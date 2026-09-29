package expo.modules.voiceduplex

import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.util.Base64
import android.util.Log
import org.json.JSONObject
import org.vosk.Recognizer
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.concurrent.thread
import kotlin.math.log10
import kotlin.math.sqrt

/**
 * Listens for the worker's answer after Monte has finished talking.
 *
 * Vosk recognizes it on the phone (the offline answer, and what decides when
 * the worker has finished), and the recorded speech is handed back as a WAV so
 * the app can have it transcribed more accurately in the cloud when online.
 *
 * Reports `onResult(text, wav)`: `wav` is null when nobody spoke before
 * `timeoutMs`.
 */
class AnswerListener(
  private val modelPath: String,
  private val grammar: String?,
  private val timeoutMs: Int,
  private val onPartial: (String) -> Unit,
  private val onResult: (text: String, wav: String?) -> Unit,
  private val onLog: (String) -> Unit,
) {
  private val running = AtomicBoolean(false)

  fun start() {
    if (!running.compareAndSet(false, true)) return
    thread(name = "answer-listener") {
      try {
        loop()
      } catch (e: Exception) {
        Log.e(TAG, "answer listener failed", e)
        onLog("listen error: ${e.message}")
        if (running.get()) onResult("", null)
      } finally {
        running.set(false)
      }
    }
  }

  /** Stop without reporting anything. */
  fun stop() {
    running.set(false)
  }

  private fun loop() {
    val min = AudioRecord.getMinBufferSize(RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT)
    val rec = AudioRecord(
      MediaRecorder.AudioSource.VOICE_RECOGNITION, RATE,
      AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, maxOf(min, FRAME * 8)
    )
    if (rec.state != AudioRecord.STATE_INITIALIZED) {
      rec.release()
      onLog("listen: mic unavailable")
      if (running.get()) onResult("", null)
      return
    }
    val model = BargeInListener.model(modelPath)
    val recognizer = if (grammar != null) Recognizer(model, RATE.toFloat(), grammar) else Recognizer(model, RATE.toFloat())
    val frames = ArrayList<ShortArray>()
    val levels = ArrayList<Double>()
    var speechAt = -1 // first frame of speech
    var lastLoud = -1
    var text = ""
    var lastPartial = ""
    val started = System.currentTimeMillis()
    rec.startRecording()
    try {
      recognizer.use { r ->
        while (running.get()) {
          val frame = ShortArray(FRAME)
          if (!BargeInListener.readFull(rec, frame)) break
          frames.add(frame)
          val db = levelDb(frame)
          levels.add(db)
          val i = frames.size - 1

          // speech = clearly above the room's own noise (learned in the first 200 ms)
          val floor = if (levels.size <= FLOOR_FRAMES) MIN_SPEECH_DB - MARGIN_DB else median(levels.subList(0, FLOOR_FRAMES))
          val loud = i >= FLOOR_FRAMES && db > maxOf(floor + MARGIN_DB, MIN_SPEECH_DB)
          if (loud) {
            lastLoud = i
            if (speechAt < 0 && recentLoud(levels, floor) >= START_NEEDED) speechAt = maxOf(0, i - START_WINDOW)
          }

          if (r.acceptWaveForm(frame, frame.size)) {
            val t = textOf(r.result)
            if (t.isNotEmpty()) {
              text = t
              if (speechAt < 0) speechAt = maxOf(0, i - 50)
              break
            }
          } else if (i % 5 == 0) {
            val p = partialOf(r.partialResult)
            if (p.isNotEmpty() && p != lastPartial) {
              lastPartial = p
              onPartial(p)
            }
          }

          val now = System.currentTimeMillis()
          if (speechAt < 0 && now - started > timeoutMs) break // nobody spoke
          if (speechAt >= 0 && i - lastLoud > END_SILENCE_FRAMES) { // finished talking
            text = textOf(r.finalResult)
            break
          }
          if (speechAt >= 0 && i - speechAt > MAX_UTTERANCE_FRAMES) {
            text = textOf(r.finalResult)
            break
          }
        }
      }
    } finally {
      try { rec.stop() } catch (e: Exception) { /* ignore */ }
      rec.release()
    }
    if (!running.get()) return
    val wav = if (speechAt >= 0) {
      val from = maxOf(0, speechAt - LEAD_FRAMES)
      wavBase64(frames.subList(from, frames.size))
    } else null
    onLog("listen: heard \"$text\"${if (wav != null) " (+audio)" else " (no speech)"}")
    onResult(text, wav)
  }

  private fun recentLoud(levels: List<Double>, floor: Double): Int {
    var n = 0
    for (k in maxOf(0, levels.size - START_WINDOW) until levels.size) {
      if (levels[k] > maxOf(floor + MARGIN_DB, MIN_SPEECH_DB)) n += 1
    }
    return n
  }

  private fun levelDb(buf: ShortArray): Double {
    var sum = 0.0
    for (s in buf) sum += s.toDouble() * s
    return 20 * log10(maxOf(sqrt(sum / buf.size), 1.0))
  }

  private fun median(xs: List<Double>): Double = xs.sorted()[xs.size / 2]

  private fun partialOf(json: String): String = try {
    JSONObject(json).optString("partial", "").replace("[unk]", "").trim()
  } catch (e: Exception) {
    ""
  }

  companion object {
    private const val TAG = "VoiceDuplex"
    const val RATE = 16000
    private const val FRAME = RATE / 50 // 20 ms
    private const val FLOOR_FRAMES = 10 // first 200 ms: the room's noise
    private const val MARGIN_DB = 12.0
    private const val MIN_SPEECH_DB = 42.0
    private const val START_WINDOW = 8 // speech starts when 5 of the last 8 frames are loud
    private const val START_NEEDED = 5
    private const val END_SILENCE_FRAMES = 50 // 1 s of quiet after speech = finished
    private const val MAX_UTTERANCE_FRAMES = 600 // 12 s
    private const val LEAD_FRAMES = 15 // keep 300 ms before speech in the audio

    fun textOf(json: String): String = try {
      JSONObject(json).optString("text", "").replace("[unk]", "").trim().replace(Regex("\\s+"), " ")
    } catch (e: Exception) {
      ""
    }

    /** 16 kHz mono 16-bit PCM → base64 WAV file. */
    fun wavBase64(frames: List<ShortArray>): String {
      val samples = frames.sumOf { it.size }
      val data = samples * 2
      val buf = ByteBuffer.allocate(44 + data).order(ByteOrder.LITTLE_ENDIAN)
      buf.put("RIFF".toByteArray()).putInt(36 + data).put("WAVE".toByteArray())
      buf.put("fmt ".toByteArray()).putInt(16).putShort(1).putShort(1)
        .putInt(RATE).putInt(RATE * 2).putShort(2).putShort(16)
      buf.put("data".toByteArray()).putInt(data)
      for (f in frames) for (s in f) buf.putShort(s)
      return Base64.encodeToString(buf.array(), Base64.NO_WRAP)
    }
  }
}

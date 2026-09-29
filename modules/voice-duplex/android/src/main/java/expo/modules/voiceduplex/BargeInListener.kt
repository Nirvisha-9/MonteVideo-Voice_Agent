package expo.modules.voiceduplex

import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.media.audiofx.AcousticEchoCanceler
import android.media.audiofx.NoiseSuppressor
import android.util.Log
import org.json.JSONObject
import org.vosk.Model
import org.vosk.Recognizer
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.concurrent.thread
import kotlin.math.log10
import kotlin.math.sqrt

/**
 * Hands-free interruption while Monte is talking.
 *
 * Records through the phone's call-audio path (VOICE_COMMUNICATION + echo
 * canceller), so Monte's own voice is mostly removed from the mic. It learns
 * how loud what's left of Monte is on this phone, and when someone speaks
 * clearly above that for a moment it reports `onSpeech` (the app stops Monte),
 * then recognizes the worker's whole sentence — including the ~1 s before the
 * trigger, kept in a buffer — and reports `onResult`.
 *
 * It does not try to understand words while Monte is talking; it only decides
 * "a person started speaking". Recognition runs after Monte has stopped, with
 * the same per-screen word list (`grammar`, JSON) as a normal answer.
 */
class BargeInListener(
  private val modelPath: String,
  private val marginDb: Double,
  private val grammar: String?,
  private val onSpeech: () -> Unit,
  private val onResult: (String) -> Unit,
  private val onLog: (String) -> Unit,
) {
  private val running = AtomicBoolean(false)

  /** True from the trigger until the worker's sentence is recognized. */
  @Volatile var recognizing = false
    private set
  private var worker: Thread? = null

  fun start() {
    if (!running.compareAndSet(false, true)) return
    worker = thread(name = "barge-in") {
      try {
        loop()
      } catch (e: Exception) {
        Log.e(TAG, "barge-in failed", e)
        onLog("barge-in error: ${e.message}")
      } finally {
        running.set(false)
      }
    }
  }

  /** Stop listening (Monte finished normally). No events after this. */
  fun stop() {
    running.set(false)
  }

  private fun loop() {
    val min = AudioRecord.getMinBufferSize(RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT)
    val rec = AudioRecord(
      MediaRecorder.AudioSource.VOICE_COMMUNICATION, RATE,
      AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, maxOf(min, FRAME * 8)
    )
    if (rec.state != AudioRecord.STATE_INITIALIZED) {
      rec.release()
      onLog("barge-in: mic unavailable")
      return
    }
    val aec = if (AcousticEchoCanceler.isAvailable()) AcousticEchoCanceler.create(rec.audioSessionId)?.apply { enabled = true } else null
    val ns = if (NoiseSuppressor.isAvailable()) NoiseSuppressor.create(rec.audioSessionId)?.apply { enabled = true } else null
    val preRoll = ShortArray(RATE * PRE_ROLL_MS / 1000)
    var preRollPos = 0
    var preRollFilled = false
    val frame = ShortArray(FRAME)
    val recent = ArrayDeque<Double>() // levels of Monte-only frames (what's left of the echo)
    val window = ArrayDeque<Boolean>() // last TRIGGER_FRAMES: above threshold?
    var frames = 0
    var triggered = false
    rec.startRecording()
    try {
      while (running.get() && !triggered) {
        if (!readFull(rec, frame)) break
        frames += 1
        for (s in frame) {
          preRoll[preRollPos] = s
          preRollPos = (preRollPos + 1) % preRoll.size
          if (preRollPos == 0) preRollFilled = true
        }
        val db = levelDb(frame)
        if (frames <= CALIBRATE_FRAMES) {
          recent.addLast(db)
          continue
        }
        val floor = percentile(recent, 80)
        val threshold = maxOf(floor + marginDb, MIN_SPEECH_DB)
        val loud = db > threshold
        window.addLast(loud)
        if (window.size > TRIGGER_FRAMES) window.removeFirst()
        if (!loud) {
          recent.addLast(db)
          if (recent.size > FLOOR_FRAMES) recent.removeFirst()
        }
        if (frames % 25 == 0) Log.d(TAG, "level ${fmt(db)} dB · floor ${fmt(floor)} · threshold ${fmt(threshold)}")
        if (window.size == TRIGGER_FRAMES && window.count { it } >= TRIGGER_NEEDED) {
          triggered = true
          onLog("barge-in: speech ${fmt(db)} dB over Monte ${fmt(floor)} dB (aec ${aec?.enabled == true})")
        }
      }
      if (!triggered || !running.get()) return
      recognizing = true
      onSpeech()
      val text = recognize(rec, frame, preRoll, preRollPos, preRollFilled)
      recognizing = false
      if (running.get()) onResult(text)
    } finally {
      recognizing = false
      try { rec.stop() } catch (e: Exception) { /* ignore */ }
      aec?.release()
      ns?.release()
      rec.release()
    }
  }

  /** Recognize the worker's sentence: the buffered start, then live audio until they stop. */
  private fun recognize(rec: AudioRecord, frame: ShortArray, preRoll: ShortArray, pos: Int, filled: Boolean): String {
    val model = model(modelPath)
    val recognizer = if (grammar != null) Recognizer(model, RATE.toFloat(), grammar) else Recognizer(model, RATE.toFloat())
    recognizer.use { r ->
      val start = if (filled) pos else 0
      val len = if (filled) preRoll.size else pos
      val ordered = ShortArray(len) { preRoll[(start + it) % preRoll.size] }
      if (r.acceptWaveForm(ordered, ordered.size)) {
        val t = textOf(r.result)
        if (t.isNotEmpty()) return t
      }
      val end = System.currentTimeMillis() + MAX_UTTERANCE_MS
      while (running.get() && System.currentTimeMillis() < end) {
        if (!readFull(rec, frame)) break
        if (r.acceptWaveForm(frame, frame.size)) {
          val t = textOf(r.result)
          if (t.isNotEmpty()) return t
        }
      }
      return textOf(r.finalResult)
    }
  }

  private fun readFull(rec: AudioRecord, buf: ShortArray): Boolean {
    var got = 0
    while (got < buf.size) {
      val n = rec.read(buf, got, buf.size - got)
      if (n <= 0) return false
      got += n
    }
    return true
  }

  private fun levelDb(buf: ShortArray): Double {
    var sum = 0.0
    for (s in buf) sum += s.toDouble() * s
    return 20 * log10(maxOf(sqrt(sum / buf.size), 1.0))
  }

  private fun percentile(xs: Collection<Double>, p: Int): Double {
    if (xs.isEmpty()) return MIN_SPEECH_DB
    val s = xs.sorted()
    return s[((s.size - 1) * p / 100.0).toInt()]
  }

  // "[unk]" = something outside the word list; the app treats that as no answer
  private fun textOf(json: String): String = try {
    JSONObject(json).optString("text", "").replace("[unk]", "").trim().replace(Regex("\\s+"), " ")
  } catch (e: Exception) {
    ""
  }

  private fun fmt(x: Double) = String.format("%.1f", x)

  companion object {
    private const val TAG = "VoiceDuplex"
    private const val RATE = 16000
    private const val FRAME = RATE / 50 // 20 ms
    private const val PRE_ROLL_MS = 1200 // audio kept from before the trigger
    private const val CALIBRATE_FRAMES = 20 // first 400 ms: learn Monte's level
    private const val FLOOR_FRAMES = 75 // floor tracks the last 1.5 s of Monte-only audio
    private const val TRIGGER_FRAMES = 15 // look at the last 300 ms…
    private const val TRIGGER_NEEDED = 11 // …and need ~220 ms of it clearly above Monte
    private const val MIN_SPEECH_DB = 45.0 // never trigger on near-silence
    private const val MAX_UTTERANCE_MS = 8000L

    private var cachedModel: Model? = null
    private var cachedPath: String? = null

    @Synchronized
    private fun model(path: String): Model {
      if (cachedPath != path || cachedModel == null) {
        cachedModel?.close()
        cachedModel = Model(path)
        cachedPath = path
      }
      return cachedModel!!
    }

    /** Load the model ahead of time so the first interruption isn't slow. */
    fun preload(path: String) {
      thread(name = "barge-in-model") {
        try { model(path) } catch (e: Exception) { Log.w(TAG, "model preload failed", e) }
      }
    }
  }
}

package expo.modules.voiceduplex

import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.media.audiofx.AcousticEchoCanceler
import android.media.audiofx.NoiseSuppressor
import android.util.Log
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import okio.ByteString.Companion.toByteString
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.concurrent.thread
import kotlin.math.log10
import kotlin.math.sqrt

/**
 * One microphone session for the whole collection: the mic stays open and its
 * audio is streamed live to a speech-to-text WebSocket (Deepgram), whose
 * messages are handed to the app as they arrive (`onMessage`, raw JSON).
 *
 * The mic records through the call-audio path (VOICE_COMMUNICATION + echo
 * canceller) and Monte speaks on that path too (see CallSpeaker), so most of
 * Monte's voice is removed from the mic. What's left would still be
 * transcribed as if the worker said it, so while Monte talks nothing is sent:
 *
 *   OPEN      the worker's turn — every frame is streamed
 *   PENDING   Monte is about to speak — nothing is sent
 *   SPEAKING  Monte is talking — nothing is sent; if the worker talks clearly
 *             over Monte (same test as BargeInListener) `onBargeIn` fires, the
 *             last ~1 s is sent so their first words aren't lost, and it's OPEN
 *   HANGOVER  Monte just stopped — a moment for the room to go quiet, then OPEN
 */
class StreamSession(
  private val url: String,
  private val authorization: String,
  private val marginDb: Double,
  private val onState: (state: String, reason: String?) -> Unit,
  private val onMessage: (String) -> Unit,
  private val onBargeIn: () -> Unit,
  private val onLog: (String) -> Unit,
) {
  private enum class Gate { OPEN, PENDING, SPEAKING, HANGOVER }

  private val running = AtomicBoolean(false)
  private var socket: WebSocket? = null
  private var client: OkHttpClient? = null

  @Volatile private var gate = Gate.OPEN
  @Volatile private var lineId = 0 // Monte's line that closed the gate
  @Volatile private var bargeIn = false
  @Volatile private var speakingFrames = 0
  @Volatile private var hangoverFrames = 0

  fun start() {
    if (!running.compareAndSet(false, true)) return
    val http = OkHttpClient.Builder()
      .connectTimeout(8, TimeUnit.SECONDS)
      .readTimeout(0, TimeUnit.MILLISECONDS)
      .build()
    client = http
    val request = Request.Builder().url(url).header("Authorization", authorization).build()
    socket = http.newWebSocket(request, object : WebSocketListener() {
      override fun onOpen(webSocket: WebSocket, response: Response) {
        if (!running.get()) return
        onState("open", null)
        thread(name = "stream-mic") {
          try {
            micLoop(webSocket)
          } catch (e: Exception) {
            Log.e(TAG, "stream mic failed", e)
            fail("mic: ${e.message}")
          }
        }
      }

      override fun onMessage(webSocket: WebSocket, text: String) {
        if (running.get()) onMessage(text)
      }

      override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
        webSocket.close(1000, null)
      }

      override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
        if (running.compareAndSet(true, false)) onState("closed", "$code $reason".trim())
        release()
      }

      override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
        // Deepgram explains a refused connection in this header
        val why = response?.header("dg-error") ?: response?.let { "HTTP ${it.code}" } ?: (t.message ?: t.toString())
        fail(why)
      }
    })
  }

  /** End the session. No events after this. */
  fun stop() {
    if (!running.compareAndSet(true, false)) return
    try { socket?.send("{\"type\":\"CloseStream\"}") } catch (e: Exception) { /* ignore */ }
    try { socket?.close(1000, null) } catch (e: Exception) { /* ignore */ }
    release()
  }

  /** Monte is about to say line `id`: stop streaming until it's over. */
  fun speakBegin(id: Int, allowBargeIn: Boolean) {
    lineId = id
    bargeIn = allowBargeIn
    gate = Gate.PENDING
    // have what the worker said so far transcribed now rather than after Monte
    try { socket?.send("{\"type\":\"Finalize\"}") } catch (e: Exception) { /* ignore */ }
  }

  /** Line `id` is actually audible now. */
  fun speakStarted(id: Int) {
    if (id != lineId || gate != Gate.PENDING) return
    speakingFrames = 0
    gate = Gate.SPEAKING
  }

  /** Line `id` finished or was stopped (`id` 0 = whichever line it is). */
  fun speakEnded(id: Int) {
    if (id != 0 && id != lineId) return
    if (gate != Gate.PENDING && gate != Gate.SPEAKING) return
    hangoverFrames = HANGOVER_FRAMES
    gate = Gate.HANGOVER
  }

  private fun fail(reason: String) {
    if (running.compareAndSet(true, false)) onState("error", reason)
    try { socket?.cancel() } catch (e: Exception) { /* ignore */ }
    release()
  }

  private fun release() {
    client?.dispatcher?.executorService?.shutdown()
    client = null
  }

  private fun micLoop(ws: WebSocket) {
    val min = AudioRecord.getMinBufferSize(RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT)
    val rec = AudioRecord(
      MediaRecorder.AudioSource.VOICE_COMMUNICATION, RATE,
      AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, maxOf(min, FRAME * 8)
    )
    if (rec.state != AudioRecord.STATE_INITIALIZED) {
      rec.release()
      fail("mic unavailable")
      return
    }
    val aec = if (AcousticEchoCanceler.isAvailable()) AcousticEchoCanceler.create(rec.audioSessionId)?.apply { enabled = true } else null
    val ns = if (NoiseSuppressor.isAvailable()) NoiseSuppressor.create(rec.audioSessionId)?.apply { enabled = true } else null
    onLog("live mic open (aec ${aec?.enabled == true})")

    val frame = ShortArray(FRAME)
    val bytes = ByteBuffer.allocate(FRAME * 2).order(ByteOrder.LITTLE_ENDIAN)
    val preRoll = ShortArray(RATE * PRE_ROLL_MS / 1000)
    var preRollPos = 0
    var preRollFilled = false
    val recent = ArrayDeque<Double>() // levels of Monte-only frames (what's left of the echo)
    val window = ArrayDeque<Boolean>() // last TRIGGER_FRAMES: above threshold?
    var lastGate = Gate.OPEN
    var lastSent = System.currentTimeMillis()

    fun send(buf: ShortArray, len: Int = buf.size) {
      val out = if (len == FRAME) bytes else ByteBuffer.allocate(len * 2).order(ByteOrder.LITTLE_ENDIAN)
      out.clear()
      for (i in 0 until len) out.putShort(buf[i])
      out.flip()
      ws.send(out.toByteString())
      lastSent = System.currentTimeMillis()
    }

    rec.startRecording()
    try {
      while (running.get()) {
        if (!BargeInListener.readFull(rec, frame)) {
          fail("mic stopped")
          break
        }
        val g = gate
        if (g != lastGate) {
          if (g == Gate.SPEAKING || g == Gate.PENDING) {
            recent.clear()
            window.clear()
            preRollPos = 0
            preRollFilled = false
          }
          lastGate = g
        }
        when (g) {
          Gate.OPEN -> send(frame)
          Gate.PENDING -> Unit
          Gate.HANGOVER -> {
            hangoverFrames -= 1
            if (hangoverFrames <= 0 && gate == Gate.HANGOVER) gate = Gate.OPEN
          }
          Gate.SPEAKING -> {
            for (s in frame) {
              preRoll[preRollPos] = s
              preRollPos = (preRollPos + 1) % preRoll.size
              if (preRollPos == 0) preRollFilled = true
            }
            if (bargeIn) {
              speakingFrames += 1
              val db = levelDb(frame)
              if (speakingFrames <= CALIBRATE_FRAMES) {
                recent.addLast(db)
              } else {
                val threshold = maxOf(percentile(recent, 80) + marginDb, MIN_SPEECH_DB)
                val loud = db > threshold
                window.addLast(loud)
                if (window.size > TRIGGER_FRAMES) window.removeFirst()
                if (!loud) {
                  recent.addLast(db)
                  if (recent.size > FLOOR_FRAMES) recent.removeFirst()
                }
                if (window.size == TRIGGER_FRAMES && window.count { it } >= TRIGGER_NEEDED && gate == Gate.SPEAKING) {
                  onLog("barge-in: speech ${fmt(db)} dB over Monte ${fmt(threshold - marginDb)} dB")
                  gate = Gate.OPEN
                  lastGate = Gate.OPEN
                  onBargeIn()
                  // their first words, from before the trigger
                  val start = if (preRollFilled) preRollPos else 0
                  val len = if (preRollFilled) preRoll.size else preRollPos
                  send(ShortArray(len) { preRoll[(start + it) % preRoll.size] }, len)
                }
              }
            }
          }
        }
        // nothing streamed for a while (Monte's turn): keep the connection up
        if (System.currentTimeMillis() - lastSent > KEEP_ALIVE_MS) {
          ws.send("{\"type\":\"KeepAlive\"}")
          lastSent = System.currentTimeMillis()
        }
      }
    } finally {
      try { rec.stop() } catch (e: Exception) { /* ignore */ }
      aec?.release()
      ns?.release()
      rec.release()
    }
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

  private fun fmt(x: Double) = String.format("%.1f", x)

  companion object {
    private const val TAG = "VoiceDuplex"
    private const val RATE = 16000
    private const val FRAME = RATE / 50 // 20 ms
    private const val KEEP_ALIVE_MS = 4000L
    private const val HANGOVER_FRAMES = 10 // 200 ms after Monte stops
    // barge-in test — same numbers as BargeInListener
    private const val PRE_ROLL_MS = 1200
    private const val CALIBRATE_FRAMES = 20
    private const val FLOOR_FRAMES = 75
    private const val TRIGGER_FRAMES = 15
    private const val TRIGGER_NEEDED = 11
    private const val MIN_SPEECH_DB = 45.0
  }
}

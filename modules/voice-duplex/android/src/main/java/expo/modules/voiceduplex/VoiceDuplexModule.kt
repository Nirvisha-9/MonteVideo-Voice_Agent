package expo.modules.voiceduplex

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioDeviceInfo
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioRecord
import android.media.MediaRecorder
import android.media.audiofx.AcousticEchoCanceler
import android.media.audiofx.NoiseSuppressor
import android.os.Build
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.util.Log
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.Locale
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.concurrent.thread
import kotlin.math.log10
import kotlin.math.sqrt

/**
 * Echo test: can this phone take Monte's own voice out of the microphone?
 *
 * Plays a Monte line and measures the mic level in three setups:
 *   A  current app — VOICE_RECOGNITION mic, TTS as media (no echo cancelling)
 *   B  VOICE_COMMUNICATION mic + echo canceller, TTS as media
 *   C  VOICE_COMMUNICATION mic + echo canceller, TTS on the call path (speaker)
 * each while the worker stays quiet and while they talk over Monte.
 */
class VoiceDuplexModule : Module() {
  private val sampleRate = 16000
  private val frame = sampleRate / 10 // 100 ms

  override fun definition() = ModuleDefinition {
    Name("VoiceDuplex")
    Events(
      "onEchoTestStatus", "onBargeInSpeech", "onBargeInResult", "onBargeInLog",
      "onCallSpeechStart", "onCallSpeechDone",
    )

    // Monte's voice on the call path, so the echo canceller can remove it — see CallSpeaker.
    Function("speakOnCall") { text: String, lang: String, id: Int ->
      callSpeaker.speak(text, lang, id)
    }

    Function("stopSpeakingOnCall") {
      // keep call audio if a barge-in is still recording the worker's sentence
      speaker?.stop(holdMode = bargeIn?.recognizing == true)
    }

    OnDestroy {
      bargeIn?.stop()
      speaker?.shutdown()
    }

    // Hands-free interruption while Monte talks — see BargeInListener.
    Function("preloadBargeIn") { modelName: String ->
      BargeInListener.preload(modelDir(modelName))
    }

    Function("startBargeIn") { modelName: String, marginDb: Double, grammar: String? ->
      bargeIn?.stop()
      val id = ++bargeInId
      bargeIn = BargeInListener(
        modelDir(modelName),
        marginDb,
        grammar,
        onSpeech = {
          // Stop Monte right here rather than after a round trip through JS —
          // until Monte stops, the echo canceller squashes the worker's first
          // words. Stay in call audio while their sentence is recorded.
          speaker?.stop(holdMode = true)
          sendEvent("onBargeInSpeech", mapOf("id" to id))
        },
        onResult = { text ->
          Log.i(TAG, "barge-in heard: \"$text\"")
          speaker?.releaseMode()
          sendEvent("onBargeInResult", mapOf("id" to id, "text" to text))
        },
        onLog = { line -> Log.i(TAG, line); sendEvent("onBargeInLog", mapOf("text" to line)) },
      ).also { it.start() }
      id
    }

    Function("stopBargeIn") {
      bargeIn?.stop()
      bargeIn = null
      speaker?.releaseMode()
    }

    AsyncFunction("runEchoTest") { lang: String, promise: Promise ->
      thread(name = "echo-test") {
        try {
          promise.resolve(runTest(lang))
        } catch (e: Exception) {
          Log.e(TAG, "echo test failed", e)
          promise.reject("ERR_ECHO_TEST", e.message ?: e.toString(), e)
        }
      }
    }
  }

  private val context: Context
    get() = appContext.reactContext ?: throw IllegalStateException("no context")

  private var bargeIn: BargeInListener? = null

  private var speaker: CallSpeaker? = null
  private val callSpeaker: CallSpeaker
    get() = speaker ?: CallSpeaker(
      context,
      onStart = { id -> sendEvent("onCallSpeechStart", mapOf("id" to id)) },
      onDone = { id, stopped -> sendEvent("onCallSpeechDone", mapOf("id" to id, "stopped" to stopped)) },
    ).also { speaker = it }
  private var bargeInId = 0

  // react-native-vosk unpacks bundled models to <external files>/models/<name>
  private fun modelDir(name: String): String =
    java.io.File(context.getExternalFilesDir(null), "models/$name").absolutePath

  private fun status(text: String) {
    Log.i(TAG, text)
    sendEvent("onEchoTestStatus", mapOf("text" to text))
  }

  private data class Setup(val key: String, val source: Int, val aec: Boolean, val callTts: Boolean)

  private fun runTest(lang: String): Map<String, Any> {
    val es = lang == "es"
    val line = if (es)
      "¿Para qué cliente es esta recolección? Di el número, o el nombre del cliente. También puedes decir lee las opciones."
    else
      "Which client is this collection for? Say the number, or the client name. You can also say read out the options."
    val tts = newTts(if (es) Locale("es", "ES") else Locale.US)
    val am = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    val setups = listOf(
      Setup("A", MediaRecorder.AudioSource.VOICE_RECOGNITION, aec = false, callTts = false),
      Setup("B", MediaRecorder.AudioSource.VOICE_COMMUNICATION, aec = true, callTts = false),
      Setup("C", MediaRecorder.AudioSource.VOICE_COMMUNICATION, aec = true, callTts = true),
    )
    val out = mutableMapOf<String, Any>(
      "aecAvailable" to AcousticEchoCanceler.isAvailable(),
      "device" to "${Build.MANUFACTURER} ${Build.MODEL} (Android ${Build.VERSION.RELEASE})",
    )
    try {
      for (s in setups) {
        status("Setup ${s.key}: stay quiet…")
        if (s.aec) {
          am.mode = AudioManager.MODE_IN_COMMUNICATION
          routeToSpeaker(am)
        }
        tts.setAudioAttributes(
          AudioAttributes.Builder()
            .setUsage(if (s.callTts) AudioAttributes.USAGE_VOICE_COMMUNICATION else AudioAttributes.USAGE_MEDIA)
            .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
            .build()
        )
        val rec = openRecorder(s.source)
        val aec = if (s.aec && AcousticEchoCanceler.isAvailable()) AcousticEchoCanceler.create(rec.audioSessionId)?.apply { enabled = true } else null
        val ns = if (s.aec && NoiseSuppressor.isAvailable()) NoiseSuppressor.create(rec.audioSessionId)?.apply { enabled = true } else null
        rec.startRecording()
        try {
          val quiet = measure(rec, 1500) { false }
          status("Setup ${s.key}: Monte is talking — STAY QUIET")
          val echo = measureWhileSpeaking(rec, tts, line)
          Thread.sleep(600)
          status("Setup ${s.key}: TALK OVER MONTE NOW — count one, two, three…")
          Thread.sleep(700)
          val talk = measureWhileSpeaking(rec, tts, line)
          out[s.key] = mapOf(
            "aecOn" to (aec?.enabled == true),
            "quiet" to pct(quiet, 50),
            "echo" to pct(echo, 90),
            "talk" to pct(talk, 50),
          )
          Log.i(TAG, "setup ${s.key}: ${out[s.key]}")
        } finally {
          rec.stop()
          aec?.release()
          ns?.release()
          rec.release()
          if (s.aec) {
            clearRoute(am)
            am.mode = AudioManager.MODE_NORMAL
          }
        }
        Thread.sleep(800)
      }
    } finally {
      tts.shutdown()
      am.mode = AudioManager.MODE_NORMAL
    }
    status("Done")
    return out
  }

  private fun openRecorder(source: Int): AudioRecord {
    val min = AudioRecord.getMinBufferSize(sampleRate, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT)
    val rec = AudioRecord(source, sampleRate, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, maxOf(min, frame * 4))
    check(rec.state == AudioRecord.STATE_INITIALIZED) { "recorder didn't start (source $source)" }
    return rec
  }

  /** dB level of each 100 ms frame for `ms`, or until `stop()` says so. */
  private fun measure(rec: AudioRecord, ms: Int, stop: () -> Boolean): List<Double> {
    val buf = ShortArray(frame)
    val levels = mutableListOf<Double>()
    val end = System.currentTimeMillis() + ms
    while (System.currentTimeMillis() < end && !stop()) {
      var got = 0
      while (got < frame) {
        val n = rec.read(buf, got, frame - got)
        if (n <= 0) break
        got += n
      }
      if (got == 0) continue
      var sum = 0.0
      for (i in 0 until got) sum += buf[i].toDouble() * buf[i]
      val rms = sqrt(sum / got)
      levels.add(20 * log10(maxOf(rms, 1.0)))
    }
    return levels
  }

  private fun measureWhileSpeaking(rec: AudioRecord, tts: TextToSpeech, line: String): List<Double> {
    val started = CountDownLatch(1)
    val done = AtomicBoolean(false)
    tts.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
      override fun onStart(id: String?) = started.countDown()
      override fun onDone(id: String?) = done.set(true)
      @Deprecated("") override fun onError(id: String?) { done.set(true); started.countDown() }
    })
    tts.speak(line, TextToSpeech.QUEUE_FLUSH, null, "echo-test")
    started.await(3, TimeUnit.SECONDS)
    return measure(rec, 12000) { done.get() }
  }

  private fun newTts(locale: Locale): TextToSpeech {
    val ready = CountDownLatch(1)
    var ok = false
    lateinit var tts: TextToSpeech
    tts = TextToSpeech(context) { st ->
      ok = st == TextToSpeech.SUCCESS
      ready.countDown()
    }
    ready.await(5, TimeUnit.SECONDS)
    check(ok) { "text-to-speech didn't start" }
    tts.language = locale
    return tts
  }

  @Suppress("DEPRECATION")
  private fun routeToSpeaker(am: AudioManager) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      am.availableCommunicationDevices
        .firstOrNull { it.type == AudioDeviceInfo.TYPE_BUILTIN_SPEAKER }
        ?.let { am.setCommunicationDevice(it) }
    } else {
      am.isSpeakerphoneOn = true
    }
  }

  @Suppress("DEPRECATION")
  private fun clearRoute(am: AudioManager) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) am.clearCommunicationDevice() else am.isSpeakerphoneOn = false
  }

  private fun pct(xs: List<Double>, p: Int): Double {
    if (xs.isEmpty()) return 0.0
    val s = xs.sorted()
    return Math.round(s[((s.size - 1) * p / 100.0).toInt()] * 10) / 10.0
  }

  companion object {
    private const val TAG = "VoiceDuplex"
  }
}

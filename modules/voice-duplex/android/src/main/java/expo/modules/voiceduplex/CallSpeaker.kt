package expo.modules.voiceduplex

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioDeviceInfo
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioTrack
import android.os.Build
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.util.Log
import okhttp3.Call
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.Locale
import java.util.concurrent.TimeUnit
import kotlin.concurrent.thread

/**
 * Monte's voice on the phone's call-audio path (loudspeaker), used while
 * barge-in is listening.
 *
 * The echo canceller only removes sound the phone knows it is playing on the
 * call path. Played as ordinary media, Monte reaches the mic about as loud as
 * the worker (measured ~75 dB on a Galaxy S24), so an interruption can't be told
 * apart from Monte. Speaking "as a call" lets the canceller take Monte out.
 *
 * Monte's voice is either the phone's text-to-speech or, with [speakCloud], a
 * cloud voice (Deepgram Aura) streamed and played as it arrives — on the same
 * call path, with the same start / progress / done events.
 */
class CallSpeaker(
  private val context: Context,
  private val onStart: (Int) -> Unit,
  private val onRange: (id: Int, start: Int) -> Unit,
  private val onDone: (id: Int, stopped: Boolean) -> Unit,
) {
  private val am = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
  private var tts: TextToSpeech? = null
  private var ready = false
  private var pending: (() -> Unit)? = null
  @Volatile private var current = 0 // utterance that owns the call-audio mode (0 = none)
  private var callMode = false
  @Volatile private var held = false

  fun speak(text: String, lang: String, id: Int) {
    stopCloud()
    val go = {
      val t = tts!!
      t.language = Locale.forLanguageTag(lang)
      t.setAudioAttributes(
        AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
          .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
          .build()
      )
      current = id
      enterCallMode()
      if (t.speak(text, TextToSpeech.QUEUE_FLUSH, null, id.toString()) != TextToSpeech.SUCCESS) {
        finished(id, stopped = false)
      }
    }
    if (tts == null) {
      pending = go
      tts = TextToSpeech(context) { st ->
        ready = st == TextToSpeech.SUCCESS
        if (!ready) {
          Log.w(TAG, "call TTS didn't start")
          pending = null
          onDone(id, false)
          tts = null
          return@TextToSpeech
        }
        tts?.setOnUtteranceProgressListener(listener)
        pending?.invoke()
        pending = null
      }
    } else if (!ready) {
      pending = go
    } else {
      go()
    }
  }

  /**
   * Stop Monte. `holdMode` keeps the call-audio mode on (the worker is still
   * talking and switching audio mode mid-recording glitches the mic) until
   * [releaseMode].
   */
  fun stop(holdMode: Boolean = false) {
    pending = null
    current = 0
    try { tts?.stop() } catch (e: Exception) { /* ignore */ }
    stopCloud()
    if (!holdMode) leaveCallMode()
  }

  // ---------------------------------------------------------------- cloud voice

  private val http by lazy {
    OkHttpClient.Builder()
      .connectTimeout(4, TimeUnit.SECONDS)
      .readTimeout(8, TimeUnit.SECONDS)
      .build()
  }
  @Volatile private var cloudCall: Call? = null
  @Volatile private var cloudTrack: AudioTrack? = null

  /**
   * Say `text` with a cloud voice: POST it to `url` (a Deepgram /v1/speak URL
   * asking for raw 16-bit mono PCM at `sampleRate`) and play the audio while it
   * downloads. If the voice can't be reached before any audio plays, the line
   * is said by the phone's text-to-speech in `lang` instead.
   */
  fun speakCloud(text: String, url: String, authorization: String, sampleRate: Int, lang: String, id: Int) {
    stopCloud()
    try { tts?.stop() } catch (e: Exception) { /* ignore */ }
    current = id
    enterCallMode()
    thread(name = "cloud-voice") { playCloud(text, url, authorization, sampleRate, lang, id) }
  }

  private fun stopCloud() {
    try { cloudCall?.cancel() } catch (e: Exception) { /* ignore */ }
    cloudCall = null
    cloudTrack?.let { t ->
      try { t.pause(); t.flush() } catch (e: Exception) { /* ignore */ }
    }
  }

  private fun playCloud(text: String, url: String, authorization: String, sampleRate: Int, lang: String, id: Int) {
    var started = false
    var track: AudioTrack? = null
    try {
      val body = JSONObject().put("text", text).toString().toRequestBody("application/json".toMediaType())
      val call = http.newCall(
        Request.Builder().url(url).header("Authorization", authorization).post(body).build()
      )
      cloudCall = call
      call.execute().use { res ->
        if (!res.isSuccessful) throw IllegalStateException("HTTP ${res.code} ${res.header("dg-error") ?: ""}")
        val min = AudioTrack.getMinBufferSize(sampleRate, AudioFormat.CHANNEL_OUT_MONO, AudioFormat.ENCODING_PCM_16BIT)
        track = AudioTrack.Builder()
          .setAudioAttributes(
            AudioAttributes.Builder()
              .setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
              .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
              .build()
          )
          .setAudioFormat(
            AudioFormat.Builder()
              .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
              .setSampleRate(sampleRate)
              .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
              .build()
          )
          .setTransferMode(AudioTrack.MODE_STREAM)
          .setBufferSizeInBytes(min * 4)
          .build()
        val t = track!!
        cloudTrack = t
        val src = res.body!!.byteStream()
        val buf = ByteArray(4096)
        var carry = -1 // a byte left over from an odd-sized read
        var frames = 0L
        while (id == current) {
          var n = src.read(buf, if (carry >= 0) 1 else 0, buf.size - 1)
          if (n < 0) break
          if (carry >= 0) { buf[0] = carry.toByte(); n += 1; carry = -1 }
          if (n % 2 == 1) { carry = buf[n - 1].toInt() and 0xff; n -= 1 }
          if (n == 0) continue
          if (!started) {
            t.play()
            started = true
            onStart(id)
          }
          t.write(buf, 0, n)
          frames += n / 2
        }
        // let what's queued play out, reporting roughly where in the text Monte is
        val total = frames.coerceAtLeast(1)
        while (id == current && started) {
          val head = t.playbackHeadPosition.toLong() and 0xffffffffL
          onRange(id, ((head * text.length) / total).toInt().coerceIn(0, text.length))
          if (head >= frames) break
          Thread.sleep(40)
        }
      }
    } catch (e: Exception) {
      if (!started && id == current) {
        Log.w(TAG, "cloud voice failed, using the phone's voice: ${e.message}")
        track?.release()
        cloudTrack = null
        cloudCall = null
        speak(text, lang, id) // same line, same id: the app sees one line
        return
      }
      if (id == current) Log.w(TAG, "cloud voice cut off: ${e.message}")
    }
    track?.let { t ->
      try { t.stop() } catch (e: Exception) { /* ignore */ }
      t.release()
    }
    if (cloudTrack === track) cloudTrack = null
    cloudCall = null
    finished(id, stopped = id != current)
  }

  fun releaseMode() {
    if (current == 0) leaveCallMode()
  }

  /**
   * Keep the call-audio mode on between Monte's lines — for a live mic session
   * (StreamSession), whose recorder would glitch on every mode switch.
   */
  fun hold(on: Boolean) {
    held = on
    if (on) enterCallMode() else if (current == 0) leaveCallMode()
  }

  fun shutdown() {
    held = false
    stop()
    tts?.shutdown()
    tts = null
    ready = false
  }

  private val listener = object : UtteranceProgressListener() {
    override fun onStart(utteranceId: String?) {
      utteranceId?.toIntOrNull()?.let(onStart)
    }

    // where in the text Monte is (e.g. which list item is being read)
    override fun onRangeStart(utteranceId: String?, start: Int, end: Int, frame: Int) {
      utteranceId?.toIntOrNull()?.let { onRange(it, start) }
    }

    override fun onDone(utteranceId: String?) {
      utteranceId?.toIntOrNull()?.let { finished(it, stopped = false) }
    }

    override fun onStop(utteranceId: String?, interrupted: Boolean) {
      utteranceId?.toIntOrNull()?.let { finished(it, stopped = true) }
    }

    @Deprecated("")
    override fun onError(utteranceId: String?) {
      utteranceId?.toIntOrNull()?.let { finished(it, stopped = false) }
    }
  }

  private fun finished(id: Int, stopped: Boolean) {
    // a replaced line's stop must not end the newer line's call mode
    if (id == current) {
      current = 0
      leaveCallMode()
    }
    onDone(id, stopped)
  }

  @Suppress("DEPRECATION")
  @Synchronized
  private fun enterCallMode() {
    if (callMode) return
    callMode = true
    am.mode = AudioManager.MODE_IN_COMMUNICATION
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      am.availableCommunicationDevices
        .firstOrNull { it.type == AudioDeviceInfo.TYPE_BUILTIN_SPEAKER }
        ?.let { am.setCommunicationDevice(it) }
    } else {
      am.isSpeakerphoneOn = true
    }
  }

  @Suppress("DEPRECATION")
  @Synchronized
  private fun leaveCallMode() {
    if (!callMode || held) return
    callMode = false
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) am.clearCommunicationDevice() else am.isSpeakerphoneOn = false
    am.mode = AudioManager.MODE_NORMAL
  }

  companion object {
    private const val TAG = "VoiceDuplex"
  }
}

package expo.modules.voiceduplex

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.os.Build
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.util.Log
import java.util.Locale

/**
 * Monte's voice on the phone's call-audio path (loudspeaker), used while
 * barge-in is listening.
 *
 * The echo canceller only removes sound the phone knows it is playing on the
 * call path. Played as ordinary media, Monte reaches the mic about as loud as
 * the worker (measured ~75 dB on a Galaxy S24), so an interruption can't be told
 * apart from Monte. Speaking "as a call" lets the canceller take Monte out.
 */
class CallSpeaker(
  private val context: Context,
  private val onStart: (Int) -> Unit,
  private val onDone: (id: Int, stopped: Boolean) -> Unit,
) {
  private val am = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
  private var tts: TextToSpeech? = null
  private var ready = false
  private var pending: (() -> Unit)? = null
  @Volatile private var current = 0 // utterance that owns the call-audio mode (0 = none)
  private var callMode = false

  fun speak(text: String, lang: String, id: Int) {
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
    if (!holdMode) leaveCallMode()
  }

  fun releaseMode() {
    if (current == 0) leaveCallMode()
  }

  fun shutdown() {
    stop()
    tts?.shutdown()
    tts = null
    ready = false
  }

  private val listener = object : UtteranceProgressListener() {
    override fun onStart(utteranceId: String?) {
      utteranceId?.toIntOrNull()?.let(onStart)
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
    if (!callMode) return
    callMode = false
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) am.clearCommunicationDevice() else am.isSpeakerphoneOn = false
    am.mode = AudioManager.MODE_NORMAL
  }

  companion object {
    private const val TAG = "VoiceDuplex"
  }
}

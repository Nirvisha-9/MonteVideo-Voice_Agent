# Voice Agent — Architecture

Handoff for an engineer or coding agent picking up this codebase. It describes
the code as of 2026-10-16, including uncommitted work (see §12). When this file
and the code disagree, trust the code. `docs/VOICE_AGENT.md` is older: it still
lists Jev, the date step and corrections as "not built".

## 1. What this is

OSV RECICLAR is an Expo / React Native app (Android first) for the waste-sorting
organization Obra Padre Cacho in Montevideo. Inside its **Clasificar** (classify)
feature there are two modes:

- **Manual**: the original tap-through screens (`screens/Classify.js`). Left
  unchanged.
- **Voice Agent**: a hands-free conversation with an agent called **Monte**, in
  English or Spanish. Workers wear gloves, have their hands full, and read the
  screen from a few feet away. Everything in this document is about this mode.

Stack: Expo SDK 54, React Native 0.81.5 (new architecture, Hermes), Firebase
(Firestore for data, Cloud Functions for server-side AI calls), a custom Kotlin
Expo module `modules/voice-duplex`, Deepgram (speech-to-text and text-to-speech),
TypeSafe Jev (option scoring), Anthropic Claude (intent and corrections), Vosk
(offline speech-to-text).

## 2. File map

| Path | Role |
|---|---|
| `screens/ClassifyEntry.js` | Entry point. Mode chooser → language chooser → `VoiceAgentFlow`. |
| `components/voice/ClassifyModeSelect.js` | Manual / Voice Agent screen. Starts the client-list prefetch. |
| `components/voice/VoiceLangSelect.js` | English / Español screen. Also starts the prefetch. |
| `components/voice/VoiceAgentFlow.js` | **The conversation**: phases, state, utterance pipeline, UI. About 1,600 lines. |
| `components/voice/useSpeech.js` | **Voice engine hook**: live Deepgram session, Vosk fallback, Monte's voice, barge-in, listen/speak API. |
| `components/voice/deepgramStream.js` | Deepgram live URL + keyterms, authorization, cloud-voice config (`CLOUD_VOICE`), transcript cleanup. |
| `components/voice/llmInterpreter.js` | Client calls to the Cloud Functions (`interpret`, `revise`, `choose`, `transcribe`, `deepgramToken`), with timeouts and backoff. |
| `components/voice/jevDirect.js` | Calls Jev directly from the app when `EXPO_PUBLIC_TYPESAFE_API_KEY` is set (standalone builds). |
| `components/voice/voiceClients.js` | Client-list prefetch cache (60 s freshness). |
| `components/voice/voiceParser.js` | On-device parsing: `normalize`, `parseNumber`, `isAffirmative`, `isNegative`, `wantsGoBack`, `wantsReadOut`, `matchOption`, `parseSummaryCommand`. |
| `components/voice/voiceCatalog.js` | Categories and sub-categories (English/Spanish), `AGENT_NAME = 'Monte'`. |
| `components/voice/voiceStrings.js` | Every user-facing string, `en` and `es`. Keep the two in sync. |
| `components/voice/voiceGrammar.js` | Vosk grammars. Free-form everywhere except the wake word (`FREEFORM_EXCEPT_WAKE`). |
| `components/voice/voiceStyles.js` | Styles and palette `VC`. |
| `components/voice/VoiceTest.js` | "Mic test" diagnostics screen. |
| `modules/voice-duplex/android/.../VoiceDuplexModule.kt` | Native module surface (see §7). |
| `.../StreamSession.kt` | Mic → Deepgram WebSocket, gate state machine, barge-in detector. |
| `.../CallSpeaker.kt` | Monte's voice on the call-audio path: phone TTS or Deepgram Aura cloud voice. |
| `.../AnswerListener.kt`, `BargeInListener.kt` | Offline (Vosk) answer listener and barge-in listener. |
| `functions/index.js` | Cloud Functions: `interpret`, `revise`, `transcribe`, `deepgramToken`, `choose`. |
| `services/clientService.js`, `services/collectionsService.js` | Firestore reads: clients; collections by client. |

## 3. Runtime topology

```
                         ┌──────────────── phone (Android) ────────────────┐
                         │  VoiceAgentFlow (React)                         │
  worker ── mic ────────►│    └─ useSpeech ── VoiceDuplex (Kotlin)          │
          ◄─ speaker ────│                     ├─ StreamSession ──WSS──────┼──► Deepgram STT (nova-3, live)
                         │                     ├─ CallSpeaker ──HTTPS──────┼──► Deepgram TTS (Aura-2, es only)
                         │                     └─ Vosk (offline fallback)  │
                         │  jevDirect ──HTTPS──────────────────────────────┼──► TypeSafe Jev (if key in build)
                         │  Firebase SDK ──────────────────────────────────┼──► Firestore (clients, collections)
                         │  llmInterpreter ──callable──┐                   │
                         └─────────────────────────────┼───────────────────┘
                                                       ▼
                               Cloud Functions (today: LOCAL EMULATOR on the dev Mac,
                               reached over USB via `adb reverse tcp:5001`)
                                 ├─ interpret / revise ──► Anthropic Claude
                                 ├─ choose ──────────────► TypeSafe Jev
                                 ├─ transcribe ──────────► Deepgram STT (pre-recorded)
                                 └─ deepgramToken ───────► Deepgram auth/grant
```

The functions are **not deployed**. They run only in the Firebase emulator on
the developer's Mac. Away from that Mac, every function call fails quickly and
the app falls back (§6). A standalone build keeps Jev working by calling it
directly (`jevDirect.js`).

## 4. Conversation flow (phases)

`phase` state in `VoiceAgentFlow`:

```
loadingctx ─► client ─► location ─► date ─► addbags ─► category ─► subcategory ─► weight ─► summary ─► done
                                       │                     │                       ▲            │
                                       │                     └─ (no sub-types) ──────┘            │
                                       └─ skipped if the location has 0 or 1 collections          │
                                                                                editweight ◄──────┘
```

| Phase | Options / input | Notes |
|---|---|---|
| `loadingctx` | — | Skipped when the prefetch already has the client list. |
| `client` | Firestore `clients` (max 100) | No clients → straight to `addbags`. |
| `location` | `client.locations` | Picking one loads the date options. |
| `date` | Client's **unclassified** collections at that location, labeled by date (`buildDateOptions`) | Same query as the manual picker. With 1 collection it is auto-selected; with 0, no date is set. |
| `addbags` | "Yes — open categories" / "Restart" ("Reiniciar") | Yes → `category`. Restart (`restartFlow`) clears client, location, date and items and goes back to `client`. |
| `category` | 6 categories (`voiceCatalog`) | Categories with sub-types → `subcategory`, others → `weight`. |
| `subcategory` | Sub-types of the category | |
| `weight` | A number (`parseNumber`) | Shown, then **auto-saved after 1 s** (`WEIGHT_SAVE_MS`); a new number inside that second replaces it. |
| `summary` | "Add another type" / "Submit" + edit/delete/redo/corrections | Submit still asks for a yes/no. |
| `editweight` | A number | Reached with "edit the weight for X". |
| `done` | "menu" / "again" | Nothing is written to Firestore; submit only shows `done`. |

**Turn mechanics.** `spokenLine` = `question` + (`agentLine` or the step's
default prompt). An effect runs `runTurn()` whenever `spokenLine` changes:
Monte speaks it, then listens. `spokenRef` remembers what was last spoken, so
clearing it (`spokenRef.current = ''`) makes Monte ask again.

**Global voice commands** (any phase):
- `monte` alone → repeat the current step.
- `pausar` said alone (`PAUSE_RE`) → Monte says "Paused…" and ignores everything
  heard until a `RESUME_RE` match (`reactivar` anywhere in what is heard, or
  `activar` / `activate` said alone). Then Monte repeats the current question.
  The mic stays open while paused, so audio is still streamed to Deepgram. A red
  banner is shown while paused, and tapping it resumes.
- "read out the options" → read-out mode (`readOut` state); the worker can answer
  in the middle of the list.

## 5. Voice engine (`useSpeech`)

API returned to the flow: `listen(grammar)`, `stopListening()`,
`speak(text, { onDone, onProgress, bargeIn, grammar })`, `stopSpeaking()`,
`status` (`loading | idle | listening | speaking | error`), `partial`,
`modelReady`, `live`, `canBargeIn`, `logEvent`.

**Speech-to-text paths, in priority order**

1. **Live session** (preferred). `VoiceDuplex.startStream(url, auth, marginDb)`
   opens one mic session for the whole collection and streams 16 kHz PCM to
   `wss://api.deepgram.com/v1/listen` (nova-3, `interim_results`,
   `endpointing=500`, `utterance_end_ms=1000`, keyterms from the screen's names,
   plus `pausar` and `reactivar`). The flow enables it whenever voice is on and
   the phase is not `loadingctx` or `done`. A finished answer is the text
   accumulated up to `speech_final` or `UtteranceEnd`. On failure it retries after
   15 s and uses Vosk meanwhile.
2. **Vosk offline**: `VoiceDuplex.listen(model, grammar, timeout)` (native
   `AnswerListener`, which also returns the recorded WAV for cloud transcription
   through `transcribe`), or `react-native-vosk` as a last resort. Models
   `model-en-en` / `model-es-es` are bundled into the APK (`assets/vosk`,
   gitignored, fetched by `scripts/fetch-vosk-models.sh`).

**StreamSession gate** (native): `OPEN` (frames streamed) → `PENDING` (Monte is
about to speak, nothing sent) → `SPEAKING` (nothing sent; the barge-in detector
runs) → `HANGOVER` (200 ms) → `OPEN`. Barge-in: calibrate on 20 frames of Monte's
residual echo; trigger when 11 of 15 frames (20 ms each) exceed the 80th
percentile + `BARGE_IN_MARGIN_DB` (10 dB), with a floor of 45 dB. On trigger it
stops Monte, sends the last 1.2 s of pre-roll so the first words aren't lost,
and fires `onStreamBargeIn`.

**Startup.** The first question waits until the live session is up (capped at
`LIVE_WAIT_MS` = 2.5 s), because a line that starts before the session cannot be
interrupted. To cut the delay, the client list is prefetched on the mode and
language screens; when it is ready, the flow starts in `client` and the session
opens on the first render.

**Monte's voice (TTS)**
- On the **call-audio path** (`MODE_IN_COMMUNICATION`, `USAGE_VOICE_COMMUNICATION`)
  whenever barge-in is wanted or the live session is on. This lets the phone's
  echo canceller remove Monte from the mic.
  - Spanish: **Deepgram Aura-2 `aura-2-antonia-es`** through
    `VoiceDuplex.speakCloudOnCall`. Native code POSTs to `/v1/speak`
    (linear16, 24 kHz, `container=none`) and plays the stream as it arrives on an
    `AudioTrack`. If the request fails before any audio plays, it falls back to
    the phone's TTS for the same line id.
  - English: the phone's `TextToSpeech` via `VoiceDuplex.speakOnCall`.
    (`CLOUD_VOICE` in `deepgramStream.js` picks the voice per language.)
- Otherwise, `expo-speech` as plain media (offline only).
- Every line has an id (`speakIdRef`). Callbacks from a stopped or replaced line
  are ignored.

## 6. Understanding pipeline (`handleUtterance(raw, audio)`)

Steps run in this order; the first that handles the utterance wins:

1. If Vosk audio is attached → `transcribe` (Deepgram pre-recorded, primed with
   keyterms). Its transcript replaces the phone's when available.
2. Empty → treated as no result.
3. `PAUSE_RE` → pause. (While paused, `onTranscript` only checks `RESUME_RE`.)
4. Read-out in progress → `handleReadOutResponse`.
5. Bare wake word → repeat the turn.
6. Option screens (`pickScreen()`: client, location, date, addbags, category,
   subcategory):
   - A plain option number ("two", "number 2", "el dos"; `isPlainNumber`) →
     **select directly**, without Jev or confirmation (not on addbags).
   - Otherwise **Jev** (`chooseWithJev`), unless confirming or a plain yes/no on
     addbags. `applyPick`:
     - confidence ≥ **0.67** (`PICK_ACCEPT`) → select and move on;
     - 0.5–0.67 (`PICK_CONFIRM`) → select and ask "Shall I proceed?";
     - below 0.5 or "none" → ask again;
     - controls `back` / `read` at ≥ 0.5 → go back / read out;
     - addbags acts directly at ≥ 0.5 (yes → categories, restart → `restartFlow`).
7. Summary:
   - `trySummaryPick`: "one"/"two" → add another / submit. Free wording goes to
     Jev with descriptive labels (`SUMMARY_PICKS`) and acts at ≥ 0.67. Skipped
     for edit/correction wording (`SUMMARY_EDIT_CUE`) and for phrases the parser
     already knows.
   - On the summary, "evitar"/"evita" are read as "editar"/"edita" (a common
     mishearing; `parseSummaryCommand`). Summary verbs are recognizer keyterms.
   - `tryRevise` (any answer of more than 3 words, or a short one the parser
     doesn't recognize; never during submit/redo questions): `revise` (Claude) →
     `{action, item, category, subcategory, weight}`. `applyRevision` replaces
     the saved item. If the new category has sub-types and none was named, Monte
     asks for the sub-type (`revising` state), then returns to the summary.
8. `localCanHandle(text)` → `routeToPhase(text)` (the per-phase handlers in the
   flow).
9. `cloudCmd` from step 1 (always empty with Deepgram).
10. `interpret` (Claude) → canonical command at confidence ≥ 0.3 →
    `routeToPhase(command)`. Otherwise the phase handler's "say the number"
    reprompt.

Jev failures put Jev into a 60 s backoff (`CHOOSE_BACKOFF_MS`) and the on-device
parser takes over, which always confirms. Seeing confirmation prompts on option
screens usually means Jev is unreachable.

## 7. Native module API (`VoiceDuplex`)

| Function | Purpose |
|---|---|
| `startStream(url, authorization, marginDb) → id` / `stopStream()` | Live session (StreamSession). Also holds call-audio mode. |
| `streamSpeakBegin(lineId, allowBargeIn)` / `streamSpeakEnd(lineId \| 0)` | Close / reopen the gate around a Monte line. |
| `speakOnCall(text, lang, id)` | Phone TTS on the call path. |
| `speakCloudOnCall(text, url, authorization, sampleRate, lang, id)` | Cloud voice on the call path (Aura). |
| `stopSpeakingOnCall()` | Stop Monte. |
| `listen(model, grammarJson, timeoutMs) → id` / `stopListening()` | Vosk answer listener (returns text + WAV). |
| `preloadBargeIn(model)`, `startBargeIn(model, marginDb, grammar) → id`, `stopBargeIn()` | Offline barge-in. |
| `runEchoTest(lang)` | Diagnostics used by VoiceTest. |

Events: `onStreamState`, `onStreamMessage` (raw Deepgram JSON), `onStreamBargeIn`,
`onCallSpeechStart`, `onCallSpeechRange` (character offset; approximate for
the cloud voice), `onCallSpeechDone`, `onListenPartial`, `onListenResult`,
`onBargeInSpeech`, `onBargeInResult`, `onBargeInLog`.

## 8. Cloud Functions (`functions/index.js`, region us-central1)

| Function | Input | Output | Backend |
|---|---|---|---|
| `interpret` | `transcript, phase, options, language, context` | `{command, confidence, note}` | Claude (`claude-opus-5-5`, low effort, JSON schema) |
| `revise` | `transcript, language, items[{label,kg}], catalog[{id,label,subs}]` | `{action: revise\|none, item, category, subcategory, weight, note}` | Claude, same settings |
| `choose` | `transcript, phase, language, options[{n,id,label}]` | `{index, id, label, control: back\|read\|null, confidence, top[3]}` | TypeSafe Jev (`jev-latest`, `choice` question; criteria = options + back/read/none) |
| `transcribe` | `audio` (base64 WAV), options, language, context | `{transcript, command:'', confidence}` | Deepgram pre-recorded |
| `deepgramToken` | — | `{token, expiresIn}` (60 s) | Deepgram `auth/grant`. Fails today: the key lacks the Member role. |

Optional abuse guard: `APP_SHARED_TOKEN` (server `.env`, must match
`llmInterpreter.js`). Currently blank.

## 9. Configuration and secrets

- `functions/.env` (gitignored): `DEEPGRAM_API_KEY`, `ANTHROPIC_API_KEY`,
  `TYPESAFE_API_KEY`.
- `.env.local` (gitignored, bundled into the app):
  `EXPO_PUBLIC_DEEPGRAM_API_KEY` (live STT and Aura TTS without a token),
  `EXPO_PUBLIC_FUNCTIONS_EMULATOR=127.0.0.1:5001`,
  `EXPO_PUBLIC_TYPESAFE_API_KEY` (direct Jev).
  Any APK built with these keys has them extractable. The owner accepts this for
  personal builds. Do not distribute such builds.
- The Firebase web config in `firebase.js` (project `obra-padre-cacho`) is public
  by design.

## 10. Development workflow

- **Metro**: `env -u CI npx expo start --dev-client --port 8081 --clear`.
  Never start it with `CI=1`: file watching turns off and the phone silently gets
  stale code. To verify a change is live, fetch
  `http://localhost:8081/node_modules/expo/AppEntry.bundle?platform=android&dev=true&...`
  and grep it for the new code.
- **Functions**: `npx firebase-tools@latest emulators:start --only functions --project obra-padre-cacho`
  from the repo root.
- **Phone over USB** (CMF by Nothing, serial `00118655K001101`; adb at
  `~/Library/Android/sdk/platform-tools/adb`, which is not on PATH):
  `adb reverse tcp:8081 tcp:8081 && adb reverse tcp:5001 tcp:5001`. These
  forwards **drop whenever the cable reconnects**. Without them, the app shows
  stale code and Jev falls back to confirmations.
- **Launch**: package `com.osvreciclar.app`, a dev-client build. Open it, not
  Expo Go (Expo Go lacks the native module). In the dev launcher, tap
  `http://localhost:8081`.
- **Logs**: in development, voice events are printed to the **Metro console** as
  `LOG  [voice +<ms since screen open>] …`: transcripts, Jev picks with
  confidence, barge-ins, revise results, startup timings. They do not appear in
  `adb logcat`. Native crashes: `adb logcat -b crash`.
- **Builds** (JDK 17 is required; the default JDK 25 is too new for Gradle 8.14.3):
  `cd android && JAVA_HOME=/Library/Java/JavaVirtualMachines/microsoft-17.jdk/Contents/Home ./gradlew :app:assembleDebug`
  (~0.5–9 min) or `:app:assembleRelease` (~13 min; JS bundled, standalone).
  Native (Kotlin) changes need a rebuild and reinstall. JS changes only need
  Metro. `android/` is gitignored (regenerated by `expo prebuild`). Build
  outputs reach ~5 GB, and the disk has run low before.
- **Git**: remote `github.com/Nirvisha-9/MonteVideo-Voice_Agent`, default branch
  `osv-reciclar` (there is no `main`). The repo wrongly tracks
  `modules/voice-duplex/android/build/` and `.gradle/`. Don't stage those.

## 11. Known issues and gotchas

- `@react-native-picker/picker` 2.11.1 crashed the app natively (SIGABRT in
  Hermes GC, `RNCAndroidDialogPickerProps` destructor) on RN 0.81 with the new
  architecture. Fixed upstream in 2.11.3; the app is on **2.11.4**.
- The phone has gone offline before (Wi-Fi disconnected, SIM out of service).
  Firestore then shows "No users available". Check
  `adb shell dumpsys connectivity | grep "Active default network"`.
- "TTS onDone never fired — timeout" in the logs after a barge-in is benign: a
  cut-off line's safety timer firing.
- `deepgramToken` doesn't work with the current key. Live STT and the Aura voice
  rely on the bundled dev key.
- On the date screen, a bare number ("five") selects option 5, not the 5th of the
  month.
- Submit asks for a yes/no confirmation on purpose.
- Corrections and `interpret` need Claude through the functions emulator, so
  they don't work in a standalone APK away from the dev Mac.
- Nothing from the voice flow is saved to Firestore. Submit is a prototype end
  state.

## 12. State of the work (2026-10-29)

- Pushed to `origin/voice-agent-jev-date-fixes`: everything described here,
  including pausar/reactivar, number and summary picks, direct Jev, client
  prefetch with startup timing logs, the Aura Antonia cloud voice, Restart on
  add bags and evitar→editar.
- Measured on the CMF phone (2026-10-16): Monte audible 0.88 s after the voice
  screen opens; the cloud voice starts 160 ms after its line starts.
- Native code changed with the cloud voice: install a debug APK built after
  2026-10-15 (or the release APK) for it to take effect.
- Latest standalone build: `android/app/build/outputs/apk/release/app-release.apk`
  (2026-10-16), not committed (`android/` is gitignored).

# Senior-Design

## Voice Agent (Clasificar → Voice Agent)

Hands-free, **offline** classification flow. Speech-to-text runs fully on-device
via [Vosk](https://alphacephei.com/vosk/) — no Google/OEM speech services, no
network, no API keys. Text-to-speech uses `expo-speech` (device TTS).

### First-time setup

```bash
./scripts/fetch-vosk-models.sh        # downloads the offline models (EN + ES, ~80 MB, gitignored)
npx expo prebuild --clean
npx expo run:android                  # native build — required, Vosk is a native module
```

Both models are bundled into the APK (adds ~80 MB). They are **not** in Expo Go —
the Voice Agent falls back to typed input there.

### Language

**English and Spanish** both ship. After picking "Voice Agent" the worker
chooses the language; Monte speaks / listens / parses in that language and loads
the matching offline model (`model-en-en` / `model-es-es`, both bundled).

All UI text lives in `components/voice/voiceStrings.js` (`en` / `es`). The parser
(`voiceParser.js`) is bilingual. Category labels are in `voiceCatalog.js`
(`getCategories(lang)`).

### Diagnostics

Voice Agent screen → **🔧 Mic test** (top bar) runs Vosk directly and shows a
live event log.

## LLM intent fallback

When the on-device parser can't make sense of what the worker said **and** there
is connectivity, the app calls a Firebase Cloud Function that asks an LLM to map
the transcript to one canonical command. Offline, it falls back to numbered
selection — nothing about the offline flow regresses.

- `functions/` — the Cloud Function proxy. The API key lives **only** in
  `functions/.env` (gitignored), never in the app.
- `components/voice/llmInterpreter.js` — client side; any failure resolves to
  `null` and the local flow continues.
- Default provider: **Google Gemini Flash** (free tier, strong Spanish). Any
  OpenAI-compatible provider works — see `functions/.env`.

### Setup

```bash
cd functions && npm install && cd ..
# functions/.env:
#   LLM_API_KEY   = key from https://aistudio.google.com/app/apikey
#   LLM_BASE_URL  = https://generativelanguage.googleapis.com/v1beta/openai
#   LLM_MODEL     = gemini-2.5-flash
firebase deploy --only functions          # needs the Blaze plan on the project
```

To harden the endpoint against abuse, set a random `APP_SHARED_TOKEN` in both
`functions/.env` and `llmInterpreter.js`, or add Firebase App Check.

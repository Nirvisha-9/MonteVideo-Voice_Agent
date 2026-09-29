/**
 * LLM intent proxy for the Voice Agent.
 *
 * The app sends the raw Vosk transcript + the current screen context; this
 * function asks an LLM (default: Google Gemini Flash, via its OpenAI-compatible
 * endpoint) to turn it into ONE canonical command the app's local parser already
 * understands, and returns { command, confidence, note }.
 *
 * Any OpenAI-compatible provider works — just change LLM_BASE_URL / LLM_MODEL in
 * functions/.env:
 *   Gemini : https://generativelanguage.googleapis.com/v1beta/openai   gemini-2.5-flash
 *   Groq   : https://api.groq.com/openai/v1                             moonshotai/kimi-k2-instruct
 *   Kimi   : https://api.moonshot.ai/v1                                 kimi-k2-0905-preview
 *
 * The API key never leaves the server — it lives in functions/.env (gitignored)
 * as LLM_API_KEY. Firebase loads .env into process.env at deploy time.
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");

setGlobalOptions({ region: "us-central1", maxInstances: 5 });

const MODEL = process.env.LLM_MODEL || "gemini-2.5-flash";
const BASE_URL = (process.env.LLM_BASE_URL || "https://generativelanguage.googleapis.com/v1beta/openai").replace(/\/$/, "");
const API_KEY = process.env.LLM_API_KEY || "";
const APP_TOKEN = process.env.APP_SHARED_TOKEN || ""; // optional abuse guard

function screenPrompt(phase, options, context) {
  const opt = (options || [])
    .map((o) => `  ${o.n}. ${o.label} (id: ${o.id})`)
    .join("\n");

  const screens = {
    client: `Question: "Which client is this collection for?". Options:\n${opt}\nCanonical commands: the option number as a word, OR the exact client name. Match on partial names / abbreviations.`,
    location: `Question: "Which location?". Options:\n${opt}\nCanonical commands: the option number as a word, OR the exact location name, OR "go back".`,
    addbags: `Question: "Add bags at ${context.place || "this location"}?". Canonical commands: "yes", "no", "go back".`,
    category: `Question: "Which waste category?". Options:\n${opt}\nCanonical commands: the option number as a word ("one".."six"), OR the exact option label, OR "read out the options", OR "go back".`,
    subcategory: `Question: "Which sub-type of ${context.pendingLabel || "material"}?". Options:\n${opt}\nCanonical commands: the option number as a word ("one".."nine"), OR the exact option label, OR "go back".`,
    weight: `Question: "What's the weight for ${context.pendingLabel || "this item"}?". Canonical commands: "<number> kilos" (e.g. "fifteen kilos"), OR "yes" to confirm the shown weight, OR "no", OR "go back". If the worker corrects themselves ("actually seventeen"), output the NEW number: "seventeen kilos".`,
    editweight: `Question: "What's the new weight for ${context.pendingLabel || "this item"}?". Canonical commands: "<number> kilos", OR "go back".`,
    summary: `The worker is reviewing what they've classified: ${JSON.stringify(context.items || [])}. Canonical commands: "add another", "submit", "edit the weight for <item label>", "delete <item label>", "redo", "read out everything", "yes", "no".`,
    done: `The collection was submitted. Canonical commands: "menu" (go to main menu) or "again" (start another).`,
  };
  return screens[phase] || `Canonical commands: "yes", "no", "go back".`;
}

function systemPrompt(phase, options, language, context) {
  const lang = language === "es" ? "Spanish" : "English";
  return [
    `You are the intent parser for a waste-collection field app used by workers in Montevideo, Uruguay.`,
    `The worker just spoke (in ${lang}); their words were transcribed offline and may be messy, informal, code-switched, or contain filler.`,
    `Your job: map what they said to exactly ONE canonical command for the CURRENT screen.`,
    ``,
    `CURRENT SCREEN (${phase}):`,
    screenPrompt(phase, options, context),
    ``,
    `Rules:`,
    `- Output ONLY compact JSON: {"command": "<canonical command>", "confidence": <0..1>, "note": "<short reason>"}.`,
    `- "command" MUST be one of the canonical commands for this screen (a number word, an exact option label, or a fixed phrase). Never invent new commands.`,
    `- On a selection screen: prefer returning the exact option label. Match on meaning, synonyms, brand names, partial names, Spanish/English mix.`,
    `- If you cannot tell what they meant, return {"command": "", "confidence": 0, "note": "unclear"}.`,
    `- confidence: 0.8+ = certain, 0.4-0.7 = likely, <0.4 = guess.`,
    `- Do not add any text outside the JSON.`,
  ].join("\n");
}

exports.interpret = onCall({ timeoutSeconds: 20 }, async (request) => {
  const d = request.data || {};
  const { transcript, phase, options = [], language = "en", context = {}, appToken } = d;

  if (APP_TOKEN && appToken !== APP_TOKEN) {
    throw new HttpsError("permission-denied", "bad app token");
  }
  if (!API_KEY) {
    throw new HttpsError("failed-precondition", "LLM_API_KEY is not configured in functions/.env");
  }
  if (!transcript || !phase) {
    throw new HttpsError("invalid-argument", "transcript and phase are required");
  }

  let res;
  try {
    res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.1,
        max_tokens: 200,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt(phase, options, language, context) },
          { role: "user", content: String(transcript).slice(0, 500) },
        ],
      }),
    });
  } catch (e) {
    throw new HttpsError("unavailable", `LLM request failed: ${e.message}`);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new HttpsError("internal", `LLM ${res.status}: ${body.slice(0, 300)}`);
  }

  const json = await res.json();
  const raw = json.choices?.[0]?.message?.content || "{}";
  let parsed = {};
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    // some models wrap JSON in ```json fences
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        parsed = JSON.parse(m[0]);
      } catch (e2) {
        parsed = {};
      }
    }
  }

  return {
    command: String(parsed.command || "").trim(),
    confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0)),
    note: String(parsed.note || "").slice(0, 200),
    model: MODEL,
  };
});

/**
 * Speech-to-text for the Voice Agent: the worker's recorded answer (16 kHz WAV,
 * base64) → Gemini, which hears it knowing what this screen is asking, and
 * returns what was said plus the canonical command it means:
 * { transcript, command, confidence }.
 *
 * Needs a Gemini key in LLM_API_KEY (Gemini's native API; the OpenAI-compatible
 * endpoint used by `interpret` doesn't take audio). The app falls back to the
 * on-device transcript on any failure.
 */
const AUDIO_MODEL = process.env.STT_MODEL || "gemini-2.5-flash";
const MAX_AUDIO_B64 = 2_000_000; // ~60 s of 16 kHz audio

exports.transcribe = onCall({ timeoutSeconds: 20 }, async (request) => {
  const d = request.data || {};
  const { audio, phase, options = [], language = "en", context = {}, appToken } = d;

  if (APP_TOKEN && appToken !== APP_TOKEN) {
    throw new HttpsError("permission-denied", "bad app token");
  }
  if (!API_KEY) {
    throw new HttpsError("failed-precondition", "LLM_API_KEY is not configured in functions/.env");
  }
  if (!audio || typeof audio !== "string" || audio.length > MAX_AUDIO_B64) {
    throw new HttpsError("invalid-argument", "audio (base64 WAV) is required");
  }

  const lang = language === "es" ? "Spanish (Rioplatense, Uruguay)" : "English";
  const prompt = [
    `You are the ears of a voice assistant in a waste-collection field app used by workers in Montevideo, Uruguay.`,
    `The audio is the worker answering the app, in ${lang} (they may mix Spanish and English). It may be noisy.`,
    ``,
    `CURRENT SCREEN (${phase || "unknown"}):`,
    screenPrompt(phase, options, context),
    ``,
    `Return ONLY compact JSON: {"transcript": "<exactly what the worker said>", "command": "<canonical command>", "confidence": <0..1>}.`,
    `- transcript: a faithful transcription in the language spoken. Write numbers as words ("fifteen", "quince"). Use "" if nobody speaks.`,
    `- command: ONE canonical command for this screen that matches what they meant, or "" if it doesn't match any. Never invent commands.`,
    `- Use the screen's options to resolve words that sound alike (e.g. "for" vs "four", "cart on" vs "cartón").`,
    `- confidence: how sure you are of the command. 0.8+ = certain, 0.4-0.7 = likely, <0.4 = guess.`,
  ].join("\n");

  let res;
  try {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${AUDIO_MODEL}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": API_KEY },
        body: JSON.stringify({
          contents: [{
            role: "user",
            parts: [
              { text: prompt },
              { inline_data: { mime_type: "audio/wav", data: audio } },
            ],
          }],
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 300,
            responseMimeType: "application/json",
            thinkingConfig: { thinkingBudget: 0 }, // answer fast — the worker is waiting
          },
        }),
      }
    );
  } catch (e) {
    throw new HttpsError("unavailable", `STT request failed: ${e.message}`);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new HttpsError("internal", `STT ${res.status}: ${body.slice(0, 300)}`);
  }

  const json = await res.json();
  const raw = json.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "{}";
  let parsed = {};
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        parsed = JSON.parse(m[0]);
      } catch (e2) {
        parsed = {};
      }
    }
  }

  return {
    transcript: String(parsed.transcript || "").trim().slice(0, 500),
    command: String(parsed.command || "").trim().slice(0, 200),
    confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0)),
    model: AUDIO_MODEL,
  };
});

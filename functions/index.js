/**
 * LLM intent proxy for the Voice Agent.
 *
 * The app sends the worker's transcript + the current screen context; this
 * function asks Claude to turn it into ONE canonical command the app's local
 * parser already understands, and returns { command, confidence, note }.
 *
 * The API key never leaves the server — it lives in functions/.env (gitignored)
 * as ANTHROPIC_API_KEY. Firebase loads .env into process.env at deploy time.
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const Anthropic = require("@anthropic-ai/sdk");

setGlobalOptions({ region: "us-central1", maxInstances: 5 });

// Low effort: this is a short classification and the worker is waiting
// (~1.8 s measured, vs ~2.1 s on claude-haiku-4-5).
const MODEL = "claude-opus-5-5";
const API_KEY = process.env.ANTHROPIC_API_KEY || "";
// The app gives up after 7 s and falls back to "say the number".
const anthropic = API_KEY ? new Anthropic({ apiKey: API_KEY, timeout: 6000, maxRetries: 1 }) : null;
const APP_TOKEN = process.env.APP_SHARED_TOKEN || ""; // optional abuse guard

function screenPrompt(phase, options, context) {
  const opt = (options || [])
    .map((o) => `  ${o.n}. ${o.label} (id: ${o.id})`)
    .join("\n");

  const screens = {
    client: `Question: "Which client is this collection for?". Options:\n${opt}\nCanonical commands: the option number as a word, OR the exact client name. Match on partial names / abbreviations.`,
    location: `Question: "Which location?". Options:\n${opt}\nCanonical commands: the option number as a word, OR the exact location name, OR "go back".`,
    date: `Question: "Which collection date?". Options:\n${opt}\nCanonical commands: the option number as a word, OR the exact option label, OR "go back". Match on weekday, day of the month, "today" / "yesterday".`,
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
    `- "command" MUST be one of the canonical commands for this screen (a number word, an exact option label, or a fixed phrase). Never invent new commands.`,
    `- On a selection screen: prefer returning the exact option label. Match on meaning, synonyms, brand names, partial names, Spanish/English mix.`,
    `- If you cannot tell what they meant, return {"command": "", "confidence": 0, "note": "unclear"}.`,
    `- confidence: 0.8+ = certain, 0.4-0.7 = likely, <0.4 = guess.`,
    `- note: a short reason.`,
  ].join("\n");
}

const COMMAND_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["command", "confidence", "note"],
  properties: {
    command: { type: "string" },
    confidence: { type: "number" },
    note: { type: "string" },
  },
};

exports.interpret = onCall({ timeoutSeconds: 20 }, async (request) => {
  const d = request.data || {};
  const { transcript, phase, options = [], language = "en", context = {}, appToken } = d;

  if (APP_TOKEN && appToken !== APP_TOKEN) {
    throw new HttpsError("permission-denied", "bad app token");
  }
  if (!anthropic) {
    throw new HttpsError("failed-precondition", "ANTHROPIC_API_KEY is not configured in functions/.env");
  }
  if (!transcript || !phase) {
    throw new HttpsError("invalid-argument", "transcript and phase are required");
  }

  let response;
  try {
    response = await anthropic.beta.messages.create({
      model: MODEL,
      max_tokens: 1024,
      // if a safety check declines, the request is re-run on another model
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: systemPrompt(phase, options, language, context),
      messages: [{ role: "user", content: String(transcript).slice(0, 500) }],
      output_config: { effort: "low", format: { type: "json_schema", schema: COMMAND_SCHEMA } },
    });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) throw new HttpsError("resource-exhausted", "LLM rate limited");
    if (e instanceof Anthropic.APIError) throw new HttpsError("internal", `LLM ${e.status}: ${e.message}`);
    throw new HttpsError("unavailable", `LLM request failed: ${e.message}`);
  }

  if (response.stop_reason === "refusal") {
    return { command: "", confidence: 0, note: "declined", model: response.model };
  }
  const text = response.content.find((b) => b.type === "text")?.text || "{}";
  let parsed = {};
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    parsed = {}; // cut off at max_tokens
  }

  return {
    command: String(parsed.command || "").trim(),
    confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0)),
    note: String(parsed.note || "").slice(0, 200),
    model: response.model,
  };
});

/**
 * Corrections on the summary screen: "not cardboard, plastics — and seven
 * kilos, not twenty-four". Claude works out which saved item is being
 * corrected and what it should become; the app applies it.
 *
 * Returns { action, item, category, subcategory, weight, note }:
 *   action       "revise", or "none" when the worker isn't correcting an item
 *   item         label of the saved item being corrected ("" = not said)
 *   category     id of the new category ("" = unchanged)
 *   subcategory  id of the new sub-type ("" = unchanged or not said)
 *   weight       the new weight in kilograms (0 = unchanged)
 */
const REVISE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["action", "item", "category", "subcategory", "weight", "note"],
  properties: {
    action: { type: "string", enum: ["revise", "none"] },
    item: { type: "string" },
    category: { type: "string" },
    subcategory: { type: "string" },
    weight: { type: "number" },
    note: { type: "string" },
  },
};

function revisePrompt(language, items, catalog) {
  const lang = language === "es" ? "Spanish" : "English";
  const cats = (catalog || [])
    .map((c) => {
      const subs = (c.subs || []).map((s) => `${s.label} (id: ${s.id})`).join(", ");
      return `  ${c.label} (id: ${c.id})${subs ? ` — sub-types: ${subs}` : " — no sub-types"}`;
    })
    .join("\n");
  return [
    `You read corrections for a waste-collection field app used by workers in Montevideo, Uruguay.`,
    `The worker is reviewing the items they recorded and just spoke (in ${lang}); the speech-to-text transcript may be messy.`,
    ``,
    `Recorded items: ${JSON.stringify(items || [])}`,
    `Material catalog:`,
    cats,
    ``,
    `If the worker is correcting a recorded item (its material, its weight, or both), return action "revise" with:`,
    `- item: the exact label of the recorded item being corrected. "" if they didn't say which and there is more than one.`,
    `- category: the id of the category it should be. "" if the material doesn't change.`,
    `- subcategory: the id of the sub-type it should be, only if they clearly named one of that category's sub-types. Otherwise "" — never guess a sub-type.`,
    `- weight: the corrected weight in kilograms. 0 if the weight doesn't change.`,
    `"X instead of Y" / "not Y, X": Y is the wrong value already recorded, X is the correct one.`,
    `Anything else (submit, add another, delete, read out, yes/no, unclear): action "none", other fields empty / 0.`,
    `note: a short reason.`,
  ].join("\n");
}

exports.revise = onCall({ timeoutSeconds: 20 }, async (request) => {
  const { transcript, language = "en", items = [], catalog = [], appToken } = request.data || {};

  if (APP_TOKEN && appToken !== APP_TOKEN) {
    throw new HttpsError("permission-denied", "bad app token");
  }
  if (!anthropic) {
    throw new HttpsError("failed-precondition", "ANTHROPIC_API_KEY is not configured in functions/.env");
  }
  if (!transcript) {
    throw new HttpsError("invalid-argument", "transcript is required");
  }

  let response;
  try {
    response = await anthropic.beta.messages.create({
      model: MODEL,
      max_tokens: 1024,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: revisePrompt(language, items, catalog),
      messages: [{ role: "user", content: String(transcript).slice(0, 500) }],
      output_config: { effort: "low", format: { type: "json_schema", schema: REVISE_SCHEMA } },
    });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) throw new HttpsError("resource-exhausted", "LLM rate limited");
    if (e instanceof Anthropic.APIError) throw new HttpsError("internal", `LLM ${e.status}: ${e.message}`);
    throw new HttpsError("unavailable", `LLM request failed: ${e.message}`);
  }

  let parsed = {};
  if (response.stop_reason !== "refusal") {
    try {
      parsed = JSON.parse(response.content.find((b) => b.type === "text")?.text || "{}");
    } catch (e) {
      parsed = {}; // cut off at max_tokens
    }
  }

  return {
    action: parsed.action === "revise" ? "revise" : "none",
    item: String(parsed.item || "").trim(),
    category: String(parsed.category || "").trim(),
    subcategory: String(parsed.subcategory || "").trim(),
    weight: Math.max(0, Number(parsed.weight) || 0),
    note: String(parsed.note || "").slice(0, 200),
    model: response.model,
  };
});

/**
 * Speech-to-text for the Voice Agent: the worker's recorded answer (16 kHz WAV,
 * base64) → Deepgram, primed with this screen's option names so they aren't
 * misheard. Returns { transcript, command, confidence }.
 *
 * Deepgram only transcribes: `command` is always "" — the app parses the
 * transcript itself and calls `interpret` when it can't. `confidence` is how
 * sure Deepgram is of the transcript.
 *
 * Needs DEEPGRAM_API_KEY in functions/.env. The app falls back to the
 * on-device transcript on any failure.
 */
const DEEPGRAM_KEY = process.env.DEEPGRAM_API_KEY || "";
const AUDIO_MODEL = process.env.STT_MODEL || "nova-3";
const MAX_AUDIO_B64 = 2_000_000; // ~60 s of 16 kHz audio
const MAX_KEYTERMS = 40;

exports.transcribe = onCall({ timeoutSeconds: 20 }, async (request) => {
  const d = request.data || {};
  const { audio, options = [], language = "en", context = {}, appToken } = d;

  if (APP_TOKEN && appToken !== APP_TOKEN) {
    throw new HttpsError("permission-denied", "bad app token");
  }
  if (!DEEPGRAM_KEY) {
    throw new HttpsError("failed-precondition", "DEEPGRAM_API_KEY is not configured in functions/.env");
  }
  if (!audio || typeof audio !== "string" || audio.length > MAX_AUDIO_B64) {
    throw new HttpsError("invalid-argument", "audio (base64 WAV) is required");
  }

  // No smart_format / punctuate: the app's parser wants plain lowercase words
  // and numbers spelled out ("fifteen", "quince"), which is Deepgram's default.
  const params = new URLSearchParams({
    model: AUDIO_MODEL,
    language: language === "es" ? "es-419" : "en",
  });
  // Bias recognition towards what this screen can be answered with.
  const terms = [
    ...(Array.isArray(options) ? options : []).map((o) => o?.label),
    context?.pendingLabel,
    ...(Array.isArray(context?.items) ? context.items : []).map((it) => it?.label),
  ]
    .map((t) => String(t || "").trim().slice(0, 60))
    .filter(Boolean);
  [...new Set(terms)].slice(0, MAX_KEYTERMS).forEach((t) => params.append("keyterm", t));

  let res;
  try {
    res = await fetch(`https://api.deepgram.com/v1/listen?${params}`, {
      method: "POST",
      headers: { "Content-Type": "audio/wav", Authorization: `Token ${DEEPGRAM_KEY}` },
      body: Buffer.from(audio, "base64"),
      signal: AbortSignal.timeout(10000),
    });
  } catch (e) {
    throw new HttpsError("unavailable", `STT request failed: ${e.message}`);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new HttpsError("internal", `STT ${res.status}: ${body.slice(0, 300)}`);
  }

  const json = await res.json();
  const alt = json.results?.channels?.[0]?.alternatives?.[0] || {};

  return {
    transcript: String(alt.transcript || "").trim().slice(0, 500),
    command: "",
    confidence: Math.max(0, Math.min(1, Number(alt.confidence) || 0)),
    model: AUDIO_MODEL,
  };
});

/**
 * Short-lived Deepgram token for the app's live mic session: the phone opens
 * the transcription WebSocket itself (audio can't be relayed through a
 * callable), and this keeps DEEPGRAM_API_KEY on the server. The token is only
 * needed to connect; an open session outlives it.
 *
 * The key needs permission to create tokens (Member role or above) —
 * Deepgram answers 403 otherwise.
 */
exports.deepgramToken = onCall({ timeoutSeconds: 10 }, async (request) => {
  const { appToken } = request.data || {};

  if (APP_TOKEN && appToken !== APP_TOKEN) {
    throw new HttpsError("permission-denied", "bad app token");
  }
  if (!DEEPGRAM_KEY) {
    throw new HttpsError("failed-precondition", "DEEPGRAM_API_KEY is not configured in functions/.env");
  }

  let res;
  try {
    res = await fetch("https://api.deepgram.com/v1/auth/grant", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Token ${DEEPGRAM_KEY}` },
      body: JSON.stringify({ ttl_seconds: 60 }),
      signal: AbortSignal.timeout(8000),
    });
  } catch (e) {
    throw new HttpsError("unavailable", `token request failed: ${e.message}`);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new HttpsError("internal", `token ${res.status}: ${body.slice(0, 300)}`);
  }

  const json = await res.json();
  return { token: String(json.access_token || ""), expiresIn: Number(json.expires_in) || 0 };
});

/**
 * Option scoring for the Voice Agent: which of this screen's options did the
 * worker mean? Jev (TypeSafe) reads the transcript — clean, misheard or a whole
 * sentence — and returns the closest option with a confidence (0..1) and a
 * probability for every option. It can only answer with one of the options
 * given, "none", or one of the two screen controls.
 *
 * Returns { index, id, label, control, confidence, top, model }:
 *   index    0-based option picked, or -1
 *   control  "back" | "read" when that's what they asked for, else null
 *   top      the three most likely answers, for the event log
 *
 * Needs TYPESAFE_API_KEY in functions/.env.
 */
const TYPESAFE_KEY = process.env.TYPESAFE_API_KEY || "";
const JEV_MODEL = "jev-latest";
const MAX_OPTIONS = 40;

const PICK_QUESTION = {
  client: "Which client did the worker choose?",
  location: "Which location did the worker choose?",
  date: "Which collection date did the worker choose? They may name the weekday, the day of the month, or say today / yesterday.",
  category: "Which waste category did the worker choose?",
  subcategory: "Which sub-type of material did the worker choose?",
};

exports.choose = onCall({ timeoutSeconds: 10 }, async (request) => {
  const { transcript, phase, options = [], language = "en", appToken } = request.data || {};

  if (APP_TOKEN && appToken !== APP_TOKEN) {
    throw new HttpsError("permission-denied", "bad app token");
  }
  if (!TYPESAFE_KEY) {
    throw new HttpsError("failed-precondition", "TYPESAFE_API_KEY is not configured in functions/.env");
  }
  const opts = (Array.isArray(options) ? options : []).filter((o) => o && o.label).slice(0, MAX_OPTIONS);
  if (!transcript || !opts.length) {
    throw new HttpsError("invalid-argument", "transcript and options are required");
  }

  // short keys: option ids come from the database and may be anything
  const criteria = {};
  opts.forEach((o, i) => {
    criteria[`o${i + 1}`] = String(o.label).slice(0, 80);
  });
  criteria.back = "Go back to the previous step";
  criteria.read = "Read the list of options aloud";
  criteria.none = "None of these: the worker did not name any option";

  const lang = language === "es" ? "Spanish" : "English";
  let res;
  try {
    res = await fetch("https://api.typesafe.ai/v1/systemone", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${TYPESAFE_KEY}` },
      body: JSON.stringify({
        state: String(transcript).slice(0, 500),
        model: JEV_MODEL,
        questions: {
          pick: {
            type: "choice",
            instructions:
              `The text is a speech-to-text transcript of a waste-collection worker in Uruguay answering in ${lang}. ` +
              `Words may be misheard or misspelled. ${PICK_QUESTION[phase] || "Which option did the worker choose?"}`,
            criteria,
          },
        },
      }),
      signal: AbortSignal.timeout(4000),
    });
  } catch (e) {
    throw new HttpsError("unavailable", `Jev request failed: ${e.message}`);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new HttpsError(res.status === 429 ? "resource-exhausted" : "internal", `Jev ${res.status}: ${body.slice(0, 300)}`);
  }

  const json = await res.json();
  const answer = json.answers?.pick || {};
  const key = String(answer.choice || "none");
  const index = /^o\d+$/.test(key) ? Number(key.slice(1)) - 1 : -1;
  const picked = index >= 0 ? opts[index] : null;
  const name = (k) => (/^o\d+$/.test(k) ? opts[Number(k.slice(1)) - 1]?.label : k);

  return {
    index: picked ? index : -1,
    id: picked ? picked.id ?? null : null,
    label: picked ? String(picked.label) : "",
    control: key === "back" || key === "read" ? key : null,
    confidence: Math.max(0, Math.min(1, Number(answer.confidence) || 0)),
    top: Object.entries(answer.probabilities || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([k, p]) => ({ label: String(name(k) || k), p: Math.round(Number(p) * 100) / 100 })),
    model: String(json.model || JEV_MODEL),
  };
});

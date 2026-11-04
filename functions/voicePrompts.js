/**
 * Prompts and output schemas for the Voice Agent's Claude calls.
 *
 * Used by the Cloud Functions (`interpret`, `revise` in index.js) and by the
 * app itself in standalone builds (components/voice/claudeDirect.js), so the
 * two always ask Claude the same thing. Plain CommonJS with no dependencies:
 * both Node and the app's bundler load it.
 */

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

module.exports = { screenPrompt, systemPrompt, COMMAND_SCHEMA, revisePrompt, REVISE_SCHEMA };

/**
 * Claude, called straight from the app.
 *
 * The same requests the `interpret` and `revise` Cloud Functions make
 * (functions/index.js), with the same prompts and schemas
 * (functions/voicePrompts.js) — for a standalone build that has no Cloud
 * Functions to call. It needs the Anthropic key inside the app:
 * EXPO_PUBLIC_ANTHROPIC_API_KEY in .env.local (gitignored). A key bundled into
 * an APK can be read out of it, so only set it for builds that stay in trusted
 * hands; without it the app uses the Cloud Functions.
 */
import Anthropic from '@anthropic-ai/sdk';
// eslint-disable-next-line import/no-relative-packages
import { systemPrompt, COMMAND_SCHEMA, revisePrompt, REVISE_SCHEMA } from '../../functions/voicePrompts';

const API_KEY = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY || '';
const MODEL = 'claude-opus-5-5';

/** True when this build carries the key and calls Claude itself. */
export const CLAUDE_DIRECT = !!API_KEY;

let client = null;
const getClient = () => {
    if (!client) client = new Anthropic({ apiKey: API_KEY, timeout: 6000, maxRetries: 1 });
    return client;
};

// One short structured-output request, as the Cloud Functions make it: low
// effort (the worker is waiting), server-side fallback if a safety check
// declines. Resolves to the parsed JSON, or {} when there is none.
async function ask(system, transcript, schema) {
    const response = await getClient().beta.messages.create({
        model: MODEL,
        max_tokens: 1024,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system,
        messages: [{ role: 'user', content: String(transcript).slice(0, 500) }],
        output_config: { effort: 'low', format: { type: 'json_schema', schema } },
    });
    if (response.stop_reason === 'refusal') return {};
    const text = response.content.find((b) => b.type === 'text')?.text || '{}';
    try {
        return JSON.parse(text);
    } catch (e) {
        return {}; // cut off at max_tokens
    }
}

/** Same result shape as the `interpret` Cloud Function. */
export async function interpretDirect({ transcript, phase, options = [], language = 'en', context = {} }) {
    const parsed = await ask(systemPrompt(phase, options, language, context), transcript, COMMAND_SCHEMA);
    return {
        command: String(parsed.command || '').trim(),
        confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0)),
        note: String(parsed.note || '').slice(0, 200),
    };
}

/** Same result shape as the `revise` Cloud Function. */
export async function reviseDirect({ transcript, language = 'en', items = [], catalog = [] }) {
    const parsed = await ask(revisePrompt(language, items, catalog), transcript, REVISE_SCHEMA);
    return {
        action: parsed.action === 'revise' ? 'revise' : 'none',
        item: String(parsed.item || '').trim(),
        category: String(parsed.category || '').trim(),
        subcategory: String(parsed.subcategory || '').trim(),
        weight: Math.max(0, Number(parsed.weight) || 0),
        note: String(parsed.note || '').slice(0, 200),
    };
}

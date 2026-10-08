/**
 * Live speech-to-text (Deepgram streaming) for the Voice Agent's mic session.
 *
 * The native VoiceDuplex module streams the microphone to the WebSocket URL
 * built here for the whole collection, and hands back Deepgram's messages:
 *   is_final: false     still improving this stretch of speech (shown live)
 *   is_final: true      this stretch is settled
 *   speech_final: true  the worker stopped talking — the answer is complete
 * useSpeech only acts on a complete answer.
 */
import { fetchSttToken } from './llmInterpreter';

const MAX_KEYTERMS = 60;

// Development only: a Deepgram key in .env.local (gitignored) is bundled into
// the app so a dev build can connect without the Cloud Function. Never set it
// for a build that leaves your hands — release builds get a short-lived token
// from the `deepgramToken` Cloud Function instead.
const DEV_KEY = process.env.EXPO_PUBLIC_DEEPGRAM_API_KEY || '';

/** `Authorization` header for the WebSocket, or null (offline / not set up). */
export async function liveAuthorization() {
    if (DEV_KEY) return `Token ${DEV_KEY}`;
    const token = await fetchSttToken();
    return token ? `Bearer ${token}` : null;
}

/** `keyterms`: names the worker is likely to say (options, clients…). */
export function liveUrl(lang, keyterms = []) {
    const params = [
        ['model', 'nova-3'],
        ['language', lang === 'es' ? 'es' : 'en'],
        ['encoding', 'linear16'],
        ['sample_rate', '16000'],
        ['channels', '1'],
        ['interim_results', 'true'],
        ['endpointing', '500'], // ms of silence that ends an answer
        ['utterance_end_ms', '1000'], // backstop when noise hides that silence
        // No smart_format / numerals: they turned "Torres one two three" into
        // "$12.03" and "quince coma cinco" into "15 coma 5". voiceParser reads
        // the words (and the digits Deepgram writes anyway).
    ];
    const seen = new Set();
    keyterms.forEach((k) => {
        const term = String(k || '').trim().slice(0, 60);
        if (!term || seen.has(term.toLowerCase()) || seen.size >= MAX_KEYTERMS) return;
        seen.add(term.toLowerCase());
        params.push(['keyterm', term]);
    });
    const query = params.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
    return `wss://api.deepgram.com/v1/listen?${query}`;
}

/** "Plástico, 24,5 kilos." -> "Plástico 24.5 kilos" — what the parser expects. */
export function cleanTranscript(text) {
    return String(text || '')
        .replace(/(\d)[.,](\d)/g, '$1\u0000$2') // keep decimal separators
        .replace(/[.,;:?!¿¡]/g, ' ')
        .replace(/\u0000/g, '.')
        .replace(/\s+/g, ' ')
        .trim();
}

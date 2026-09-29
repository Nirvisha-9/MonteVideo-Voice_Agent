/**
 * Calls the `interpret` Cloud Function to turn a messy transcript into ONE
 * canonical command the local parser understands. Used only as a fallback when
 * the on-device parser can't make sense of what the worker said, and only when
 * there's connectivity. Any failure (offline, timeout, error) resolves to null,
 * and the caller falls back to "say the number / option name".
 *
 * The LLM API key lives server-side in functions/.env — never here.
 */

const REGION = 'us-central1';
const TIMEOUT_MS = 7000;

// Must match APP_SHARED_TOKEN in functions/.env (leave both blank to disable).
const APP_SHARED_TOKEN = '';

let callableFn = null;
let transcribeFn = null;

function getFunctionsInstance() {
    // Loaded lazily so unit tests / environments without Firebase don't choke.
    // eslint-disable-next-line global-require
    require('../../firebase');
    // eslint-disable-next-line global-require
    const { getApp } = require('firebase/app');
    // eslint-disable-next-line global-require
    const { getFunctions, httpsCallable } = require('firebase/functions');
    return { functions: getFunctions(getApp(), REGION), httpsCallable };
}

function getCallable() {
    if (callableFn) return callableFn;
    const { functions, httpsCallable } = getFunctionsInstance();
    callableFn = httpsCallable(functions, 'interpret', { timeout: TIMEOUT_MS });
    return callableFn;
}

export async function interpretWithLLM(payload) {
    let timer = null;
    try {
        const call = getCallable();
        const result = await Promise.race([
            call({ ...payload, appToken: APP_SHARED_TOKEN }),
            new Promise((_, reject) => {
                timer = setTimeout(() => reject(new Error('llm-timeout')), TIMEOUT_MS + 1000);
            }),
        ]);
        const data = result?.data;
        if (!data || !data.command) return null;
        return {
            command: String(data.command),
            confidence: Number(data.confidence) || 0,
            note: data.note || '',
        };
    } catch (e) {
        return null;
    } finally {
        if (timer) clearTimeout(timer);
    }
}

/* ------------------------------------------------ cloud speech-to-text   */

// The worker is waiting on this: give up quickly and use the phone's own
// transcript instead.
const STT_TIMEOUT_MS = 5000;
// After a failure (offline, not deployed) skip the cloud for a while so each
// answer doesn't wait out the timeout.
const STT_BACKOFF_MS = 60000;
let sttDownUntil = 0;

/**
 * Calls the `transcribe` Cloud Function with the worker's recorded answer.
 * Resolves to { transcript, command, confidence }, { error } (offline, timeout,
 * not deployed) or null (recently failed; skipped) — on anything but a result
 * the caller uses the on-device transcript.
 */
export async function transcribeWithCloud(payload) {
    if (Date.now() < sttDownUntil) return null;
    let timer = null;
    try {
        if (!transcribeFn) {
            const { functions, httpsCallable } = getFunctionsInstance();
            transcribeFn = httpsCallable(functions, 'transcribe', { timeout: STT_TIMEOUT_MS });
        }
        const result = await Promise.race([
            transcribeFn({ ...payload, appToken: APP_SHARED_TOKEN }),
            new Promise((_, reject) => {
                timer = setTimeout(() => reject(new Error('stt-timeout')), STT_TIMEOUT_MS);
            }),
        ]);
        const data = result?.data;
        if (!data) return null;
        return {
            transcript: String(data.transcript || ''),
            command: String(data.command || ''),
            confidence: Number(data.confidence) || 0,
        };
    } catch (e) {
        sttDownUntil = Date.now() + STT_BACKOFF_MS;
        return { error: String(e?.message || e) };
    } finally {
        if (timer) clearTimeout(timer);
    }
}

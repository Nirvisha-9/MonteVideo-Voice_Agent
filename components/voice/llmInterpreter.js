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

function getCallable() {
    if (callableFn) return callableFn;
    // Loaded lazily so unit tests / environments without Firebase don't choke.
    // eslint-disable-next-line global-require
    require('../../firebase');
    // eslint-disable-next-line global-require
    const { getApp } = require('firebase/app');
    // eslint-disable-next-line global-require
    const { getFunctions, httpsCallable } = require('firebase/functions');
    const functions = getFunctions(getApp(), REGION);
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

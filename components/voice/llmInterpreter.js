/**
 * Calls the `interpret` Cloud Function to turn a messy transcript into ONE
 * canonical command the local parser understands. Used only as a fallback when
 * the on-device parser can't make sense of what the worker said, and only when
 * there's connectivity. Any failure (offline, timeout, error) resolves to null,
 * and the caller falls back to "say the number / option name".
 *
 * The LLM API key lives server-side in functions/.env — never here.
 */

import { JEV_DIRECT, chooseDirect } from './jevDirect';

const REGION = 'us-central1';
const TIMEOUT_MS = 7000;

// Development only: "host:port" of a local Functions emulator
// (`firebase emulators:start --only functions`, reached from the phone with
// `adb reverse tcp:5001 tcp:5001`). Set in .env.local; leave unset otherwise.
const EMULATOR = process.env.EXPO_PUBLIC_FUNCTIONS_EMULATOR || '';
let emulatorConnected = false;

// Must match APP_SHARED_TOKEN in functions/.env (leave both blank to disable).
const APP_SHARED_TOKEN = '';

let callableFn = null;
let transcribeFn = null;
let tokenFn = null;
let chooseFn = null;
let reviseFn = null;

function getFunctionsInstance() {
    // Loaded lazily so unit tests / environments without Firebase don't choke.
    // eslint-disable-next-line global-require
    require('../../firebase');
    // eslint-disable-next-line global-require
    const { getApp } = require('firebase/app');
    // eslint-disable-next-line global-require
    const { getFunctions, httpsCallable, connectFunctionsEmulator } = require('firebase/functions');
    const functions = getFunctions(getApp(), REGION);
    if (EMULATOR && !emulatorConnected) {
        const [host, port] = EMULATOR.split(':');
        connectFunctionsEmulator(functions, host, Number(port) || 5001);
        emulatorConnected = true;
    }
    return { functions, httpsCallable };
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

/**
 * Calls the `revise` Cloud Function: is the worker correcting a saved item on
 * the summary screen, and to what? Resolves to { action, item, category,
 * subcategory, weight } or null on any failure — the caller then treats the
 * answer as an ordinary summary command.
 */
export async function reviseWithLLM(payload) {
    let timer = null;
    try {
        if (!reviseFn) {
            const { functions, httpsCallable } = getFunctionsInstance();
            reviseFn = httpsCallable(functions, 'revise', { timeout: TIMEOUT_MS });
        }
        const result = await Promise.race([
            reviseFn({ ...payload, appToken: APP_SHARED_TOKEN }),
            new Promise((_, reject) => {
                timer = setTimeout(() => reject(new Error('llm-timeout')), TIMEOUT_MS + 1000);
            }),
        ]);
        const data = result?.data;
        if (!data) return null;
        return {
            action: data.action === 'revise' ? 'revise' : 'none',
            item: String(data.item || ''),
            category: String(data.category || ''),
            subcategory: String(data.subcategory || ''),
            weight: Number(data.weight) || 0,
            note: data.note || '',
        };
    } catch (e) {
        return null;
    } finally {
        if (timer) clearTimeout(timer);
    }
}

/* ------------------------------------------------ option scoring (Jev)   */

// Jev answers in ~0.1 s; the rest is the round trip (and a cold start).
const CHOOSE_TIMEOUT_MS = 4000;
// After a failure (offline, not deployed) skip it for a while so each answer
// doesn't wait out the timeout.
const CHOOSE_BACKOFF_MS = 60000;
let chooseDownUntil = 0;

/**
 * Which of `options` did the worker mean? Asks Jev through the `choose` Cloud
 * Function — or straight from the app in a build that carries the TypeSafe key
 * (see jevDirect.js), which needs no Cloud Functions.
 * Resolves to { index, label, control, confidence, top }, { error } (offline,
 * timeout, not deployed) or null (recently failed; skipped) — on anything but
 * a result the caller uses the on-device parser.
 */
export async function chooseWithJev(payload) {
    if (Date.now() < chooseDownUntil) return null;
    let timer = null;
    try {
        let data = null;
        if (JEV_DIRECT) {
            data = await chooseDirect(payload, CHOOSE_TIMEOUT_MS);
        } else {
            if (!chooseFn) {
                const { functions, httpsCallable } = getFunctionsInstance();
                chooseFn = httpsCallable(functions, 'choose', { timeout: CHOOSE_TIMEOUT_MS });
            }
            const result = await Promise.race([
                chooseFn({ ...payload, appToken: APP_SHARED_TOKEN }),
                new Promise((_, reject) => {
                    timer = setTimeout(() => reject(new Error('choose-timeout')), CHOOSE_TIMEOUT_MS);
                }),
            ]);
            data = result?.data;
        }
        if (!data) return null;
        return {
            index: Number.isInteger(data.index) ? data.index : -1,
            label: String(data.label || ''),
            control: data.control || null,
            confidence: Number(data.confidence) || 0,
            top: Array.isArray(data.top) ? data.top : [],
        };
    } catch (e) {
        chooseDownUntil = Date.now() + CHOOSE_BACKOFF_MS;
        return { error: String(e?.message || e) };
    } finally {
        if (timer) clearTimeout(timer);
    }
}

/* ------------------------------------------------ live speech-to-text    */

/**
 * Asks the `deepgramToken` Cloud Function for a short-lived token to open the
 * live transcription WebSocket with. Resolves to null on any failure (offline,
 * not deployed) — the caller then uses the on-device recognizer.
 */
export async function fetchSttToken() {
    let timer = null;
    try {
        if (!tokenFn) {
            const { functions, httpsCallable } = getFunctionsInstance();
            tokenFn = httpsCallable(functions, 'deepgramToken', { timeout: TIMEOUT_MS });
        }
        const result = await Promise.race([
            tokenFn({ appToken: APP_SHARED_TOKEN }),
            new Promise((_, reject) => {
                timer = setTimeout(() => reject(new Error('token-timeout')), TIMEOUT_MS);
            }),
        ]);
        return result?.data?.token ? String(result.data.token) : null;
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

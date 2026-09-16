import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

/**
 * Offline voice engine for the Voice Agent.
 *
 *   STT : react-native-vosk   — a self-contained recognizer + model bundled in
 *         the app. No Google / OEM speech services, no network, no API keys.
 *   TTS : expo-speech         — device text-to-speech (present on every Android).
 *
 * Turn-based: Monte speaks -> `speak()` fires `onDone` (guaranteed, timeout
 * fallback) -> the screen calls `listen(grammar)` -> Vosk returns a transcript
 * constrained to that screen's grammar -> pushed to `onTranscript`.
 *
 * Vosk is loaded defensively so the screen still works through the typed input
 * on a build where the native module isn't linked (Expo Go, tests).
 */

let Speech = null;
try {
    // eslint-disable-next-line global-require
    Speech = require('expo-speech');
} catch (e) {
    Speech = null;
}

let Vosk = null;
try {
    // eslint-disable-next-line global-require
    Vosk = require('react-native-vosk');
} catch (e) {
    Vosk = null;
}

const MAX_EVENTS = 12;
const MODEL_LOAD_TIMEOUT = 180000; // first launch copies ~80 MB out of the APK
const stamp = () => {
    const d = new Date();
    return `${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
};

// Only one Vosk model is loaded natively at a time — loading a second one
// replaces the first. So we track which model is actually loaded, and serialize
// all loads through one chain (react-native-vosk's bundle unpack deletes +
// recopies the model dir; two concurrent copies corrupt it).
let loadedModelName = null;
let loadChain = Promise.resolve();

function doLoad(name, onLog) {
    return new Promise((resolve, reject) => {
        if (!Vosk) {
            reject(new Error('native module missing'));
            return;
        }
        const t0 = Date.now();
        let done = false;
        const timer = setTimeout(() => {
            if (done) return;
            done = true;
            onLog?.(`model "${name}" load TIMED OUT after ${Math.round((Date.now() - t0) / 1000)}s`);
            reject(new Error('timed out — the model copy is taking too long'));
        }, MODEL_LOAD_TIMEOUT);
        onLog?.(`loadModel("${name}") — first launch copies the model, please wait`);
        Vosk.loadModel(name)
            .then(() => {
                if (done) return;
                done = true;
                clearTimeout(timer);
                loadedModelName = name;
                onLog?.(`model "${name}" loaded in ${Math.round((Date.now() - t0) / 1000)}s`);
                resolve();
            })
            .catch((e) => {
                if (done) return;
                done = true;
                clearTimeout(timer);
                if (loadedModelName === name) loadedModelName = null;
                const msg = String(e?.message || e);
                onLog?.(`model "${name}" load FAILED: ${msg}`);
                reject(
                    new Error(
                        /not.*found|no such|does not|IOException|list/i.test(msg)
                            ? `"${name}" isn't in this build — rebuild the app (npx expo run:android)`
                            : msg
                    )
                );
            });
    });
}

export function loadModelOnce(name, onLog) {
    if (loadedModelName === name) return Promise.resolve();
    const p = loadChain.catch(() => {}).then(() => {
        if (loadedModelName === name) return undefined; // loaded by an earlier queued call
        return doLoad(name, onLog);
    });
    loadChain = p.catch(() => {});
    return p;
}

export default function useSpeech({ lang = 'en', model = 'model-en-en', onTranscript, onNoResult } = {}) {
    const [status, setStatus] = useState(Vosk ? 'loading' : 'unavailable');
    const [partial, setPartial] = useState('');
    const [lastError, setLastError] = useState('');
    const [events, setEvents] = useState([]);
    const [modelReady, setModelReady] = useState(false);
    const [loadElapsed, setLoadElapsed] = useState(0);
    const [loadAttempt, setLoadAttempt] = useState(0);

    const statusRef = useRef(status);
    const speakingRef = useRef(false);
    const listeningRef = useRef(false);
    const gotResultRef = useRef(false);
    const subsRef = useRef([]);
    const lastFinal = useRef({ t: '', at: 0 });

    const onTranscriptRef = useRef(onTranscript);
    const onNoResultRef = useRef(onNoResult);
    onTranscriptRef.current = onTranscript;
    onNoResultRef.current = onNoResult;

    const ttsLang = lang === 'es' ? 'es-ES' : 'en-US';

    const set = useCallback((s) => {
        statusRef.current = s;
        setStatus(s);
    }, []);
    const log = useCallback((line) => {
        setEvents((p) => [`${stamp()}  ${line}`, ...p].slice(0, MAX_EVENTS));
    }, []);

    const retryModel = useCallback(() => {
        setLastError('');
        setModelReady(false);
        set('loading');
        setLoadAttempt((n) => n + 1);
    }, [set]);

    /* ------------------------------------------------------- load the model */
    useEffect(() => {
        if (!Vosk) {
            setLastError('react-native-vosk native module is not in this build — rebuild required.');
            return undefined;
        }
        if (modelReady) return undefined;
        let alive = true;
        set('loading');
        setLoadElapsed(0);
        const tick = setInterval(() => alive && setLoadElapsed((s) => s + 1), 1000);

        loadModelOnce(model, log)
            .then(() => {
                if (!alive) return;
                setModelReady(true);
                set('idle');
            })
            .catch((e) => {
                if (!alive) return;
                setLastError(`voice model didn't load: ${e?.message || e}`);
                set('error');
            });

        return () => {
            alive = false;
            clearInterval(tick);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [model, loadAttempt]);

    // Free the recognizer (not the model) when the screen goes away.
    useEffect(
        () => () => {
            try {
                Vosk?.stop();
            } catch (e) {
                /* ignore */
            }
        },
        []
    );

    /* ------------------------------------------------------- STT events     */
    useEffect(() => {
        if (!Vosk) return undefined;
        const subs = [];
        const push = (s) => {
            if (s) subs.push(s);
        };
        push(
            Vosk.onResult?.((text) => {
                const t = String(text || '').trim();
                log(`result: "${t}"`);
                if (!t) return;
                const now = Date.now();
                if (t === lastFinal.current.t && now - lastFinal.current.at < 1200) return;
                lastFinal.current = { t, at: now };
                gotResultRef.current = true;
                setPartial('');
                stopInternal();
                if (!speakingRef.current) onTranscriptRef.current?.(t);
            })
        );
        push(
            Vosk.onPartialResult?.((text) => {
                const t = String(text || '').trim();
                if (t) setPartial(t);
            })
        );
        push(
            Vosk.onFinalResult?.((text) => {
                const t = String(text || '').trim();
                log(`finalResult: "${t}"`);
                setPartial('');
            })
        );
        push(
            Vosk.onError?.((e) => {
                log(`ERROR: ${e}`);
                setLastError(String(e));
                listeningRef.current = false;
                set('idle');
                if (!speakingRef.current && !gotResultRef.current) onNoResultRef.current?.(String(e));
            })
        );
        push(
            Vosk.onTimeout?.(() => {
                log('timeout (no speech)');
                listeningRef.current = false;
                set('idle');
                if (!speakingRef.current && !gotResultRef.current) onNoResultRef.current?.('timeout');
            })
        );
        subsRef.current = subs;
        return () => {
            subs.forEach((s) => {
                try {
                    s.remove();
                } catch (e) {
                    /* ignore */
                }
            });
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [set, log]);

    const stopInternal = () => {
        listeningRef.current = false;
        try {
            Vosk?.stop();
        } catch (e) {
            /* ignore */
        }
        if (statusRef.current === 'listening') set('idle');
    };

    /* ------------------------------------------------------- controls       */
    const listen = useCallback(
        (grammar, { timeout = 30000 } = {}) => {
            if (!Vosk || !modelReady) {
                log(`listen() skipped — ${!Vosk ? 'no module' : 'model not ready'}`);
                return;
            }
            if (speakingRef.current) {
                log('listen() skipped — still speaking');
                return;
            }
            try {
                Vosk.stop();
            } catch (e) {
                /* ignore */
            }
            gotResultRef.current = false;
            listeningRef.current = true;
            setLastError('');
            set('listening');
            const opts = { timeout };
            if (Array.isArray(grammar) && grammar.length) opts.grammar = grammar;
            Vosk.start(opts)
                .then(() => log(`listening (grammar ${opts.grammar ? opts.grammar.length + ' words' : 'off'})`))
                .catch((e) => {
                    listeningRef.current = false;
                    set('idle');
                    setLastError(String(e));
                    log(`start() rejected: ${e}`);
                    onNoResultRef.current?.(String(e));
                });
        },
        [modelReady, set, log]
    );

    const stopListening = useCallback(() => {
        stopInternal();
        setPartial('');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const speak = useCallback(
        (text, { onDone } = {}) => {
            let finished = false;
            const finish = () => {
                if (finished) return;
                finished = true;
                speakingRef.current = false;
                if (statusRef.current === 'speaking') set('idle');
                onDone?.();
            };
            if (!text || !Speech) {
                finish();
                return;
            }
            speakingRef.current = true;
            set('speaking');
            try {
                Vosk?.stop();
            } catch (e) {
                /* ignore */
            }
            try {
                Speech.stop();
            } catch (e) {
                /* ignore */
            }
            const cap = Math.min(20000, 1600 + String(text).length * 75);
            const timer = setTimeout(() => {
                log('TTS onDone never fired — timeout');
                finish();
            }, cap);
            const wrap = () => {
                clearTimeout(timer);
                finish();
            };
            try {
                Speech.speak(String(text), {
                    language: ttsLang,
                    pitch: 1.0,
                    rate: Platform.OS === 'ios' ? 0.5 : 1.0,
                    onDone: wrap,
                    onStopped: wrap,
                    onError: wrap,
                });
            } catch (e) {
                wrap();
            }
        },
        [ttsLang, set, log]
    );

    const stopSpeaking = useCallback(() => {
        try {
            Speech?.stop();
        } catch (e) {
            /* ignore */
        }
        speakingRef.current = false;
        if (statusRef.current === 'speaking') set('idle');
    }, [set]);

    // `init` kept for API compatibility with the screen — Vosk's start() asks
    // for the mic permission itself, so this just reports readiness.
    const init = useCallback(async () => !!Vosk && modelReady, [modelReady]);
    const refreshDiag = useCallback(() => {
        log(`diag: module=${!!Vosk} model=${modelReady ? 'ready' : 'not ready'} tts=${!!Speech}`);
    }, [modelReady, log]);

    useEffect(
        () => () => {
            try {
                Vosk?.stop();
            } catch (e) {
                /* ignore */
            }
            try {
                Speech?.stop();
            } catch (e) {
                /* ignore */
            }
        },
        []
    );

    const diag = {
        module: !!Vosk,
        tts: !!Speech,
        model: modelReady ? 'ready' : status === 'error' ? 'FAILED' : `loading ${loadElapsed}s`,
        lang,
    };

    return {
        status,
        partial,
        lastError,
        events,
        diag,
        loadElapsed,
        available: !!Vosk,
        modelReady,
        ttsAvailable: !!Speech,
        listening: status === 'listening',
        speaking: status === 'speaking',
        FATAL: [],
        init,
        listen,
        stopListening,
        speak,
        stopSpeaking,
        refreshDiag,
        retryModel,
        logEvent: log,
    };
}

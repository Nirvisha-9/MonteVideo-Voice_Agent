import { useCallback, useEffect, useRef, useState } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';

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
 * Hands-free interruption: `speak(text, { bargeIn: true, grammar })` also starts the
 * native VoiceDuplex listener (echo-cancelled mic). When the worker starts
 * talking over Monte it stops Monte, recognizes their sentence and pushes it to
 * `onTranscript` — the same path as a normal answer. Tapping still works too.
 *
 * Live session: with `live.enabled` (and connectivity) the mic is opened once
 * and streamed to Deepgram for as long as it stays enabled — see StreamSession
 * (native) and deepgramStream.js. `listen()` then just marks the worker's turn;
 * a complete answer is pushed to `onTranscript` like any other. Without a
 * connection everything above still works as described, on Vosk.
 *
 * Vosk is loaded defensively so the screen still works through the typed input
 * on a build where the native module isn't linked (Expo Go, tests).
 */

// eslint-disable-next-line import/first
import VoiceDuplex from '../../modules/voice-duplex';
import {
    CLOUD_VOICE,
    CLOUD_VOICE_RATE,
    cleanTranscript,
    cloudVoiceUrl,
    liveAuthorization,
    liveUrl,
} from './deepgramStream';

// How far (dB) the worker's voice must rise above what's left of Monte's voice
// in the echo-cancelled mic before Monte is interrupted.
const BARGE_IN_MARGIN_DB = 10;

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
const LIVE_RETRY_MS = 15000; // wait before reconnecting a lost live session
// How long the first question waits for the live session to connect. A line
// that starts before the session is up can't be interrupted by voice.
const LIVE_WAIT_MS = 2500;
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

async function micAllowed() {
    if (Platform.OS !== 'android') return true;
    try {
        const r = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
        return r === PermissionsAndroid.RESULTS.GRANTED;
    } catch (e) {
        return false;
    }
}

export default function useSpeech({ lang = 'en', model = 'model-en-en', onTranscript, onNoResult, live = null } = {}) {
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
    const speakIdRef = useRef(0); // bumped per line; a stopped line's callbacks are ignored
    const bargeIdRef = useRef(0); // native barge-in listener for the current line (0 = none)
    const answerIdRef = useRef(0); // native answer listener (0 = none)
    const callLineRef = useRef(null); // line spoken on the call path: { id, onStart, onDone, onProgress }

    // live session (mic streamed to Deepgram)
    const liveEnabled = !!live?.enabled && !!VoiceDuplex?.startStream;
    const [liveOn, setLiveOn] = useState(false);
    const [liveAttempt, setLiveAttempt] = useState(0);
    const [liveSettled, setLiveSettled] = useState(false); // connected, or gave up for now
    const liveOnRef = useRef(false);
    const liveIdRef = useRef(0); // native session (0 = none)
    const liveRetryRef = useRef(false); // the last attempt failed: wait before the next
    const utterRef = useRef(''); // settled part of the answer being spoken
    const liveKeytermsRef = useRef([]);
    liveKeytermsRef.current = live?.keyterms || [];

    const onTranscriptRef = useRef(onTranscript);
    const onNoResultRef = useRef(onNoResult);
    onTranscriptRef.current = onTranscript;
    onNoResultRef.current = onNoResult;

    const ttsLang = lang === 'es' ? 'es-ES' : 'en-US';

    // Monte's cloud voice for this language (see CLOUD_VOICE), and what
    // authorizes it. A short-lived token is fetched again after ~50 s; meanwhile
    // a refused line falls back to the phone's voice on its own (native side).
    const cloudModel = VoiceDuplex?.speakCloudOnCall ? CLOUD_VOICE[lang] || null : null;
    const cloudAuthRef = useRef({ value: null, at: 0, loading: false });
    const refreshCloudAuth = () => {
        const a = cloudAuthRef.current;
        if (!cloudModel || a.loading) return;
        a.loading = true;
        liveAuthorization()
            .then((value) => {
                cloudAuthRef.current = { value, at: Date.now(), loading: false };
            })
            .catch(() => {
                cloudAuthRef.current = { ...cloudAuthRef.current, loading: false };
            });
    };
    useEffect(() => {
        cloudAuthRef.current = { value: null, at: 0, loading: false };
        refreshCloudAuth();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cloudModel]);

    // A line on the call path: the cloud voice when it's set up, else the phone's.
    const speakOnCallPath = (text, id) => {
        const auth = cloudAuthRef.current;
        if (auth.value?.startsWith('Bearer') && Date.now() - auth.at > 50000) refreshCloudAuth();
        if (cloudModel && auth.value) {
            VoiceDuplex.speakCloudOnCall(String(text), cloudVoiceUrl(cloudModel), auth.value, CLOUD_VOICE_RATE, ttsLang, id);
        } else {
            VoiceDuplex.speakOnCall(String(text), ttsLang, id);
        }
    };

    const set = useCallback((s) => {
        statusRef.current = s;
        setStatus(s);
    }, []);
    const mountedAt = useRef(Date.now()).current;
    const log = useCallback((line) => {
        // ms since the voice screen opened, to see where startup time goes
        // eslint-disable-next-line no-console
        if (__DEV__) console.log(`[voice +${Date.now() - mountedAt}ms] ${line}`); // shown in Metro
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
                if (statusRef.current === 'loading') set('idle');
            })
            .catch((e) => {
                if (!alive) return;
                setLastError(`voice model didn't load: ${e?.message || e}`);
                if (!liveOnRef.current) set('error'); // the live session doesn't need it
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

    // Stop Monte, whichever voice path the current line is on.
    const stopTts = () => {
        try {
            Speech?.stop();
        } catch (e) {
            /* ignore */
        }
        if (callLineRef.current) {
            callLineRef.current = null;
            try {
                VoiceDuplex?.stopSpeakingOnCall();
            } catch (e) {
                /* ignore */
            }
        }
        if (liveOnRef.current) VoiceDuplex.streamSpeakEnd(0); // back to the worker
    };

    // The worker finished an answer in the live session.
    const commitLive = () => {
        const t = utterRef.current.trim();
        utterRef.current = '';
        setPartial('');
        if (!t) return;
        log(`result (live): "${t}"`);
        gotResultRef.current = true;
        onTranscriptRef.current?.(t, null);
    };

    const stopBargeIn = () => {
        if (!bargeIdRef.current) return;
        bargeIdRef.current = 0;
        try {
            VoiceDuplex?.stopBargeIn();
        } catch (e) {
            /* ignore */
        }
    };

    /* ------------------------------------------------------- barge-in       */
    useEffect(() => {
        if (!VoiceDuplex) return undefined;
        const subs = [
            // The worker started talking over Monte: stop Monte, like a tap.
            VoiceDuplex.addListener('onBargeInSpeech', ({ id }) => {
                if (id !== bargeIdRef.current || !speakingRef.current) return;
                log('you spoke — stopping Monte');
                speakIdRef.current += 1; // Monte was cut off: skip its onDone
                stopTts();
                speakingRef.current = false;
                set('listening');
            }),
            // Their sentence, recognized after Monte stopped.
            VoiceDuplex.addListener('onBargeInResult', ({ id, text, audio }) => {
                if (id !== bargeIdRef.current) return;
                bargeIdRef.current = 0;
                const t = String(text || '').trim();
                log(`result (interrupt): "${t}"`);
                set('idle');
                if (t || audio) {
                    gotResultRef.current = true;
                    onTranscriptRef.current?.(t, audio || null);
                } else {
                    onNoResultRef.current?.('timeout');
                }
            }),
            VoiceDuplex.addListener('onBargeInLog', ({ text }) => log(text)),
            // The worker's answer after Monte finished (see listen).
            VoiceDuplex.addListener('onListenPartial', ({ id, text }) => {
                if (id === answerIdRef.current && text) setPartial(text);
            }),
            VoiceDuplex.addListener('onListenResult', ({ id, text, audio }) => {
                if (id !== answerIdRef.current) return;
                answerIdRef.current = 0;
                listeningRef.current = false;
                setPartial('');
                set('idle');
                const t = String(text || '').trim();
                log(`result: "${t}"${audio ? ' (+audio)' : ''}`);
                if (speakingRef.current) return;
                if (t || audio) {
                    gotResultRef.current = true;
                    onTranscriptRef.current?.(t, audio || null);
                } else {
                    onNoResultRef.current?.('timeout');
                }
            }),
            // Monte's voice on the call path (see speak).
            VoiceDuplex.addListener('onCallSpeechStart', ({ id }) => {
                if (callLineRef.current?.id === id) callLineRef.current.onStart();
            }),
            VoiceDuplex.addListener('onCallSpeechRange', ({ id, start }) => {
                if (callLineRef.current?.id === id) callLineRef.current.onProgress?.(start);
            }),
            VoiceDuplex.addListener('onCallSpeechDone', ({ id }) => {
                const line = callLineRef.current;
                if (line?.id !== id) return;
                callLineRef.current = null;
                line.onDone();
            }),
            // Live session connected / lost.
            VoiceDuplex.addListener('onStreamState', ({ id, state, reason }) => {
                if (id !== liveIdRef.current) return;
                if (state === 'open') {
                    log(`live transcription connected${speakingRef.current ? ' (Monte already speaking)' : ''}`);
                    const wasListening = listeningRef.current;
                    stopInternal(); // the session owns the mic now
                    utterRef.current = '';
                    liveRetryRef.current = false;
                    liveOnRef.current = true;
                    setLiveOn(true);
                    setLiveSettled(true);
                    setLastError('');
                    if (speakingRef.current) {
                        // a line that started before the session: don't transcribe Monte
                        VoiceDuplex.streamSpeakBegin(speakIdRef.current, false);
                    } else if (wasListening) {
                        listeningRef.current = true;
                        set('listening');
                    } else if (statusRef.current === 'loading' || statusRef.current === 'error') {
                        set('idle');
                    }
                    return;
                }
                log(`live transcription ${state}${reason ? `: ${reason}` : ''} — using offline voice`);
                const wasListening = liveOnRef.current && listeningRef.current && !speakingRef.current;
                liveIdRef.current = 0;
                liveOnRef.current = false;
                liveRetryRef.current = true;
                utterRef.current = '';
                setPartial('');
                setLiveOn(false);
                setLiveSettled(true);
                setLiveAttempt((n) => n + 1); // reconnect after LIVE_RETRY_MS
                if (wasListening) {
                    listeningRef.current = false;
                    set('idle');
                    onNoResultRef.current?.('live-lost'); // the screen re-opens the mic, on Vosk
                }
            }),
            // Deepgram's messages — see deepgramStream.js.
            VoiceDuplex.addListener('onStreamMessage', ({ id, json }) => {
                if (id !== liveIdRef.current || speakingRef.current) return; // Monte's turn
                let m = null;
                try {
                    m = JSON.parse(json);
                } catch (e) {
                    return;
                }
                if (m.type === 'Results') {
                    const text = cleanTranscript(m.channel?.alternatives?.[0]?.transcript);
                    if (!m.is_final) {
                        if (text) setPartial(`${utterRef.current} ${text}`.trim());
                        return;
                    }
                    if (text) utterRef.current = `${utterRef.current} ${text}`.trim();
                    if (m.speech_final) commitLive();
                    else setPartial(utterRef.current);
                } else if (m.type === 'UtteranceEnd') {
                    commitLive();
                }
            }),
            // The worker started talking over Monte (the session already stopped Monte).
            VoiceDuplex.addListener('onStreamBargeIn', ({ id }) => {
                if (id !== liveIdRef.current || !speakingRef.current) return;
                log('you spoke — stopping Monte');
                speakIdRef.current += 1; // Monte was cut off: skip its onDone
                stopTts();
                speakingRef.current = false;
                utterRef.current = '';
                listeningRef.current = true;
                set('listening');
            }),
        ];
        return () => {
            subs.forEach((s) => s.remove());
            stopBargeIn();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [set, log]);

    const firstLineRef = useRef(true); // log when Monte's first line is heard

    /* ------------------------------------------------------- live session   */
    useEffect(() => {
        liveRetryRef.current = false;
    }, [liveEnabled, lang]);

    useEffect(() => {
        if (!liveEnabled) return undefined;
        let alive = true;
        const retryLater = (why) => {
            log(`live transcription unavailable (${why}) — using offline voice`);
            liveRetryRef.current = true;
            setLiveSettled(true);
            setLiveAttempt((n) => n + 1);
        };
        // a reconnect happens in the background: the offline voice is in use
        if (liveRetryRef.current) setLiveSettled(true);
        const settleTimer = setTimeout(() => setLiveSettled(true), LIVE_WAIT_MS);
        const timer = setTimeout(async () => {
            const allowed = await micAllowed();
            const auth = allowed ? await liveAuthorization() : null;
            if (!alive) return;
            if (!allowed) {
                log('microphone permission denied');
                setLiveSettled(true);
                return;
            }
            if (!auth) {
                retryLater('no connection or not set up');
                return;
            }
            try {
                liveIdRef.current = VoiceDuplex.startStream(
                    liveUrl(lang, liveKeytermsRef.current), auth, BARGE_IN_MARGIN_DB
                );
            } catch (e) {
                retryLater(e?.message || e);
            }
        }, liveRetryRef.current ? LIVE_RETRY_MS : 0);
        return () => {
            alive = false;
            clearTimeout(timer);
            clearTimeout(settleTimer);
            setLiveSettled(false);
            if (liveIdRef.current) {
                liveIdRef.current = 0;
                try {
                    VoiceDuplex.stopStream();
                } catch (e) {
                    /* ignore */
                }
            }
            if (liveOnRef.current) {
                liveOnRef.current = false;
                setLiveOn(false);
                if (statusRef.current === 'listening') set('idle');
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [liveEnabled, lang, liveAttempt]);

    // Load the model for the barge-in recognizer early, so the first
    // interruption isn't slow.
    useEffect(() => {
        if (modelReady) VoiceDuplex?.preloadBargeIn(model);
    }, [modelReady, model]);

    const stopInternal = () => {
        listeningRef.current = false;
        try {
            Vosk?.stop();
        } catch (e) {
            /* ignore */
        }
        if (answerIdRef.current) {
            answerIdRef.current = 0;
            try {
                VoiceDuplex?.stopListening();
            } catch (e) {
                /* ignore */
            }
        }
        if (statusRef.current === 'listening') set('idle');
    };

    /* ------------------------------------------------------- controls       */
    const listen = useCallback(
        (grammar, { timeout = 30000 } = {}) => {
            if (speakingRef.current) {
                log('listen() skipped — still speaking');
                return;
            }
            // Live session: the mic is already open and streaming.
            if (liveOnRef.current) {
                gotResultRef.current = false;
                listeningRef.current = true;
                setLastError('');
                set('listening');
                return;
            }
            if (!Vosk || !modelReady) {
                log(`listen() skipped — ${!Vosk ? 'no module' : 'model not ready'}`);
                return;
            }
            // Native listener: same recognizer, but also hands back the audio
            // so the answer can be transcribed more accurately in the cloud.
            if (VoiceDuplex?.listen) {
                stopInternal();
                gotResultRef.current = false;
                listeningRef.current = true;
                setLastError('');
                set('listening');
                const words = Array.isArray(grammar) && grammar.length ? JSON.stringify(grammar) : null;
                try {
                    answerIdRef.current = VoiceDuplex.listen(model, words, timeout);
                    log(`listening (native, grammar ${words ? grammar.length + ' words' : 'off'})`);
                    return;
                } catch (e) {
                    answerIdRef.current = 0;
                    log(`native listen failed, using Vosk: ${e?.message || e}`);
                }
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [modelReady, set, log, model]
    );

    const stopListening = useCallback(() => {
        stopBargeIn();
        stopInternal();
        setPartial('');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const speak = useCallback(
        (text, { onDone, onProgress, bargeIn = false, grammar = null } = {}) => {
            let finished = false;
            speakIdRef.current += 1;
            const id = speakIdRef.current;
            const finish = () => {
                if (finished) return;
                finished = true;
                // Stopped (tap to talk) or replaced by a newer line: its "done"
                // must not re-open the mic or reset the newer line's state.
                if (id !== speakIdRef.current) return;
                stopBargeIn(); // Monte finished without being interrupted
                if (liveOnRef.current) VoiceDuplex.streamSpeakEnd(id); // back to the worker
                speakingRef.current = false;
                if (statusRef.current === 'speaking') set('idle');
                onDone?.();
            };
            if (!text || !Speech) {
                finish();
                return;
            }
            if (firstLineRef.current) log(`first line starts (${liveOnRef.current ? 'live' : 'offline'})`);
            speakingRef.current = true;
            set('speaking');
            stopInternal(); // Monte talks: close the mic (either recognizer)
            stopBargeIn();
            stopTts();
            const cap = Math.min(20000, 1600 + String(text).length * 75);
            const timer = setTimeout(() => {
                log('TTS onDone never fired — timeout');
                finish();
            }, cap);
            const wrap = () => {
                clearTimeout(timer);
                finish();
            };
            // Start listening for an interruption only once Monte's voice is
            // actually playing — the listener learns how loud Monte is from its
            // first moments, and the TTS engine can take ~1 s to start.
            const startBargeIn = () => {
                if (liveOnRef.current) return; // the session listens for interruptions itself
                if (!bargeIn || !VoiceDuplex || !modelReady) return;
                if (finished || id !== speakIdRef.current) return;
                try {
                    // same word list the normal answer would get (see listen)
                    const words = Array.isArray(grammar) && grammar.length ? JSON.stringify(grammar) : null;
                    bargeIdRef.current = VoiceDuplex.startBargeIn(model, BARGE_IN_MARGIN_DB, words);
                } catch (e) {
                    bargeIdRef.current = 0;
                    log(`barge-in unavailable: ${e?.message || e}`);
                }
            };
            // Live session: Monte talks on the call path and the session stops
            // streaming until the line is over (or the worker talks over it).
            if (liveOnRef.current) {
                utterRef.current = '';
                setPartial('');
                const onStart = () => {
                    if (firstLineRef.current) log('first line audible');
                    firstLineRef.current = false;
                };
                callLineRef.current = { id, onStart, onDone: wrap, onProgress };
                try {
                    VoiceDuplex.streamSpeakBegin(id, !!bargeIn);
                    speakOnCallPath(text, id);
                    return;
                } catch (e) {
                    callLineRef.current = null;
                    log(`call voice unavailable: ${e?.message || e}`);
                }
            }
            // With barge-in, Monte talks on the call path so the phone's echo
            // canceller removes Monte from the mic; as ordinary media Monte is
            // as loud in the mic as the worker and can't be interrupted.
            if (bargeIn && VoiceDuplex?.speakOnCall && modelReady) {
                callLineRef.current = { id, onStart: startBargeIn, onDone: wrap, onProgress };
                try {
                    speakOnCallPath(text, id);
                    return;
                } catch (e) {
                    callLineRef.current = null;
                    log(`call voice unavailable: ${e?.message || e}`);
                }
            }
            try {
                Speech.speak(String(text), {
                    language: ttsLang,
                    pitch: 1.0,
                    rate: Platform.OS === 'ios' ? 0.5 : 1.0,
                    onStart: startBargeIn,
                    onDone: wrap,
                    onStopped: wrap,
                    onError: wrap,
                });
            } catch (e) {
                wrap();
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [ttsLang, set, log, modelReady, model]
    );

    const stopSpeaking = useCallback(() => {
        speakIdRef.current += 1; // cancel the current line's onDone
        stopBargeIn();
        stopTts();
        speakingRef.current = false;
        if (statusRef.current === 'speaking') set('idle');
    }, [set]);

    // `init` kept for API compatibility with the screen — Vosk's start() asks
    // for the mic permission itself, so this just reports readiness.
    const init = useCallback(async () => (!!Vosk && modelReady) || liveOn, [modelReady, liveOn]);
    const refreshDiag = useCallback(() => {
        log(`diag: module=${!!Vosk} model=${modelReady ? 'ready' : 'not ready'} tts=${!!Speech} live=${liveOn}`);
    }, [modelReady, liveOn, log]);

    useEffect(
        () => () => {
            stopInternal();
            stopBargeIn();
            stopTts(); // also leaves call-audio mode if Monte was on the call path
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        []
    );

    const diag = {
        module: !!Vosk,
        tts: !!Speech,
        model: modelReady ? 'ready' : status === 'error' ? 'FAILED' : `loading ${loadElapsed}s`,
        live: liveOn,
        lang,
    };

    return {
        status,
        partial,
        lastError,
        events,
        diag,
        loadElapsed,
        available: !!Vosk || liveEnabled,
        // Monte can be interrupted by voice (call-path voice + barge-in listener)
        canBargeIn: !!VoiceDuplex?.speakOnCall && (modelReady || liveOn),
        // ready to run a turn: the live session is up, or the offline model is
        // loaded and the live session isn't about to connect
        modelReady: liveOn || (modelReady && (!liveEnabled || liveSettled)),
        live: liveOn,
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

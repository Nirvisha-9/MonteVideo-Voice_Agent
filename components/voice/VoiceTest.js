import React, { useCallback, useEffect, useRef, useState } from 'react';
import { SafeAreaView, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import styles, { VC } from './voiceStyles';

/**
 * Bare-metal offline STT test — drives react-native-vosk directly so we can see
 * whether the model loads and recognition works on this device.
 */

import { loadModelOnce } from './useSpeech';

let Vosk = null;
try {
    // eslint-disable-next-line global-require
    Vosk = require('react-native-vosk');
} catch (e) {
    Vosk = null;
}

const MODEL = 'model-en-en';
const GRAMMAR = ['yes', 'no', 'hello world', 'monte', 'one', 'two', 'three', '[unk]'];

export default function VoiceTest({ onClose }) {
    const [lines, setLines] = useState([]);
    const [result, setResult] = useState('');
    const [partial, setPartial] = useState('');
    const [ready, setReady] = useState(false);
    const [listening, setListening] = useState(false);
    const subs = useRef([]);

    const add = useCallback((l) => {
        const t = new Date();
        const ts = `${String(t.getMinutes()).padStart(2, '0')}:${String(t.getSeconds()).padStart(2, '0')}`;
        setLines((p) => [`${ts}  ${l}`, ...p].slice(0, 40));
    }, []);

    useEffect(() => {
        if (!Vosk) {
            add('react-native-vosk native module NOT in this build.');
            return undefined;
        }
        subs.current = [
            Vosk.onResult((t) => {
                setResult(String(t));
                setPartial('');
                add(`RESULT: "${t}"`);
            }),
            Vosk.onPartialResult((t) => {
                if (t) setPartial(String(t));
            }),
            Vosk.onFinalResult((t) => add(`finalResult: "${t}"`)),
            Vosk.onError((e) => {
                add(`ERROR: ${e}`);
                setListening(false);
            }),
            Vosk.onTimeout(() => {
                add('timeout');
                setListening(false);
            }),
        ];
        add(`loading model "${MODEL}" … (first launch copies ~80 MB, be patient)`);
        const t0 = Date.now();
        loadModelOnce(MODEL, add)
            .then(() => {
                setReady(true);
                add(`✅ model ready (${Math.round((Date.now() - t0) / 1000)}s)`);
            })
            .catch((e) => add(`✖ model load FAILED: ${e?.message || e}`));

        return () => {
            subs.current.forEach((s) => {
                try {
                    s.remove();
                } catch (e) {
                    /* ignore */
                }
            });
            try {
                Vosk.stop();
            } catch (e) {
                /* ignore */
            }
            // NOTE: don't unload() — the model is shared with the Voice Agent.
        };
    }, [add]);

    const run = useCallback(() => {
        if (!Vosk || !ready) {
            add('not ready — model still loading?');
            return;
        }
        setResult('');
        setPartial('');
        add('start({ grammar }) … SAY "hello world"');
        setListening(true);
        Vosk.start({ grammar: GRAMMAR, timeout: 15000 })
            .then(() => add('started OK'))
            .catch((e) => {
                add(`start rejected: ${e}`);
                setListening(false);
            });
    }, [ready, add]);

    const stop = useCallback(() => {
        try {
            Vosk?.stop();
        } catch (e) {
            /* ignore */
        }
        setListening(false);
        add('stop()');
    }, [add]);

    return (
        <SafeAreaView style={styles.safe}>
            <View style={styles.topBar}>
                <TouchableOpacity style={styles.topBarBtn} onPress={onClose}>
                    <Text style={styles.topBarBtnText}>‹ Back</Text>
                </TouchableOpacity>
                <Text style={[styles.topBarBtnText, { fontSize: 15 }]}>Offline mic test (Vosk)</Text>
            </View>

            <View style={{ paddingHorizontal: 18 }}>
                <Text style={styles.question}>Vosk test</Text>
                <View style={[styles.transcriptCard, listening && styles.voiceStatusLive]}>
                    <Text style={styles.transcriptText}>
                        {!Vosk
                            ? 'module missing — rebuild'
                            : !ready
                              ? 'loading model…'
                              : listening
                                ? '🎤 LISTENING — say "hello world"'
                                : 'idle'}
                    </Text>
                    {partial ? <Text style={styles.transcriptPlaceholder}>“{partial}”…</Text> : null}
                    {result ? (
                        <Text style={[styles.weightValue, { fontSize: 24 }]}>“{result}”</Text>
                    ) : null}
                </View>

                <View style={{ flexDirection: 'row', marginTop: 10 }}>
                    <TouchableOpacity
                        style={[styles.primaryBtn, { flex: 1, marginRight: 8 }]}
                        onPress={run}
                    >
                        <Text style={styles.primaryBtnText}>▶ Run test</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.primaryBtn, { flex: 1, marginLeft: 8 }]}
                        onPress={stop}
                    >
                        <Text style={styles.primaryBtnText}>■ Stop</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView style={{ flex: 1, margin: 18 }} contentContainerStyle={{ paddingBottom: 30 }}>
                <View style={styles.diagBox}>
                    {lines.length === 0 ? (
                        <Text style={styles.diagEvent}>Waiting…</Text>
                    ) : (
                        lines.map((l, i) => (
                            <Text
                                key={i}
                                style={[
                                    styles.diagEvent,
                                    l.includes('ERROR') || l.includes('FAILED') ? { color: VC.danger } : null,
                                    l.includes('RESULT') || l.includes('OK') ? { color: VC.accent } : null,
                                ]}
                            >
                                {l}
                            </Text>
                        ))
                    )}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

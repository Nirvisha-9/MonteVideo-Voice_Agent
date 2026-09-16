import React, { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import styles from './voiceStyles';

// Animated "listening" waveform used on every voice screen (design doc).
export default function Listening({ active = true, label = 'Listening…' }) {
    const bars = useRef([0, 1, 2, 3, 4, 5, 6].map(() => new Animated.Value(0.3))).current;

    useEffect(() => {
        let loops = [];
        if (active) {
            loops = bars.map((v, i) =>
                Animated.loop(
                    Animated.sequence([
                        Animated.timing(v, { toValue: 1, duration: 320 + i * 45, useNativeDriver: true }),
                        Animated.timing(v, { toValue: 0.3, duration: 320 + i * 45, useNativeDriver: true }),
                    ])
                )
            );
            loops.forEach((l, i) => setTimeout(() => l.start(), i * 70));
        } else {
            bars.forEach((v) => v.setValue(0.3));
        }
        return () => loops.forEach((l) => l.stop());
    }, [active]);

    return (
        <View style={styles.listenWrap}>
            <View style={styles.listenRing}>
                <View style={styles.listenBars}>
                    {bars.map((v, i) => (
                        <Animated.View
                            key={i}
                            style={[
                                styles.bar,
                                {
                                    height: 34,
                                    transform: [{ scaleY: v }],
                                    opacity: active ? 1 : 0.35,
                                },
                            ]}
                        />
                    ))}
                </View>
            </View>
            <Animated.Text style={[styles.listenLabel, !active && styles.idleLabel]}>
                {active ? label : 'Tap the mic or type to reply'}
            </Animated.Text>
        </View>
    );
}

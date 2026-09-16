import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, SafeAreaView } from 'react-native';
import { VC } from './voiceStyles';

/**
 * Shown after "Voice Agent" is picked — choose the language the agent speaks
 * and understands. English is ready; Spanish uses the model-es-es Vosk model.
 */
export default function VoiceLangSelect({ onPick, onBack }) {
    return (
        <SafeAreaView style={styles.safe}>
            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                <Text style={styles.title}>Voice Agent</Text>
                <Text style={styles.subtitle}>Which language? · ¿Qué idioma?</Text>

                <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={() => onPick('en')}>
                    <Text style={styles.flag}>🇬🇧</Text>
                    <Text style={styles.cardTitle}>English</Text>
                    <Text style={styles.cardDesc}>Monte speaks and listens in English</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={() => onPick('es')}>
                    <Text style={styles.flag}>🇺🇾</Text>
                    <Text style={styles.cardTitle}>Español</Text>
                    <Text style={styles.cardDesc}>Monte habla y escucha en español</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={onBack} style={styles.backBtn}>
                    <Text style={styles.backTxt}>‹ Back</Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: VC.bg },
    scroll: { padding: 22, flexGrow: 1, justifyContent: 'center' },
    title: { color: VC.text, fontSize: 30, fontWeight: '900', textAlign: 'center' },
    subtitle: { color: VC.textDim, fontSize: 15, textAlign: 'center', marginTop: 6, marginBottom: 26 },
    card: {
        backgroundColor: VC.surface,
        borderWidth: 1.5,
        borderColor: VC.accentBorder,
        borderRadius: 20,
        padding: 24,
        marginBottom: 18,
        alignItems: 'center',
    },
    flag: { fontSize: 40, marginBottom: 8 },
    cardTitle: { color: VC.text, fontSize: 24, fontWeight: '900', marginBottom: 4 },
    cardDesc: { color: VC.textDim, fontSize: 14, textAlign: 'center' },
    backBtn: { alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 18, marginTop: 4 },
    backTxt: { color: VC.textDim, fontSize: 15, fontWeight: '600' },
});

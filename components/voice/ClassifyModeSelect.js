import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, SafeAreaView } from 'react-native';
import { WAKE_WORD } from './voiceCatalog';
import { VC } from './voiceStyles';

/**
 * Entry screen shown right after the user taps "Clasificar".
 * Two large, equally-weighted options (design doc, Fig. 2):
 *   - Manual      -> the existing tap-through Classify flow (unchanged)
 *   - Voice Agent -> the new hands-free prototype
 */
export default function ClassifyModeSelect({ onManual, onVoice }) {
    return (
        <SafeAreaView style={styles.safe}>
            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                <Text style={styles.title}>Clasificar</Text>
                <Text style={styles.subtitle}>How would you like to work today?</Text>

                <TouchableOpacity style={[styles.card, styles.manualCard]} activeOpacity={0.85} onPress={onManual}>
                    <View style={styles.iconWrapManual}>
                        <View style={styles.tapOuter}>
                            <View style={styles.tapInner} />
                        </View>
                    </View>
                    <Text style={styles.cardTitle}>Manual</Text>
                    <Text style={styles.cardDesc}>Tap through each screen yourself</Text>
                    <Text style={styles.cardMeta}>Quiet settings · precise single taps</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.card, styles.voiceCard]} activeOpacity={0.85} onPress={onVoice}>
                    <View style={styles.iconWrapVoice}>
                        <Text style={styles.micIcon}>🎙️</Text>
                    </View>
                    <Text style={styles.cardTitle}>Voice Agent</Text>
                    <Text style={styles.cardDesc}>Say “{WAKE_WORD}” and work hands-free</Text>
                    <Text style={styles.cardMeta}>Gloves on · hands full · reading from a few feet away</Text>
                </TouchableOpacity>

                <Text style={styles.footer}>Selection persists for the rest of the session</Text>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: VC.bg },
    scroll: { padding: 22, paddingTop: 28, flexGrow: 1, justifyContent: 'center' },
    title: {
        color: VC.text,
        fontSize: 30,
        fontWeight: '900',
        textAlign: 'center',
    },
    subtitle: {
        color: VC.textDim,
        fontSize: 15,
        textAlign: 'center',
        marginTop: 6,
        marginBottom: 26,
    },
    card: {
        borderRadius: 20,
        borderWidth: 1.5,
        padding: 22,
        marginBottom: 18,
    },
    manualCard: {
        backgroundColor: VC.surface,
        borderColor: VC.border,
    },
    voiceCard: {
        backgroundColor: '#12303A',
        borderColor: VC.accentBorder,
    },
    cardTitle: {
        color: VC.text,
        fontSize: 24,
        fontWeight: '900',
        marginBottom: 4,
    },
    cardDesc: { color: VC.textDim, fontSize: 15, marginBottom: 10 },
    cardMeta: { color: VC.textFaint, fontSize: 12.5, lineHeight: 18 },
    iconWrapManual: { marginBottom: 16 },
    iconWrapVoice: { marginBottom: 16 },
    tapOuter: {
        width: 46,
        height: 46,
        borderRadius: 999,
        borderWidth: 2,
        borderColor: VC.number,
        alignItems: 'center',
        justifyContent: 'center',
    },
    tapInner: {
        width: 14,
        height: 14,
        borderRadius: 999,
        backgroundColor: VC.number,
    },
    micIcon: { fontSize: 40 },
    footer: {
        color: VC.textFaint,
        fontSize: 12,
        textAlign: 'center',
        marginTop: 8,
    },
});

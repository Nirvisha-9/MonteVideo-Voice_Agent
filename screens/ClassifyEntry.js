import React, { useState } from 'react';
import Classify from './Classify';
import ClassifyModeSelect from '../components/voice/ClassifyModeSelect';
import VoiceLangSelect from '../components/voice/VoiceLangSelect';
import VoiceAgentFlow from '../components/voice/VoiceAgentFlow';

/**
 * Wraps the "Clasificar" entry point.
 *
 * - Tapping "Clasificar" shows a chooser: Manual vs. Voice Agent.
 * - "Manual"      -> the EXISTING Classify flow, completely unchanged.
 * - "Voice Agent" -> pick a language (English / Español) -> the voice prototype.
 * - Editing an existing classification (from History) skips straight to Manual.
 */
export default function ClassifyEntry(props) {
    const isEditingExisting = Boolean(props?.route?.params?.classification);
    const [mode, setMode] = useState(null); // null | 'manual' | 'voice'
    const [voiceLang, setVoiceLang] = useState(null); // 'en' | 'es'

    if (isEditingExisting || mode === 'manual') {
        return <Classify {...props} />;
    }

    if (mode === 'voice') {
        if (!voiceLang) {
            return (
                <VoiceLangSelect
                    onPick={setVoiceLang}
                    onBack={() => setMode(null)}
                />
            );
        }
        return (
            <VoiceAgentFlow
                {...props}
                lang={voiceLang}
                onExit={() => {
                    setVoiceLang(null);
                    setMode(null);
                }}
            />
        );
    }

    return (
        <ClassifyModeSelect
            onManual={() => setMode('manual')}
            onVoice={() => setMode('voice')}
        />
    );
}

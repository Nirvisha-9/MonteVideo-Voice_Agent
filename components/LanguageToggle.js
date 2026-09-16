import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { getLanguage, setLanguage, subscribeLanguage } from '../localization/dictionary';
import { COLORS, BORDER_RADIUS } from '../helper/theme';

const LanguageToggle = ({ style }) => {
    const [lang, setLang] = React.useState(getLanguage());

    React.useEffect(() => {
        const unsub = subscribeLanguage(setLang);
        return unsub;
    }, []);

    const toggleLang = () => {
        setLanguage(lang === 'es' ? 'en' : 'es');
    };

    return (
        <TouchableOpacity onPress={toggleLang} style={[styles.langToggle, style]}>
            <Text style={styles.langToggleText}>{lang.toUpperCase()}</Text>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    langToggle: { 
        paddingVertical: 8, 
        paddingHorizontal: 16, 
        borderRadius: BORDER_RADIUS.round, 
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.15)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.15,
        shadowRadius: 1.5,
        elevation: 2,
    },
    langToggleText: { 
        color: COLORS.white, 
        fontWeight: '800', 
        letterSpacing: 0.8, 
        fontSize: 13 
    }
});

export default LanguageToggle;

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ImageBackground, Image } from 'react-native';
import dictionary from '../localization/dictionary';
import { COLORS, SHADOWS, BORDER_RADIUS } from '../helper/theme';
import LanguageToggle from '../components/LanguageToggle';

const Welcome = ({ screenNames, navigation }) => {
    const handleNavigateToSignIn = () => navigation.navigate(screenNames.SIGNIN);

    return (
        <ImageBackground
            source={require('../assets/background_6.webp')}
            style={welcomeStyles.backgroundImage}
        >
            {/* tiny pill in the corner */}
            <LanguageToggle style={welcomeStyles.langToggleWrap} />

            <View style={welcomeStyles.mainContainer}>
                <View style={welcomeStyles.logoWrapper}>
                    <Image source={require('../assets/black_logo.png')} style={welcomeStyles.logo} />
                </View>
                <View style={welcomeStyles.buttonContainer}>
                    <TouchableOpacity style={welcomeStyles.signInbutton} onPress={handleNavigateToSignIn}>
                        <Text style={welcomeStyles.buttonText}>{dictionary?.welcome.signIn}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </ImageBackground>
    );
};

const welcomeStyles = StyleSheet.create({
    backgroundImage: { flex: 1, resizeMode: 'cover', justifyContent: 'center', alignItems: 'center' },
    mainContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', width: "100%", padding: 24 },
    buttonContainer: { 
        position: 'absolute',
        bottom: 50,
        left: 24,
        right: 24,
        alignItems: 'center',
    },
    signInbutton: { 
        paddingVertical: 16, 
        borderRadius: BORDER_RADIUS.large, 
        alignItems: 'center', 
        backgroundColor: COLORS.primary, 
        width: "100%",
        ...SHADOWS.medium 
    },
    logoWrapper: {
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 30,
        backgroundColor: COLORS.glassLight,
        borderRadius: BORDER_RADIUS.xlarge,
        ...SHADOWS.heavy,
        borderWidth: 1,
        borderColor: COLORS.borderLight,
    },
    logo: { 
        resizeMode: 'contain', 
        width: '90%',
        height: 120,
    },
    buttonText: { color: COLORS.white, fontSize: 18, fontWeight: '700', letterSpacing: 0.5 },

    langToggleWrap: { position: 'absolute', top: 50, right: 20, zIndex: 10 },
    langToggle: { 
        paddingVertical: 8, 
        paddingHorizontal: 16, 
        borderRadius: BORDER_RADIUS.round, 
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.15)',
    },
    langToggleText: { color: COLORS.white, fontWeight: '800', letterSpacing: 0.8, fontSize: 13 }
});

export default Welcome;
import React from 'react';
import { SafeAreaView, View, Text, StyleSheet, Image } from 'react-native';
import { COLORS, SHADOWS, BORDER_RADIUS } from '../helper/theme';

const Header = ({ client, location, title = "Default" }) => {
    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.container}>
                <View style={styles.headerContent}>
                    <View style={styles.logoContainer}>
                        <Image
                            source={require('../assets/logo.jpg')}
                            style={styles.logo}
                            resizeMode="contain"
                        />
                    </View>
                    <Text style={styles.headerTitle}>{title}</Text>
                    <View style={styles.profileContainer}>
                        <Image
                            source={require('../assets/profileImage.png')}
                            style={styles.userIcon}
                        />
                    </View>
                </View>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        backgroundColor: COLORS.white,
    },
    container: {
        backgroundColor: COLORS.white,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.borderDark,
        ...SHADOWS.light,
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 12,
    },
    logoContainer: {
        padding: 4,
        borderRadius: BORDER_RADIUS.small,
        backgroundColor: '#f1f5f9',
    },
    logo: {
        width: 100,
        height: 40,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.textDark,
        letterSpacing: 0.2,
    },
    profileContainer: {
        width: 36,
        height: 36,
        borderRadius: BORDER_RADIUS.round,
        backgroundColor: COLORS.primaryBg,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: COLORS.primary,
        overflow: 'hidden',
    },
    userIcon: {
        width: '100%',
        height: '100%',
    },
});

export default Header;
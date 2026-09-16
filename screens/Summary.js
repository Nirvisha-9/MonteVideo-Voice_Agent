import React, { useState } from 'react';
import { useUserContext } from '../context/useUserContext';
import { Image, ImageBackground, StyleSheet, Text, View } from 'react-native';
import dictionary from '../localization/dictionary';
import { ScrollView, TouchableOpacity } from 'react-native-gesture-handler';
import { COLORS, SHADOWS, BORDER_RADIUS } from '../helper/theme';
import LanguageToggle from '../components/LanguageToggle';

const Summary = ({ screenNames, route, navigation }) => {
    const { user } = useUserContext();

    const [totalBags] = useState(0);
    const [entries] = useState([
        { id: '1', date: 'Junio 18, 2024', label: '2 bolsas de plastico, 18kg' },
        { id: '2', date: 'Junio 20, 2024', label: '3 bolsas de plastico, 22kg' },
        { id: '3', date: 'Junio 21, 2024', label: '1 bolsa de plastico, 12kg' },
        { id: '4', date: 'Junio 19, 2024', label: '4 bolsas de plastico, 25kg' },
        { id: '5', date: 'Junio 22, 2024', label: '2 bolsas de plastico, 15kg' },
        { id: '6', date: 'Junio 20, 2024', label: '3 bolsas de plastico, 22kg' },
        { id: '7', date: 'Junio 23, 2024', label: '5 bolsas de plastico, 30kg' },
    ]);

    const handleDeleteEntry = () => {};
    const handleEditEntry = () => {};

    // Get initials for profile fallback
    const getInitials = (u) => {
        if (!u) return '';
        const first = u.first_name ? u.first_name.charAt(0) : '';
        const last = u.last_name ? u.last_name.charAt(0) : '';
        return (first + last).toUpperCase();
    };

    return (
        <ImageBackground
            source={require('../assets/background_7.jpg')}
            style={styles.backgroundImage}
            blurRadius={30}
        >
            <LanguageToggle style={{ position: 'absolute', top: 50, right: 24, zIndex: 10 }} />
            <View style={styles.darkOverlay}>
                <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
                    <View style={styles.container}>
                        <Text style={styles.title}>
                            {`${dictionary?.summary.summaryOf} ${user?.first_name ?? ''}`}
                        </Text>
                        
                        <View style={styles.profilePictureContainer}>
                            <View style={styles.profileAvatar}>
                                <Text style={styles.profileAvatarText}>{getInitials(user)}</Text>
                            </View>
                        </View>

                        <View style={styles.cardContainer}>
                            <Text style={styles.subTitle}>{dictionary?.summary.bagsRecycled}</Text>
                            <Text style={styles.bagNumber}>{totalBags}</Text>
                        </View>

                        <View style={styles.entriesContainer}>
                            {entries.map((entry) => (
                                <View key={entry.id} style={styles.entryRow}>
                                    <View style={styles.entryLeft}>
                                        <Text style={styles.entryDate}>{entry.date}</Text>
                                        <Text style={styles.entryText}>{entry.label}</Text>
                                    </View>
                                    <View style={styles.entryRight}>
                                        <TouchableOpacity onPress={handleEditEntry} style={styles.editButton}>
                                            <Text style={styles.buttonText}>
                                                {dictionary?.sharedFields?.edit || 'Editar'}
                                            </Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={handleDeleteEntry} style={styles.deleteButton}>
                                            <Text style={styles.buttonText}>
                                                {dictionary?.sharedFields?.cancel || 'Borrar'}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ))}
                        </View>
                    </View>
                </ScrollView>

                <View style={styles.bottomButtonContainer}>
                    <TouchableOpacity style={styles.addMoreButton}>
                        <Text style={styles.bottomButtonText}>
                            Agregar Más
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.finishButton}>
                        <Text style={styles.bottomButtonText}>
                            Terminar
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </ImageBackground>
    );
};

const styles = StyleSheet.create({
    backgroundImage: {
        flex: 1,
        resizeMode: 'cover',
    },
    darkOverlay: {
        flex: 1,
        backgroundColor: COLORS.overlayDark,
        paddingTop: 50,
        paddingHorizontal: 20,
    },
    scrollContainer: {
        flexGrow: 1,
        paddingBottom: 100, // Leave space for bottom buttons
    },
    container: {
        flex: 1,
        alignItems: 'center',
        width: '100%'
    },
    title: {
        color: COLORS.white,
        fontSize: 28,
        fontWeight: '800',
        textAlign: 'center',
        marginTop: 10,
        letterSpacing: 0.5,
    },
    profilePictureContainer: {
        marginTop: 20,
        alignItems: 'center',
    },
    profileAvatar: {
        width: 120,
        height: 120,
        borderRadius: BORDER_RADIUS.round,
        backgroundColor: COLORS.glassLight,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: COLORS.white,
        ...SHADOWS.heavy,
    },
    profileAvatarText: {
        color: COLORS.primaryDark,
        fontSize: 36,
        fontWeight: '800',
    },
    cardContainer: {
        marginVertical: 24,
        padding: 20,
        backgroundColor: COLORS.glassLight,
        borderRadius: BORDER_RADIUS.large,
        width: '100%',
        alignItems: 'center',
        ...SHADOWS.medium,
        borderWidth: 1,
        borderColor: COLORS.borderLight,
    },
    subTitle: {
        color: COLORS.textMedium,
        fontSize: 18,
        fontWeight: '700',
        textAlign: 'center'
    },
    bagNumber: {
        color: COLORS.primary,
        fontSize: 48,
        fontWeight: '800',
        textAlign: 'center',
        marginTop: 6,
    },
    entriesContainer: {
        width: '100%',
    },
    entryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        backgroundColor: COLORS.glassLight,
        borderRadius: BORDER_RADIUS.medium,
        marginBottom: 12,
        ...SHADOWS.light,
        borderWidth: 1,
        borderColor: COLORS.borderDark,
    },
    entryLeft: {
        flex: 1,
        paddingRight: 10,
    },
    entryRight: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    entryDate: {
        color: COLORS.primaryDark,
        fontSize: 14,
        fontWeight: '700',
    },
    entryText: {
        fontSize: 13,
        color: COLORS.textDark,
        marginTop: 2,
        fontWeight: '500',
    },
    buttonText: {
        fontSize: 12,
        color: COLORS.white,
        fontWeight: '700',
    },
    deleteButton: {
        backgroundColor: COLORS.danger,
        borderRadius: BORDER_RADIUS.small,
        paddingVertical: 8,
        paddingHorizontal: 12,
        marginLeft: 8,
        ...SHADOWS.light,
    },
    editButton: {
        backgroundColor: COLORS.secondary,
        borderRadius: BORDER_RADIUS.small,
        paddingVertical: 8,
        paddingHorizontal: 12,
        ...SHADOWS.light,
    },
    bottomButtonContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        padding: 20,
        backgroundColor: 'transparent',
    },
    addMoreButton: {
        flex: 1,
        backgroundColor: COLORS.white,
        paddingVertical: 16,
        borderRadius: BORDER_RADIUS.large,
        marginRight: 12,
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: COLORS.white,
        ...SHADOWS.medium,
    },
    finishButton: {
        flex: 1,
        backgroundColor: COLORS.primary,
        paddingVertical: 16,
        borderRadius: BORDER_RADIUS.large,
        alignItems: 'center',
        ...SHADOWS.medium,
    },
    bottomButtonText: {
        fontSize: 16,
        fontWeight: '800',
        color: COLORS.textDark,
        textAlign: 'center'
    }
});

// Since finishButton is primary color, make its text white
styles.bottomButtonText = {
    ...styles.bottomButtonText,
    color: COLORS.textDark, // for white button
};

export default Summary;
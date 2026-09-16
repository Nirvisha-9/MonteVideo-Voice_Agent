import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, ImageBackground, Image } from 'react-native';
import { useUserContext } from '../context/useUserContext';
import dictionary from '../localization/dictionary';
import LanguageToggle from '../components/LanguageToggle';
import { ScrollView } from 'react-native-gesture-handler';
import { COLORS, SHADOWS, BORDER_RADIUS } from '../helper/theme';

const Home = ({ screenNames, navigation }) => {
    const { user } = useUserContext();

    const handleGoBack = () => {
        navigation.navigate(screenNames.WELCOME);
    };

    const getInitials = (u) => {
        if (!u) return '';
        const first = u.first_name ? u.first_name.charAt(0) : '';
        const last = u.last_name ? u.last_name.charAt(0) : '';
        return (first + last).toUpperCase();
    };

    return (
        <ImageBackground
            source={require('../assets/background_7.jpg')}
            style={homeStyles.backgroundImage}
        >
            <View style={homeStyles.mainContainer}>
                <LanguageToggle style={{ position: 'absolute', top: 50, right: 24, zIndex: 10 }} />
                <TouchableOpacity onPress={handleGoBack} style={homeStyles.backButtonContainer}>
                    <Text style={homeStyles.backButton}>
                        {dictionary?.sharedFields.goBack}
                    </Text>
                </TouchableOpacity>
                <ScrollView contentContainerStyle={homeStyles.scrollContainer} showsVerticalScrollIndicator={false}>
                    <View style={homeStyles.subContainer}>
                        {/* Profile Banner */}
                        <View style={homeStyles.profileCard}>
                            <View style={homeStyles.avatarContainer}>
                                <Text style={homeStyles.avatarText}>
                                    {getInitials(user)}
                                </Text>
                            </View>
                            <View style={homeStyles.profileTextContainer}>
                                <Text style={homeStyles.title}>
                                    {`${dictionary.home.title}, ${user?.first_name ?? ''}`}
                                </Text>                    
                                <Text style={homeStyles.subTitle}>
                                    {dictionary.home.subtitle}
                                </Text>
                            </View>
                        </View>

                        {/* Menu Cards Grid */}
                        <View style={homeStyles.cardsGrid}>
                            <MenuCard
                                title={dictionary.home.menu.collectTitle}
                                navigation={navigation}
                                navigatePath={screenNames.COLLECT}
                                imagePath={require('../assets/recollect-image.png')}
                            />
                            <MenuCard
                                title={dictionary.home.menu.classifyTitle}
                                navigation={navigation}
                                navigatePath={screenNames.CLASSIFY}
                                imagePath={require('../assets/classify-image.png')}
                            />
                            <MenuCard
                                title={dictionary.home.menu.historyTitle}
                                navigation={navigation}
                                navigatePath={screenNames.PAST_COLLECTIONS}
                                imagePath={require('../assets/past-collections-image.png')}
                            />
                            <MenuCard
                                title={dictionary.home.menu.evidencesTitle}
                                navigation={navigation}
                                navigatePath={screenNames.EVIDENCES}
                                imagePath={require('../assets/evidences.jpg')}
                            />
                        </View>
                    </View>
                </ScrollView>
            </View>
        </ImageBackground>
    );
};

const MenuCard = ({ title, imagePath, navigation, navigatePath }) => {
    const handleNavigateToMenu = () => {
        navigation.navigate(navigatePath);
    };

    return (
        <TouchableOpacity onPress={handleNavigateToMenu} style={menuCardStyles.mainContainer}>
            <View style={menuCardStyles.textContainer}>
                <Text style={menuCardStyles.text}>
                    {title}
                </Text>
            </View>
            <View style={menuCardStyles.imageContainer}>
                <Image
                    source={imagePath}
                    style={menuCardStyles.picture}
                    resizeMode="cover"
                />
            </View>
        </TouchableOpacity>
    );
};

const menuCardStyles = StyleSheet.create({
    mainContainer: {
        flexDirection: "row",
        width: "100%",
        marginBottom: 16,
        borderRadius: BORDER_RADIUS.large,
        backgroundColor: COLORS.white,
        overflow: 'hidden',
        ...SHADOWS.medium,
        borderWidth: 1,
        borderColor: COLORS.borderDark,
    },
    imageContainer: {
        width: "35%",
        height: 100,
        backgroundColor: '#f1f5f9',
    },
    picture: {
        width: "100%",
        height: "100%",
    },
    textContainer: {
        width: "65%",
        justifyContent: 'center',
        paddingHorizontal: 20,
        paddingVertical: 15,
        backgroundColor: COLORS.white,
    },
    text: {
        color: COLORS.textDark,
        fontSize: 20,
        fontWeight: '700',
        letterSpacing: 0.2,
    }
});

const homeStyles = StyleSheet.create({
    backgroundImage: {
        flex: 1,
        width: '100%',
        height: '100%',
    },
    mainContainer: {
        flex: 1,
        width: "100%",
        paddingTop: 50,
        paddingHorizontal: 20,
        backgroundColor: COLORS.overlayDark,
    },
    backButtonContainer: {
        alignSelf: 'flex-start',
        marginBottom: 20,
    },
    backButton: {
        color: COLORS.white,
        fontSize: 16,
        fontWeight: '600',
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: BORDER_RADIUS.round,
    },
    scrollContainer: {
        flexGrow: 1,
        paddingBottom: 30,
    },
    subContainer: {
        width: "100%",
    },
    profileCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.glassLight,
        borderRadius: BORDER_RADIUS.large,
        padding: 20,
        marginBottom: 24,
        ...SHADOWS.heavy,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    avatarContainer: {
        width: 60,
        height: 60,
        borderRadius: BORDER_RADIUS.round,
        backgroundColor: COLORS.primaryBg,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
        borderWidth: 2,
        borderColor: COLORS.primary,
    },
    avatarText: {
        color: COLORS.primaryDark,
        fontSize: 20,
        fontWeight: '800',
    },
    profileTextContainer: {
        flex: 1,
    },
    title: {
        color: COLORS.textDark,
        fontSize: 22,
        fontWeight: "800",
        letterSpacing: 0.2,
    },
    subTitle: {
        color: COLORS.textLight,
        fontSize: 14,
        fontWeight: '500',
        marginTop: 4,
    },
    cardsGrid: {
        width: '100%',
    }
});

export default Home;
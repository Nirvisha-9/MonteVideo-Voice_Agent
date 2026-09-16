import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ImageBackground, Dimensions, ActivityIndicator } from 'react-native';
import dictionary from '../localization/dictionary';
import { getUsers } from '../services/userService';
import { ScrollView } from 'react-native-gesture-handler';
import { useUserContext } from '../context/useUserContext';
import { COLORS, SHADOWS, BORDER_RADIUS } from '../helper/theme';
import LanguageToggle from '../components/LanguageToggle';

const Signin = ({ screenNames, navigation }) => {
    const { setUser } = useUserContext();
    const [users, setUsers] = useState([]);
    const [noUsers, setNoUsers] = useState();

    const handleFetchUsers = async () => {
        try {
            const users = await getUsers();
            if (users && users.length < 1) {                
                setNoUsers(true);
            } else {
                setUsers(users);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handleGoBack = () => {
        navigation.navigate(screenNames.WELCOME);
    };

    const handleSelectUser = (user) => {
        setUser(user);
        navigation.navigate(screenNames.HOME);
    };

    useEffect(() => {
        handleFetchUsers();        
    }, []);

    // Get initials for the avatar
    const getInitials = (user) => {
        const first = user.first_name ? user.first_name.charAt(0) : '';
        const last = user.last_name ? user.last_name.charAt(0) : '';
        return (first + last).toUpperCase();
    };

    return (
        <ImageBackground
            source={require('../assets/background_6.webp')}
            style={signInStyles.backgroundImage}
        >
            <View style={signInStyles.mainContainer}>
                <LanguageToggle style={{ position: 'absolute', top: 50, right: 24, zIndex: 10 }} />
                <TouchableOpacity onPress={handleGoBack} style={signInStyles.backButtonContainer}>
                    <Text style={signInStyles.backButton}>
                        {dictionary?.sharedFields.goBack}
                    </Text>
                </TouchableOpacity>

                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={signInStyles.scrollContent}>
                    <Text style={signInStyles.title}>
                        {dictionary?.signIn.selectUserTitle}
                    </Text>
                    
                    <View style={signInStyles.userListContainer}>
                        {users.length > 0 && users.map((user) => (
                            <TouchableOpacity
                                key={user.id}
                                style={signInStyles.userEntryContainer}
                                onPress={() => handleSelectUser(user)}
                            >
                                <View style={signInStyles.avatarContainer}>
                                    <Text style={signInStyles.avatarText}>
                                        {getInitials(user)}
                                    </Text>
                                </View>
                                <View style={signInStyles.userInfoContainer}>
                                    <Text style={signInStyles.userEntryText}>
                                        {user.first_name} {user.last_name}
                                    </Text>
                                    {user.email && (
                                        <Text style={signInStyles.userSubText}>
                                            {user.email}
                                        </Text>
                                    )}
                                </View>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {noUsers &&
                        <View style={signInStyles.noUsersContainer}>
                            <Text style={signInStyles.noUsersText}>
                                {dictionary?.signIn.noUsersAvailable}
                            </Text>
                        </View>
                    }
                    {users.length <= 0 && !noUsers &&
                        <View style={signInStyles.loaderContainer}>
                            <ActivityIndicator
                                size={'large'}
                                color={COLORS.primary}
                            />
                        </View>
                    }
                </ScrollView>
            </View>
        </ImageBackground>
    );
};

const signInStyles = StyleSheet.create({
    backgroundImage: {
        position: 'absolute',
        left: 0,
        top: 0,
        width: Dimensions.get('window').width,
        height: Dimensions.get('window').height,
    },
    mainContainer: {
        flex: 1,
        width: "100%",
        paddingTop: 50,
        paddingHorizontal: 24,
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
    scrollContent: {
        paddingBottom: 40,
    },
    title: {
        color: COLORS.white,
        fontSize: 32,
        fontWeight: '800',
        marginTop: 20,
        marginBottom: 30,
        textAlign: 'center',
        lineHeight: 40,
        letterSpacing: 0.5,
    },
    userListContainer: {
        width: '100%',
    },
    userEntryContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: BORDER_RADIUS.large,
        backgroundColor: COLORS.glassLight,
        marginBottom: 14,
        ...SHADOWS.medium,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    avatarContainer: {
        width: 48,
        height: 48,
        borderRadius: BORDER_RADIUS.round,
        backgroundColor: COLORS.primaryBg,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
        borderWidth: 1.5,
        borderColor: COLORS.primary,
    },
    avatarText: {
        color: COLORS.primaryDark,
        fontSize: 18,
        fontWeight: '700',
    },
    userInfoContainer: {
        flex: 1,
    },
    userEntryText: {
        color: COLORS.textDark,
        fontSize: 18,
        fontWeight: '700',
    },
    userSubText: {
        color: COLORS.textLight,
        fontSize: 13,
        marginTop: 2,
    },
    noUsersContainer: {
        width: '100%',
        marginTop: 20,
    },
    noUsersText: {
        color: COLORS.white,
        padding: 16,
        fontSize: 16,
        textAlign: 'center',
        borderRadius: BORDER_RADIUS.medium,
        backgroundColor: 'rgba(255, 0, 0, 0.15)',
        borderWidth: 1,
        borderColor: 'rgba(255, 0, 0, 0.2)',
    },
    loaderContainer: {
        marginTop: 60,
        justifyContent: 'center',
        alignItems: 'center',
    }
});

export default Signin;
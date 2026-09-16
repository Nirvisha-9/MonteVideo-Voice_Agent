import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ImageBackground, Image, TextInput, Dimensions } from 'react-native';
import dictionary from '../localization/dictionary';
import LanguageToggle from '../components/LanguageToggle';

const Signup = ({ screenNames, navigation }) => {

    // Initialize state variables for each input field
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [email, setEmail] = useState('');

    const handleGoBack = () => {
        navigation.navigate(screenNames.WELCOME);
    }

    // TODO: Integrate the send form function
    const sendForm = async () => {
        try {

        }
        catch (e) {
            return;
        }
    }

    return (
        <ImageBackground
            source={require('../assets/background_6.webp')}
            style={signUpStyles.backgroundImage}
        >
            <View style={signUpStyles.mainContainer}>
                <LanguageToggle style={{ position: 'absolute', top: 50, right: 24, zIndex: 10 }} />
                <TouchableOpacity onPress={handleGoBack}>
                    <Text style={signUpStyles.backButton}>
                        {dictionary?.sharedFields.goBack}
                    </Text>
                </TouchableOpacity>
                <Text style={signUpStyles.title}>
                    {dictionary?.signUp.signUp}
                </Text>

                <Text style={signUpStyles.label}>
                    {dictionary?.signUp.name}
                </Text>
                <TextInput
                    style={signUpStyles.input}
                    placeholder="Ingrese su nombre"
                    placeholderTextColor={"rgba(255, 255, 255, 0.7)"}
                    value={firstName}
                    onChangeText={setFirstName}
                />

                <Text style={signUpStyles.label}>
                    {dictionary?.signUp.lastName}
                </Text>
                <TextInput
                    style={signUpStyles.input}
                    placeholder="Ingrese su apellido"
                    placeholderTextColor={"rgba(255, 255, 255, 0.7)"}
                    value={lastName}
                    onChangeText={setLastName}
                />

                <Text style={signUpStyles.label}>
                    {dictionary?.signUp.telephoneNumber}
                </Text>
                <TextInput
                    style={signUpStyles.input}
                    placeholder="Ingrese su número de teléfono"
                    placeholderTextColor={"rgba(255, 255, 255, 0.7)"}
                    value={phoneNumber}
                    onChangeText={setPhoneNumber}
                    keyboardType="phone-pad"
                />

                <Text style={signUpStyles.label}>
                    {dictionary?.signUp.telephoneNumber}
                </Text>
                <TextInput
                    style={signUpStyles.input}
                    placeholder="Ingrese su correo electrónico"
                    placeholderTextColor={"rgba(255, 255, 255, 0.7)"}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                />
                <TouchableOpacity
                    style={signUpStyles.signUpButton}
                    onPress={sendForm}
                >
                    <Text style={signUpStyles.buttonText}>{dictionary?.signUp.signUp}</Text>
                </TouchableOpacity>
            </View>
        </ImageBackground>
    )
}

const signUpStyles = StyleSheet.create({
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
        padding: 25,
        opacity: 1
    },
    title: {
        color: "#ffffff",
        fontSize: 40,
        fontWeight: 'bold',
        marginTop: 50,
        marginBottom: 50
    },
    label: {
        color: "#ffffff",
        fontSize: 18,
        fontWeight: 'bold'
    },
    input: {
        color: "#ffffff",
        fontSize: 18,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        padding: 10,
        borderRadius: 16,
        marginBottom: 25,
    },
    signUpButton: {
        padding: 15,
        borderRadius: 15,
        alignItems: 'center',
        backgroundColor: "rgba(0, 122, 255, 1)",
        width: "100%"
    },
    buttonText: {
        color: "#ffffff",
        opacity: 1,
        fontSize: 18,
    },
    backButton: {
        color: "#ffffff",
        opacity: 1,
        fontSize: 18,
    }
})

export default Signup
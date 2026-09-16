import React, { useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Image,
    ImageBackground,
    Alert,
    ScrollView,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    Platform,
    PermissionsAndroid,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { launchCamera } from 'react-native-image-picker';
import evidenceSharedStyles from './evidenceStyles';
import dictionary from '../../localization/dictionary';
import { useEvidencesContext } from '../../context/EvidencesContext';

export default function EvidenceStageTwo({ navigation }) {
    const {
        form,
        handleAddImage,
        handleRemoveImage,
        handleUpdateNotes,
        handleStoreEvidence,
        handleGoBack,
        isSubmitting
    } = useEvidencesContext();

    const [requestingPermission, setRequestingPermission] = useState(false);
    const [showNotes, setShowNotes] = useState(false);
    const hasOpenedCameraOnMount = useRef(false);

    const requestCameraPermission = async () => {
        if (Platform.OS !== 'android') return true;
        setRequestingPermission(true);
        try {
            const granted = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.CAMERA,
                {
                    title: 'Camera Permission',
                    message: 'Camera permission is required to take photos for evidence.',
                    buttonNeutral: 'Ask Me Later',
                    buttonNegative: 'Cancel',
                    buttonPositive: 'OK',
                }
            );
            setRequestingPermission(false);
            if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
                Alert.alert(
                    'Permission Required',
                    'Camera permission is required to take photos for evidence.',
                    [{ text: 'OK' }]
                );
                return false;
            }
            return true;
        } catch (error) {
            console.error('Error requesting camera permission:', error);
            setRequestingPermission(false);
            return false;
        }
    };

    const takePicture = async () => {
        const hasPermission = await requestCameraPermission();
        if (!hasPermission) return;

        try {
            const result = await launchCamera({
                mediaType: 'photo',
                quality: 0.8,
                saveToPhotos: false,
            });

            if (!result.didCancel && result.assets && result.assets.length > 0) {
                handleAddImage(result.assets[0].uri);
            }
        } catch (error) {
            console.error('Error taking picture:', error);
            Alert.alert('Error', 'Failed to take picture. Please try again.');
        }
    };

    useEffect(() => {
        if (!hasOpenedCameraOnMount.current && form.images.length === 0) {
            hasOpenedCameraOnMount.current = true;
            takePicture();
        }
    }, []);

    const confirmAndSend = () => {
        if (form.images.length === 0) {
            Alert.alert(
                'Error',
                dictionary.evidences?.addAtLeastOneImage || 'Please add at least one image'
            );
            return;
        }

        const trimmedNotes = form.notes?.trim();
        let confirmMessage =
            `Client: ${form.client?.client_name || 'N/A'}\n` +
            `Location: ${form.location?.name || 'N/A'}\n` +
            `Images: ${form.images.length}`;
        if (trimmedNotes) {
            confirmMessage += `\nNotes: ${trimmedNotes}`;
        }

        Alert.alert(
            dictionary.evidences?.confirmEvidence || 'Confirm Evidence',
            confirmMessage,
            [
                { text: dictionary.sharedFields.cancel || 'Cancel', style: 'cancel' },
                {
                    text: dictionary.sharedFields.confirm || 'Confirm',
                    onPress: async () => {
                        await handleStoreEvidence(navigation);
                    }
                }
            ]
        );
    };

    return (
        <SafeAreaView style={{ flex: 1 }}>
            <ImageBackground
                source={require('../../assets/background_7.jpg')}
                style={evidenceSharedStyles.backgroundImage}
                imageStyle={StyleSheet.absoluteFillObject}
            >
                <View style={[evidenceSharedStyles.mainContainer, { flex: 1 }]}>
                    <ScrollView
                        contentContainerStyle={{
                            paddingBottom: 100,
                        }}
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                    >
                        <TouchableOpacity onPress={() => handleGoBack(navigation)}>
                            <Text style={evidenceSharedStyles.backButton}>
                                {dictionary?.sharedFields.goBack}
                            </Text>
                        </TouchableOpacity>

                        <Text style={styles.title}>
                            {dictionary?.evidences?.title || 'Evidences'}
                        </Text>

                        {/* Images Section */}
                        <Text style={evidenceSharedStyles.dropdownLabel}>
                            {dictionary?.evidences?.images || 'Images'}:
                        </Text>
                        <View style={evidenceSharedStyles.imageContainer}>
                            {form.images.map((item, index) => {
                                const uri = typeof item === 'string' ? item : item.uri;
                                return (
                                <View key={index} style={evidenceSharedStyles.imageWrapper}>
                                    <Image
                                        source={{ uri }}
                                        style={evidenceSharedStyles.image}
                                        resizeMode="cover"
                                    />
                                    <TouchableOpacity
                                        style={evidenceSharedStyles.removeImageButton}
                                        onPress={() => handleRemoveImage(index)}
                                    >
                                        <Text style={evidenceSharedStyles.removeImageText}>×</Text>
                                    </TouchableOpacity>
                                </View>
                                );
                            })}
                            <TouchableOpacity
                                style={evidenceSharedStyles.addImageButton}
                                onPress={takePicture}
                                disabled={requestingPermission || isSubmitting}
                            >
                                {requestingPermission ? (
                                    <ActivityIndicator size="small" color="#ffffff" />
                                ) : (
                                    <Text style={evidenceSharedStyles.addImageText}>+</Text>
                                )}
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity
                            style={styles.addNotesButton}
                            onPress={() => setShowNotes((prev) => !prev)}
                            disabled={isSubmitting}
                        >
                            <Text style={styles.addNotesButtonText}>
                                {showNotes
                                    ? (dictionary?.evidences?.notesOptional || 'Notes (optional)')
                                    : (dictionary?.evidences?.addNotes || 'Add notes (optional)')}
                            </Text>
                        </TouchableOpacity>
                        {showNotes && (
                            <TextInput
                                style={evidenceSharedStyles.textInput}
                                value={form.notes}
                                onChangeText={handleUpdateNotes}
                                placeholder={dictionary?.evidences?.notesPlaceholder || 'Enter notes...'}
                                placeholderTextColor="rgba(255, 255, 255, 0.5)"
                                multiline
                                numberOfLines={4}
                            />
                        )}
                    </ScrollView>

                    {/* Fixed controls bar */}
                    <View style={styles.bottomButtonContainer}>
                        <TouchableOpacity
                            onPress={confirmAndSend}
                            disabled={form.images.length === 0 || isSubmitting}
                            style={[
                                styles.sendButton,
                                (form.images.length === 0 || isSubmitting) && styles.sendButtonDisabled
                            ]}
                        >
                            {isSubmitting ? (
                                <ActivityIndicator size="small" color="#ffffff" />
                            ) : (
                                <Text style={styles.sendButtonText}>
                                    {dictionary.sharedFields.send || 'Send'}
                                </Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </ImageBackground>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    title: {
        color: "#ffffff",
        paddingTop: 25,
        fontSize: 42,
        fontWeight: "500",
        marginBottom: 20,
    },
    bottomButtonContainer: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        paddingLeft: 25,
        paddingRight: 25,
        paddingBottom: 15,
        paddingTop: 15,
        backgroundColor: "rgba(0, 0, 0, 0.8)",
    },
    sendButton: {
        backgroundColor: "#3B54A5",
        borderRadius: 15,
        padding: 15,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 48,
    },
    sendButtonDisabled: {
        backgroundColor: "rgba(59, 84, 165, 0.5)",
    },
    sendButtonText: {
        color: "#ffffff",
        fontSize: 18,
        fontWeight: '600',
    },
    addNotesButton: {
        marginTop: 8,
        marginBottom: 8,
        paddingVertical: 10,
        alignItems: 'center',
    },
    addNotesButtonText: {
        color: 'rgba(255, 255, 255, 0.85)',
        fontSize: 16,
        textDecorationLine: 'underline',
    },
});

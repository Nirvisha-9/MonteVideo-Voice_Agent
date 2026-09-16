import React, { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { getClients } from '../services/clientService';
import { upsertEvidence, uploadEvidenceImages } from '../services/evidencesService';
import dictionary from '../localization/dictionary';
import EvidenceStageOne from '../components/evidences/EvidenceStageOne';
import EvidenceStageTwo from '../components/evidences/EvidenceStageTwo';
import { EvidencesContext } from '../context/EvidencesContext';

const Stack = createStackNavigator();

function EvidencesProvider({ route, children, screenNames }) {
    const [updating, setUpdating] = useState(false);
    const [updatingId, setUpdatingId] = useState(null);

    const [form, setForm] = useState({
        client: null, // full object for UI only
        location: null,
        images: [], // Array of { uri, capturedAt } (capturedAt = when photo was taken)
        notes: ''
    });

    const [clients, setClients] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleFetchClients = async () => {
        try {
            const result = await getClients();
            setClients(result);
        } catch (e) {
            console.error(e);
        }
    };

    const handleUpdateClient = (client) => {
        setForm((prev) => ({ 
            ...prev, 
            client,
            location: null // Clear location when client changes
        }));
    };

    const handleUpdateLocation = (location) => {
        setForm((prev) => ({ ...prev, location }));
    };

    const handleAddImage = (imageUri) => {
        setForm((prev) => ({
            ...prev,
            images: [...prev.images, { uri: imageUri, capturedAt: new Date() }]
        }));
    };

    const handleRemoveImage = (index) => {
        setForm((prev) => ({
            ...prev,
            images: prev.images.filter((_, i) => i !== index)
        }));
    };

    const handleUpdateNotes = (notes) => {
        setForm((prev) => ({ ...prev, notes }));
    };

    const handleGoBackToMenu = (navigation) => {
        navigation.navigate(screenNames.HOME);
        setForm({
            client: null,
            location: null,
            images: [],
            notes: ''
        });
        setUpdating(false);
        setUpdatingId(null);
    };

    const handleGoBack = (navigation) => {
        Alert.alert(
            dictionary.navigation.goBackTitle,
            dictionary.navigation.goBackDescription,
            [
                { text: dictionary.sharedFields.cancel, style: 'cancel' },
                { text: dictionary.sharedFields.yes, onPress: () => navigation.goBack() }
            ],
            { cancelable: false }
        );
    };

    const handleStoreEvidence = async (navigation) => {
        try {
            if (!form.client?.id || !form.location?.id) {
                Alert.alert(
                    'Error',
                    dictionary.evidences?.selectClientAndLocation || 'Please select both client and location'
                );
                return;
            }

            if (form.images.length === 0) {
                Alert.alert(
                    'Error',
                    dictionary.evidences?.addAtLeastOneImage || 'Please add at least one image'
                );
                return;
            }

            setIsSubmitting(true);

            const imageUris = form.images.map((img) => (typeof img === 'string' ? img : img.uri));
            const imageUrls = await uploadEvidenceImages(imageUris);

            // Use the time the first picture was taken as the evidence date/time
            const evidenceDateTime =
                form.images.length > 0 && form.images[0]?.capturedAt
                    ? form.images[0].capturedAt
                    : new Date();

            const payload = {
                clientId: form.client.id,
                locationId: form.location.id,
                dateTime: evidenceDateTime,
                images: imageUrls,
                notes: form.notes || ''
            };

            const evidenceId = await upsertEvidence(payload, updating ? updatingId : null);
            
            Alert.alert(
                'Success',
                'Evidence saved successfully',
                [{ text: 'OK', onPress: () => handleGoBackToMenu(navigation) }]
            );
        } catch (e) {
            console.error('Error storing evidence:', e);
            console.error('Error stack:', e.stack);
            const errorMessage = e?.message || 'Unknown error occurred';
            Alert.alert(
                'Error', 
                `Failed to save evidence: ${errorMessage}\n\nCheck console for details.`
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    useEffect(() => {
        handleFetchClients();
    }, []);

    const value = {
        form,
        setForm,
        clients,
        updating,
        updatingId,
        isSubmitting,
        handleGoBackToMenu,
        handleGoBack,
        handleUpdateClient,
        handleUpdateLocation,
        handleAddImage,
        handleRemoveImage,
        handleUpdateNotes,
        handleStoreEvidence
    };

    return (
        <EvidencesContext.Provider value={value}>
            {children}
        </EvidencesContext.Provider>
    );
}

export default function EvidencesNavigator({ route, screenNames }) {
    return (
        <EvidencesProvider route={route} screenNames={screenNames}>
            <Stack.Navigator
                initialRouteName="EvidenceStageOne"
                screenOptions={{ headerShown: false }}
            >
                <Stack.Screen name="EvidenceStageOne" component={EvidenceStageOne} />
                <Stack.Screen name="EvidenceStageTwo" component={EvidenceStageTwo} />
            </Stack.Navigator>
        </EvidencesProvider>
    );
}

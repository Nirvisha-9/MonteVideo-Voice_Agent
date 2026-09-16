import React, { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { getClients, getClient } from '../services/clientService';
import ClassifyStageOne from '../components/classify/ClassifyStageOne';
import ClassifyStageTwo from '../components/classify/ClassifyStageTwo';
import ClassifyStageThree from '../components/classify/ClassifyStageThree';
import ClassifyStageFour from '../components/classify/ClassifyStageFour';
import ClassifyStageFive from '../components/classify/ClassifyStageFive';
import dictionary from '../localization/dictionary';
import { FetchCollectionsByClient } from '../services/collectionsService';
import { upsertClassification } from '../services/classificationService';
import { ClassifyContext } from '../context/ClassifyContext';

const Stack = createStackNavigator();

function ClassifyProvider({ children, route, screenNames }) {
    // UI-only: full objects for client and location
    const [form, setForm] = useState({
        client: null,  // full client object (UI only)
        location: null, // full location object (UI only)
        classifications: [], // [{ materialId, subMaterialId, weight }]
        timeStamp: new Date(),
        collection: null,
        // hydration status for UI
        isLoading: false,
        status: 'idle', // 'idle' | 'hydrating' | 'ready' | 'error'
    });

    const [selectedClient, setSelectedClient] = useState(null);
    const [selectedLocation, setSelectedLocation] = useState(null);
    const [selectedCollection, setSelectedCollection] = useState(null);
    const [clientCollections, setClientCollections] = useState([]); // newest first

    const [classificationToAdd, setClassificationToAdd] = useState({
        materialId: null,
        subMaterialId: null
    });

    const [clients, setClients] = useState([]);
    const [updating, setUpdating] = useState(false);
    const [originalCollectionId, setOriginalCollectionId] = useState(null);
    const [updatingId, setUpdatingId] = useState(null);

    // --- Data fetching ---
    const handleFetchClientsData = useCallback(async () => {
        try {
            const clientsResult = await getClients();
            setClients(clientsResult);
        } catch (e) {
            console.error(e);
        }
    }, []);

    const fetchAndSetClientCollections = async (clientId) => {
        if (!clientId) {
            setClientCollections([]);
            return;
        }
        try {
            setForm(prev => ({ ...prev, isLoading: true, status: 'hydrating' }));
            const cols = await FetchCollectionsByClient(clientId, { unclassifiedOnly: true });
            setClientCollections(Array.isArray(cols) ? cols : []);
        } catch (err) {
            console.error('Failed to fetch client collections', err);
            setClientCollections([]); // fail safe
            setForm(prev => ({ ...prev, status: 'error' }));
        }
        finally {
            setForm(prev => ({ ...prev, isLoading: false, status: prev.status === 'error' ? 'error' : 'ready' }));
        }
    };

    // --- UI Handlers ---
    const handleUpdateClient = (client) => {
        setSelectedClient(client || null);
        setForm((prevForm) => ({ ...prevForm, client: client || null }));

        // also clear any previously selected collection/date
        setSelectedCollection(null);
        setForm((prevForm) => ({ ...prevForm, collection: null }));

        // If switching client, clear location to avoid mismatch
        setSelectedLocation(null);
        setForm((prevForm) => ({ ...prevForm, location: null }));

        if (client?.id) {
            fetchAndSetClientCollections(client.id);
        } else {
            setClientCollections([]);
        }
    };

    const handleUpdateLocation = (location) => {
        setSelectedLocation(location || null);
        setSelectedCollection(null);
        // Store the FULL location object in form (UI only) and reset selection
        setForm((prevForm) => ({ ...prevForm, location: location || null, collection: null }));
    };

    const handleUpdateCollection = (collection) => {
        setSelectedCollection(collection || null);
        setForm((prevForm) => ({ ...prevForm, collection: collection || null }));
    };

    const handleUpdateClassificationToAddMaterialId = (materialId) => {
        setClassificationToAdd({ materialId, subMaterialId: null });
    };

    const handleUpdateClassificationToAddSubMaterialId = (subMaterialId) => {
        setClassificationToAdd((prev) => ({ ...prev, subMaterialId }));
    };

    const handleAddClassification = (materialId, subMaterialId, weight) => {
        setForm((prevForm) => {
            const idx = prevForm.classifications.findIndex(c => c.subMaterialId === subMaterialId);
            if (idx !== -1) {
                const classifications = prevForm.classifications.map((c, i) =>
                    i === idx ? { ...c, weight: c.weight + weight } : c
                );
                return { ...prevForm, classifications };
            }
            return {
                ...prevForm,
                classifications: [...prevForm.classifications, { materialId, subMaterialId, weight }]
            };
        });
    };

    const handleRemoveClassification = (subMaterialId) => {
        setForm((prevForm) => ({
            ...prevForm,
            classifications: prevForm.classifications.filter(c => c.subMaterialId !== subMaterialId)
        }));
    };

    const handleStoreClassification = async (navigation) => {
        try {
            // Determine which collection to persist (preserve original if the user didn't change it)
            const collectionId =
                selectedCollection?.id ?? originalCollectionId ?? form.collection?.id ?? null;

            if (!collectionId) {
                console.error('No collectionId found when trying to save classification');
                return;
            }

            // Determine collection timestamp from selectedCollection, form.collection, or existing classification
            const collectionTimeStamp =
                selectedCollection?.timeStamp ??
                form.collection?.timeStamp ??
                route?.params?.classification?.collectionTimeStamp ??
                null;

            // Persist ONLY ids + primitives; UI keeps full objects
            const payload = {
                client: form.client?.id ?? null,
                location: form.location?.id ?? null,
                classifications: Array.isArray(form.classifications) ? form.classifications : [],
                collectionId,
                collectionTimeStamp,
                timeStamp: form.timeStamp ?? new Date(),
            };

            // Use the explicit id if we’re editing; avoid relying on a boolean
            await upsertClassification(payload, updatingId ?? null);

            // Optional: exit editing mode after a successful save
            setUpdating(false);

            navigation.navigate(screenNames.HOME);
        } catch (e) {
            console.error('Failed to store classification:', e);
        }
    };

    // Load existing classification: hydrate client and find location from client.locations by locationId
    const loadExistingClassification = useCallback(async (classification) => {
        setUpdating(true);
        setForm(prev => ({ ...prev, isLoading: true, status: 'hydrating' }));
        setUpdatingId(classification.id);

        // Resolve IDs robustly (classification.client may be id or object)
        const clientId =
            classification.clientId ??
            (typeof classification.client === 'string' ? classification.client : null) ??
            classification.client?.id ??
            null;
        const locationId =
            classification.locationId ??
            (typeof classification.location === 'string' ? classification.location : null) ??
            classification.location?.id ??
            null;
        const collectionId =
            classification.collectionId ??
            (typeof classification.collection === 'string' ? classification.collection : null) ??
            classification.collection?.id ??
            null;

        let clientObj = null;
        let locationObj = null;
        let collectionObj = null;

        if (clientId) {
            try {
                clientObj = await getClient(clientId);
                if (Array.isArray(clientObj?.locations) && locationId) {
                    locationObj = clientObj.locations.find(loc => loc?.id === locationId) || null;
                }
                // Fetch client collections and choose the original one, if any                
                const cols = await FetchCollectionsByClient(clientId, { unclassifiedOnly: false });
                const safeCols = Array.isArray(cols) ? cols : [];
                setClientCollections(safeCols); // keep state up to date
                if (collectionId) {
                    collectionObj = safeCols.find(c => c?.id === collectionId) || null;
                }
            } catch (e) {
                console.error('Failed to hydrate client/location', e);
                setForm(prev => ({ ...prev, status: 'error' }));
            }
        }

        setForm(prev => ({
            client: clientObj, // full object for UI
            location: locationObj, // full object for UI
            classifications: Array.isArray(classification.classifications)
                ? classification.classifications
                : [],
            timeStamp: classification.timeStamp ?? null,
            collectionTimeStamp: classification.collectionTimeStamp ?? collectionObj?.timeStamp ?? null,
            collection: collectionObj,
            isLoading: false,
            status: prev.status === 'error' ? 'error' : 'ready',
        }));

        setSelectedClient(clientObj);
        setSelectedLocation(locationObj);

        setSelectedCollection(collectionObj);
        // Keep a fallback of the original collection id in case the object is missing
        setOriginalCollectionId(collectionId || null);
    }, []);

    const handleSetClassification = (materialId, subMaterialId, weight) => {
        setForm((prevForm) => {
            const key = subMaterialId ?? materialId;
            const idx = prevForm.classifications.findIndex(
                c => (c.subMaterialId ?? c.materialId) === key
            );

            if (idx !== -1) {
                const classifications = prevForm.classifications.map((c, i) =>
                    i === idx ? { ...c, materialId, subMaterialId: key, weight } : c
                );
                return { ...prevForm, classifications };
            }

            // if it doesn't exist yet, add it
            return {
                ...prevForm,
                classifications: [...prevForm.classifications, { materialId, subMaterialId: key, weight }]
            };
        });
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

    // Init
    useEffect(() => {
        if (route?.params?.classification) {
            loadExistingClassification(route.params.classification);
        } else {
            setForm(prev => ({ ...prev, isLoading: true, status: 'hydrating' }));
            (async () => {
                try {
                    await handleFetchClientsData();
                    setForm(prev => ({ ...prev, isLoading: false, status: 'ready' }));
                } catch {
                    setForm(prev => ({ ...prev, isLoading: false, status: 'error' }));
                }
            })();
        }
    }, [route?.params?.classification?.id, handleFetchClientsData, loadExistingClassification]);

    return (
        <ClassifyContext.Provider
            value={{
                form,
                setForm,
                selectedClient,
                setSelectedClient,
                selectedLocation,
                setSelectedLocation,
                selectedCollection,
                setSelectedCollection,
                clientCollections,
                setClientCollections,
                classificationToAdd,
                setClassificationToAdd,
                clients,
                updating,
                handleUpdateClient,
                handleUpdateLocation,
                handleUpdateCollection,
                handleUpdateClassificationToAddMaterialId,
                handleUpdateClassificationToAddSubMaterialId,
                handleAddClassification,
                handleSetClassification,
                handleRemoveClassification,
                handleStoreClassification,
                handleGoBack
            }}
        >
            {children}
        </ClassifyContext.Provider>
    );
}

function ClassifyNavigator({ route, screenNames }) {
    const hasExisting = Boolean(route?.params?.classification);
    return (
        <ClassifyProvider route={route} screenNames={screenNames}>
            <Stack.Navigator
                screenOptions={{ headerShown: false }}
                initialRouteName={hasExisting ? 'ClassifyStageTwo' : 'ClassifyStageOne'}
            >
                <Stack.Screen name="ClassifyStageOne" component={ClassifyStageOne} />
                <Stack.Screen name="ClassifyStageTwo" component={ClassifyStageTwo} />
                <Stack.Screen name="ClassifyStageThree" component={ClassifyStageThree} />
                <Stack.Screen name="ClassifyStageFour" component={ClassifyStageFour} />
                <Stack.Screen name="ClassifyStageFive" component={ClassifyStageFive} />
            </Stack.Navigator>
        </ClassifyProvider>
    );
}

export default ClassifyNavigator;
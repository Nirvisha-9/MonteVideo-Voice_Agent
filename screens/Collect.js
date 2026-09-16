import React, { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { getClients, getClient } from '../services/clientService';
import { upsertCollection } from '../services/collectionsService';
import dictionary from '../localization/dictionary';
import CollectStageOne from '../components/collect/CollectStageOne';
import CollectStageTwo from '../components/collect/CollectStageTwo';
import CollectStageThree from '../components/collect/CollectStageThree';
import CollectStageFour from '../components/collect/CollectStageFour';
import { CollectContext } from '../context/CollectContext';

const Stack = createStackNavigator();

function CollectProvider({ route, children, screenNames }) {
    const [updating, setUpdating] = useState(false);
    const [updatingId, setUpdatingId] = useState(null);

    const [form, setForm] = useState({
        client: null, // full object for UI only (not stored)
        location: null,
        timeStamp: new Date(),
        collections: [] // [{ materialId, count, weight }]
    });

    const [collectionToAdd, setCollectionToAdd] = useState(null);
    const [clients, setClients] = useState([]);

    const handleFetchClients = useCallback(async () => {
        try {
            const result = await getClients();
            setClients(result);
        } catch (e) {
            console.error(e);
        }
    }, []);

    const handleSetCollection = (materialId, count, weight) => {
        setForm((prev) => {
            const idx = prev.collections.findIndex(b => b.materialId === materialId);
            if (idx !== -1) {
                const collections = prev.collections.map((b, i) =>
                    i === idx ? { ...b, count, weight } : b
                );
                return { ...prev, collections };
            }
            // if it doesn't exist yet, add it
            return { ...prev, collections: [...prev.collections, { materialId, count, weight }] };
        });
    };

    const handleGoBackToMenu = (navigation) => {
        navigation.navigate(screenNames.HOME);
        setForm({
            client: null,
            location: null,
            timeStamp: new Date(),
            collections: []
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

    const handleUpdateClient = (client) => {
        setForm((prev) => ({ ...prev, client }));
    };

    const handleUpdateLocation = (location) => {
        setForm((prev) => ({ ...prev, location }));
    };

    const handleUpdatecollectionToAddMaterialId = (materialId) => {
        setCollectionToAdd(materialId);
    };

    const handleAddCollection = (materialId, count, weight) => {
        setForm((prev) => {
            const idx = prev.collections.findIndex(b => b.materialId === materialId);
            if (idx !== -1) {
                const collections = prev.collections.map((b, i) =>
                    i === idx ? { ...b, count: b.count + count, weight: b.weight + weight } : b
                );
                return { ...prev, collections };
            }
            return { ...prev, collections: [...prev.collections, { materialId, count, weight }] };
        });
    };

    const handleRemoveCollection = (materialId) => {
        setForm((prev) => ({
            ...prev,
            collections: prev.collections.filter(b => b.materialId !== materialId)
        }));
    };

    const handleStoreCollection = async (navigation) => {
        try {
            const payload = {
                clientId: form.client?.id ?? null, // << save only clientId
                location: form.location,
                timeStamp: form.timeStamp,
                collections: form.collections,
            };

            await upsertCollection(payload, updating ? updatingId : null);
            handleGoBackToMenu(navigation);
        } catch (e) {
            console.error(e);
        }
    };

    // Load existing collection and hydrate client via getClient(clientId)
    const loadExistingCollection = useCallback(async (collection) => {
        setUpdating(true);
        setUpdatingId(collection.id);

        let client = null;
        const clientId = collection.clientId ?? collection.client?.id; // tolerate legacy
        if (clientId) {
            try {
                client = await getClient(clientId);
            } catch (e) {
                console.error('Failed to fetch client', e);
            }
        }

        setForm({
            client, // hydrated for UI
            location: collection.location ?? null,
            timeStamp: collection.timeStamp ?? new Date(),
            collections: Array.isArray(collection.collections) ? collection.collections : []
        });
    }, []);

    useEffect(() => {
        const existing = route?.params?.collection;
        if (existing) {
            loadExistingCollection(existing);
        } else {
            handleFetchClients();
        }
    }, [route?.params?.collection?.id, handleFetchClients, loadExistingCollection]);

    const value = {
        form,
        setForm,
        collectionToAdd,
        setCollectionToAdd,
        clients,
        updating,
        updatingId,
        handleGoBackToMenu,
        handleGoBack,
        handleUpdateClient,
        handleUpdateLocation,
        handleUpdatecollectionToAddMaterialId,
        handleAddCollection,
        handleRemoveCollection,
        handleStoreCollection,
        handleSetCollection
    };

    return (
        <CollectContext.Provider value={value}>
            {children}
        </CollectContext.Provider>
    );
}

export default function CollectNavigator({ route, screenNames }) {
    const hasExisting = Boolean(route?.params?.collection);
    return (
        <CollectProvider route={route} screenNames={screenNames}>
            <Stack.Navigator
                initialRouteName={hasExisting ? 'CollectStageTwo' : 'CollectStageOne'}
                screenOptions={{ headerShown: false }}
            >
                <Stack.Screen name="CollectStageOne" component={CollectStageOne} />
                <Stack.Screen name="CollectStageTwo" component={CollectStageTwo} />
                <Stack.Screen name="CollectStageThree" component={CollectStageThree} />
                <Stack.Screen name="CollectStageFour" component={CollectStageFour} />
            </Stack.Navigator>
        </CollectProvider>
    );
}
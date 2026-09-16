import React, { useMemo, useState } from 'react';
import {
    Dimensions,
    Image,
    ImageBackground,
    StyleSheet,
    Text,
    View,
    Alert
} from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import dictionary from '../../localization/dictionary';
import collectSharedStyles from './collectStyles';
import dateFormater from '../../helper/dateFormatter';
import { collectMaterialStylesDict } from './collectMaterialStyles';
import { useCollectContext } from '../../context/CollectContext';
import { getClient } from '../../services/clientService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function CollectStageTwo({ navigation }) {
    const {
        handleGoBack,
        form,
        handleRemoveCollection,
        handleStoreCollection
    } = useCollectContext();

    const insets = useSafeAreaInsets();

    // Cache hydrated client details so popup + confirm share the same fetch
    const [clientDetails, setClientDetails] = useState(null);

    const normalizeClient = (res) => res?.client ?? res?.data?.client ?? res ?? null;
    const hasLocations = (c) => c && Array.isArray(c.locations);

    // Single helper to avoid duplicate fetching across popup + confirm
    const ensureClientDetails = async () => {
        // 1) cached
        if (hasLocations(clientDetails)) return clientDetails;

        // 2) already full object in form
        if (hasLocations(form?.client)) {
            setClientDetails(form.client);
            return form.client;
        }

        // 3) id -> fetch
        const id = form?.client;
        if (typeof id === 'string' || typeof id === 'number') {
            const res = await getClient(id);
            const full = normalizeClient(res);
            if (full) setClientDetails(full);
            return full;
        }

        return null;
    };

    const formatClientInfo = (client) => {
        if (!client) return dictionary?.sharedFields?.unknownClient ?? '—';

        const lines = [];

        lines.push(
            `${dictionary?.sharedFields?.client || 'Cliente'}: ${client.client_name ?? client.name ?? '—'}`
        );

        if (client.contact_name) lines.push(`Contacto: ${client.contact_name}`);
        if (client.contact_email) lines.push(`Email: ${client.contact_email}`);
        if (client.contact_phone) lines.push(`Tel: ${client.contact_phone}`);
        if (client.pickup_frequency) lines.push(`Frecuencia: ${client.pickup_frequency}`);

        const locs = Array.isArray(client.locations) ? client.locations : [];
        if (locs.length) {
            lines.push('');
            lines.push('Ubicaciones:');
            locs.forEach((loc, idx) => {
                lines.push(`${idx + 1}) ${loc?.name ?? '—'}`);
                if (loc?.address) lines.push(`   Dirección: ${loc.address}`);
                if (loc?.contact_name) lines.push(`   Contacto: ${loc.contact_name}`);
                if (loc?.contact_phone) lines.push(`   Tel/Email: ${loc.contact_phone}`);
            });
        }

        return lines.join('\n');
    };

    const showClientInfo = async () => {
        try {
            const client = await ensureClientDetails();
            Alert.alert(
                client?.client_name ?? dictionary?.sharedFields?.client ?? 'Cliente',
                formatClientInfo(client),
                [{ text: dictionary?.sharedFields?.close ?? 'Cerrar' }]
            );
        } catch (e) {
            console.error('Failed to show client info:', e);
        }
    };

    const displayClient = useMemo(() => clientDetails ?? form?.client ?? null, [clientDetails, form?.client]);

    const clientName =
        displayClient?.client_name ??
        displayClient?.name ??
        dictionary?.sharedFields?.unknownClient ??
        '—';

    const placeName = useMemo(() => {
        // location can be object or id depending on the flow
        if (form?.location && typeof form.location === 'object') {
            return form.location?.name ?? form.location?.label ?? '';
        }
        const locId = form?.location;
        const loc = displayClient?.locations?.find(l => l?.id === locId);
        return loc?.name ?? loc?.label ?? '';
    }, [form?.location, displayClient]);

    const confirmAndSend = async () => {
        try {
            const clientData = await ensureClientDetails();

            const resolvedClientName =
                clientData?.client_name ?? dictionary?.sharedFields?.unknownClient ?? '';

            const locationObj =
                clientData?.locations && (typeof form.location === 'string' || typeof form.location === 'number')
                    ? clientData.locations.find(loc => loc.id === form.location)
                    : null;

            const resolvedPlaceName =
                (typeof form.location === 'object' ? (form.location?.name || form.location?.label) : null) ||
                (locationObj ? (locationObj.name || locationObj.label) : '') ||
                '';

            const formattedDate = dateFormater(form.timeStamp);

            Alert.alert(
                dictionary.sharedFields.confirmTitle || 'Confirmar recolección',
                `${dictionary.sharedFields.client || 'Cliente'}: ${resolvedClientName}\n` +
                `${dictionary.sharedFields.place || 'Lugar'}: ${resolvedPlaceName}\n` +
                `${dictionary.sharedFields.date || 'Fecha'}: ${formattedDate}`,
                [
                    { text: dictionary.sharedFields.cancel || 'Cancelar', style: 'cancel' },
                    { text: dictionary.sharedFields.confirm || 'Confirmar', onPress: () => handleStoreCollection(navigation) }
                ]
            );
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <ImageBackground
            source={require('../../assets/background_7.jpg')}
            style={[collectSharedStyles.backgroundImage, { flex: 1 }]}
        >
            <View style={[collectSharedStyles.mainContainer, { flex: 1 }]}>
                <TouchableOpacity onPress={() => handleGoBack(navigation)}>
                    <Text style={collectSharedStyles.backButton}>
                        {dictionary?.sharedFields.goBack}
                    </Text>
                </TouchableOpacity>

                <Text style={collectStageTwoStyles.title}>
                    {dictionary?.sharedFields.collect}
                </Text>

                <Text style={collectSharedStyles.fieldText}>
                    {dateFormater(form.timeStamp)}
                </Text>

                {/* Pressable client name -> popup */}
                <TouchableOpacity onPress={showClientInfo} disabled={!form?.client}>
                    <Text style={[collectSharedStyles.fieldText, collectStageTwoStyles.clientLink]}>
                        {`${clientName} | ${placeName}`}
                    </Text>
                </TouchableOpacity>

                <Text style={collectSharedStyles.fieldText}>
                    {`${form.collections.reduce((total, bag) => total + bag.count, 0)} ${dictionary.sharedFields.bags}`}
                </Text>

                <Text style={collectSharedStyles.fieldText}>
                    {`${parseFloat(form.collections.reduce((total, bag) => total + (Number(bag.weight) || 0), 0).toFixed(2))} Kg`}
                </Text>

                {form.collections.map((bagEntry, index) => (
                    <BagCard
                        navigation={navigation}
                        key={index}
                        bagEntry={bagEntry}
                        handleRemoveCollection={handleRemoveCollection}
                        dictionary={dictionary}
                    />
                ))}

                <View
                    style={[
                        collectStageTwoStyles.bottomButtonContainer,
                        {
                            paddingBottom: Math.max(15, insets.bottom + 8),
                            bottom: 0,
                            left: 0,
                            right: 0,
                            zIndex: 10,
                            elevation: 4
                        }
                    ]}
                >
                    <TouchableOpacity>
                        <Text
                            onPress={() => navigation.navigate('CollectStageThree')}
                            style={collectStageTwoStyles.addMoreButton}
                        >
                            {dictionary.collect.addBags}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={confirmAndSend}>
                        <Text style={collectStageTwoStyles.sendButton}>
                            {dictionary.sharedFields.send}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </ImageBackground>
    );
}

// export default function CollectStageTwo({ navigation }) {
//     const {
//         handleGoBack,
//         form,
//         handleRemoveCollection,
//         handleStoreCollection
//     } = useCollectContext();

//     const insets = useSafeAreaInsets();
//     const confirmAndSend = async () => {

//         // Determine if we need to fetch full client details
//         let clientData = form.client;
//         if (typeof form.client === 'number' || !form.client.locations) {
//             // Only fetch if client is represented by ID or missing location info
//             const response = await getClient(form.client);
//             clientData = response.client;
//         }

//         const clientName = clientData.client_name;
//         const locationObj = clientData.locations ?
//             clientData.locations.find(loc => loc.id === form.location)
//             : null;
//         const placeName = locationObj
//             ? (locationObj.name || locationObj.label || '')
//             : '';
//         const formattedDate = dateFormater(form.timeStamp);

//         Alert.alert(
//             dictionary.sharedFields.confirmTitle || 'Confirmar recolección',
//             `${dictionary.sharedFields.client || 'Cliente'}: ${clientName}\n` +
//             `${dictionary.sharedFields.place || 'Lugar'}: ${placeName}\n` +
//             `${dictionary.sharedFields.date || 'Fecha'}: ${formattedDate}`,
//             [
//                 { text: dictionary.sharedFields.cancel || 'Cancelar', style: 'cancel' },
//                 { text: dictionary.sharedFields.confirm || 'Confirmar', onPress: () => handleStoreCollection(navigation) }
//             ]
//         );
//     };


//     const formatClientInfo = (client) => {
//         if (!client) return dictionary?.sharedFields?.unknownClient ?? "—";

//         const lines = [];

//         lines.push(`${dictionary?.sharedFields?.client || "Cliente"}: ${client.client_name ?? client.name ?? "—"}`);

//         if (client.contact_name) lines.push(`Contacto: ${client.contact_name}`);
//         if (client.contact_email) lines.push(`Email: ${client.contact_email}`);
//         if (client.contact_phone) lines.push(`Tel: ${client.contact_phone}`);
//         if (client.pickup_frequency) lines.push(`Frecuencia: ${client.pickup_frequency}`);

//         const locs = Array.isArray(client.locations) ? client.locations : [];
//         if (locs.length) {
//             lines.push("");
//             lines.push("Ubicaciones:");
//             locs.forEach((loc, idx) => {
//                 lines.push(`${idx + 1}) ${loc?.name ?? "—"}`);
//                 if (loc?.address) lines.push(`   Dirección: ${loc.address}`);
//                 if (loc?.contact_name) lines.push(`   Contacto: ${loc.contact_name}`);
//                 if (loc?.contact_phone) lines.push(`   Tel/Email: ${loc.contact_phone}`);
//             });
//         }

//         return lines.join("\n");
//     };

//     const showClientInfo = () => {
//         const client = form?.client;
//         Alert.alert(
//             client?.client_name ?? dictionary?.sharedFields?.client ?? "Cliente",
//             formatClientInfo(client),
//             [{ text: dictionary?.sharedFields?.close ?? "Cerrar" }]
//         );
//     };


//     return (
//         <ImageBackground
//             source={require('../../assets/background_2.jpeg')}
//             style={[collectSharedStyles.backgroundImage, { flex: 1 }]}

//         >
//             <View style={[collectSharedStyles.mainContainer, { flex: 1 }]}>
//                 <TouchableOpacity onPress={() => handleGoBack(navigation)}>
//                     <Text style={collectSharedStyles.backButton}>
//                         {dictionary?.sharedFields.goBack}
//                     </Text>
//                 </TouchableOpacity>

//                 <Text style={collectStageTwoStyles.title}>
//                     {dictionary?.sharedFields.collect}
//                 </Text>

//                 <Text style={collectSharedStyles.fieldText}>
//                     {dateFormater(form.timeStamp)}
//                 </Text>

//                 <TouchableOpacity onPress={showClientInfo} disabled={!form?.client}>
//                     <Text style={[collectSharedStyles.fieldText]}>
//                         {`${clientName} | ${placeName}`}
//                     </Text>
//                 </TouchableOpacity>

//                 <Text style={collectSharedStyles.fieldText}>
//                     {`${form.collections.reduce((total, bag) => total + bag.count, 0)} ${dictionary.sharedFields.bags}`}
//                 </Text>

//                 <Text style={collectSharedStyles.fieldText}>
//                     {`${form.collections.reduce((total, bag) => total + bag.weight, 0)} Kg`}
//                 </Text>

//                 {form.collections.map((bagEntry, index) => (
//                     <BagCard
//                         navigation={navigation}
//                         key={index}
//                         bagEntry={bagEntry}
//                         handleRemoveCollection={handleRemoveCollection}
//                         dictionary={dictionary}
//                     />
//                 ))}
//                 <View style={[
//                     collectStageTwoStyles.bottomButtonContainer,
//                     {
//                         paddingBottom: Math.max(15, insets.bottom + 8),
//                         bottom: 0,
//                         left: 0,
//                         right: 0,
//                         zIndex: 10,
//                         elevation: 4
//                     }
//                 ]}>
//                     <TouchableOpacity>
//                         <Text
//                             onPress={() => navigation.navigate('CollectStageThree')}
//                             style={collectStageTwoStyles.addMoreButton}
//                         >
//                             {dictionary.collect.addBags}
//                         </Text>
//                     </TouchableOpacity>

//                     <TouchableOpacity onPress={confirmAndSend}>
//                         <Text style={collectStageTwoStyles.sendButton}>
//                             {dictionary.sharedFields.send}
//                         </Text>
//                     </TouchableOpacity>
//                 </View>
//             </View>
//         </ImageBackground>
//     );
// }

const BagCard = ({ bagEntry, handleRemoveCollection, dictionary, navigation }) => {
    const { setCollectionToAdd } = useCollectContext();
    const onEdit = () => {
        setCollectionToAdd(bagEntry.materialId);
        navigation.navigate('CollectStageFour', { editing: true });
    };
    return (
        <View
            style={[
                collectStageTwoStyles.bagCardContainer,
                { backgroundColor: collectMaterialStylesDict[bagEntry.materialId]?.color || COLORS.primary }
            ]}
        >
            <Text style={collectStageTwoStyles.bagCardMainText}>
                {collectMaterialStylesDict[bagEntry.materialId]?.label || ''}
            </Text>
            <View style={collectStageTwoStyles.bagCardSecundaryContainer}>
                <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                }}>
                    <Text style={collectStageTwoStyles.bagCardSecundaryText}>
                        {`${bagEntry.count} ${dictionary.sharedFields.bags}`}
                    </Text>
                    <Text style={collectStageTwoStyles.bagCardSecundaryText}>
                        {'  |  '}
                    </Text>
                    <Text style={collectStageTwoStyles.bagCardSecundaryText}>
                        {`${bagEntry.weight ?? 'N/A'} Kg`}
                    </Text>
                </View>
                <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                }}>
                    <TouchableOpacity onPress={onEdit}>
                        <Text style={collectStageTwoStyles.editButtonText}>
                            {dictionary?.sharedFields?.edit || 'Editar'}
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleRemoveCollection(bagEntry.materialId)}>
                        <Image
                            source={require('../../assets/trash-icon.png')}
                            style={collectStageTwoStyles.bagCardTrashIcon}
                            resizeMode="contain"
                        />
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}

const collectStageTwoStyles = StyleSheet.create({
    editButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600'
    },
    title: {
        color: "#ffffff",
        paddingTop: 25,
        fontSize: 42,
        fontWeight: "500",
    },
    bottomButtonContainer: {
        position: 'absolute',
        width: Dimensions.get('window').width,
        bottom: 0,
        paddingLeft: 25,
        paddingRight: 25,
        paddingBottom: 15,
        paddingTop: 15,
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
    },
    addMoreButton: {
        color: "#ffffff",
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        borderRadius: 15,
        fontSize: 18,
        padding: 15
    },
    sendButton: {
        color: "#ffffff",
        fontSize: 18,
        padding: 15
    },
    bagCardContainer: {
        padding: 15,
        borderRadius: 15,
        flexDirection: 'column',
        marginTop: 15,
    },
    bagCardSecundaryContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between'
    },
    bagCardMainText: {
        fontSize: 24,
        color: "#ffffff",
    },
    bagCardSecundaryText: {
        fontSize: 18,
        color: "#ffffff",
    },
    bagCardTrashIcon: {
        width: 40,
        height: 40,
        marginLeft: 15,
    }
})

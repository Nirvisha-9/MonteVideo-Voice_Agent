import React from 'react';
import { Image, ImageBackground, Text, View, StyleSheet, ScrollView } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { Picker } from '@react-native-picker/picker';
import dictionary from '../../localization/dictionary';
import collectSharedStyles from './collectStyles';
import { useCollectContext } from '../../context/CollectContext';

export default function CollectStageOne({ navigation }) {
    const {
        clients,
        handleGoBack,
        form,
        handleUpdateLocation,
        handleUpdateClient
    } = useCollectContext();
    
    const handleAdvanceMenu = () => {
        // Only allow to move forward if the user selected both a client and location
        if (form.location && form.client) {
            navigation.navigate('CollectStageTwo');            
        }
    };

    const selectedLocationObj = form.client?.locations?.find(loc => loc.id === form.location);
    const bothSelected = Boolean(form.client && form.location);

    return (
        <ImageBackground
            source={require('../../assets/background_7.jpg')}
            style={collectSharedStyles.backgroundImage}
        >
            <View style={collectSharedStyles.mainContainer}>
                <View style={collectSharedStyles.navigationBarContainer}>
                    <TouchableOpacity onPress={() => handleGoBack(navigation)}>
                        <Text style={collectSharedStyles.backButton}>
                            {dictionary?.sharedFields.goBack}
                        </Text>
                    </TouchableOpacity>
                </View>
                
                <ScrollView 
                    contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }}
                    showsVerticalScrollIndicator={false}
                >
                    <Text style={collectSharedStyles.title}>
                        {dictionary.sharedFields.collect}
                    </Text>

                    {bothSelected ? (
                        <View style={localStyles.infoCard}>
                            <Text style={localStyles.infoCardTitle}>
                                {form.client.client_name ?? form.client.name}
                            </Text>
                            {form.client.contact_name && (
                                <Text style={localStyles.infoCardText}>
                                    <Text style={localStyles.boldLabel}>{dictionary?.sharedFields?.contact || 'Contacto'}:</Text> {form.client.contact_name}
                                </Text>
                            )}
                            {form.client.contact_phone && (
                                <Text style={localStyles.infoCardText}>
                                    <Text style={localStyles.boldLabel}>{dictionary?.sharedFields?.phone || 'Teléfono'}:</Text> {form.client.contact_phone}
                                </Text>
                            )}
                            {form.client.contact_email && (
                                <Text style={localStyles.infoCardText}>
                                    <Text style={localStyles.boldLabel}>{dictionary?.sharedFields?.email || 'Correo'}:</Text> {form.client.contact_email}
                                </Text>
                            )}
                            {form.client.pickup_frequency && (
                                <Text style={localStyles.infoCardText}>
                                    <Text style={localStyles.boldLabel}>{dictionary?.sharedFields?.frequency || 'Frecuencia'}:</Text> {form.client.pickup_frequency}
                                </Text>
                            )}
                            
                            <View style={localStyles.divider} />
                            
                            <Text style={localStyles.infoSubTitle}>
                                {selectedLocationObj?.name ?? selectedLocationObj?.label ?? dictionary?.sharedFields?.location ?? 'Ubicación'}
                            </Text>
                            {selectedLocationObj?.address && (
                                <Text style={localStyles.infoCardText}>
                                    <Text style={localStyles.boldLabel}>{dictionary?.sharedFields?.address || 'Dirección'}:</Text> {selectedLocationObj.address}
                                </Text>
                            )}
                            {selectedLocationObj?.contact_name && (
                                <Text style={localStyles.infoCardText}>
                                    <Text style={localStyles.boldLabel}>{dictionary?.sharedFields?.contact || 'Contacto'}:</Text> {selectedLocationObj.contact_name}
                                </Text>
                            )}
                            {selectedLocationObj?.contact_phone && (
                                <Text style={localStyles.infoCardText}>
                                    <Text style={localStyles.boldLabel}>{dictionary?.sharedFields?.phone || 'Teléfono'}:</Text> {selectedLocationObj.contact_phone}
                                </Text>
                            )}
                        </View>
                    ) : (
                        <Image
                            source={require('../../assets/recollect-image.png')}
                            style={collectSharedStyles.picture}
                            resizeMode="contain"
                        />
                    )}

                    <View style={collectSharedStyles.dropdownContainer}>
                        <Text style={collectSharedStyles.dropdownLabel}>
                            {dictionary?.sharedFields.client}:
                        </Text>
                        <Picker
                            selectedValue={form.client}
                            style={collectSharedStyles.picker}
                            onValueChange={(itemValue) => handleUpdateClient(itemValue)}
                        >
                            <Picker.Item label={dictionary.collect.selectClient} value={null} />
                            {clients && clients.map((client) => (
                                <Picker.Item key={client.id} label={client.client_name} value={client} />
                            ))}
                        </Picker>
                        <Text style={collectSharedStyles.dropdownLabel}>
                            {dictionary.collect.pickupPlace}:
                        </Text>
                        <Picker
                            selectedValue={form.location}
                            style={collectSharedStyles.picker}
                            onValueChange={(itemValue) => handleUpdateLocation(itemValue)}
                            enabled={form.client != null}
                        >
                            <Picker.Item label={dictionary.collect.selectLocation} value={null} />
                            {form.client && form.client.locations.map((location) => (
                                <Picker.Item key={location.id} label={location.name} value={location.id} />
                            ))}
                        </Picker>
                    </View>

                    {bothSelected && (
                        <TouchableOpacity onPress={handleAdvanceMenu} style={localStyles.continueButton}>
                            <Text style={localStyles.continueButtonText}>
                                {dictionary.sharedFields.continue}
                            </Text>
                        </TouchableOpacity>
                    )}
                </ScrollView>
            </View>
        </ImageBackground>
    );
}

const localStyles = StyleSheet.create({
    infoCard: {
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        borderRadius: 15,
        padding: 18,
        marginVertical: 15,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    infoCardTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#FFFFFF',
        marginBottom: 8,
    },
    infoSubTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#E0E0E0',
        marginBottom: 8,
        marginTop: 5,
    },
    infoCardText: {
        fontSize: 15,
        color: '#D0D0D0',
        marginBottom: 6,
        lineHeight: 20,
    },
    boldLabel: {
        fontWeight: 'bold',
        color: '#E0E0E0',
    },
    divider: {
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        marginVertical: 12,
    },
    continueButton: {
        backgroundColor: '#3B54A5',
        borderRadius: 15,
        padding: 15,
        alignItems: 'center',
        marginTop: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    continueButtonText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: 'bold',
    },
});
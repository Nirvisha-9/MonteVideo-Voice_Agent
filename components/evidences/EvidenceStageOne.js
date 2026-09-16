import React from 'react';
import { Alert, Image, ImageBackground, Text, View } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { Picker } from '@react-native-picker/picker';
import dictionary from '../../localization/dictionary';
import evidenceSharedStyles from './evidenceStyles';
import { useEvidencesContext } from '../../context/EvidencesContext';

export default function EvidenceStageOne({ navigation }) {
    const {
        clients,
        form,
        handleUpdateClient,
        handleUpdateLocation,
        handleGoBack
    } = useEvidencesContext();

    const handleAdvanceMenu = () => {
        if (form.client && form.location) {
            navigation.navigate('EvidenceStageTwo');
            return;
        }
        Alert.alert(
            'Error',
            dictionary.evidences?.selectClientAndLocation || 'Please select both client and location'
        );
    };

    return (
        <ImageBackground
            source={require('../../assets/background_7.jpg')}
            style={evidenceSharedStyles.backgroundImage}
        >
            <View style={evidenceSharedStyles.mainContainer}>
                <View style={evidenceSharedStyles.navigationBarContainer}>
                    <TouchableOpacity onPress={() => handleGoBack(navigation)}>
                        <Text style={evidenceSharedStyles.backButton}>
                            {dictionary?.sharedFields.goBack}
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleAdvanceMenu}>
                        <Text style={evidenceSharedStyles.continueHeaderButton}>
                            {dictionary?.sharedFields.continue}
                        </Text>
                    </TouchableOpacity>
                </View>
                <Text style={evidenceSharedStyles.title}>
                    {dictionary?.evidences?.title || 'Evidences'}
                </Text>
                <Image
                    source={require('../../assets/evidences.jpg')}
                    style={evidenceSharedStyles.picture}
                    resizeMode="contain"
                />
                <View style={evidenceSharedStyles.dropdownContainer}>
                    {/* Client Picker */}
                    <Text style={evidenceSharedStyles.dropdownLabel}>
                        {dictionary?.sharedFields.client}:
                    </Text>
                    <Picker
                        selectedValue={form.client}
                        style={evidenceSharedStyles.picker}
                        onValueChange={(itemValue) => handleUpdateClient(itemValue)}
                    >
                        <Picker.Item label={dictionary.collect.selectClient} value={null} />
                        {clients?.map((client) => (
                            <Picker.Item key={client.id} label={client.client_name} value={client} />
                        ))}
                    </Picker>

                    {/* Location Picker */}
                    <Text style={evidenceSharedStyles.dropdownLabel}>
                        {dictionary?.sharedFields.location}:
                    </Text>
                    <Picker
                        selectedValue={form.location}
                        style={evidenceSharedStyles.picker}
                        onValueChange={(itemValue) => handleUpdateLocation(itemValue)}
                        enabled={form.client != null}
                    >
                        <Picker.Item label={dictionary.collect.selectLocation} value={null} />
                        {form.client?.locations?.map((location) => (
                            <Picker.Item key={location.id} label={location.name} value={location} />
                        ))}
                    </Picker>
                </View>
            </View>
        </ImageBackground>
    );
}

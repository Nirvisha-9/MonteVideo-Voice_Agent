import { Image, ImageBackground, Text, View } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { Picker } from '@react-native-picker/picker';
import dictionary from '../../localization/dictionary';
import React from 'react';
import dateFormater from '../../helper/dateFormatter';
import classifySharedStyles from './classifyStyles';
import { useClassifyContext } from '../../context/ClassifyContext';

export default function ClassifyStageOne({ navigation }) {
    const {
        clients,
        selectedClient,
        clientCollections,
        handleUpdateClient,
        selectedCollection,
        handleUpdateCollection,
        selectedLocation,
        handleUpdateLocation,
        handleGoBack
    } = useClassifyContext();

    const filteredCollections = React.useMemo(() => {
        if (!selectedLocation) return [];
        return clientCollections.filter(
            pickup => pickup.location && String(pickup.location) === String(selectedLocation.id)
        );
    }, [clientCollections, selectedLocation]);

    const handleAdvanceMenu = () => {
        if (selectedClient && selectedLocation && selectedCollection) {
            navigation.navigate('ClassifyStageTwo');
        }
    };


    return (
        <ImageBackground
            source={require('../../assets/background_7.jpg')}
            style={classifySharedStyles.backgroundImage}
        >
            <View style={classifySharedStyles.mainContainer}>
                <View style={classifySharedStyles.navigationBarContainer}>
                    <TouchableOpacity onPress={() => handleGoBack(navigation)}>
                        <Text style={classifySharedStyles.backButton}>
                            {dictionary?.sharedFields.goBack}
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleAdvanceMenu}>
                        <Text style={classifySharedStyles.continueHeaderButton}>
                            {dictionary?.sharedFields.continue}
                        </Text>
                    </TouchableOpacity>
                </View>
                <Text style={classifySharedStyles.title}>
                    {dictionary?.sharedFields.classify}
                </Text>
                <Image
                    source={require('../../assets/classify-image.png')}
                    style={classifySharedStyles.picture}
                    resizeMode="contain"
                />
                <View style={classifySharedStyles.dropdownContainer}>
                    {/* Client Picker */}
                    <Text style={classifySharedStyles.dropdownLabel}>
                        {dictionary?.sharedFields.client}:
                    </Text>
                    <Picker
                        selectedValue={selectedClient}
                        style={classifySharedStyles.picker}
                        onValueChange={(itemValue) => handleUpdateClient(itemValue)}
                    >
                        <Picker.Item label="Select a client..." value={null} />
                        {clients?.map((client, index) => (
                            <Picker.Item key={client.id} label={client.client_name} value={client} />
                        ))}
                    </Picker>

                    {/* Location Picker */}
                    <Text style={classifySharedStyles.dropdownLabel}>
                        {dictionary?.sharedFields.location}:
                    </Text>
                    <Picker
                        selectedValue={selectedLocation}
                        style={classifySharedStyles.picker}
                        onValueChange={(itemValue) => handleUpdateLocation(itemValue)}
                    >
                        <Picker.Item label="Select a location..." value={null} />
                        {selectedClient?.locations && Array.isArray(selectedClient.locations) && selectedClient.locations.map((location, index) => (
                            <Picker.Item key={location.id} label={location.name} value={location} />
                        ))}
                    </Picker>

                    {/* Date Picker */}
                    <Text style={classifySharedStyles.dropdownLabel}>
                        {dictionary?.sharedFields.date}:
                    </Text>
                    <Picker
                        selectedValue={selectedCollection}
                        style={classifySharedStyles.picker}
                        onValueChange={(itemValue) => handleUpdateCollection(itemValue)}
                    >
                        <Picker.Item label="Select a date..." value={null} />
                        {filteredCollections.map((pickup, index) => (
                            <Picker.Item
                                key={pickup.id || index}
                                label={dateFormater(pickup.timeStamp)}
                                value={pickup}
                            />
                        ))}
                    </Picker>
                </View>
            </View>
        </ImageBackground>
    );
};
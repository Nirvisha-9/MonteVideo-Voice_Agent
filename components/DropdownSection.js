import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Button, TextInput } from 'react-native';
import RNPickerSelect from 'react-native-picker-select';
import dictionary from '../localization/dictionary';
import { fetchClients } from '../services/clientService';

/**
 * Component to display dropdowns for selecting a client and a location.
 *
 * @component
 * @param {Object} props
 * @param {function} props.onClientSelect - Callback function when a client is selected.
 * @param {function} props.onLocationSelect - Callback function when a location is selected.
 */
const DropdownSection = ({ onClientSelect, onLocationSelect }) => {
    const [selectedClient, setSelectedClient] = useState(null);
    const [clients, setClients] = useState([]);
    const [locations, setLocations] = useState([]);

    useEffect(() => {
        fetchClients((clientData) => {
            const formattedClients = clientData.map(client => ({
                label: client.client_name,
                value: client.id,
                locations: client.locations
            }));
            setClients(formattedClients);
        });
    }, []);

    /**
    * Handles the change in client selection, updates locations based on the selected client.
    *
    * @param {number} clientId - The ID of the selected client.
    */
    const onClientValueChange = (clientId) => {
        const id = parseInt(clientId);
        const selectedClient = clients.find(client => client.value === id);
        setSelectedClient(selectedClient);
        if (selectedClient) {
            const locationItems = selectedClient.locations.map(location => ({
                label: location.name,
                value: location.id,
            }));
            setLocations(locationItems);
        } else {
            setLocations([]);
        }
    };

    return (
        <View style={styles.mainContainer}>
            <View style={styles.dropdownSection}>
                <View style={styles.dropdownContainer}>
                    <Text style={styles.dropdownLabel}>{dictionary?.sharedFields.client}:</Text>
                    <RNPickerSelect
                        onValueChange={(value) => {
                            onClientSelect(value);
                            onClientValueChange(value);
                        }}
                        items={clients}
                        style={pickerSelectStyles}
                        placeholder={{ label: dictionary?.dropdownSection.selectClient, value: null }}
                    />
                </View>
                <View style={styles.dropdownContainer}>
                    <Text style={styles.dropdownLabel}>{dictionary?.dropdownSection.pickupLocation}:</Text>
                    <RNPickerSelect
                        onValueChange={(value) => {
                            onLocationSelect(value);
                        }}
                        items={locations}
                        style={pickerSelectStyles}
                        placeholder={{ label: dictionary?.dropdownSection.selectLocation, value: null }}
                    />
                </View>
            </View>
            {selectedClient && <Contact style={styles.Contact} clientId={selectedClient.value} />}
        </View>
    );
};

/**
 * Component to display client contact information.
 *
 * @component
 * @param {Object} props
 * @param {number} props.clientId - The ID of the client whose contact information is to be displayed.
 */
const Contact = ({ clientId }) => {
    const [clientContactInfo, setClientContactInfo] = useState(null);
    const [isVisible, setIsVisible] = useState(false);


    useEffect(() => {
        fetchClientContactInfo();
    }, [clientId]);

    /**
     * Fetches the contact information of the client based on clientId.
     */
    const fetchClientContactInfo = async () => {
        if (clientId) {
            await fetchClients((clients) => {
                const client = clients.find(c => c.id === clientId);
                if (client) {
                    setClientContactInfo({
                        name: `${client.first_name} ${client.last_name}`,
                        email: client.contact_email,
                        phone: client.contact_phone,
                    });
                }
            });
        }
    };

    /**
     * Toggles the visibility of the contact information.
     */
    const toggleVisibility = () => {
        setIsVisible(!isVisible);
    };

    return (
        <View style={styles.container}>
            <Button title={dictionary?.dropdownSection.contactInfo} onPress={toggleVisibility} />
            {isVisible && clientContactInfo && (
                <View style={styles.detailsContainer}>
                    <Text style={styles.detailText}>{dictionary?.dropdownSection.name}: {clientContactInfo.name}</Text>
                    <Text style={styles.detailText}>{dictionary?.dropdownSection.email}: {clientContactInfo.email}</Text>
                    <Text style={styles.detailText}>{dictionary?.dropdownSection.phone}: {clientContactInfo.phone}</Text>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    mainContainer: {
        flexDirection: 'column',

    },
    Contact: {
        alignItems: 'center',
    },
    dropdownSection: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: 10,
    },
    dropdownContainer: {
        flexDirection: 'column',
        width: '45%',
    },
    dropdownLabel: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 5,
        color: 'black',
        alignItems: 'center'
    }
});

const pickerSelectStyles = StyleSheet.create({
    inputIOS: {
        fontSize: 16,
        paddingVertical: 12,
        paddingHorizontal: 10,
        borderWidth: 1,
        borderColor: 'gray',
        borderRadius: 4,
        color: 'black',
        paddingRight: 30,
    },
    inputAndroid: {
        fontSize: 12,
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderWidth: 0.5,
        borderColor: 'purple',
        borderRadius: 8,
        color: 'black',
        paddingRight: 30,
    },
});

export default DropdownSection;
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Alert, Button, TextInput } from 'react-native';
import dictionary from '../localization/dictionary';

/**
 * Dashboard component that displays a list of pickup entries, total bags, and weight, and allows the user to add notes and submit the data.
 *
 * @component
 * @param {Object} props - The component props.
 * @param {Object} props.pickupData - The data related to pickups including entries, totalBags, totalWeight, and notes.
 * @param {Function} props.setPickupData - Function to update the pickup data state.
 * @param {Function} props.handleRemoveEntry - Function to handle the removal of a pickup entry by index.
 * @param {Object} props.navigation - Navigation object to navigate between screens.
 * @param {Object} props.screenNames - Object containing screen names for navigation.
 * @param {Function} props.handleSubmit - Function to handle the submission of the dashboard data.
 *
 * @returns {React.JSX.Element} The rendered Dashboard component.
 */
const Dashboard = ({ pickupData, setPickupData, handleRemoveEntry, navigation, screenNames, handleSubmit }) => {
    const [showNotes, setShowNotes] = useState(false);

    /**
     * Updates the notes in the pickupData.
     *
     * @param {string} notes - The new notes text.
     */
    setNotes = notes => setPickupData(prevData => ({ ...prevData, notes }))

    /**
     * Handles the cancel action by displaying an alert and navigating to the home screen if confirmed.
     */
    const handleCancel = () => {
        Alert.alert(
            dictionary?.dashboard.cancel,
            dictionary?.dashboard.cancelMessage,
            [
                {
                    text:  dictionary?.dashboard.no,
                    style: "cancel"
                },
                {
                    text: dictionary?.dashboard.yes,
                    onPress: () => {
                        navigation.navigate(screenNames.HOME);
                    },
                }
            ]
        );
    };

    /**
     * Toggles the visibility of the notes input field.
     */
    const toggleNotes = () => {
        setShowNotes(!showNotes);
    };

    return (
        <View style={styles.container}>
            <View style={styles.headerLine} />
            <View style={styles.listContainer}>
                <DashboardHeader />
                <FlatList
                    data={pickupData.entries}
                    keyExtractor={(item, index) => 'entry-' + index}
                    renderItem={({ item, index }) => (
                        <DashboardEntry item={item} index={index} handleRemoveEntry={handleRemoveEntry} />
                    )}
                />
            </View>
            <View style={styles.totalsContainer}>
                <Text style={styles.total}>{dictionary?.dashboard.totalBags}: {pickupData.totalBags}</Text>
                <Text style={styles.total}>{dictionary?.dashboard.totalWeight}: {pickupData.totalWeight} KG</Text>
            </View>
            <Button title={dictionary?.dashboard.addNotes} onPress={toggleNotes} />
            {showNotes && (
                <TextInput
                    style={styles.notesInput}
                    onChangeText={setNotes}
                    value={pickupData.notes}
                    placeholder={dictionary?.dashboard.notesPlaceholder}
                    multiline
                    numberOfLines={4}
                />
            )}
            <View style={styles.buttonsContainer}>
                <TouchableOpacity onPress={handleSubmit} style={styles.addButton}>
                    <Text style={styles.buttonText}>{dictionary?.dashboard.submit}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleCancel} style={styles.cancelButton}>
                    <Text style={styles.buttonText}>{dictionary?.dashboard.cancel}</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

/**
 * DashboardHeader component that displays the header row for the dashboard entries list.
 *
 * @component
 * @returns {React.JSX.Element} The rendered DashboardHeader component.
 */
const DashboardHeader = () => {
    return (
        <View style={styles.headerRow}>
            <Text style={styles.headerText}>{dictionary?.dashboard.color}</Text>
            <Text style={styles.headerText}>{dictionary?.dashboard.count}</Text>
            <Text style={styles.headerText}>{dictionary?.dashboard.weight}</Text>
            <View style={{ width: 30 }}></View>
        </View>
    )
}

/**
 * DashboardEntry component that displays an individual entry in the dashboard list.
 *
 * @component
 * @param {Object} props - The component props.
 * @param {Object} props.item - The data for the current entry, including color, bags, and weight.
 * @param {number} props.index - The index of the current entry.
 * @param {Function} props.handleRemoveEntry - Function to handle the removal of the entry.
 *
 * @returns {JSX.Element} The rendered DashboardEntry component.
 */
const DashboardEntry = ({ item, index, handleRemoveEntry }) => {
    return (
        <View style={styles.entryRow}>
            <Text style={styles.entryText}>{item.color}</Text>
            <Text style={styles.entryText}>{item.bags}</Text>
            <Text style={styles.entryText}>{`${item.weight} KG`}</Text>
            <TouchableOpacity onPress={() => handleRemoveEntry(index)} style={styles.removeButton}>
                <Text style={styles.removeButtonText}>X</Text>
            </TouchableOpacity>
        </View>
    )
}


const styles = StyleSheet.create({
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: 10,
        backgroundColor: '#e3e3e3',
    },
    entryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: 10,
        marginBottom: 5,
    },
    headerText: {
        flex: 1,
        fontWeight: 'bold',
        textAlign: 'center'
    },
    container: {
        flex: 1,
        marginTop: 60,
        backgroundColor: '#f7f7f7',
    },
    headerLine: {
        height: 10,
        backgroundColor: '#0038A8',
    },
    listContainer: {
        flex: 1,
    },
    entryText: {
        flex: 1,
        textAlign: 'center',
    },
    removeButton: {
        width: 30,
        backgroundColor: 'red',
        padding: 5,
        borderRadius: 5,
    },
    removeButtonText: {
        color: '#fff',
        fontSize: 16,
        textAlign: 'center'
    },
    totalsContainer: {
        paddingVertical: 10,
    },
    total: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    buttonsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginTop: 10,
    },
    cancelButton: {
        backgroundColor: 'red',
        padding: 10,
        borderRadius: 5,
        minWidth: 100,
        alignItems: 'center',
    },
    addButton: {
        backgroundColor: 'green',
        padding: 10,
        borderRadius: 5,
        minWidth: 100,
        alignItems: 'center',
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    notesInput: {
        fontSize: 16,
        borderColor: 'gray',
        borderWidth: 1,
        padding: 10,
        margin: 10,
        borderRadius: 5,
        textAlignVertical: 'top',
        flexDirection: 'row',
    },
});

export default Dashboard;
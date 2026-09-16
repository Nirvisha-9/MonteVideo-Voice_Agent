import React, { useState } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Picker } from '@react-native-picker/picker';

const DateTimePickerModal = ({ visible, dateTime, onConfirm, onCancel }) => {
    const [selectedDate, setSelectedDate] = useState(dateTime || new Date());
    
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 10 }, (_, i) => currentYear - 5 + i);
    const months = Array.from({ length: 12 }, (_, i) => i + 1);
    const days = Array.from({ length: 31 }, (_, i) => i + 1);
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const minutes = Array.from({ length: 60 }, (_, i) => i);

    const updateDateTime = (field, value) => {
        const newDate = new Date(selectedDate);
        switch (field) {
            case 'year':
                newDate.setFullYear(value);
                break;
            case 'month':
                newDate.setMonth(value - 1);
                break;
            case 'day':
                newDate.setDate(value);
                break;
            case 'hour':
                newDate.setHours(value);
                break;
            case 'minute':
                newDate.setMinutes(value);
                break;
        }
        setSelectedDate(newDate);
    };

    const handleConfirm = () => {
        onConfirm(selectedDate);
    };

    const getDaysInMonth = (year, month) => {
        return new Date(year, month, 0).getDate();
    };

    const availableDays = Array.from(
        { length: getDaysInMonth(selectedDate.getFullYear(), selectedDate.getMonth() + 1) },
        (_, i) => i + 1
    );

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="slide"
            onRequestClose={onCancel}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <Text style={styles.modalTitle}>Select Date & Time</Text>
                    
                    <View style={styles.pickerContainer}>
                        <View style={styles.pickerColumn}>
                            <Text style={styles.pickerLabel}>Year</Text>
                            <Picker
                                selectedValue={selectedDate.getFullYear()}
                                style={styles.picker}
                                onValueChange={(value) => updateDateTime('year', value)}
                            >
                                {years.map((year) => (
                                    <Picker.Item key={year} label={year.toString()} value={year} />
                                ))}
                            </Picker>
                        </View>

                        <View style={styles.pickerColumn}>
                            <Text style={styles.pickerLabel}>Month</Text>
                            <Picker
                                selectedValue={selectedDate.getMonth() + 1}
                                style={styles.picker}
                                onValueChange={(value) => updateDateTime('month', value)}
                            >
                                {months.map((month) => (
                                    <Picker.Item
                                        key={month}
                                        label={month.toString().padStart(2, '0')}
                                        value={month}
                                    />
                                ))}
                            </Picker>
                        </View>

                        <View style={styles.pickerColumn}>
                            <Text style={styles.pickerLabel}>Day</Text>
                            <Picker
                                selectedValue={selectedDate.getDate()}
                                style={styles.picker}
                                onValueChange={(value) => updateDateTime('day', value)}
                            >
                                {availableDays.map((day) => (
                                    <Picker.Item
                                        key={day}
                                        label={day.toString().padStart(2, '0')}
                                        value={day}
                                    />
                                ))}
                            </Picker>
                        </View>
                    </View>

                    <View style={styles.pickerContainer}>
                        <View style={styles.pickerColumn}>
                            <Text style={styles.pickerLabel}>Hour</Text>
                            <Picker
                                selectedValue={selectedDate.getHours()}
                                style={styles.picker}
                                onValueChange={(value) => updateDateTime('hour', value)}
                            >
                                {hours.map((hour) => (
                                    <Picker.Item
                                        key={hour}
                                        label={hour.toString().padStart(2, '0')}
                                        value={hour}
                                    />
                                ))}
                            </Picker>
                        </View>

                        <View style={styles.pickerColumn}>
                            <Text style={styles.pickerLabel}>Minute</Text>
                            <Picker
                                selectedValue={selectedDate.getMinutes()}
                                style={styles.picker}
                                onValueChange={(value) => updateDateTime('minute', value)}
                            >
                                {minutes.map((minute) => (
                                    <Picker.Item
                                        key={minute}
                                        label={minute.toString().padStart(2, '0')}
                                        value={minute}
                                    />
                                ))}
                            </Picker>
                        </View>
                    </View>

                    <View style={styles.buttonContainer}>
                        <TouchableOpacity
                            style={[styles.button, styles.cancelButton]}
                            onPress={onCancel}
                        >
                            <Text style={styles.buttonText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.button, styles.confirmButton]}
                            onPress={handleConfirm}
                        >
                            <Text style={[styles.buttonText, styles.confirmButtonText]}>Confirm</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
        maxHeight: '80%',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 20,
        textAlign: 'center',
        color: '#000',
    },
    pickerContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: 20,
    },
    pickerColumn: {
        flex: 1,
        alignItems: 'center',
    },
    pickerLabel: {
        fontSize: 14,
        color: '#666',
        marginBottom: 5,
    },
    picker: {
        width: '100%',
        height: 150,
    },
    buttonContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 20,
    },
    button: {
        flex: 1,
        padding: 15,
        borderRadius: 10,
        alignItems: 'center',
        marginHorizontal: 5,
    },
    cancelButton: {
        backgroundColor: '#e0e0e0',
    },
    confirmButton: {
        backgroundColor: '#3B54A5',
    },
    buttonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#666',
    },
    confirmButtonText: {
        color: '#fff',
    },
});

export default DateTimePickerModal;

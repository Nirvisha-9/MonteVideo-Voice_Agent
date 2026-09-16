import React, { useState, useEffect } from 'react';
import { Image, ImageBackground, Text, TextInput, View } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import dictionary from '../../localization/dictionary';
import collectSharedStyles from '../../components/collect/collectStyles';
import { collectMaterialStylesDict } from './collectMaterialStyles';
import { useCollectContext } from '../../context/CollectContext';

export default function CollectStageFour({ navigation, route }) {
    const {
        handleGoBack,
        collectionToAdd,
        handleAddCollection,
        handleSetCollection,
        form
    } = useCollectContext();

    const [count, setCount] = useState('');
    const [weight, setWeight] = useState('');
    const isEditing = Boolean(route?.params?.editing);

    // Prefill when editing
    useEffect(() => {
        if (!isEditing || !collectionToAdd) return;
        const existing = form?.collections?.find(b => b.materialId === collectionToAdd);
        if (existing) {
            setCount(String(existing.count ?? ''));
            // keep raw display for weight; allow empty if undefined
            setWeight(existing.weight === undefined || existing.weight === null ? '' : String(existing.weight));
        }
    }, [isEditing, collectionToAdd, form?.collections]);

    const sanitizeNumericInput = (text) => {
        // Allow only digits, comma, period, and minus
        let sanitized = text.replace(/[^0-9.,-]/g, '');

        // Ensure minus sign is only at the very start
        sanitized = sanitized
            .replace(/-/g, '') // strip all minus signs
            .replace(/^/, text.startsWith('-') ? '-' : ''); // and re-add one if the original started with it

        // Ensure only one decimal separator (comma or period)
        const match = sanitized.match(/[.,]/g) || [];
        if (match.length > 1) {
            // keep the first occurrence, remove the rest
            const firstSepIndex = sanitized.search(/[.,]/);
            sanitized =
                sanitized.slice(0, firstSepIndex + 1) +
                sanitized.slice(firstSepIndex + 1).replace(/[.,]/g, '');
        }

        return sanitized;
    };

    const sanitizeIntegerInput = (text) => {
        return text.replace(/\D/g, '');
    };


    const handleWeightChange = (text) => {
        setWeight(sanitizeNumericInput(text));
    };

    const handleCountChange = (text) => {
        setCount(sanitizeIntegerInput(text));
    };

    const handleContinue = () => {
        // Normalize to a JS-friendly decimal point
        const normalizedWeight = weight.replace(',', '.');
        const normalizedCount = count.replace(',', '.');

        const parsedWeight = parseFloat(normalizedWeight);
        const parsedCount = parseFloat(normalizedCount);

        if (!isNaN(parsedCount) && parsedCount >= 1) {
            if (isEditing) {
                // Replace the entry instead of summing
                handleSetCollection(
                    collectionToAdd,
                    parsedCount,
                    isNaN(parsedWeight) ? 0 : parsedWeight
                );
            } else {
                handleAddCollection(collectionToAdd, parsedCount, isNaN(parsedWeight) ? 0 : parsedWeight);
            }            
            navigation.navigate('CollectStageTwo');
        }
    };

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
                    <TouchableOpacity onPress={handleContinue}>
                        <Text style={collectSharedStyles.continueHeaderButton}>
                            {dictionary.sharedFields.continue}
                        </Text>
                    </TouchableOpacity>
                </View>
                <Text style={collectSharedStyles.title}>
                    {collectionToAdd ? collectMaterialStylesDict[collectionToAdd]?.label : ''}
                </Text>
                <View>
                    <Text style={collectSharedStyles.fieldText}>
                        {dictionary.sharedFields.quantity}:
                    </Text>
                    <TextInput
                        autoFocus={true}
                        style={collectSharedStyles.field}
                        keyboardType="numeric"
                        value={count}
                        onChangeText={handleCountChange}
                        placeholder={dictionary.sharedFields.addCountDescription}
                        placeholderTextColor="#FFFFFF"
                    />
                    <Text style={collectSharedStyles.fieldText}>
                        {dictionary.sharedFields.weight}:
                    </Text>
                    <TextInput
                        style={collectSharedStyles.field}
                        keyboardType="numeric"
                        value={weight}
                        onChangeText={handleWeightChange}
                        placeholder={dictionary.sharedFields.addWeightDescription}
                        placeholderTextColor="#FFFFFF"
                    />
                </View>
            </View>
        </ImageBackground>
    );
}
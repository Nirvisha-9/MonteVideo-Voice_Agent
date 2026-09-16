import React, { useState, useEffect } from "react";
import { View, Text, TextInput, ImageBackground } from "react-native";
import { TouchableOpacity } from "react-native-gesture-handler";
import classifySharedStyles from "./classifyStyles";
import dictionary from "../../localization/dictionary";
import { classifySubMaterialsDict, classifyMaterialStylesDict } from "./classifyMaterialStyles";
import { useClassifyContext } from '../../context/ClassifyContext';

export default function ClassifyStageFive({ navigation, route }) {
    const {
        classificationToAdd,
        handleAddClassification,
        handleSetClassification,
        handleGoBack,
        form
    } = useClassifyContext();

    const [weight, setWeight] = useState("");
    const isEditing = Boolean(route?.params?.editing);

    useEffect(() => {
        if (!isEditing) return;
        const key = classificationToAdd?.subMaterialId ?? classificationToAdd?.materialId;
        if (!key) return;

        const existing = form?.classifications?.find(
            c => (c.subMaterialId ?? c.materialId) === key
        );

        if (existing) {
            setWeight(
                existing.weight === undefined || existing.weight === null
                    ? ""
                    : String(existing.weight)
            );
        }
    }, [isEditing, classificationToAdd, form?.classifications]);

    const sanitizeNumericInput = (text) => {
        // Allow only digits, comma, period, and minus
        let sanitized = text.replace(/[^0-9.,-]/g, '');

        // Ensure minus sign is only at the very start
        sanitized = sanitized
            .replace(/-/g, '') // remove all minus signs...
            .replace(/^/, text.startsWith('-') ? '-' : ''); // re-add one if original started with it

        // Ensure only one decimal separator (comma or period)
        const seps = sanitized.match(/[.,]/g) || [];
        if (seps.length > 1) {
            const firstIndex = sanitized.search(/[.,]/);
            sanitized =
                sanitized.slice(0, firstIndex + 1) +
                sanitized.slice(firstIndex + 1).replace(/[.,]/g, '');
        }

        return sanitized;
    };

    const handleWeightChange = (text) => {
        setWeight(sanitizeNumericInput(text));
    };


    const handleContinue = () => {
        const normalized = weight.replace(",", ".");
        const parsedWeight = parseFloat(normalized);

        if (!isNaN(parsedWeight) && parsedWeight !== 0) {
            const finalSubId = classificationToAdd.subMaterialId ?? classificationToAdd.materialId;

            if (isEditing) {
                // Replace instead of summing
                handleSetClassification(
                    classificationToAdd.materialId,
                    finalSubId,
                    parsedWeight
                );
            } else {
                // Existing behavior: sum if already exists
                handleAddClassification(
                    classificationToAdd.materialId,
                    finalSubId,
                    parsedWeight
                );
            }

            navigation.navigate("ClassifyStageTwo");
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
                    <TouchableOpacity onPress={handleContinue}>
                        <Text style={classifySharedStyles.continueHeaderButton}>
                            {dictionary?.sharedFields.continue}
                        </Text>
                    </TouchableOpacity>
                </View>
                <Text style={classifySharedStyles.title}>
                    {
                        classifySubMaterialsDict[classificationToAdd.subMaterialId]?.label
                        ?? classifyMaterialStylesDict[classificationToAdd.materialId]?.label
                        ?? ''
                    }
                </Text>
                <View>
                    <Text style={classifySharedStyles.fieldText}>
                        {dictionary.sharedFields.weight}
                    </Text>
                    <TextInput
                        autoFocus={true}
                        style={classifySharedStyles.field}
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
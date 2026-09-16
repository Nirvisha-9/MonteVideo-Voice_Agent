import React from "react";
import { useEffect } from "react";
import { ImageBackground, Text, TouchableOpacity, View } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import SubMaterialCard from "../SubMaterialCard";
import classifySharedStyles from "./classifyStyles";
import dictionary from "../../localization/dictionary";
import { classifyMaterialStylesDict, classifySubMaterials } from "./classifyMaterialStyles";
import { useClassifyContext } from '../../context/ClassifyContext';

export default function ClassifyStageFour({ navigation }) {
    const {
        classificationToAdd,
        handleUpdateClassificationToAddSubMaterialId,
        handleGoBack
    } = useClassifyContext();

    const handleSelectSubMaterial = (subMaterial) => {
        handleUpdateClassificationToAddSubMaterialId(subMaterial.id);
        navigation.navigate('ClassifyStageFive');
    };

    useEffect(() => {
        if (!classificationToAdd?.materialId) {
            handleGoBack(navigation);
        }
    }, [classificationToAdd?.materialId]);

    return (
        <ImageBackground
            source={require('../../assets/background_7.jpg')}
            style={classifySharedStyles.backgroundImage}
        >
            <ScrollView style={classifySharedStyles.mainContainer}>
                <TouchableOpacity onPress={() => handleGoBack(navigation)}>
                    <Text style={classifySharedStyles.backButton}>
                        {dictionary?.sharedFields.goBack}
                    </Text>
                </TouchableOpacity>

                <Text style={classifySharedStyles.title}>
                    {classificationToAdd?.materialId ? classifyMaterialStylesDict[classificationToAdd.materialId]?.label : ''}
                </Text>
                <View>
                    {classificationToAdd?.materialId && Array.isArray(classifySubMaterials[classificationToAdd.materialId]) && classifySubMaterials[classificationToAdd.materialId].map((subMaterial) => (
                        <SubMaterialCard
                            key={subMaterial?.id}
                            subMaterial={subMaterial}
                            handleSelectSubMaterial={handleSelectSubMaterial}
                        />
                    ))}
                </View>
            </ScrollView>
        </ImageBackground>
    );
};
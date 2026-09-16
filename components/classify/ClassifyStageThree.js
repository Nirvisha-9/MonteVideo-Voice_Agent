import React from 'react';
import { ImageBackground, Text, View } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import dictionary from '../../localization/dictionary';
import MaterialsGrid from '../MaterialsGrid';
import classifySharedStyles from './classifyStyles';
import { classifyMaterials } from './classifyMaterialStyles';
import { useClassifyContext } from '../../context/ClassifyContext';

export default function ClassifyStageThree({ navigation }) {
    const {
        handleUpdateClassificationToAddMaterialId,
        handleUpdateClassificationToAddSubMaterialId,
        handleGoBack
    } = useClassifyContext();

    const handleSelectMaterial = (material) => {
        const NO_SUB = material.id === 'organico' || material.id === 'descarte';
        handleUpdateClassificationToAddMaterialId(material.id); // also clears subMaterialId
        handleUpdateClassificationToAddSubMaterialId(NO_SUB ? material.id : null);
        navigation.navigate(NO_SUB ? 'ClassifyStageFive' : 'ClassifyStageFour');  
    }

    return (
        <ImageBackground
            source={require('../../assets/background_7.jpg')}
            style={classifySharedStyles.backgroundImage}
        >
            <View style={classifySharedStyles.mainContainer}>
                <TouchableOpacity onPress={() => handleGoBack(navigation)}>
                    <Text style={classifySharedStyles.backButton}>
                        {dictionary?.sharedFields.goBack}
                    </Text>
                </TouchableOpacity>
                <Text style={classifySharedStyles.title}>
                    {dictionary.sharedFields.classify}
                </Text>
                <MaterialsGrid
                    handleSelectMaterial={handleSelectMaterial}
                    materials={classifyMaterials}
                />
            </View>
        </ImageBackground>
    )
}
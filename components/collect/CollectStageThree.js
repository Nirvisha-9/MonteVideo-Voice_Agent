import React from 'react';
import { ImageBackground, Text, View } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import dictionary from '../../localization/dictionary';
import collectSharedStyles from './collectStyles';
import MaterialsGrid from '../MaterialsGrid';
import { collectMaterials } from './collectMaterialStyles';
import { useCollectContext } from '../../context/CollectContext';

export default function CollectStageThree({ navigation }) {
    const {
        handleGoBack,
        handleUpdatecollectionToAddMaterialId
    } = useCollectContext();


    const handleSelectMaterial = (material) => {
        handleUpdatecollectionToAddMaterialId(material.id);
        navigation.navigate('CollectStageFour');
    }

    return (
        <ImageBackground
            source={require('../../assets/background_7.jpg')}
            style={collectSharedStyles.backgroundImage}
        >
            <View style={collectSharedStyles.mainContainer}>
                <TouchableOpacity onPress={() => handleGoBack(navigation)}>
                    <Text style={collectSharedStyles.backButton}>
                        {dictionary?.sharedFields.goBack}
                    </Text>
                </TouchableOpacity>
                <Text style={collectSharedStyles.title}>
                    {dictionary.sharedFields.collect}
                </Text>
                <MaterialsGrid
                    handleSelectMaterial={handleSelectMaterial}
                    materials={collectMaterials}
                />
            </View>
        </ImageBackground>
    )
}
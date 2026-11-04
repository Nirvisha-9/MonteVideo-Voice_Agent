import React, { useState, useEffect, useCallback } from "react";
import { ImageBackground, Text, TouchableOpacity, View, ActivityIndicator, StyleSheet } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import SubMaterialCard from "../SubMaterialCard";
import classifySharedStyles from "./classifyStyles";
import dictionary, { getLanguage, subscribeLanguage } from "../../localization/dictionary";
import { fetchClassifySubMaterials, getMaterialOrSubMaterialLabel } from "../../services/materialService";
import { useClassifyContext } from '../../context/ClassifyContext';
import { COLORS } from '../../helper/theme';

export default function ClassifyStageFour({ navigation }) {
    const {
        classificationToAdd,
        handleUpdateClassificationToAddSubMaterialId,
        handleGoBack
    } = useClassifyContext();

    const [subMaterialsList, setSubMaterialsList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const handleSelectSubMaterial = (subMaterial) => {
        handleUpdateClassificationToAddSubMaterialId(subMaterial.id);
        navigation.navigate('ClassifyStageFive');
    };

    const parentId = classificationToAdd?.materialId;

    useEffect(() => {
        if (!parentId) {
            handleGoBack(navigation);
        }
    }, [parentId]);

    const loadSubMaterials = useCallback(async () => {
        if (!parentId) return;
        try {
            setLoading(true);
            setError(null);
            const data = await fetchClassifySubMaterials(parentId, getLanguage());
            setSubMaterialsList(data);
        } catch (err) {
            console.error(`Failed to load submaterials for ${parentId}:`, err);
            setError(err?.message || 'Error loading submaterials');
        } finally {
            setLoading(false);
        }
    }, [parentId]);

    useEffect(() => {
        loadSubMaterials();
    }, [loadSubMaterials]);

    useEffect(() => {
        const unsub = subscribeLanguage(() => {
            loadSubMaterials();
        });
        return unsub;
    }, [loadSubMaterials]);

    return (
        <ImageBackground
            source={require('../../assets/background_7.jpg')}
            style={classifySharedStyles.backgroundImage}
        >
            <ScrollView style={classifySharedStyles.mainContainer}>
                <TouchableOpacity onPress={() => handleGoBack(navigation)}>
                    <Text style={classifySharedStyles.backButton}>
                        {dictionary?.sharedFields?.goBack}
                    </Text>
                </TouchableOpacity>

                <Text style={classifySharedStyles.title}>
                    {parentId ? getMaterialOrSubMaterialLabel(parentId) : ''}
                </Text>

                {loading ? (
                    <View style={styles.centerContainer}>
                        <ActivityIndicator size="large" color={COLORS.primary || '#ffffff'} />
                    </View>
                ) : error ? (
                    <View style={styles.centerContainer}>
                        <Text style={styles.errorText}>{error}</Text>
                        <TouchableOpacity onPress={loadSubMaterials} style={styles.retryButton}>
                            <Text style={styles.retryText}>
                                {dictionary?.sharedFields?.retry || 'Reintentar'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                ) : subMaterialsList.length === 0 ? (
                    <View style={styles.centerContainer}>
                        <Text style={styles.emptyText}>
                            {dictionary?.sharedFields?.noSubMaterials || 'No hay submateriales disponibles'}
                        </Text>
                    </View>
                ) : (
                    <View>
                        {subMaterialsList.map((subMaterial) => (
                            <SubMaterialCard
                                key={subMaterial?.id}
                                subMaterial={subMaterial}
                                handleSelectSubMaterial={handleSelectSubMaterial}
                            />
                        ))}
                    </View>
                )}
            </ScrollView>
        </ImageBackground>
    );
}

const styles = StyleSheet.create({
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 40,
    },
    errorText: {
        color: '#ff6b6b',
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 16,
        paddingHorizontal: 20,
    },
    emptyText: {
        color: '#ffffff',
        fontSize: 16,
        textAlign: 'center',
        opacity: 0.8,
    },
    retryButton: {
        backgroundColor: COLORS.primary || '#4C52E7',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
    },
    retryText: {
        color: '#ffffff',
        fontWeight: 'bold',
    },
});
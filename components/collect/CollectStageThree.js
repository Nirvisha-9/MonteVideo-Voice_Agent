import React, { useState, useEffect, useCallback } from 'react';
import { ImageBackground, Text, View, ActivityIndicator, StyleSheet } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import dictionary, { getLanguage, subscribeLanguage } from '../../localization/dictionary';
import collectSharedStyles from './collectStyles';
import MaterialsGrid from '../MaterialsGrid';
import { fetchCollectMaterials } from '../../services/materialService';
import { useCollectContext } from '../../context/CollectContext';
import { COLORS } from '../../helper/theme';

export default function CollectStageThree({ navigation }) {
    const {
        handleGoBack,
        handleUpdatecollectionToAddMaterialId
    } = useCollectContext();

    const [materials, setMaterials] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const loadMaterials = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await fetchCollectMaterials(getLanguage());
            setMaterials(data);
        } catch (err) {
            console.error('Failed to load collect materials:', err);
            setError(err?.message || 'Error loading materials');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadMaterials();
    }, [loadMaterials]);

    // Re-render / update materials when language toggles
    useEffect(() => {
        const unsub = subscribeLanguage(() => {
            loadMaterials();
        });
        return unsub;
    }, [loadMaterials]);

    const handleSelectMaterial = (material) => {
        handleUpdatecollectionToAddMaterialId(material.id);
        navigation.navigate('CollectStageFour');
    };

    return (
        <ImageBackground
            source={require('../../assets/background_7.jpg')}
            style={collectSharedStyles.backgroundImage}
        >
            <View style={collectSharedStyles.mainContainer}>
                <TouchableOpacity onPress={() => handleGoBack(navigation)}>
                    <Text style={collectSharedStyles.backButton}>
                        {dictionary?.sharedFields?.goBack}
                    </Text>
                </TouchableOpacity>
                <Text style={collectSharedStyles.title}>
                    {dictionary.sharedFields.collect}
                </Text>

                {loading ? (
                    <View style={styles.centerContainer}>
                        <ActivityIndicator size="large" color={COLORS.primary || '#ffffff'} />
                    </View>
                ) : error ? (
                    <View style={styles.centerContainer}>
                        <Text style={styles.errorText}>{error}</Text>
                        <TouchableOpacity onPress={loadMaterials} style={styles.retryButton}>
                            <Text style={styles.retryText}>
                                {dictionary?.sharedFields?.retry || 'Reintentar'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                ) : materials.length === 0 ? (
                    <View style={styles.centerContainer}>
                        <Text style={styles.emptyText}>
                            {dictionary?.sharedFields?.noMaterials || 'No hay materiales disponibles'}
                        </Text>
                    </View>
                ) : (
                    <MaterialsGrid
                        handleSelectMaterial={handleSelectMaterial}
                        materials={materials}
                    />
                )}
            </View>
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
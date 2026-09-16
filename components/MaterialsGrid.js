import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Image } from 'react-native';

const MaterialsGrid = ({ materials, handleSelectMaterial }) => {
    // Calculate card size based on screen width
    const numColumns = 2;
    const cardMargin = 24;
    const screenWidth = Dimensions.get('window').width;
    const cardSize = (screenWidth - (numColumns + 1) * cardMargin) / numColumns;

    // Prepare data rows
    const data = materials;

    const rows = [];
    for (let i = 0; i < data.length; i += numColumns) {
        rows.push(data.slice(i, i + numColumns));
    }

    return (
        <View>
            {rows.map((rowItems, rowIndex) => (
                <View
                    key={rowIndex}
                    style={[
                        materialGridStyles.row,
                        rowItems.length < numColumns ? materialGridStyles.centerRow : null,
                    ]}
                >
                    {rowItems.map((item) => (
                        <MaterialCard
                            key={item.id}
                            item={item}
                            handleSelectMaterial={handleSelectMaterial}
                            cardSize={cardSize}
                        />
                    ))}
                </View>
            ))}
        </View>
    );
};

const MaterialCard = ({ item, cardSize, handleSelectMaterial }) => {
    return (
        <TouchableOpacity
            key={item.id}
            style={[materialGridStyles.cardContainer, { width: cardSize, height: cardSize }]}
            onPress={() => handleSelectMaterial(item)}
        >
            <View
                style={[
                    materialGridStyles.cardTextContainer,
                    { backgroundColor: item.color }
                ]}>
                <Text style={materialGridStyles.cardText}>
                    {item.label}
                </Text>
            </View>
            {(materialGridStyles?.cardPicture) && <View style={materialGridStyles.cardImageContainer}>
                <Image
                    source={item.imagePath}
                    style={materialGridStyles.cardPicture}
                    resizeMode="contain"
                />
            </View>}
        </TouchableOpacity>
    )
}

const materialGridStyles = StyleSheet.create({
    cardImageContainer: {
        width: "100%",
        height: "70%",
    },
    cardPicture: {
        width: "100%",
        height: "100%",
    },
    cardText: {
        fontSize: 16,
        color: '#ffffff',
    },
    cardTextContainer: {
        width: "100%",
        height: "30%",
        justifyContent: 'center',
        alignItems: 'center',
    },
    cardContainer: {
        backgroundColor: '#ffffff',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 15,
        overflow: 'hidden',
    },
    row: {
        flexDirection: 'row',
        flexWrap: 'nowrap',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    centerRow: {
        justifyContent: 'center',
    },
});

export default MaterialsGrid;
import React from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { TouchableOpacity } from 'react-native-gesture-handler'
import dictionary from '../localization/dictionary';
import dateFormater from '../helper/dateFormatter';

const SummarySection = ({ handleFinalize, handleAddMore, pastCollections }) => {
    return (
        <View style={summarySectionStyles.pastCollectionsMainContainer}>
            <View style={summarySectionStyles.pastCollectionsHeaderContainer}>
                <TouchableOpacity onPress={handleFinalize}>
                    <Text style={summarySectionStyles.backButton}>
                        {dictionary?.sharedFields.goBack}
                    </Text>
                </TouchableOpacity>
                <Text style={summarySectionStyles.title}>
                    Enviado Exitosamente
                </Text>
                <TouchableOpacity onPress={handleAddMore} style={summarySectionStyles.finalizeButton}>
                    <Text style={summarySectionStyles.buttonText}>
                        Agregar Más
                    </Text>
                </TouchableOpacity>
            </View>
            <ScrollView style={summarySectionStyles.pastCollectionsScroll}>
                {pastCollections.map((item, index) => (
                    <PastCollectionItem
                        key={index}
                        item={item}
                    />
                ))}
            </ScrollView>
        </View>
    )
};

export const PastCollectionItem = ({ item }) => {
    return (
        <View key={item.id} style={summarySectionStyles.pastCollectionsCardContainer}>
            <View style={summarySectionStyles.pastCollectionsCardHeader}>
                <View>
                    <Text style={summarySectionStyles.pastCollectionsCardText}>
                        <Text style={{ fontWeight: 'bold' }}>Client: </Text>
                        {item.client_data.client_name}
                    </Text>
                    <Text style={summarySectionStyles.pastCollectionsCardText}>
                        <Text style={{ fontWeight: 'bold' }}>Location: </Text>
                        {item.location}
                    </Text>
                </View>
                <Text style={summarySectionStyles.pastCollectionsCardText}>
                    {dateFormater(item.datetime)}
                </Text>
            </View>
            <View style={summarySectionStyles.pastCollectionsTotalWeight}>
                <Text style={summarySectionStyles.pastCollectionsCardText}>
                    {`Total Amount Recorded: ${item.total_weight} Kg`}
                </Text>
            </View>
            <View>
                <Text>

                </Text>
            </View>
        </View>
    );
};

export default SummarySection;


const summarySectionStyles = StyleSheet.create({
    pastCollectionsScroll: {
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        height: '100%',
        marginTop: 25
    },
    pastCollectionsCardContainer: {
        marginTop: 10,
    },
    pastCollectionsCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: 10,
        backgroundColor: '#3B54A5',
    },
    pastCollectionsCardText: {
        fontSize: 18,
        color: '#ffffff',
    },
    pastCollectionsTotalWeight: {
        padding: 10,
        backgroundColor: '#E5B650',
    },
    pastCollectionsMainContainer: {
        flex: 1,
        width: "100%",
        opacity: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.2)',
    },
    pastCollectionsHeaderContainer: {
        paddingTop: 25,
        paddingLeft: 25,
        paddingRight: 25,
    },
    finalizeButton: {
        padding: 15,
        borderRadius: 15,
        alignItems: 'center',
        backgroundColor: "#3B54A5",
        width: "100%"
    },
    buttonText: {
        color: "#ffffff",
        opacity: 1,
        fontSize: 18,
    },
    backButton: {
        color: "#ffffff",
        opacity: 1,
        fontSize: 18,
    },
    title: {
        color: "#ffffff",
        paddingBottom: 25,
        paddingTop: 25,
        fontSize: 42,
        fontWeight: "500",
        textAlign: "center"
    },
})

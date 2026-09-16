// components/classify/ClassifyStageTwo.tsx
import React, { useMemo } from "react";
import { View, Text, StyleSheet, Image, ImageBackground, Alert, SafeAreaView, FlatList, ActivityIndicator } from "react-native";
import { TouchableOpacity } from "react-native-gesture-handler";
import classifySharedStyles from "./classifyStyles";
import dictionary from "../../localization/dictionary";
import dateFormater from "../../helper/dateFormatter";
import { classifyMaterialStylesDict, classifySubMaterialsDict } from "./classifyMaterialStyles";
import { useClassifyContext } from '../../context/ClassifyContext';

const BOTTOM_HEIGHT = 78; // controls bar height (approx); keep in sync with styles

export default function ClassifyStageTwo({ navigation }) {
    const {
        handleRemoveClassification,
        handleStoreClassification,
        form,
        selectedCollection,
        handleGoBack
    } = useClassifyContext();


    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const isHydrating = form?.isLoading === true || form?.status === "hydrating" || !Array.isArray(form?.classifications);

    const clientName = form?.client?.client_name ?? form?.client?.name ?? dictionary.sharedFields.unknownClient ?? "—";
    const placeName = form?.location?.name ?? form?.location?.label ?? dictionary.sharedFields.unknownPlace ?? "—";

    const totalKg = useMemo(
        () => parseFloat((Array.isArray(form.classifications)
            ? form.classifications.reduce((total, bag) => total + (Number(bag?.weight) || 0), 0)
            : 0).toFixed(2)),
        [form.classifications]
    );

    const collectionKg = useMemo(() => {
        const col = selectedCollection ?? form?.collection;
        const entries = col?.collections;
        if (!Array.isArray(entries)) return 0;
        return parseFloat(entries.reduce((sum, it) => sum + (Number(it?.weight) || 0), 0).toFixed(2));
    }, [selectedCollection, form?.collection]);

    const confirmAndSend = () => {
        const formattedDate = dateFormater(form?.timeStamp ?? new Date());

        Alert.alert(
            dictionary.classify.confirmClassification || "Confirm Classification",
            `${dictionary.sharedFields.client || "Client"}: ${clientName}\n` +
            `${dictionary.sharedFields.place || "Place"}: ${placeName}\n` +
            `${dictionary.sharedFields.date || "Date"}: ${formattedDate}`,
            [
                { text: dictionary.sharedFields.cancel || "Cancel", style: "cancel" },
                {
                    text: dictionary.sharedFields.confirm || "Confirm",
                    onPress: async () => {
                        try {
                            setIsSubmitting(true);
                            await handleStoreClassification(navigation);
                        } finally {
                            setIsSubmitting(false);
                        }
                    }
                }
            ]
        );
    };

    const renderHeader = () => (
        <View>
            <TouchableOpacity onPress={() => handleGoBack(navigation)}>
                <Text style={classifySharedStyles.backButton}>
                    {dictionary?.sharedFields.goBack}
                </Text>
            </TouchableOpacity>

            <Text style={styles.title}>
                {dictionary.sharedFields.classify}
            </Text>

            <Text style={classifySharedStyles.fieldText}>
                {dateFormater(form?.timeStamp ?? new Date())}
            </Text>
            <TouchableOpacity onPress={showClientInfo} disabled={!form?.client}>
                <Text style={[classifySharedStyles.fieldText]}>
                    {`${clientName} | ${placeName}`}
                </Text>
            </TouchableOpacity>

            <Text style={classifySharedStyles.fieldText}>
                {`Peso Recolección: ${collectionKg} Kg`}
            </Text>
            <Text style={classifySharedStyles.fieldText}>
                {`Peso Clasificado: ${totalKg} Kg`}
            </Text>
        </View>
    );

    const keyExtractor = (item, index) =>
        `${item?.subMaterialId ?? item?.materialId ?? "item"}-${index}`;

    const renderItem = ({ item }) => (
        <ClassificationCard
            navigation={navigation}
            classificationEntry={item}
            handleRemoveClassification={handleRemoveClassification}
        />
    );


    const hasItems = (form?.classifications?.length ?? 0) > 0;
    const canSend = Boolean(selectedCollection?.id) && hasItems;

    const formatClientInfo = (client) => {
        if (!client) return dictionary?.sharedFields?.unknownClient ?? "—";

        const lines = [];

        lines.push(`${dictionary?.sharedFields?.client || "Cliente"}: ${client.client_name ?? client.name ?? "—"}`);

        if (client.contact_name) lines.push(`Contacto: ${client.contact_name}`);
        if (client.contact_email) lines.push(`Email: ${client.contact_email}`);
        if (client.contact_phone) lines.push(`Tel: ${client.contact_phone}`);
        if (client.pickup_frequency) lines.push(`Frecuencia: ${client.pickup_frequency}`);

        const locs = Array.isArray(client.locations) ? client.locations : [];
        if (locs.length) {
            lines.push("");
            lines.push("Ubicaciones:");
            locs.forEach((loc, idx) => {
                lines.push(`${idx + 1}) ${loc?.name ?? "—"}`);
                if (loc?.address) lines.push(`   Dirección: ${loc.address}`);
                if (loc?.contact_name) lines.push(`   Contacto: ${loc.contact_name}`);
                if (loc?.contact_phone) lines.push(`   Tel/Email: ${loc.contact_phone}`);
            });
        }

        return lines.join("\n");
    };

    const showClientInfo = () => {
        const client = form?.client;
        Alert.alert(
            client?.client_name ?? dictionary?.sharedFields?.client ?? "Cliente",
            formatClientInfo(client),
            [{ text: dictionary?.sharedFields?.close ?? "Cerrar" }]
        );
    };


    return (
        <SafeAreaView style={{ flex: 1 }}>
            <ImageBackground
                source={require('../../assets/background_7.jpg')}
                style={classifySharedStyles.backgroundImage} // must have {flex: 1}
                imageStyle={StyleSheet.absoluteFillObject}
            >
                <View style={[classifySharedStyles.mainContainer, { flex: 1 }]}>
                    {isHydrating ? (
                        <View style={styles.loaderContainer}>
                            <ActivityIndicator size="large" />
                            <Text style={styles.loaderText}>
                                {dictionary?.sharedFields?.loading ?? "Loading..."}
                            </Text>
                        </View>
                    ) : (
                        <FlatList
                            data={form?.classifications ?? []}
                            renderItem={renderItem}
                            keyExtractor={keyExtractor}
                            ListHeaderComponent={renderHeader}
                            contentContainerStyle={{
                                paddingBottom: BOTTOM_HEIGHT + 24, // space for the fixed bar
                            }}
                            keyboardShouldPersistTaps="handled"
                            showsVerticalScrollIndicator={false}
                        />
                    )}

                    {/* Fixed controls bar */}
                    <View style={styles.bottomButtonContainer}>
                        <TouchableOpacity disabled={isHydrating || isSubmitting} onPress={() => navigation.navigate("ClassifyStageThree")}>
                            <Text style={styles.addMoreButton}>
                                {dictionary.classify.addClassifications}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={confirmAndSend}
                            disabled={!canSend || isHydrating || isSubmitting}
                        >
                            <View style={styles.sendButtonRow}>
                                {isSubmitting ? (
                                    <ActivityIndicator size="small" />
                                ) : (
                                    <Text style={styles.sendButton}>
                                        {dictionary.sharedFields.send}
                                    </Text>
                                )}
                            </View>
                        </TouchableOpacity>
                    </View>
                </View>
            </ImageBackground>
        </SafeAreaView>
    );
}

const ClassificationCard = ({ classificationEntry, handleRemoveClassification, navigation }) => {
    const { setClassificationToAdd } = useClassifyContext();

    const subMeta = classifySubMaterialsDict?.[classificationEntry?.subMaterialId];
    const matMeta = classifyMaterialStylesDict?.[classificationEntry?.materialId];
    const meta = subMeta ?? matMeta ?? {};

    const key = classificationEntry?.subMaterialId ?? classificationEntry?.materialId;

    const onEdit = () => {
        setClassificationToAdd({
            materialId: classificationEntry?.materialId ?? null,
            subMaterialId: key ?? null
        });
        navigation.navigate("ClassifyStageFive", { editing: true });
    };

    return (
        <View style={[styles.bagCardContainer, { backgroundColor: meta.color || "#333" }]}>
            <Text style={styles.bagCardMainText}>
                {meta.label ?? key}
            </Text>

            <View style={styles.bagCardSecundaryContainer}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Text style={styles.bagCardSecundaryText}>
                        {`${classificationEntry?.weight ?? "N/A"} Kg`}
                    </Text>
                </View>

                <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <TouchableOpacity onPress={onEdit}>
                        <Text style={styles.editButtonText}>
                            {dictionary?.sharedFields?.edit || "Editar"}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => handleRemoveClassification(key)}>
                        <Image
                            source={require("../../assets/trash-icon.png")}
                            style={styles.bagCardTrashIcon}
                            resizeMode="contain"
                        />
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    loaderContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingBottom: BOTTOM_HEIGHT, // keep space off bottom bar
    },
    loaderText: {
        marginTop: 12,
        color: "#fff",
        opacity: 0.9,
        fontSize: 14,
    },
    editButtonText: {
        color: "#FFFFFF",
        fontSize: 16,
        fontWeight: "600",
        marginRight: 12,
    },
    title: {
        color: "#ffffff",
        paddingTop: 25,
        fontSize: 42,
        fontWeight: "500",
    },
    bottomButtonContainer: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        paddingLeft: 25,
        paddingRight: 25,
        paddingBottom: 15,
        paddingTop: 15,
        flexDirection: "row",
        justifyContent: "space-between",
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        // keep height roughly stable for padding calculation
        minHeight: BOTTOM_HEIGHT,
    },
    addMoreButton: {
        color: "#ffffff",
        backgroundColor: "rgba(255, 255, 255, 0.2)",
        borderRadius: 15,
        fontSize: 18,
        padding: 15
    },
    sendButton: {
        color: "#ffffff",
        fontSize: 18,
        padding: 15
    },
    helperText: {
        color: "#ffffff",
        opacity: 0.8,
        fontSize: 12,
        marginTop: -6,
        paddingHorizontal: 15
    },
    bagCardContainer: {
        padding: 15,
        borderRadius: 15,
        flexDirection: "column",
        marginTop: 15,
    },
    bagCardSecundaryContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between'
    },
    bagCardMainText: {
        fontSize: 24,
        color: "#ffffff",
    },
    bagCardSecundaryText: {
        fontSize: 18,
        color: "#ffffff",
    },
    bagCardTrashIcon: {
        width: 40,
        height: 40,
        marginLeft: 15,
    },
    sendButtonRow: {
        minHeight: 48,
        minWidth: 120,
        alignItems: "center",
        justifyContent: "center",
    },
});
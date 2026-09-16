import { StyleSheet } from "react-native";
import { Dimensions } from "react-native";
import { COLORS, SHADOWS, BORDER_RADIUS } from "../../helper/theme";

const classifySharedStyles = StyleSheet.create({
    backgroundImage: {
        position: 'absolute',
        left: 0,
        top: 0,
        width: Dimensions.get('window').width,
        height: Dimensions.get('window').height,
    },
    mainContainer: {
        flex: 1,
        width: "100%",
        paddingTop: 40,
        paddingLeft: 20,
        paddingRight: 20,
        opacity: 1,
        backgroundColor: COLORS.overlayDark,
    },
    navigationBarContainer : {        
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    backButton: {
        color: COLORS.white,
        opacity: 0.9,
        fontSize: 16,
        fontWeight: '600',
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: BORDER_RADIUS.round,
    },
    continueHeaderButton: {
        color: COLORS.white,
        opacity: 0.9,
        fontSize: 16,
        fontWeight: '600',
        backgroundColor: '#10B981', // Emerald green
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: BORDER_RADIUS.round,
    },
    title: {
        color: COLORS.white,
        paddingBottom: 15,
        paddingTop: 15,
        fontSize: 32,
        fontWeight: "800",
        textAlign: "center",
        letterSpacing: 0.5,
    },
    fieldText: {
        fontSize: 18,
        color: COLORS.white,
        fontWeight: '600',
        marginBottom: 8,
    },
    picture: {
        width: "100%",
        height: 180,
        borderRadius: BORDER_RADIUS.large,
        marginVertical: 10,
    },
    dropdownContainer: {
        marginTop: 15,
        padding: 15,
        backgroundColor: COLORS.glassLight,
        borderRadius: BORDER_RADIUS.large,
        ...SHADOWS.medium,
    },
    dropdownLabel: {
        fontSize: 15,
        fontWeight: '700',
        color: COLORS.textMedium,
        marginBottom: 6,
    },
    picker: {
        backgroundColor: '#F1F5F9',
        borderRadius: BORDER_RADIUS.medium,
        width: '100%',
        marginBottom: 16,
        color: COLORS.textDark,
    },
    field: {
        backgroundColor: '#F1F5F9',
        borderRadius: BORDER_RADIUS.medium,
        width: '100%',
        marginBottom: 16,
        fontSize: 16,
        padding: 12,
        color: COLORS.textDark,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    finalizeButton: {
        paddingVertical: 14,
        borderRadius: BORDER_RADIUS.large,
        alignItems: 'center',
        backgroundColor: COLORS.primary,
        width: "100%",
        ...SHADOWS.medium,
    },
    buttonText: {
        color: COLORS.white,
        fontSize: 18,
        fontWeight: '700',
    },
});

export default classifySharedStyles;
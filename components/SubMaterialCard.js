import { StyleSheet, Text } from "react-native"
import { TouchableOpacity } from "react-native-gesture-handler"

const SubMaterialCard = ({ subMaterial, handleSelectSubMaterial }) => {
    return (
        <TouchableOpacity onPress={() => handleSelectSubMaterial(subMaterial)} style={[
            subMaterialCardStyles.cardContainer,
            { backgroundColor: subMaterial.color }
        ]}>
            <Text style={subMaterialCardStyles.cardText}>
                {subMaterial.label}
            </Text>
        </TouchableOpacity>
    )
}

const subMaterialCardStyles = StyleSheet.create({
    cardText: {
        fontSize: 20,
        color: '#ffffff',
    },
    cardContainer: {
        height: 64,
        backgroundColor: '#ffffff',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 15,
        overflow: 'hidden',
        marginBottom: 10
    },
})

export default SubMaterialCard
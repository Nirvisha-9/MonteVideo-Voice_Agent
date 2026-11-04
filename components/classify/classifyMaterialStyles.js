import {
    getMaterialOrSubMaterialLabel as getLabel,
    getMaterialColor,
    materialStylesDict,
    fetchClassifyRootMaterials,
    fetchClassifySubMaterials
} from '../../services/materialService';

export const classifyMaterials = [];
export const classifySubMaterials = {};
export const classifyMaterialStylesDict = materialStylesDict;
export const classifySubMaterialsDict = materialStylesDict;

export const getClassifyMaterials = async () => {
    return await fetchClassifyRootMaterials();
};

export const getClassifySubMaterials = async (mainMaterialId) => {
    return await fetchClassifySubMaterials(mainMaterialId);
};

export const getMaterialOrSubMaterialLabel = (id) => {
    return getLabel(id);
};

export { getMaterialColor, fetchClassifyRootMaterials, fetchClassifySubMaterials };
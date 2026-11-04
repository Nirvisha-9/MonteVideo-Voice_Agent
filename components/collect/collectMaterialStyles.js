import {
    getMaterialOrSubMaterialLabel as getLabel,
    materialStylesDict,
    fetchCollectMaterials,
} from '../../services/materialService';

export const collectMaterials = [];
export const collectMaterialStylesDict = materialStylesDict;
export const getMaterialOrSubMaterialLabel = getLabel;
export { fetchCollectMaterials };
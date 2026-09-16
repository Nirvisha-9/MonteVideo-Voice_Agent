export const collectMaterials = [
    { id: 'papel_carton', label: 'Papel Cartón', color: '#4C52E7', imagePath: require('../../assets/paper-icon.png') },
    { id: 'plasticos', label: 'Plásticos', color: '#D8D238', imagePath: require('../../assets/plastic-icon.png') },
    { id: 'otros_reciclables', label: 'Otros Reciclables', color: '#06A73C', imagePath: require('../../assets/other-recyclable-icon.png') },
    { id: 'organico', label: 'Orgánico', color: '#663B14', imagePath: require('../../assets/organic-icon.png') },
    { id: 'mezclado', label: 'Mezclado', color: '#7E7E7E', imagePath: require('../../assets/mixed-icon.png') },
    { id: 'sin_identificar', label: 'Sin Identificar', color: '#2D9CDB' }
];

export const collectMaterialStylesDict = collectMaterials.reduce((acc, item) => {
    const { id, ...rest } = item;
    acc[id] = rest;
    return acc;
}, {});
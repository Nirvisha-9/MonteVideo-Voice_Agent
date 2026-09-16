export const classifyMaterials = [
    { id: 'papel_carton', label: 'Papel Cartón', color: '#4C52E7', imagePath: require('../../assets/paper-icon.png') },
    { id: 'plasticos', label: 'Plásticos', color: '#D8D238', imagePath: require('../../assets/plastic-icon.png') },
    { id: 'otros', label: 'Otros', color: '#EDAC2F', imagePath: require('../../assets/other-recyclable-icon.png') },
    { id: 'organico', label: 'Orgánico', color: '#663B14', imagePath: require('../../assets/organic-icon.png') },
    { id: 'descarte', label: 'Descarte', color: '#5B1466', imagePath: require('../../assets/discard-icon.png') },
];

export const classifyMaterialStylesDict = classifyMaterials.reduce((acc, item) => {
    const { id, ...rest } = item;
    acc[id] = rest;
    return acc;
}, {});


export const classifySubMaterials = {
    papel_carton: [
        { id: 'papel_blanco', label: 'Papel Blanco', color: '#7BD1D7' },
        { id: 'papel_color', label: 'Papel Color', color: '#5780CF' },
        { id: 'revista', label: 'Revista', color: '#85aaf3ff' },
        { id: 'diario', label: 'Diario', color: '#3358a3ff' },
        { id: 'carton_corrugado', label: 'Cartón Corrugado', color: '#2D9BAA' },
        { id: 'carton_color', label: 'Cartón Color', color: '#2E438C' },
    ],
    plasticos: [
        { id: 'pet_natural', label: 'PET Natural (Cristal)', color: '#EADA4A' },
        { id: 'pet_verde', label: 'PET Verde', color: '#FED56B' },
        { id: 'pet_blanco', label: 'PET Blanco', color: '#E6CA83' },
        { id: 'pomo', label: 'Pomo (Botella Polietileno)', color: '#D7C562' },
        { id: 'nylon_transparente', label: 'Nylon Transparente (Polietileno Film)', color: '#BBA877' },
        { id: 'nylon_color', label: 'Nylon Color (Polietileno Film)', color: '#E6E289' },
        { id: 'espuma', label: 'Espuma (Poliestireno Expandido)', color: '#FFE81C' },
        { id: 'polipropileno', label: 'Polipropileno PP (5)', color: '#C6B412' },
        { id: 'poliestireno', label: 'Poliestireno PS (6)', color: '#C2BA73' },
    ],
    otros: [
        { id: 'latas_aluminio', label: 'Latas-Aluminio', color: '#EE6807' },
        { id: 'latas_chatarra', label: 'Latas-Chatarra', color: '#EE8407' },
        { id: 'electronicos', label: 'Electrónicos', color: '#EDAC2F' },
        { id: 'vidrio', label: 'Vidrio', color: '#C5821D' },
        { id: 'tetrabrik', label: 'Tetrabrik', color: '#FFB649' },
    ],
    descarte: { id: 'descarte', label: 'Descarte', color: '#5B1466' },
    organico: { id: 'organico', label: 'Orgánico', color: '#663B14' },
};

export const classifySubMaterialsDict = Object.entries(classifySubMaterials).reduce((acc, [mainMaterialId, subMaterials]) => {
    if (Array.isArray(subMaterials)) {
        subMaterials.forEach(subMaterial => {
            acc[subMaterial.id] = subMaterial;
        });
    } else if (subMaterials && typeof subMaterials === 'object') {
        acc[subMaterials.id] = subMaterials;
    }
    return acc;
}, {});
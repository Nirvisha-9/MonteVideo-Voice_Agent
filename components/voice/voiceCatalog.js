// Voice Agent prototype — English catalog.
// Mirrors the Clasificar materials used elsewhere in the app, but with the
// doc's English top-level category names. Kept fully self-contained so the
// existing manual flow and its data are never touched.

// Example collection context used by the voice prototype (from the design doc).
export const VOICE_CONTEXT = { client: 'WTC', location: 'Towers 1 2 3' };

const CATEGORIES = {
    en: [
        { id: 'paper', label: 'Paper/Cardboard', typeWord: 'paper', hasSub: true },
        { id: 'plastics', label: 'Plastics', typeWord: 'plastic', hasSub: true },
        { id: 'other', label: 'Other Recyclables', typeWord: 'material', hasSub: true },
        { id: 'organic', label: 'Organic', typeWord: null, hasSub: false },
        { id: 'mixed', label: 'Mixed', typeWord: null, hasSub: false },
        { id: 'unidentified', label: 'Unidentified', typeWord: null, hasSub: false },
    ],
    es: [
        { id: 'paper', label: 'Papel Cartón', typeWord: 'papel', hasSub: true },
        { id: 'plastics', label: 'Plásticos', typeWord: 'plástico', hasSub: true },
        { id: 'other', label: 'Otros Reciclables', typeWord: 'material', hasSub: true },
        { id: 'organic', label: 'Orgánico', typeWord: null, hasSub: false },
        { id: 'mixed', label: 'Mezclado', typeWord: null, hasSub: false },
        { id: 'unidentified', label: 'Sin Identificar', typeWord: null, hasSub: false },
    ],
};

export const getCategories = (lang) => CATEGORIES[lang] || CATEGORIES.en;

// Back-compat default (English) for any code that still imports the constant.
export const VOICE_CATEGORIES = CATEGORIES.en;

export const VOICE_SUBCATEGORIES = {
    paper: [
        { id: 'papel_blanco', label: 'Papel Blanco' },
        { id: 'papel_color', label: 'Papel Color' },
        { id: 'revista', label: 'Revista' },
        { id: 'diario', label: 'Diario' },
        { id: 'carton_corrugado', label: 'Cartón Corrugado' },
        { id: 'carton_color', label: 'Cartón Color' },
    ],
    plastics: [
        { id: 'pet_natural', label: 'PET Natural' },
        { id: 'pet_verde', label: 'PET Verde' },
        { id: 'pet_blanco', label: 'PET Blanco' },
        { id: 'pomo', label: 'Pomo' },
        { id: 'nylon_transparente', label: 'Nylon Transparente' },
        { id: 'nylon_color', label: 'Nylon Color' },
        { id: 'espuma', label: 'Espuma' },
        { id: 'polipropileno', label: 'Polipropileno' },
        { id: 'poliestireno', label: 'Poliestireno' },
    ],
    other: [
        { id: 'latas_aluminio', label: 'Latas-Aluminio' },
        { id: 'latas_chatarra', label: 'Latas-Chatarra' },
        { id: 'electronicos', label: 'Electrónicos' },
        { id: 'vidrio', label: 'Vidrio' },
        { id: 'tetrabrik', label: 'Tetrabrik' },
    ],
};

export const WAKE_WORD = 'monte';
export const AGENT_NAME = 'Monte';

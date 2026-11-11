// Voice Agent catalog.
// Materials come from Firestore via `loadVoiceCatalog` (the list the admin page
// edits, shared with the manual Clasificar flow). The lists below are only the
// offline fallback.

import { fetchClassifyRootMaterials, fetchClassifySubMaterials } from '../../services/materialService';

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

// "Which type of ___ is it?" words for the admin's existing categories.
// Categories added later in the admin page fall back to their own label.
const TYPE_WORDS = {
    papel_carton: { en: 'paper', es: 'papel' },
    plasticos: { en: 'plastic', es: 'plástico' },
    otros: { en: 'material', es: 'material' },
};

const staticCatalog = (lang) => ({
    categories: getCategories(lang),
    subcategories: VOICE_SUBCATEGORIES,
});

/**
 * Loads the materials the admin page manages (Firestore `materials`), the same
 * source the manual Clasificar flow uses, shaped for the voice agent:
 * { categories: [{ id, label, typeWord, hasSub }], subcategories: { [catId]: [{ id, label }] } }.
 * Falls back to the built-in list when offline or when nothing is configured.
 */
export async function loadVoiceCatalog(lang) {
    const L = lang === 'es' ? 'es' : 'en';
    try {
        const roots = await fetchClassifyRootMaterials(L);
        if (!roots.length) return staticCatalog(L);

        const subLists = await Promise.all(
            roots.map((m) => (m.hasSubMaterials ? fetchClassifySubMaterials(m.id, L) : []))
        );
        const categories = [];
        const subcategories = {};
        roots.forEach((m, i) => {
            const subs = subLists[i].map((s) => ({ id: s.id, label: s.label }));
            const hasSub = subs.length > 0;
            if (hasSub) subcategories[m.id] = subs;
            categories.push({
                id: m.id,
                label: m.label,
                typeWord: hasSub ? TYPE_WORDS[m.id]?.[L] || m.label.toLowerCase() : null,
                hasSub,
            });
        });
        return { categories, subcategories };
    } catch (e) {
        console.warn('Voice agent: using built-in materials list —', e?.message || e);
        return staticCatalog(L);
    }
}

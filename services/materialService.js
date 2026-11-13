import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { getLanguage, subscribeLanguage } from '../localization/dictionary';

const DEFAULT_COLOR = '#4C52E7';

// Colors for materials the admin saved without one. Each gets its own color,
// never one already saved on another material. Dark enough for white labels.
const AUTO_COLORS = [
    '#E63946', '#2A9D8F', '#8E44AD', '#D35400', '#27AE60', '#E84393',
    '#00838F', '#6D4C41', '#607D8B', '#AD1457', '#2E7D32', '#F4511E',
    '#7B1FA2', '#00695C', '#B71C1C', '#558B2F', '#C2185B', '#5E35B1',
    '#0097A7', '#9E6B00',
];
const autoColors = new Map(); // material id -> assigned color

const hashString = (str) => {
    let h = 0;
    for (let i = 0; i < str.length; i += 1) h = (h * 31 + str.charCodeAt(i)) >>> 0;
    return h;
};

const createdMillis = (data) => {
    const t = data?.createdAt;
    if (!t) return 0;
    if (typeof t.toMillis === 'function') return t.toMillis();
    if (typeof t.seconds === 'number') return t.seconds * 1000;
    const ms = new Date(t).getTime();
    return Number.isNaN(ms) ? 0 : ms;
};

/**
 * Picks a color for every material without a saved one: a pseudo-random start
 * from its id (so it stays the same on every load), moved on to the next free
 * color. Older materials pick first, so adding one never recolors the others.
 */
function assignAutoColors(docs) {
    const taken = new Set(
        docs.map((d) => d.data()?.color).filter(Boolean).map((c) => c.toUpperCase())
    );
    taken.add(DEFAULT_COLOR);
    const uncolored = docs
        .filter((d) => !d.data()?.color)
        .map((d) => ({ id: d.data()?.canonicalId || d.id, at: createdMillis(d.data()) }))
        .sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));

    autoColors.clear();
    uncolored.forEach(({ id }) => {
        const start = hashString(id) % AUTO_COLORS.length;
        let color = AUTO_COLORS[start]; // palette used up: reuse the hashed one
        for (let i = 0; i < AUTO_COLORS.length; i += 1) {
            const c = AUTO_COLORS[(start + i) % AUTO_COLORS.length];
            if (!taken.has(c)) {
                color = c;
                break;
            }
        }
        taken.add(color);
        autoColors.set(id, color);
    });
}

// In-memory cache of materials metadata keyed by material/submaterial ID
const materialCache = new Map();
const cacheListeners = new Set();

function notifyCacheUpdate() {
    cacheListeners.forEach((fn) => {
        try {
            fn();
        } catch (e) {
            console.error('Error in materialCache listener:', e);
        }
    });
}

export function subscribeMaterialCache(listener) {
    cacheListeners.add(listener);
    return () => cacheListeners.delete(listener);
}

/**
 * Validates whether a Firestore document conforms to the expected material schema.
 * Malformed or invalid entries are ignored and skipped.
 */
export function isValidMaterialDocument(docData, docId) {
    if (!docData || typeof docData !== 'object') return false;

    const id = docId || docData.id;
    if (!id || typeof id !== 'string' || id.trim() === '') {
        return false;
    }

    // Must be active and not archived
    if (docData.status && docData.status !== 'active') return false;
    if (docData.archived === true) return false;
    if (docData.active === false) return false;

    // Must have a valid display name or localized names object
    const hasValidName = typeof docData.name === 'string' && docData.name.trim().length > 0;
    const hasValidLocalizedName = docData.names && typeof docData.names === 'object' &&
        ((typeof docData.names.es === 'string' && docData.names.es.trim().length > 0) ||
         (typeof docData.names.en === 'string' && docData.names.en.trim().length > 0));

    if (!hasValidName && !hasValidLocalizedName) {
        return false;
    }

    return true;
}

/**
 * Normalizes a raw Firestore material document into a consistent structure.
 */
export function normalizeMaterial(docData, docId, lang = getLanguage()) {
    // Some admin-created categories are stored under their display name
    // ("Papel y cartón") with the short code in `canonicalId`; sub-materials
    // point at that code through `parentId`, so it is the material's id.
    const storedId = docId || docData?.id;
    const id = docData?.canonicalId || storedId;
    const names = docData?.names || {};
    const name = docData?.name || '';
    const label = names[lang] || names.es || names.en || name || id || '';
    const color = docData?.color || autoColors.get(id) || DEFAULT_COLOR;
    const photoUrl = docData?.photoUrl || docData?.imageUrl || null;
    const parentId = docData?.parentId || null;
    const workflows = Array.isArray(docData?.workflows) ? docData.workflows : [];
    const sortOrder = typeof docData?.sortOrder === 'number' ? docData.sortOrder : 999;
    const hasSubMaterials = Boolean(docData?.hasSubMaterials);
    const subMaterials = Array.isArray(docData?.subMaterials) ? docData.subMaterials : [];

    return {
        ...docData,
        id,
        docId: storedId,
        name,
        names,
        label,
        color,
        photoUrl,
        imageUrl: photoUrl,
        parentId,
        workflows,
        sortOrder,
        hasSubMaterials,
        subMaterials,
    };
}

/**
 * Stores normalized material documents into the in-memory cache.
 */
function cacheMaterials(materials) {
    let updated = false;
    materials.forEach((mat) => {
        if (mat?.id) {
            materialCache.set(mat.id, mat);
            // records saved with the stored document id still resolve
            if (mat.docId && mat.docId !== mat.id) materialCache.set(mat.docId, mat);
            updated = true;
        }
    });
    if (updated) {
        notifyCacheUpdate();
    }
}

/**
 * Fetch all active materials from Firestore.
 * Ignores malformed documents that do not match the expected schema.
 * Updates the in-memory cache.
 */
export async function fetchAllActiveMaterials(lang = getLanguage()) {
    try {
        const q = query(
            collection(db, 'materials'),
            where('status', '==', 'active')
        );
        const snapshot = await getDocs(q);
        const validDocs = snapshot.docs.filter((d) => isValidMaterialDocument(d.data(), d.id));
        assignAutoColors(validDocs);
        const materials = validDocs.map((d) => normalizeMaterial(d.data(), d.id, lang));

        // A category has sub-materials when active ones point at it, whatever
        // its `hasSubMaterials` flag says (the flag is not kept in sync by the admin).
        const parentIds = new Set(materials.map((m) => m.parentId).filter(Boolean));
        materials.forEach((m) => {
            if (m.parentId) return;
            const embedded = Array.isArray(m.subMaterials) && m.subMaterials.length > 0;
            m.hasSubMaterials = parentIds.has(m.id) || parentIds.has(m.docId) || embedded;
        });
        cacheMaterials(materials);

        // Also check for embedded submaterials in legacy root docs
        materials.forEach((root) => {
            if (Array.isArray(root.subMaterials)) {
                root.subMaterials.forEach((sub) => {
                    if (isValidMaterialDocument(sub, sub?.id) && !materialCache.has(sub.id)) {
                        const normalizedSub = normalizeMaterial(
                            { ...sub, parentId: root.id },
                            sub.id,
                            lang
                        );
                        materialCache.set(sub.id, normalizedSub);
                    }
                });
            }
        });

        return materials;
    } catch (error) {
        console.error('Error fetching all active materials:', error);
        throw error;
    }
}

/**
 * Fetch active root materials for the Collect workflow.
 * Filter: root categories (no parentId) matching workflow 'both' (or unrestricted).
 */
export async function fetchCollectMaterials(lang = getLanguage()) {
    try {
        const all = await fetchAllActiveMaterials(lang);
        const rootCollectMaterials = all.filter((item) => {
            if (item.parentId) return false;
            if (!item.workflows || item.workflows.length === 0) return true;
            return item.workflows.includes('both') || item.workflows.includes('collect');
        });

        rootCollectMaterials.sort((a, b) => a.sortOrder - b.sortOrder);
        return rootCollectMaterials;
    } catch (error) {
        console.error('Error fetching collect materials:', error);
        throw error;
    }
}

/**
 * Fetch active root materials for the Classify workflow.
 * Filter: root categories (no parentId) matching workflow 'both' or 'classify'.
 */
export async function fetchClassifyRootMaterials(lang = getLanguage()) {
    try {
        const all = await fetchAllActiveMaterials(lang);
        const rootClassifyMaterials = all.filter((item) => {
            if (item.parentId) return false;
            if (!item.workflows || item.workflows.length === 0) return true;
            return item.workflows.includes('classify') || item.workflows.includes('both');
        });

        rootClassifyMaterials.sort((a, b) => a.sortOrder - b.sortOrder);
        return rootClassifyMaterials;
    } catch (error) {
        console.error('Error fetching classify root materials:', error);
        throw error;
    }
}

/**
 * Fetch active submaterials for a specific parent category.
 * Queries Firestore where parentId == parentCategoryId, or extracts embedded submaterials.
 */
export async function fetchClassifySubMaterials(parentCategoryId, lang = getLanguage()) {
    if (!parentCategoryId) return [];
    try {
        // children may reference the parent by its short code or its document id
        const parent = materialCache.get(parentCategoryId);
        const parentIds = [...new Set([parentCategoryId, parent?.id, parent?.docId].filter(Boolean))];
        const q = query(
            collection(db, 'materials'),
            where('parentId', 'in', parentIds),
            where('status', '==', 'active')
        );
        const snapshot = await getDocs(q);
        let subs = snapshot.docs
            .filter((d) => isValidMaterialDocument(d.data(), d.id))
            .map((d) => normalizeMaterial(d.data(), d.id, lang));

        // If no flat child documents found, check if parent in cache has embedded subMaterials
        if (subs.length === 0) {
            if (Array.isArray(parent?.subMaterials) && parent.subMaterials.length > 0) {
                subs = parent.subMaterials
                    .filter((s) => isValidMaterialDocument(s, s?.id))
                    .map((s) => normalizeMaterial({ ...s, parentId: parentCategoryId }, s.id, lang));
            }
        }

        cacheMaterials(subs);
        subs.sort((a, b) => a.sortOrder - b.sortOrder);
        return subs;
    } catch (error) {
        console.error(`Error fetching submaterials for ${parentCategoryId}:`, error);
        throw error;
    }
}

/**
 * Fetch metadata for a single material by ID (checks cache first, queries doc if absent).
 */
export async function getOrFetchMaterial(id, lang = getLanguage()) {
    if (!id) return null;
    if (materialCache.has(id)) {
        return materialCache.get(id);
    }
    try {
        const docRef = doc(db, 'materials', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && isValidMaterialDocument(docSnap.data(), docSnap.id)) {
            const mat = normalizeMaterial(docSnap.data(), docSnap.id, lang);
            materialCache.set(id, mat);
            notifyCacheUpdate();
            return mat;
        }
    } catch (e) {
        console.error(`Error fetching material doc for ${id}:`, e);
    }
    return null;
}

/**
 * Synchronous cached lookup of a material's display label.
 */
export function getMaterialOrSubMaterialLabel(id, lang = getLanguage()) {
    if (!id) return '';
    const mat = materialCache.get(id);
    if (!mat) return id;
    return mat.names?.[lang] || mat.names?.es || mat.names?.en || mat.name || mat.label || id;
}

/**
 * Synchronous cached lookup of a material's badge color.
 */
export function getMaterialColor(id, defaultColor = DEFAULT_COLOR) {
    if (!id) return defaultColor;
    const mat = materialCache.get(id);
    return mat?.color || defaultColor;
}

/**
 * Synchronous cached lookup of a material's full metadata.
 */
export function getMaterialMetadata(id) {
    if (!id) return null;
    return materialCache.get(id) || null;
}

/**
 * Export in-memory cache dictionary for compatibility with components expecting a dictionary object.
 */
export const materialStylesDict = new Proxy({}, {
    get(_target, prop) {
        if (typeof prop !== 'string') return undefined;
        return materialCache.get(prop);
    }
});

// Auto-update labels if language changes
subscribeLanguage((newLang) => {
    materialCache.forEach((mat, id) => {
        materialCache.set(id, {
            ...mat,
            label: mat.names?.[newLang] || mat.names?.es || mat.names?.en || mat.name || mat.id,
        });
    });
    notifyCacheUpdate();
});

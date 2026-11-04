import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { getLanguage, subscribeLanguage } from '../localization/dictionary';

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
    const id = docId || docData?.id;
    const names = docData?.names || {};
    const name = docData?.name || '';
    const label = names[lang] || names.es || names.en || name || id || '';
    const color = docData?.color || '#4C52E7';
    const photoUrl = docData?.photoUrl || docData?.imageUrl || null;
    const parentId = docData?.parentId || null;
    const workflows = Array.isArray(docData?.workflows) ? docData.workflows : [];
    const sortOrder = typeof docData?.sortOrder === 'number' ? docData.sortOrder : 999;
    const hasSubMaterials = Boolean(docData?.hasSubMaterials);
    const subMaterials = Array.isArray(docData?.subMaterials) ? docData.subMaterials : [];

    return {
        ...docData,
        id,
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
        const materials = snapshot.docs
            .filter((d) => isValidMaterialDocument(d.data(), d.id))
            .map((d) => normalizeMaterial(d.data(), d.id, lang));
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
        const q = query(
            collection(db, 'materials'),
            where('parentId', '==', parentCategoryId),
            where('status', '==', 'active')
        );
        const snapshot = await getDocs(q);
        let subs = snapshot.docs
            .filter((d) => isValidMaterialDocument(d.data(), d.id))
            .map((d) => normalizeMaterial(d.data(), d.id, lang));

        // If no flat child documents found, check if parent in cache has embedded subMaterials
        if (subs.length === 0) {
            const parent = materialCache.get(parentCategoryId);
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
export function getMaterialColor(id, defaultColor = '#4C52E7') {
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

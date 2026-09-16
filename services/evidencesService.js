import { db, storage } from '../firebase';
import { addDoc, collection, doc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, Timestamp, where, startAfter } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

/**
 * Upload images to Firebase Storage and return their download URLs.
 * Uses fetch-to-blob pattern for React Native (RN Blob from fetch is safe; new Blob(ArrayBuffer) is not).
 * @param {Array<string>} imageUris - Array of local image URIs (e.g. file:///...)
 * @returns {Promise<Array<string>>} Array of download URLs
 */
export async function uploadEvidenceImages(imageUris) {
    const uploadPromises = imageUris.map(async (uri, index) => {
        try {
            let fileUri = uri;
            if (!uri.startsWith('file://') && !uri.startsWith('http')) {
                fileUri = uri.startsWith('/') ? `file://${uri}` : `file:///${uri}`;
            }

            if (!fileUri.startsWith('file://')) {
                throw new Error(`Invalid image URI: must be a local file path (file://...), got: ${fileUri}`);
            }

            const response = await fetch(fileUri, { method: 'GET' });
            if (!response.ok) {
                throw new Error(`Failed to read file: ${response.status} ${response.statusText}`);
            }
            const blob = await response.blob();

            const timestamp = Date.now();
            const filename = `evidences/${timestamp}_${index}.jpg`;
            const storageRef = ref(storage, filename);

            await uploadBytes(storageRef, blob);
            const downloadURL = await getDownloadURL(storageRef);
            return downloadURL;
        } catch (error) {
            console.error(`Error uploading image ${index}:`, error);
            console.error('Error details:', error.message, error.stack);
            throw new Error(`Failed to upload image ${index + 1}: ${error.message}`);
        }
    });

    return Promise.all(uploadPromises);
}

/**
 * Upsert an Evidence document in Firestore.
 * 
 * @param {Object} payload - { clientId, locationId, dateTime, images[], notes }
 * @param {string|null} id - Firestore doc id to update; omit/null to create
 * @returns {Promise<string>} - The document id
 */
export async function upsertEvidence(payload, id) {
    // Normalize dateTime -> Firestore Timestamp
    let normalizedTime;
    const dt = payload?.dateTime;

    if (dt instanceof Date) {
        normalizedTime = Timestamp.fromDate(dt);
    } else if (dt?.toDate instanceof Function) {
        normalizedTime = Timestamp.fromDate(dt.toDate());
    } else if (dt) {
        const parsed = new Date(dt);
        normalizedTime = isNaN(parsed.getTime())
            ? serverTimestamp()
            : Timestamp.fromDate(parsed);
    } else {
        normalizedTime = serverTimestamp();
    }

    const baseData = {
        clientId: payload.clientId ?? null,
        locationId: payload.locationId ?? null,
        dateTime: normalizedTime,
        images: Array.isArray(payload.images) ? payload.images : [],
        notes: payload.notes ?? '',
        updatedAt: serverTimestamp(),
    };

    if (id) {
        const ref = doc(db, 'evidences', id);
        await setDoc(ref, { ...baseData, id }, { merge: true });
        return id;
    } else {
        const ref = await addDoc(collection(db, 'evidences'), {
            ...baseData,
            createdAt: serverTimestamp(),
        });
        await setDoc(ref, { id: ref.id }, { merge: true });
        return ref.id;
    }
}

/**
 * Fetch Evidences with cursor pagination (newest first).
 * 
 * @param {Object} [opts]
 * @param {string} [opts.clientId] - Filter evidences by clientId (optional).
 * @param {number} [opts.pageSize=20] - Page size (1-100 recommended).
 * @param {{time:number, id:string}|null} [opts.cursor] - Pass the `nextCursor` returned from a previous call.
 * @returns {Promise<{items:Array<Object>, nextCursor:null|{time:number,id:string}}>}
 */
export async function fetchEvidences(opts = {}) {
    const {
        clientId,
        pageSize = 20,
        cursor = null,
    } = opts;

    const parts = [collection(db, 'evidences')];

    if (clientId) {
        parts.push(where('clientId', '==', clientId));
    }

    // Stable ordering for pagination
    parts.push(orderBy('dateTime', 'desc'));
    parts.push(orderBy('id', 'desc'));
    parts.push(limit(Math.max(1, Math.min(pageSize, 100))));

    // Apply cursor if present
    if (cursor?.time && cursor?.id) {
        parts.splice(parts.length - 1, 0, startAfter(Timestamp.fromMillis(cursor.time), cursor.id));
    }

    try {
        const q = query(...parts);
        const snap = await getDocs(q);

        const items = snap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
        }));

        let nextCursor = null;
        if (items.length > 0) {
            const last = snap.docs[snap.docs.length - 1];
            const lastData = last.data();
            const ts = lastData.dateTime ?? lastData.createdAt ?? null;
            if (ts instanceof Timestamp) {
                nextCursor = { time: ts.toMillis(), id: lastData.id ?? last.id };
            }
        }

        return { items, nextCursor };
    } catch (err) {
        console.error('Error fetching evidences (paginated):', err);
        throw err;
    }
}

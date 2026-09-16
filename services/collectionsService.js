import { db } from '../firebase';
import { addDoc, collection, doc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, Timestamp, where, startAfter } from 'firebase/firestore';

/**
 * Upsert a Collection document in Firestore.
 * Persists only clientId (no client object).
 *
 * @param {Object} payload - { clientId, location, timeStamp, collections[] }
 * @param {string|null} id - Firestore doc id to update; omit/null to create
 * @returns {Promise<string>} - The document id
 */
export async function upsertCollection(payload, id) {
    // Normalize timeStamp -> Firestore Timestamp
    let normalizedTime;
    const ts = payload?.timeStamp;

    if (ts instanceof Date) {
        normalizedTime = Timestamp.fromDate(ts);
    } else if (ts?.toDate instanceof Function) {
        normalizedTime = Timestamp.fromDate(ts.toDate());
    } else if (ts) {
        const parsed = new Date(ts);
        normalizedTime = isNaN(parsed.getTime())
            ? serverTimestamp()
            : Timestamp.fromDate(parsed);
    } else {
        normalizedTime = serverTimestamp();
    }

    const baseData = {
        clientId: payload.clientId ?? null,
        location: payload.location ?? null,
        timeStamp: normalizedTime,
        collections: Array.isArray(payload.collections) ? payload.collections : [],
        updatedAt: serverTimestamp(),
        // NOTE: don't put `classified` here or updates would reset it
    };

    if (id) {
        const ref = doc(db, 'collections', id);
        await setDoc(ref, { ...baseData, id }, { merge: true }); // keep id == doc id
        return id;
    } else {
        const ref = await addDoc(collection(db, 'collections'), {
            ...baseData,
            classified: false,            // <-- default for brand-new collections
            createdAt: serverTimestamp(),
        });
        await setDoc(ref, { id: ref.id }, { merge: true }); // ensure id field present
        return ref.id;
    }
}

/**
 * Fetch Collections with cursor pagination (newest first).
 *
 * Sorts by timeStamp DESC, then id DESC to keep order stable
 * when multiple docs share the same timeStamp.
 *
 * @param {Object} [opts]
 * @param {string} [opts.clientId] - Filter collections by clientId (optional).
 * @param {boolean} [opts.unclassifiedOnly=false] - If true, only return docs with classified === false.
 * @param {number} [opts.pageSize=20] - Page size (1-100 recommended).
 * @param {{time:number, id:string}|null} [opts.cursor] - Pass the `nextCursor` returned from a previous call.
 * @returns {Promise<{items:Array<Object>, nextCursor:null|{time:number,id:string}}>}
 */
export async function fetchCollections(opts = {}) {
    const {
        clientId,
        unclassifiedOnly = false,
        pageSize = 10,
        cursor = null,
    } = opts;

    const parts = [collection(db, 'collections')];

    if (clientId) {
        parts.push(where('clientId', '==', clientId));
    }
    if (unclassifiedOnly) {
        // Only matches docs where the field exists and is strictly false.
        parts.push(where('classified', '==', false));
    }

    // Stable ordering for pagination
    parts.push(orderBy('timeStamp', 'desc'));
    parts.push(orderBy('id', 'desc'));
    parts.push(limit(Math.max(1, Math.min(pageSize, 100))));

    // Apply cursor if present (must match orderBy fields)
    if (cursor?.time && cursor?.id) {
        // Insert before `limit`
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
            const ts = lastData.timeStamp ?? lastData.createdAt ?? null;
            if (ts instanceof Timestamp) {
                nextCursor = { time: ts.toMillis(), id: lastData.id ?? last.id };
            }
        }

        return { items, nextCursor };
    } catch (err) {
        console.error('Error fetching collections (paginated):', err);
        throw err;
    }
}

/**
 * Fetch the most recent collections for a given client.
 *
 * @param {string} clientId - The client id to filter by.
 * @param {Object} [opts]
 * @param {boolean} [opts.unclassifiedOnly=false] - If true, only return docs with classified === false.
 * @returns {Promise<Array<Object>>} - Array of up to 20 collection docs, newest first.
 */
export async function FetchCollectionsByClient(clientId, opts = {}) {
    const { unclassifiedOnly = false } = opts;

    try {
        const q = query(
            collection(db, 'collections'),
            where('clientId', '==', clientId),
            ...(unclassifiedOnly ? [where('classified', '==', false)] : []),
            orderBy('timeStamp', 'desc'),
            limit(20)
        );

        const snap = await getDocs(q);
        return snap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
        }));
    } catch (err) {
        console.error('Error fetching collections for client:', err);
        throw err;
    }
}
import { db } from '../firebase';
import { addDoc, collection, doc, serverTimestamp, setDoc, Timestamp, startAfter, orderBy, limit, query, getDocs, where, writeBatch } from 'firebase/firestore';



/**
 * Upsert a Classification document in Firestore and mark the related
 * collection as classified = true when appropriate.
 *
 * @param {Object} payload - { clientId, location, collectionId, classifications[], timeStamp }
 * @param {string|null} id - Firestore doc id to update; omit/null to create
 * @returns {Promise<string>} - The document id
 */
export async function upsertClassification(payload, id) {
    // Normalize timeStamp -> Firestore Timestamp (same logic as upsertCollection)
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

    // Normalize collectionTimeStamp -> Firestore Timestamp if provided
    let normalizedCollectionTime = null;
    const collTs = payload?.collectionTimeStamp;
    if (collTs instanceof Date) {
        normalizedCollectionTime = Timestamp.fromDate(collTs);
    } else if (collTs?.toDate instanceof Function) {
        normalizedCollectionTime = Timestamp.fromDate(collTs.toDate());
    } else if (collTs) {
        const parsed = new Date(collTs);
        normalizedCollectionTime = isNaN(parsed.getTime())
            ? null
            : Timestamp.fromDate(parsed);
    }

    const baseData = {
        clientId: payload.clientId ?? payload.client ?? null,
        location: payload.location ?? null,
        collectionId: payload.collectionId ?? null,
        collectionTimeStamp: normalizedCollectionTime,
        classifications: Array.isArray(payload.classifications) ? payload.classifications : [],
        timeStamp: normalizedTime,
        updatedAt: serverTimestamp(),
    };

    const hasClassifications = Array.isArray(baseData.classifications) && baseData.classifications.length > 0;

    // --- Batch both writes so they land together ---
    const batch = writeBatch(db);

    // Prepare classification ref (reuse id if provided)
    const classRef = id
        ? doc(db, 'classifications', id)
        : doc(collection(db, 'classifications')); // pre-generate id for batch

    // Upsert classification
    batch.set(
        classRef,
        {
            ...baseData,
            id: classRef.id,              // keep id == doc id
            ...(id ? {} : { createdAt: serverTimestamp() }),
        },
        { merge: true }
    );

    // Mark the related collection as classified if we have one and there is at least one classification
    if (payload.collectionId && hasClassifications) {
        const collRef = doc(db, 'collections', payload.collectionId);
        batch.set(
            collRef,
            { classified: true, updatedAt: serverTimestamp() },
            { merge: true }
        );
    }

    await batch.commit();
    return classRef.id;
}


/**
 * Fetch Classifications with cursor pagination (newest first).
 *
 * Ordered by timeStamp DESC, then id DESC so that results remain stable
 * when multiple docs share the same timeStamp.
 *
 * @param {Object} [opts]
 * @param {string} [opts.clientId] - Filter by clientId (optional).
 * @param {string} [opts.collectionId] - Filter by collectionId (optional).
 * @param {number} [opts.pageSize=20] - Page size (1..100).
 * @param {{time:number, id:string}|null} [opts.cursor] - Pass the `nextCursor` returned from a previous call.
 * @returns {Promise<{items:Array<Object>, nextCursor:null|{time:number,id:string}}>}
 */
export async function fetchClassifications(opts = {}) {
    const {
        clientId,
        collectionId,
        pageSize = 10,
        cursor = null,
    } = opts;

    const parts = [collection(db, 'classifications')];

    if (clientId) parts.push(where('clientId', '==', clientId));
    if (collectionId) parts.push(where('collectionId', '==', collectionId));

    // Stable ordering: newest first by collectionTimeStamp, then by id to break ties
    parts.push(orderBy('collectionTimeStamp', 'desc'));
    parts.push(orderBy('id', 'desc'));

    // Page size clamp for safety
    const clamped = Math.max(1, Math.min(pageSize, 100));
    // Apply cursor if present (must match the orderBy fields)
    if (cursor?.time && cursor?.id) {
        parts.push(startAfter(Timestamp.fromMillis(cursor.time), cursor.id));
    }

    parts.push(limit(clamped));

    try {
        const q = query(...parts);
        const snap = await getDocs(q);

        const items = snap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
        }));

        let nextCursor = null;
        if (items.length > 0) {
            const lastDoc = snap.docs[snap.docs.length - 1];
            const data = lastDoc.data();
            const ts = data.collectionTimeStamp ?? data.timeStamp ?? data.createdAt ?? null;
            if (ts instanceof Timestamp) {
                nextCursor = { time: ts.toMillis(), id: data.id ?? lastDoc.id };
            }
        }

        return { items, nextCursor };
    } catch (err) {
        console.error('Error fetching classifications (paginated):', err);
        throw err;
    }
}
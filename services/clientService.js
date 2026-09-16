import { db } from '../firebase';
import { collection, query, limit as qLimit, getDocs, getDoc, doc } from 'firebase/firestore';

/**
 * Get up to 100 clients.
 * Returns an array of plain objects exactly as stored in Firestore.
 */
export const getClients = async (setClients) => {
    try {
        const q = query(collection(db, "clients"), qLimit(100));
        const snap = await getDocs(q);
        const list = snap.docs.map((d) => d.data());
        if (typeof setClients === "function") setClients(list);
        return list;
    } catch (e) {
        console.error(e);
        throw e;
    }
};


export const getClient = async (clientId) => {
    try {
        const clientRef = doc(db, 'clients', clientId);
        const clientSnap = await getDoc(clientRef);

        return clientSnap.exists() ? clientSnap.data() : null;
    } catch (e) {
        console.error('Error fetching client:', e);
        throw e;
    }
};
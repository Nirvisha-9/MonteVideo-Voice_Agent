import { db } from '../firebase';
import { collection, query, limit as qLimit, getDocs } from 'firebase/firestore';

/**
 * Get up to 100 users
 * Returns: Array of raw objects exactly as stored in Firestore
 */
export const getUsers = async (setUsers) => {
    try {
        const q = query(collection(db, 'users'), qLimit(100));
        const snap = await getDocs(q);
        const list = snap.docs.map(d => d.data()); // raw only
        if (typeof setUsers === 'function') setUsers(list);
        return list;
    } catch (e) {
        console.error(e);
        throw e;
    }
};
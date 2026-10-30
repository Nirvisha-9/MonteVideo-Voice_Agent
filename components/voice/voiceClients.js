/**
 * The client list for the Voice Agent, fetched ahead of time.
 *
 * The mode and language screens start the fetch, so by the time the worker
 * picks a language the list is usually here and the first question can be
 * asked at once (and the live session opened with the client names).
 */

const FRESH_MS = 60000; // a list older than this is fetched again

let cache = null; // { at, list, promise }

/** Start (or reuse) a fetch of the client list. Never rejects: [] on failure. */
export function prefetchVoiceClients() {
    if (cache && Date.now() - cache.at < FRESH_MS) return cache.promise;
    const entry = { at: Date.now(), list: null, promise: null };
    entry.promise = (async () => {
        try {
            // lazy require: keeps firebase/firestore out of the module graph
            // for environments that can't resolve it (unit tests)
            // eslint-disable-next-line global-require
            const { getClients } = require('../../services/clientService');
            entry.list = (await getClients()) || [];
            return entry.list;
        } catch (e) {
            if (cache === entry) cache = null; // try again next time
            return [];
        }
    })();
    cache = entry;
    return entry.promise;
}

/** The list if a recent fetch already finished, else null. */
export function peekVoiceClients() {
    if (!cache || !cache.list || Date.now() - cache.at >= FRESH_MS) return null;
    return cache.list;
}

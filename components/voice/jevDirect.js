/**
 * Option scoring with Jev (TypeSafe), called straight from the app.
 *
 * The same request the `choose` Cloud Function makes (functions/index.js) —
 * for a standalone build that has no Cloud Functions to call. It needs the
 * TypeSafe key inside the app: EXPO_PUBLIC_TYPESAFE_API_KEY in .env.local
 * (gitignored). A key bundled into an APK can be read out of it, so only set
 * it for builds that stay in trusted hands; without it the app uses `choose`.
 */

const JEV_KEY = process.env.EXPO_PUBLIC_TYPESAFE_API_KEY || '';
const JEV_MODEL = 'jev-latest';
const MAX_OPTIONS = 40;

const PICK_QUESTION = {
    client: 'Which client did the worker choose?',
    location: 'Which location did the worker choose?',
    date: 'Which collection date did the worker choose? They may name the weekday, the day of the month, or say today / yesterday.',
    category: 'Which waste category did the worker choose?',
    subcategory: 'Which sub-type of material did the worker choose?',
};

/** True when this build carries the key and scores options itself. */
export const JEV_DIRECT = !!JEV_KEY;

/**
 * Which of `options` did the worker mean? Resolves to the same shape as the
 * `choose` Cloud Function: { index, id, label, control, confidence, top }.
 * Rejects on a network error, a timeout or a non-2xx reply.
 */
export async function chooseDirect({ transcript, phase, language = 'en', options = [] }, timeoutMs = 4000) {
    const opts = (Array.isArray(options) ? options : []).filter((o) => o && o.label).slice(0, MAX_OPTIONS);
    if (!transcript || !opts.length) throw new Error('transcript and options are required');

    // short keys: option ids come from the database and may be anything
    const criteria = {};
    opts.forEach((o, i) => {
        criteria[`o${i + 1}`] = String(o.label).slice(0, 80);
    });
    criteria.back = 'Go back to the previous step';
    criteria.read = 'Read the list of options aloud';
    criteria.none = 'None of these: the worker did not name any option';

    const lang = language === 'es' ? 'Spanish' : 'English';
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), timeoutMs);
    let res;
    try {
        res = await fetch('https://api.typesafe.ai/v1/systemone', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${JEV_KEY}` },
            body: JSON.stringify({
                state: String(transcript).slice(0, 500),
                model: JEV_MODEL,
                questions: {
                    pick: {
                        type: 'choice',
                        instructions:
                            `The text is a speech-to-text transcript of a waste-collection worker in Uruguay answering in ${lang}. ` +
                            `Words may be misheard or misspelled. ${PICK_QUESTION[phase] || 'Which option did the worker choose?'}`,
                        criteria,
                    },
                },
            }),
            signal: abort.signal,
        });
    } finally {
        clearTimeout(timer);
    }
    if (!res.ok) throw new Error(`Jev ${res.status}`);

    const json = await res.json();
    const answer = json.answers?.pick || {};
    const key = String(answer.choice || 'none');
    const index = /^o\d+$/.test(key) ? Number(key.slice(1)) - 1 : -1;
    const picked = index >= 0 ? opts[index] : null;
    const name = (k) => (/^o\d+$/.test(k) ? opts[Number(k.slice(1)) - 1]?.label : k);

    return {
        index: picked ? index : -1,
        id: picked ? picked.id ?? null : null,
        label: picked ? String(picked.label) : '',
        control: key === 'back' || key === 'read' ? key : null,
        confidence: Math.max(0, Math.min(1, Number(answer.confidence) || 0)),
        top: Object.entries(answer.probabilities || {})
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([k, p]) => ({ label: String(name(k) || k), p: Math.round(Number(p) * 100) / 100 })),
    };
}

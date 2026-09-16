// Per-screen recognition grammars for Vosk.
//
// Vosk is far more accurate when it only has to choose between the handful of
// answers that make sense on the current screen. Every screen therefore gets a
// tight word/phrase list. `"[unk]"` lets the recognizer report "that wasn't one
// of these" instead of forcing a wrong match.
//
// Structured by language so Spanish is a drop-in later (add the `es` block and
// ship the `model-es-es` Vosk model).

const NUMBERS_EN = [
    'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
    'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
    'seventeen', 'eighteen', 'nineteen', 'twenty', 'thirty', 'forty', 'fifty',
    'sixty', 'seventy', 'eighty', 'ninety', 'hundred', 'point', 'a half',
];

const NUMBERS_ES = [
    'cero', 'uno', 'una', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho',
    'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis',
    'diecisiete', 'dieciocho', 'diecinueve', 'veinte', 'treinta', 'cuarenta',
    'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa', 'cien', 'ciento',
    'coma', 'punto', 'medio', 'y',
];

const COMMON = {
    en: ['yes', 'no', 'yeah', 'nope', 'okay', 'go back', 'back', 'repeat', 'stop',
        'cancel', 'monte', 'correct', 'wrong'],
    es: ['sí', 'si', 'no', 'dale', 'volver', 'atrás', 'repetir', 'para', 'cancelar',
        'monte', 'correcto', 'incorrecto'],
};

const WORDS = {
    en: {
        wake: ['monte', 'hey monte', 'okay monte', 'ok monte'],
        addbags: ['yes', 'no', 'yeah', 'nope', 'add bags', 'not now', 'go back'],
        categoryExtra: [
            'paper', 'cardboard', 'plastic', 'plastics', 'other', 'recyclables',
            'organic', 'mixed', 'unidentified', 'read out the options', 'options',
        ],
        subExtra: [
            'pet', 'natural', 'green', 'white', 'nylon', 'clear', 'color', 'foam',
            'paper', 'magazine', 'newspaper', 'cardboard', 'aluminium', 'aluminum',
            'cans', 'scrap', 'electronics', 'glass',
        ],
        weightExtra: ['kilos', 'kilograms', 'kilo', 'kilogram', 'kg', 'actually',
            'wait', 'change to', 'make it'],
        summary: [
            'add another', 'another', 'add another type', 'submit', 'send',
            'edit', 'change', 'update', 'delete', 'remove', 'redo', 'start over',
            'read everything', 'everything', 'one item',
        ],
        done: ['menu', 'home', 'again', 'another', 'restart', 'exit'],
    },
    es: {
        wake: ['monte', 'hola monte', 'oye monte'],
        addbags: ['sí', 'si', 'no', 'agregar bolsas', 'ahora no', 'volver'],
        categoryExtra: [
            'papel', 'cartón', 'carton', 'plástico', 'plásticos', 'plasticos',
            'otros', 'reciclables', 'orgánico', 'organico', 'mezclado',
            'sin identificar', 'lee las opciones', 'opciones',
        ],
        subExtra: [
            'pet', 'natural', 'cristal', 'verde', 'blanco', 'pomo', 'nylon',
            'transparente', 'color', 'espuma', 'polipropileno', 'poliestireno',
            'papel', 'revista', 'diario', 'cartón', 'corrugado', 'latas', 'aluminio',
            'chatarra', 'electrónicos', 'vidrio', 'tetrabrik',
        ],
        weightExtra: ['kilos', 'kilo', 'kilogramos', 'kg', 'en realidad', 'espera',
            'cambia a', 'ponlo en'],
        summary: [
            'agregar otro', 'otro', 'agregar otro tipo', 'enviar', 'mandar',
            'editar', 'cambiar', 'borrar', 'eliminar', 'rehacer', 'empezar de nuevo',
            'lee todo', 'todo', 'un elemento',
        ],
        done: ['menú', 'menu', 'inicio', 'otra vez', 'otro', 'reiniciar', 'salir'],
    },
};

const uniq = (arr) => Array.from(new Set(arr.filter(Boolean)));

// Free-form recognition everywhere except the wake screen. A hard grammar makes
// Vosk *only* emit words from the list, which throws away everything the worker
// actually said ("let's do option 7" → nothing) and defeats the LLM fallback.
// Wake keeps a tight grammar because spotting the single made-up word "monte" in
// open vocabulary is unreliable on low-end phones.
const FREEFORM_EXCEPT_WAKE = true;

/**
 * @param {'en'|'es'} lang
 * @param {string} phase   wake | addbags | category | subcategory | weight | editweight | summary | done
 * @param {number} optionCount  how many numbered options are on screen (for "one".."nine")
 * @returns {string[]|null}  null = free-form recognition (no grammar)
 */
export function buildGrammar(lang, phase, optionCount = 0) {
    const L = WORDS[lang] ? lang : 'en';
    const w = WORDS[L];

    if (phase === 'wake') return uniq([...w.wake, '[unk]']);
    if (FREEFORM_EXCEPT_WAKE) return null;

    const nums = L === 'es' ? NUMBERS_ES : NUMBERS_EN;
    const numberWords = nums.slice(0, Math.max(10, Math.min(optionCount + 1, nums.length)));

    let list;
    switch (phase) {
        case 'wake':
            list = [...w.wake];
            break;
        case 'addbags':
            list = [...w.addbags, ...COMMON[L]];
            break;
        case 'category':
            list = [...numberWords, ...w.categoryExtra, ...COMMON[L]];
            break;
        case 'subcategory':
            list = [...numberWords, ...w.subExtra, ...COMMON[L]];
            break;
        case 'weight':
        case 'editweight':
            list = [...nums, ...w.weightExtra, ...COMMON[L]];
            break;
        case 'summary':
            list = [...w.summary, ...numberWords, ...COMMON[L]];
            break;
        case 'done':
            list = [...w.done, ...COMMON[L]];
            break;
        default:
            list = [...COMMON[L]];
    }
    return uniq([...list, '[unk]']);
}

export default buildGrammar;

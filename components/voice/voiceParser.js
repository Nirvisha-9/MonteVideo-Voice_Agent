// Lightweight natural-language interpreter for the Voice Agent prototype.
// No speech library is used — utterances arrive as typed text (or as taps on the
// numbered chips, which feed the same pipeline). The goal is to cover every
// spoken use-case described in the design doc.

// Bilingual (EN + ES). Accents are already stripped by `normalize`, so keys are
// accent-free ("dieciseis", "septimo", ...).
const UNITS = {
    zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
    eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
    fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
    nineteen: 19,
    // Spanish
    cero: 0, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5,
    seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12,
    trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17,
    dieciocho: 18, diecinueve: 19, veinte: 20, veintiuno: 21, veintiuna: 21,
    veintidos: 22, veintitres: 23, veinticuatro: 24, veinticinco: 25,
    veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29,
};
const TENS = {
    twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70,
    eighty: 80, ninety: 90,
    // Spanish
    treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70,
    ochenta: 80, noventa: 90,
};
const ORDINALS = {
    first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7,
    eighth: 8, ninth: 9,
    // Spanish
    primero: 1, primera: 1, segundo: 2, segunda: 2, tercero: 3, tercera: 3,
    quinto: 5, quinta: 5, sexto: 6, sexta: 6, septimo: 7, septima: 7,
    octavo: 8, octava: 8, noveno: 9, novena: 9,
};

export function normalize(str) {
    return String(str || '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^\w\s.,-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

// Decimal-separator words ("fifteen point five") and fraction words
// ("and a half"). "coma"/"punto"/"medio"/"cuarto" included so the same logic
// works once Spanish number words land.
const DECIMAL_SEP = new Set(['point', 'dot', 'decimal', 'coma', 'comma', 'punto']);

function scanInt(arr) {
    let total = null;
    for (const w of arr) {
        if (w in TENS) total = (total || 0) + TENS[w];
        else if (w in UNITS) total = (total || 0) + UNITS[w];
        else if (w in ORDINALS) total = (total || 0) + ORDINALS[w];
        else if ((w === 'hundred' || w === 'cien' || w === 'ciento') && total != null) total *= 100;
        else if (w === 'cien' || w === 'ciento') total = 100;
    }
    return total;
}

// "twenty five" · "fifteen" · "17" · "17.5" · "fifteen point five" ·
// "fifteen and a half" · "a quarter" · "point five"  -> number | null
export function parseNumber(text) {
    const n = normalize(text);

    // plain digits: "15", "15.5", "15,5"
    const digit = n.match(/(\d+(?:[.,]\d+)?)/);
    if (digit) return parseFloat(digit[1].replace(',', '.'));

    // fraction phrases -> a bonus we add at the end; strip the matched words
    let working = n;
    let frac = 0;
    if (/\bthree\s+quarters?\b/.test(working)) {
        frac = 0.75;
        working = working.replace(/\bthree\s+quarters?\b/, ' ');
    } else if (/\b(a\s+)?half\b/.test(working) || /\by?\s*medi[oa]\b/.test(working)) {
        frac = 0.5;
        working = working.replace(/\b(a\s+)?half\b/, ' ').replace(/\by?\s*medi[oa]\b/, ' ');
    } else if (/\b(a\s+)?quarter\b/.test(working) || /\bcuarto\b/.test(working)) {
        frac = 0.25;
        working = working.replace(/\b(a\s+)?quarter\b/, ' ').replace(/\bcuarto\b/, ' ');
    }

    let tokens = working.replace(/-/g, ' ').split(/\s+/).filter(Boolean);
    if (!tokens.length) return frac || null;

    const sepIdx = tokens.findIndex((t) => DECIMAL_SEP.has(t));

    if (sepIdx !== -1) {
        const intPart = scanInt(tokens.slice(0, sepIdx)) || 0;
        const after = tokens.slice(sepIdx + 1).filter((w) => w in UNITS || w in TENS);
        let fracStr = '';
        for (const w of after) {
            if (w in UNITS && UNITS[w] < 10) {
                fracStr += String(UNITS[w]); // "two five" -> "25" -> 0.25
            } else {
                const asInt = scanInt(tokens.slice(sepIdx + 1)); // "twenty five" -> 25
                if (asInt != null) fracStr = String(asInt);
                break;
            }
        }
        const value = fracStr ? parseFloat(`${intPart}.${fracStr}`) : intPart;
        return value + frac;
    }

    const total = scanInt(tokens);
    if (total == null) return frac || null;
    return total + frac;
}

const AFFIRM_WORDS = [
    'yes', 'yeah', 'yep', 'yup', 'sure', 'correct', 'proceed', 'confirm', 'confirmed',
    'ok', 'okay', 'affirmative', 'save', 'submit', 'continue', 'go', 'ahead',
    // Spanish
    'si', 'claro', 'dale', 'correcto', 'confirmar', 'confirmo', 'guardar', 'guarda',
    'enviar', 'envia', 'adelante', 'continuar', 'continua', 'listo', 'bueno', 'perfecto', 'exacto',
];
const AFFIRM_PHRASES = [
    "that's correct", 'thats correct', 'go ahead', 'do it', 'please do', 'sounds good',
    'save and continue', 'save & continue',
    'esta bien', 'asi es', 'esta correcto', 'guardar y continuar', 'hacelo', 'de acuerdo',
];
const DENY_WORDS = [
    'no', 'nope', 'nah', 'cancel', 'stop', "don't", 'dont', 'wait',
    'nada', 'cancelar', 'cancela', 'para', 'para', 'espera', 'esperate',
];
const DENY_PHRASES = ['not now', 'not yet', 'go back', 'hold on', 'ahora no', 'todavia no', 'espera un momento'];

function tokens(n) {
    return n.split(/[^a-z]+/).filter(Boolean);
}

export function isNegative(text) {
    const n = normalize(text);
    if (DENY_PHRASES.some((d) => n.includes(d))) return true;
    return tokens(n).some((t) => DENY_WORDS.includes(t));
}

export function isAffirmative(text) {
    const n = normalize(text);
    if (!n) return false;
    if (isNegative(text)) return false;
    if (AFFIRM_PHRASES.some((a) => n.includes(a))) return true;
    return tokens(n).some((t) => AFFIRM_WORDS.includes(t));
}

export function wantsGoBack(text) {
    const n = normalize(text);
    return (
        /\b(go back|back up|previous)\b/.test(n) ||
        /\b(volver|atras|regresa|regresar|un paso atras|paso atras|para atras)\b/.test(n) ||
        n === 'back'
    );
}

export function wantsReadOut(text) {
    const n = normalize(text);
    if (/\bkilo|kg\b/.test(n)) return false;
    return (
        /\b(read (out|me)?|read the|list|what are the|options)\b/.test(n) ||
        /\b(lee|leer|leeme|leelas|opciones|cuales son|que opciones|las opciones|dime las)\b/.test(n)
    );
}

// Match an utterance against a list of { id, label } options.
// Returns { index, option } (0-based) or null.
export function matchOption(text, options) {
    const n = normalize(text);
    if (!n || !Array.isArray(options)) return null;

    // 1. explicit number: "two", "number 2", "option 3", "2", "opcion 3", "el cuatro"
    const num = parseNumber(n);
    if (num != null && Number.isInteger(num) && num >= 1 && num <= options.length) {
        // only treat as an index when the utterance is essentially just the number
        if (/^(number\s+|option\s+|opcion\s+|numero\s+|el\s+|la\s+)?[a-z0-9]+$/.test(n) && n.split(/\s+/).length <= 2) {
            return { index: num - 1, option: options[num - 1] };
        }
    }

    // 1b. an index reference anywhere in a longer phrase:
    // "let's do option 7", "pick number three", "quiero la opcion 7", "dame el dos"
    const words = n.split(/\s+/);
    const TRIGGERS = [
        'option', 'number', 'pick', 'choose', 'select', 'choice', 'take', 'do', 'want',
        'opcion', 'numero', 'elijo', 'elige', 'quiero', 'dame', 'pone', 'poner', 'selecciona', 'la', 'el',
    ];
    for (let i = 0; i < words.length; i += 1) {
        if (!TRIGGERS.includes(words[i])) continue;
        for (let j = i + 1; j < Math.min(i + 4, words.length); j += 1) {
            const k = parseNumber(words[j]);
            if (k != null && Number.isInteger(k) && k >= 1 && k <= options.length) {
                return { index: k - 1, option: options[k - 1] };
            }
        }
    }
    // bare "the 7th one" / "just 3" — a standalone integer token in a short phrase
    if (num != null && Number.isInteger(num) && num >= 1 && num <= options.length && words.length <= 5) {
        const onlyNums = words.filter((x) => parseNumber(x) != null);
        if (onlyNums.length === 1) return { index: num - 1, option: options[num - 1] };
    }

    // 2. name match
    let best = null;
    options.forEach((opt, index) => {
        const label = normalize(opt.label);
        if (!label) return;
        let score = 0;
        if (n === label) score = 100;
        else if (n.length >= 3 && (n.includes(label) || label.includes(n))) score = 60;
        else {
            const labelTokens = label.split(/[^a-z0-9]+/).filter((t) => t.length >= 3);
            const uttTokens = n.split(/[^a-z0-9]+/).filter((t) => t.length >= 3);
            const overlap = labelTokens.filter((t) => uttTokens.includes(t)).length;
            if (overlap > 0) score = 30 + overlap * 5;
        }
        if (score > 0 && (!best || score > best.score)) best = { index, option: opt, score };
    });
    return best ? { index: best.index, option: best.option } : null;
}

// Summary-screen verbs. Returns { action, target? }.
export function parseSummaryCommand(text) {
    const n = normalize(text);

    if (/\b(redo everything|start over|clear everything|reset)\b/.test(n) ||
        /\b(rehacer todo|empezar de nuevo|borrar todo|reiniciar|de cero)\b/.test(n)) {
        return { action: 'redoAll' };
    }
    if (/\b(redo|rehacer)\b/.test(n)) {
        const t = n.replace(/.*\b(item|type|just|elemento|tipo|solo|el|la)\b/, '').trim();
        if (/\b(one item|just one|single item|un elemento|solo uno|un solo)\b/.test(n) || t) {
            return { action: 'redoOne', target: t };
        }
        return { action: 'redoAsk' };
    }
    if (/\b(edit|change|update|fix)\b/.test(n) ||
        /\b(editar|edita|cambiar|cambia|corregir|corrige|modificar|modifica)\b/.test(n)) {
        const target = n
            .replace(/.*\b(for|the weight for|weight for|item|de|el peso de|peso de|elemento)\b/, '')
            .replace(/\b(weight|the|peso|el|la)\b/g, '')
            .trim();
        return { action: 'edit', target };
    }
    if (/\b(delete|remove|drop)\b/.test(n) ||
        /\b(borrar|borra|eliminar|elimina|sacar|saca|quitar|quita)\b/.test(n)) {
        const target = n
            .replace(/.*\b(delete|remove|drop|borrar|borra|eliminar|elimina|sacar|saca|quitar|quita)\b/, '')
            .replace(/\b(the|item|el|la|elemento)\b/g, '')
            .trim();
        return { action: 'delete', target };
    }
    if (/\b(add another|another type|add more|one more)\b/.test(n) ||
        /\b(agregar otro|otro tipo|agrega otro|uno mas|anadir|añadir|agregar mas)\b/.test(n)) {
        return { action: 'addAnother' };
    }
    if (/\b(submit|send it|finish|done)\b/.test(n) ||
        /\b(enviar|envia|mandar|manda|terminar|termina|finalizar|finaliza|listo)\b/.test(n) ||
        /\b(read|lee|leeme).*(collected|everything|todo|recolect)\b/.test(n)) {
        if (/\b(read|lee|leeme)\b/.test(n)) return { action: 'readAll' };
        return { action: 'submit' };
    }
    return { action: 'unknown' };
}

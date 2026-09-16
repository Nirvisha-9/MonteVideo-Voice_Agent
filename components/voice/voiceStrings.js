// All user-facing Voice Agent text, per language. `getStrings(lang)` returns one
// flat object `t`; templated strings are functions. Keep en / es in sync.

const EN = {
    // step pills
    pill: {
        client: 'SELECT CLIENT',
        location: 'SELECT LOCATION',
        addbags: 'STEP 1 OF 5 · ADD BAGS',
        category: 'STEP 2 OF 5 · CATEGORY',
        subcategory: 'STEP 3 OF 5 · SUB-CATEGORY',
        weight: 'STEP 4 OF 5 · WEIGHT',
        summary: 'STEP 5 OF 5 · SUMMARY',
        editweight: 'EDIT ITEM',
    },
    hint: {
        client: 'Try: "one"  ·  the client name',
        location: 'Try: "one"  ·  the location name  ·  "go back"',
        addbags: 'Try: "yes, please add bags"  ·  "go back"',
        category: 'Try: "two"  ·  "plastics"  ·  "read out the options"  ·  "go back"',
        subcategory: 'Try: "three"  ·  "PET Blanco"  ·  "go back"',
        weight: 'Try: "fifteen kilos"  ·  "actually seventeen kilos"  ·  "yes"',
        summary: 'Try: "add another"  ·  "submit"  ·  "edit the weight for Revista"  ·  "delete PET Blanco"  ·  "redo"',
        editweight: 'Try: "nine kilos"',
    },

    // questions
    qClient: 'Which client is this collection for?',
    qLocationAt: (c) => `Which location at ${c}?`,
    qCategory: 'Which category are you sorting?',
    qTypeOf: (w) => `Which type of ${w} is it?`,
    qWeightFor: (x) => `What's the weight for ${x}?`,
    qNewWeightFor: (x) => `What's the new weight for ${x}?`,
    qAddBagsAt: (p) => `Add bags at ${p}?`,
    qSummary: "Here's what you've classified so far",

    // spoken helper lines (added when there's no agentLine)
    sayClient: 'Say the number, or the client name.',
    sayLocation: 'Say the number, or the location name.',
    sayAddBags: 'Say yes to add bags, or say go back.',
    sayCategory: 'Say the number, or the category name. You can also say "read out the options".',
    saySubcategory: 'Say the number or the name.',
    sayWeight: 'Tell me the weight in kilograms.',
    sayEditWeight: 'Tell me the new weight in kilograms.',
    saySummary: 'Say add another, or say submit.',

    // agent lines
    didntCatchTap: `I didn't catch that. Tap the microphone circle and speak, or type below.`,
    whichOne: 'Which one would you like?',
    confirmSel: (x) => `Confirming your selection: ${x}. Shall I proceed?`,
    gotItConfirm: (x) => `Got it — confirming your selection: ${x}. Shall I proceed?`,
    okWhich: (type) => `Okay — which ${type} then?`,
    sayYesToConfirm: (x) => `Say "yes" to confirm ${x}, or name another option.`,
    didntGetSayNumber: `I didn't get that — say the number or the name, or say "read out the options".`,
    openingCategories: 'Opening the waste category screen so you can start adding bags.',
    noProblemSayYes: `No problem — say "yes" whenever you're ready to add bags.`,
    sorrySayYes: `Sorry, I didn't catch that. Say "yes" to add bags, or "go back".`,
    clientSet: (c) => `Client set to ${c}.`,
    locationSet: (l) => `Location set to ${l}.`,
    openingSub: (c) => `Opening the sub-category list for ${c}.`,
    openingWeight: (c) => `Opening the weight entry for ${c}.`,
    confirmWeight: (kg, x) => `Confirming: ${kg} kilograms of ${x}. Save and continue?`,
    okCorrectWeight: `Okay — what's the correct weight?`,
    tellWeightExample: `Tell me the weight in kilograms, for example "fifteen kilos".`,
    tellNewWeightExample: `Tell me the new weight in kilograms, for example "nine kilos".`,
    savedSummary: (list, total) =>
        `Saved. ${list}. Total: ${total} kilograms. ` +
        `Would you like to add another type, edit or delete an item, redo, or submit?`,
    removedTotal: (x, total) =>
        `${x} removed. Total: ${total} kilograms. Add another, edit, delete, redo, or submit?`,
    updatedTotal: (x, kg, total) =>
        `Updated — ${x} is now ${kg} kilograms. Total: ${total} kilograms. ` +
        `Add another, edit, delete, redo, or submit?`,
    notSubmittingYet: 'Okay — not submitting yet. Add another, edit, delete, redo, or submit?',
    submitYesNo: 'Do you want me to submit this collection? Say "yes" or "no".',
    cleared: 'Cleared. Which category are you sorting?',
    keepingEverything: 'Okay — keeping everything. Add another, edit, delete, redo, or submit?',
    clearSure: 'This will clear the whole collection. Are you sure? Say "yes" or "no".',
    clearAllSure: 'This will clear everything you have classified so far for this collection. Are you sure?',
    removingReenter: (x) => `Okay, removing ${x} so you can re-enter it. Which category are you sorting?`,
    redoWhichAsk: 'Do you want to redo everything, or just one item? Name the item if it is just one.',
    atSummarySay: 'You are at the summary. Say "add another", "submit", "edit", "delete", or "redo".',
    backToCategory: 'Sure — back to Category. Which category are you sorting?',
    submitThis: 'Do you want me to submit this?',
    readAll: (place, list, total) =>
        `Today at ${place}, you've collected ${list}. Total: ${total} kilograms.`,
    redoEverythingOrOne: 'Do you want to redo everything, or just one item?',
    whichRedo: 'Which item would you like to redo?',
    whichEdit: 'Which item would you like to edit? For example "edit the weight for Revista".',
    whichDelete: 'Which item would you like to delete?',
    summaryVerbs: 'Say "add another", "submit", "edit the weight for …", "delete …", or "redo".',
    backToSummaryVerbs: 'Back to the summary. Add another, edit, delete, redo, or submit?',
    goingBackAddBags: 'Going back to Add Bags.',
    goingBackCategory: 'Going back to Category.',
    goingBackSubList: 'Going back to the sub-category list.',
    goingBackSummary: 'Back to the summary.',
    goingBackClientList: 'Going back to the client list.',
    goingBackLocationList: 'Going back to the location list.',
    imListening: 'Getting the client list…',
    loadingClients: 'Loading clients…',

    // done
    submittedTitle: 'Submitted successfully.',
    submittedSpoken: `Submitted successfully. Say "menu" to go back, or "again" to start another.`,
    recordedFor: (n, plural, total, place) =>
        `${n} type${plural} · ${total} kilograms\nrecorded for ${place}.`,
    backToMenu: 'Back to menu',
    startAnother: 'Start another voice collection',

    // status
    stNotInBuild: '⚠️  Voice module not in this build — type your answers',
    stError: (e) => `⚠️  ${e || 'voice error'} — tap to retry`,
    stLoading: (s) => `⏳  Preparing offline voice — first launch only (${s}s)…`,
    stThinking: '🤔  Working out what you meant…',
    stReading: '📖  Reading the list — say your pick to stop here',
    stVoiceOff: '🔇  Voice off — tap here to turn it on',
    stSpeaking: (name) => `🔊  ${name} is speaking…`,
    stListening: '🎤  Listening — speak your answer now',
    stTapToTalk: '👉  Tap here (or the circle) to talk',
    transcriptSpeaking: (name) => `${name} is speaking…`,
    transcriptListening: 'Listening…',
    transcriptIdle: 'Speak your answer, or type it below',
    inputPlaceholder: 'Type what you would say…',

    // chips
    chipYes: 'Yes — open categories',
    chipNot: 'Not now',
    chipAdd: 'Add another type',
    chipSubmit: 'Submit',
    saveContinue: 'Save & continue?',
    weightLabel: 'WEIGHT',
    classifiedTotal: 'Classified',
    exit: '‹ Exit',
    back: 'Back',

    // read-out item, e.g. "1. Plastics."
    readItem: (n, label) => `${n}. ${label}.`,
};

const ES = {
    pill: {
        client: 'ELEGIR CLIENTE',
        location: 'ELEGIR UBICACIÓN',
        addbags: 'PASO 1 DE 5 · AGREGAR BOLSAS',
        category: 'PASO 2 DE 5 · CATEGORÍA',
        subcategory: 'PASO 3 DE 5 · SUBCATEGORÍA',
        weight: 'PASO 4 DE 5 · PESO',
        summary: 'PASO 5 DE 5 · RESUMEN',
        editweight: 'EDITAR ELEMENTO',
    },
    hint: {
        client: 'Probá: "uno"  ·  el nombre del cliente',
        location: 'Probá: "uno"  ·  el nombre de la ubicación  ·  "volver"',
        addbags: 'Probá: "sí, agregar bolsas"  ·  "volver"',
        category: 'Probá: "dos"  ·  "plásticos"  ·  "lee las opciones"  ·  "volver"',
        subcategory: 'Probá: "tres"  ·  "PET Blanco"  ·  "volver"',
        weight: 'Probá: "quince kilos"  ·  "en realidad diecisiete kilos"  ·  "sí"',
        summary: 'Probá: "agregar otro"  ·  "enviar"  ·  "editar el peso de Revista"  ·  "borrar PET Blanco"  ·  "rehacer"',
        editweight: 'Probá: "nueve kilos"',
    },

    qClient: '¿Para qué cliente es esta recolección?',
    qLocationAt: (c) => `¿Qué ubicación en ${c}?`,
    qCategory: '¿Qué categoría estás clasificando?',
    qTypeOf: (w) => `¿Qué tipo de ${w} es?`,
    qWeightFor: (x) => `¿Cuál es el peso de ${x}?`,
    qNewWeightFor: (x) => `¿Cuál es el nuevo peso de ${x}?`,
    qAddBagsAt: (p) => `¿Agregar bolsas en ${p}?`,
    qSummary: 'Esto es lo que clasificaste hasta ahora',

    sayClient: 'Decí el número o el nombre del cliente.',
    sayLocation: 'Decí el número o el nombre de la ubicación.',
    sayAddBags: 'Decí sí para agregar bolsas, o decí volver.',
    sayCategory: 'Decí el número o el nombre de la categoría. También podés decir "lee las opciones".',
    saySubcategory: 'Decí el número o el nombre.',
    sayWeight: 'Decime el peso en kilogramos.',
    sayEditWeight: 'Decime el nuevo peso en kilogramos.',
    saySummary: 'Decí agregar otro, o decí enviar.',

    didntCatchTap: 'No te entendí. Tocá el círculo del micrófono y hablá, o escribí abajo.',
    whichOne: '¿Cuál querés?',
    confirmSel: (x) => `Confirmando tu selección: ${x}. ¿Continúo?`,
    gotItConfirm: (x) => `Listo — confirmando tu selección: ${x}. ¿Continúo?`,
    okWhich: (type) => `Bien — ¿qué ${type} entonces?`,
    sayYesToConfirm: (x) => `Decí "sí" para confirmar ${x}, o nombrá otra opción.`,
    didntGetSayNumber: 'No entendí — decí el número o el nombre, o decí "lee las opciones".',
    openingCategories: 'Abriendo la pantalla de categorías para que empieces a agregar bolsas.',
    noProblemSayYes: 'No hay problema — decí "sí" cuando estés listo para agregar bolsas.',
    sorrySayYes: 'Perdón, no te entendí. Decí "sí" para agregar bolsas, o "volver".',
    clientSet: (c) => `Cliente: ${c}.`,
    locationSet: (l) => `Ubicación: ${l}.`,
    openingSub: (c) => `Abriendo la lista de subcategorías de ${c}.`,
    openingWeight: (c) => `Abriendo el ingreso de peso para ${c}.`,
    confirmWeight: (kg, x) => `Confirmando: ${kg} kilogramos de ${x}. ¿Guardar y continuar?`,
    okCorrectWeight: 'Bien — ¿cuál es el peso correcto?',
    tellWeightExample: 'Decime el peso en kilogramos, por ejemplo "quince kilos".',
    tellNewWeightExample: 'Decime el nuevo peso en kilogramos, por ejemplo "nueve kilos".',
    savedSummary: (list, total) =>
        `Guardado. ${list}. Total: ${total} kilogramos. ` +
        `¿Querés agregar otro tipo, editar o borrar un elemento, rehacer, o enviar?`,
    removedTotal: (x, total) =>
        `${x} eliminado. Total: ${total} kilogramos. ¿Agregar otro, editar, borrar, rehacer, o enviar?`,
    updatedTotal: (x, kg, total) =>
        `Actualizado — ${x} ahora es ${kg} kilogramos. Total: ${total} kilogramos. ` +
        `¿Agregar otro, editar, borrar, rehacer, o enviar?`,
    notSubmittingYet: 'Bien — no envío todavía. ¿Agregar otro, editar, borrar, rehacer, o enviar?',
    submitYesNo: '¿Querés que envíe esta recolección? Decí "sí" o "no".',
    cleared: 'Listo, borrado. ¿Qué categoría estás clasificando?',
    keepingEverything: 'Bien — mantengo todo. ¿Agregar otro, editar, borrar, rehacer, o enviar?',
    clearSure: 'Esto va a borrar toda la recolección. ¿Estás seguro? Decí "sí" o "no".',
    clearAllSure: 'Esto va a borrar todo lo que clasificaste en esta recolección. ¿Estás seguro?',
    removingReenter: (x) => `Bien, quito ${x} para que lo ingreses de nuevo. ¿Qué categoría estás clasificando?`,
    redoWhichAsk: '¿Querés rehacer todo, o solo un elemento? Nombrá el elemento si es solo uno.',
    atSummarySay: 'Estás en el resumen. Decí "agregar otro", "enviar", "editar", "borrar", o "rehacer".',
    backToCategory: 'Bien — volvemos a Categoría. ¿Qué categoría estás clasificando?',
    submitThis: '¿Querés que envíe esto?',
    readAll: (place, list, total) =>
        `Hoy en ${place}, recolectaste ${list}. Total: ${total} kilogramos.`,
    redoEverythingOrOne: '¿Querés rehacer todo, o solo un elemento?',
    whichRedo: '¿Qué elemento querés rehacer?',
    whichEdit: '¿Qué elemento querés editar? Por ejemplo "editar el peso de Revista".',
    whichDelete: '¿Qué elemento querés borrar?',
    summaryVerbs: 'Decí "agregar otro", "enviar", "editar el peso de …", "borrar …", o "rehacer".',
    backToSummaryVerbs: 'De vuelta al resumen. ¿Agregar otro, editar, borrar, rehacer, o enviar?',
    goingBackAddBags: 'Volviendo a Agregar Bolsas.',
    goingBackCategory: 'Volviendo a Categoría.',
    goingBackSubList: 'Volviendo a la lista de subcategorías.',
    goingBackSummary: 'De vuelta al resumen.',
    goingBackClientList: 'Volviendo a la lista de clientes.',
    goingBackLocationList: 'Volviendo a la lista de ubicaciones.',
    imListening: 'Obteniendo la lista de clientes…',
    loadingClients: 'Cargando clientes…',

    submittedTitle: 'Enviado correctamente.',
    submittedSpoken: 'Enviado correctamente. Decí "menú" para volver, o "otra vez" para empezar otra.',
    recordedFor: (n, plural, total, place) =>
        `${n} tipo${plural} · ${total} kilogramos\nregistrados para ${place}.`,
    backToMenu: 'Volver al menú',
    startAnother: 'Empezar otra recolección por voz',

    stNotInBuild: '⚠️  El módulo de voz no está en esta compilación — escribí tus respuestas',
    stError: (e) => `⚠️  ${e || 'error de voz'} — tocá para reintentar`,
    stLoading: (s) => `⏳  Preparando la voz sin conexión — solo la primera vez (${s}s)…`,
    stThinking: '🤔  Interpretando lo que dijiste…',
    stReading: '📖  Leyendo la lista — decí tu opción para parar acá',
    stVoiceOff: '🔇  Voz apagada — tocá acá para encenderla',
    stSpeaking: (name) => `🔊  ${name} está hablando…`,
    stListening: '🎤  Escuchando — decí tu respuesta',
    stTapToTalk: '👉  Tocá acá (o el círculo) para hablar',
    transcriptSpeaking: (name) => `${name} está hablando…`,
    transcriptListening: 'Escuchando…',
    transcriptIdle: 'Decí tu respuesta, o escribila abajo',
    inputPlaceholder: 'Escribí lo que dirías…',

    chipYes: 'Sí — abrir categorías',
    chipNot: 'Ahora no',
    chipAdd: 'Agregar otro tipo',
    chipSubmit: 'Enviar',
    saveContinue: '¿Guardar y continuar?',
    weightLabel: 'PESO',
    classifiedTotal: 'Peso Clasificado',
    exit: '‹ Salir',
    back: 'Volver',

    readItem: (n, label) => `${n}. ${label}.`,
};

// merge so any key missing from ES falls back to EN
const withFallback = (obj) => ({
    ...EN,
    ...obj,
    pill: { ...EN.pill, ...(obj.pill || {}) },
    hint: { ...EN.hint, ...(obj.hint || {}) },
});

const TABLE = { en: EN, es: withFallback(ES) };

export function getStrings(lang) {
    return TABLE[lang] || TABLE.en;
}

export default getStrings;

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    SafeAreaView,
} from 'react-native';
import styles, { VC } from './voiceStyles';
import Listening from './Listening';
import useSpeech from './useSpeech';
import VoiceTest from './VoiceTest';
import buildGrammar from './voiceGrammar';
import { interpretWithLLM, transcribeWithCloud } from './llmInterpreter';
import { getStrings } from './voiceStrings';
import {
    getCategories,
    VOICE_SUBCATEGORIES,
    VOICE_CONTEXT,
    AGENT_NAME,
} from './voiceCatalog';
import {
    normalize,
    parseNumber,
    isAffirmative,
    isNegative,
    wantsGoBack,
    wantsReadOut,
    matchOption,
    parseSummaryCommand,
} from './voiceParser';

// Accepted mis-hearings of the wake word.
const WAKE_VARIANTS = ['monte', 'monty', 'montey', 'montie', 'monta', 'mounte', 'monde', 'mount'];

const MODEL_FOR = { en: 'model-en-en', es: 'model-es-es' };

/* ------------------------------------------------------------------ helpers */

const fmt = (n) => {
    const v = Number(n) || 0;
    if (Number.isInteger(v)) return String(v);
    return v.toFixed(2).replace(/0+$/, '').replace(/\.$/, ''); // 15.50 -> 15.5
};

const listOptions = (opts, lang) => {
    const labels = opts.map((o) => o.label);
    if (labels.length <= 1) return labels.join('');
    const conj = lang === 'es' ? ' o ' : ' or ';
    return `${labels.slice(0, -1).join(', ')},${conj}${labels[labels.length - 1]}`;
};

const itemsSentence = (items, lang) => {
    const unit = lang === 'es' ? 'kilogramos' : 'kilograms';
    return items.map((i) => `${i.label}, ${fmt(i.weight)} ${unit}`).join('; ');
};

const totalKg = (items) => items.reduce((s, i) => s + (Number(i.weight) || 0), 0);

/* ------------------------------------------------------------------ screen  */

export default function VoiceAgentFlow({ navigation, screenNames, onExit, lang = 'en' }) {
    const VOICE_LANG = lang === 'es' ? 'es' : 'en';
    const VOICE_MODEL = MODEL_FOR[VOICE_LANG];
    const t = useMemo(() => getStrings(VOICE_LANG), [VOICE_LANG]);
    const STEP_PILL = t.pill;
    const HINTS = t.hint;

    const [clients, setClients] = useState([]);
    const [selectedClient, setSelectedClient] = useState(null);
    const [selectedLocation, setSelectedLocation] = useState(null);

    const placeLabel =
        selectedClient && selectedLocation
            ? `${selectedClient.client_name}, ${selectedLocation.name}`
            : `${VOICE_CONTEXT.client}, ${VOICE_CONTEXT.location}`;

    const [phase, setPhase] = useState('loadingctx');
    const [question, setQuestion] = useState('');
    const [agentLine, setAgentLine] = useState('');
    const [heard, setHeard] = useState('');
    const [micText, setMicText] = useState('');

    const [items, setItems] = useState([]);
    const [pending, setPending] = useState(null); // { catId, catLabel, typeWord, hasSub, subId, subLabel, label, weight }
    const [selection, setSelection] = useState(null); // { index, option }
    const [confirming, setConfirming] = useState(false);

    // summary sub-states
    const [submitAsking, setSubmitAsking] = useState(false);
    const [redoAsking, setRedoAsking] = useState(false);
    const [redoAllConfirm, setRedoAllConfirm] = useState(false);
    const [editTargetId, setEditTargetId] = useState(null);

    const scrollRef = useRef(null);

    const [voiceOn, setVoiceOn] = useState(true);
    const [showTest, setShowTest] = useState(false);
    const [interpreting, setInterpreting] = useState(false);
    const [readOut, setReadOut] = useState(null); // { opts, typeLabel, i } while reading the list aloud
    const readOutRef = useRef(null);
    readOutRef.current = readOut;

    const CATS = useMemo(() => getCategories(VOICE_LANG), [VOICE_LANG]);
    const categoryOptions = useMemo(
        () => CATS.map((c) => ({ id: c.id, label: c.label })),
        [CATS]
    );
    const subOptions = useMemo(
        () => (pending?.catId ? VOICE_SUBCATEGORIES[pending.catId] || [] : []),
        [pending?.catId]
    );

    const clientOptions = useMemo(
        () => clients.map((c) => ({ id: c.id, label: c.client_name, raw: c })),
        [clients]
    );
    const locationOptions = useMemo(
        () =>
            Array.isArray(selectedClient?.locations)
                ? selectedClient.locations.map((l) => ({ id: l.id, label: l.name, raw: l }))
                : [],
        [selectedClient]
    );

    // Recognition grammar for the current screen — a tight word list keeps Vosk
    // accurate on low-end phones.
    const grammarOptionCount = useMemo(() => {
        if (phase === 'category') return categoryOptions.length;
        if (phase === 'subcategory') return subOptions.length;
        return 9;
    }, [phase, categoryOptions.length, subOptions.length]);

    const currentGrammar = useMemo(
        () => buildGrammar(VOICE_LANG, phase, grammarOptionCount),
        [phase, grammarOptionCount]
    );
    const grammarRef = useRef(currentGrammar);
    grammarRef.current = currentGrammar;

    // handleUtterance closes over state and is re-created each render; keep a ref
    // so the speech callback always calls the latest version.
    const handleUtteranceRef = useRef(() => {});
    const noResultRef = useRef(0);
    const wantListenRef = useRef(false); // true while a step is waiting for an answer

    const speakReadOutItemRef = useRef(() => {});

    const handleNoResult = (code) => {
        // during a list read-out, silence just means "move to the next item"
        if (readOutRef.current) {
            speakReadOutItemRef.current(readOutRef.current.i + 1);
            return;
        }
        if (!wantListenRef.current) return;
        noResultRef.current += 1;
        if (noResultRef.current <= 4) {
            setTimeout(() => {
                if (wantListenRef.current && !readOutRef.current) {
                    voiceRef.current?.listen(grammarRef.current);
                }
            }, 400);
        } else {
            setAgentLine(t.didntCatchTap);
        }
    };

    const voice = useSpeech({
        lang: VOICE_LANG,
        model: VOICE_MODEL,
        onTranscript: (text, audio) => {
            noResultRef.current = 0;
            handleUtteranceRef.current(text, audio);
        },
        onNoResult: handleNoResult,
    });
    const voiceRef = useRef(voice);
    voiceRef.current = voice;
    const { speak, listen } = voice;

    // What Monte should say on the current screen.
    const spokenLine = useMemo(() => {
        if (phase === 'loadingctx') return '';
        if (phase === 'done') return t.submittedSpoken;
        const parts = [question];
        if (agentLine) parts.push(agentLine);
        else if (phase === 'client') parts.push(t.sayClient);
        else if (phase === 'location') parts.push(t.sayLocation);
        else if (phase === 'addbags') parts.push(t.sayAddBags);
        else if (phase === 'category') parts.push(t.sayCategory);
        else if (phase === 'subcategory') parts.push(t.saySubcategory);
        else if (phase === 'weight') parts.push(t.sayWeight);
        else if (phase === 'editweight') parts.push(t.sayEditWeight);
        else if (phase === 'summary') parts.push(t.saySummary);
        return parts.filter(Boolean).join(' ');
    }, [phase, question, agentLine, t]);

    const spokenRef = useRef('');

    // A conversational turn: speak the prompt, then open the mic for the answer.
    const runTurn = () => {
        if (!spokenLine) return; // e.g. still loading the client list
        spokenRef.current = spokenLine;
        noResultRef.current = 0;
        wantListenRef.current = phase !== 'done';
        speak(spokenLine, {
            bargeIn: wantListenRef.current && voiceOn, // worker can talk over Monte
            grammar: grammarRef.current, // …and is understood like a normal answer
            onDone: () => {
                if (wantListenRef.current && voiceOn) listen(grammarRef.current);
            },
        });
    };

    // Load the client list, then start at "select client" (or skip to Add Bags
    // if it can't be loaded — offline / no clients).
    useEffect(() => {
        let alive = true;
        (async () => {
            let list = [];
            try {
                // lazy require: keeps firebase/firestore out of the module graph
                // for environments that can't resolve it (unit tests)
                // eslint-disable-next-line global-require
                const { getClients } = require('../../services/clientService');
                list = (await getClients()) || [];
            } catch (e) {
                list = [];
            }
            if (!alive) return;
            setClients(list);
            if (list.length) {
                setPhase('client');
                setQuestion(t.qClient);
            } else {
                setPhase('addbags');
                setQuestion(t.qAddBagsAt(placeLabel));
            }
        })();
        return () => {
            alive = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Populate diagnostics as soon as the screen opens.
    useEffect(() => {
        voice.refreshDiag?.();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Run the opening turn once the model has finished loading.
    useEffect(() => {
        if (voiceOn && voice.modelReady && spokenRef.current === '') {
            runTurn();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [voiceOn, voice.modelReady]);

    // Every time the prompt changes, run the next turn (unless a list read-out
    // is in progress — that drives its own speak / listen cycle).
    useEffect(() => {
        if (readOut) return;
        if (!voiceOn || !voice.modelReady) return;
        if (!spokenLine || spokenLine === spokenRef.current) return;
        runTurn();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [spokenLine, voiceOn, voice.modelReady, readOut]);

    // Read the option list aloud from item `i`, so the worker can name/number
    // their pick the moment they hear it and Monte stops right there.
    //
    // Where Monte can be interrupted by voice, the rest of the list is one
    // continuous line (no pause between items) and the item being read is
    // highlighted as Monte reaches it. Otherwise each item is followed by a
    // short listen gap for the answer.
    const READ_OUT_MAX = 8;
    const speakReadOutItem = (i) => {
        const ro = readOutRef.current;
        if (!ro) return;
        const end = Math.min(ro.opts.length, READ_OUT_MAX);
        if (i >= end) {
            readOutRef.current = null;
            setReadOut(null);
            setAgentLine(t.whichOne);
            spokenRef.current = ''; // let the prompt-changed effect speak + listen
            return;
        }
        const next = { ...ro, i };
        readOutRef.current = next;
        setReadOut(next);
        noResultRef.current = 0;
        wantListenRef.current = true;

        if (voiceOn && voice.canBargeIn) {
            let text = '';
            const starts = []; // where each item begins in `text`
            for (let k = i; k < end; k += 1) {
                starts.push(text.length);
                text += `${t.readItem(k + 1, ro.opts[k].label)} `;
            }
            speak(text.trim(), {
                bargeIn: true,
                onProgress: (at) => {
                    const cur = readOutRef.current;
                    if (!cur) return;
                    let k = 0;
                    while (k + 1 < starts.length && starts[k + 1] <= at) k += 1;
                    if (cur.i !== i + k) {
                        readOutRef.current = { ...cur, i: i + k };
                        setReadOut(readOutRef.current);
                    }
                },
                onDone: () => {
                    if (readOutRef.current) speakReadOutItemRef.current(end); // whole list read
                },
            });
            return;
        }

        speak(t.readItem(i + 1, ro.opts[i].label), {
            bargeIn: voiceOn,
            onDone: () => {
                if (readOutRef.current && voiceOn) listen(null, { timeout: 2000 });
            },
        });
    };

    const startReadOut = (opts, typeLabel) => {
        setSelection(null);
        setConfirming(false);
        setAgentLine('');
        const ro = { opts, typeLabel, i: 0 };
        readOutRef.current = ro;
        setReadOut(ro);
        speakReadOutItem(0);
    };

    const cancelReadOut = () => {
        if (!readOutRef.current) return;
        readOutRef.current = null;
        setReadOut(null);
        voice.stopSpeaking();
    };
    speakReadOutItemRef.current = speakReadOutItem;

    // Response received while Monte is reading the list aloud.
    const handleReadOutResponse = (text) => {
        const ro = readOutRef.current;
        if (!ro) return;
        setHeard(text);
        if (isBareWake(text)) {
            speakReadOutItem(0); // restart the read-out
            return;
        }
        const m = matchOption(text, ro.opts);
        if (m) {
            readOutRef.current = null;
            setReadOut(null);
            voice.stopSpeaking();
            setSelection(m);
            setConfirming(true);
            setAgentLine(t.confirmSel(m.option.label));
            spokenRef.current = ''; // let the effect speak the confirmation + listen
            return;
        }
        // not one of the options — keep reading from where we were
        speakReadOutItem(ro.i + 1);
    };

    const resetSelection = () => {
        setSelection(null);
        setConfirming(false);
    };

    const bumpScroll = () =>
        requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: 0, animated: true }));

    /* --------------------------------------------------- phase transitions   */

    const goToClient = (line) => {
        setPhase('client');
        setQuestion(t.qClient);
        setAgentLine(line || '');
        resetSelection();
        bumpScroll();
    };

    const goToLocation = (line) => {
        setPhase('location');
        setQuestion(t.qLocationAt(selectedClient?.client_name ?? (VOICE_LANG === 'es' ? 'este cliente' : 'this client')));
        setAgentLine(line || '');
        resetSelection();
        bumpScroll();
    };

    const goToCategory = (line) => {
        setPhase('category');
        setQuestion(t.qCategory);
        setAgentLine(line || '');
        resetSelection();
        bumpScroll();
    };

    const goToAddBags = (line) => {
        setPhase('addbags');
        setQuestion(t.qAddBagsAt(placeLabel));
        setAgentLine(line || '');
        resetSelection();
        setPending(null);
        bumpScroll();
    };

    const goToSummary = (line) => {
        setPhase('summary');
        setQuestion(t.qSummary);
        setAgentLine(line || '');
        resetSelection();
        setSubmitAsking(false);
        setRedoAsking(false);
        setRedoAllConfirm(false);
        setEditTargetId(null);
        bumpScroll();
    };

    const startFlow = () => {
        setItems([]);
        setPending(null);
        goToAddBags('');
    };

    /* --------------------------------------------------- utterance handling  */

    const routeToPhase = (text) => {
        switch (phase) {
            case 'client':
                return handleSelection(text, clientOptions, 'client');
            case 'location':
                return handleSelection(text, locationOptions, 'location');
            case 'addbags':
                return handleAddBags(text);
            case 'category':
                return handleSelection(text, categoryOptions, 'category');
            case 'subcategory':
                return handleSelection(text, subOptions, 'sub-category');
            case 'weight':
                return handleWeight(text);
            case 'summary':
                return handleSummary(text);
            case 'editweight':
                return handleEditWeight(text);
            case 'done':
                return handleDone(text);
            default:
                return undefined;
        }
    };

    // "monte" (alone, or "hey monte", "monte are you there") on ANY screen just
    // re-prompts the current step and re-opens the mic — a global attention word.
    const isBareWake = (text) => {
        const n = normalize(text).replace(/^(hey|ok|okay|hi|hello)\s+/, '');
        const w = WAKE_VARIANTS.find((v) => n === v || n.startsWith(v + ' '));
        if (!w) return false;
        const rest = n.slice(w.length).trim();
        return rest === '' || /^(are you there|you there|listen|hello|hey|help|wake up|start)$/.test(rest);
    };

    // Would the on-device parser confidently handle this on the current screen?
    const localCanHandle = (text) => {
        const n = normalize(text);
        switch (phase) {
            case 'client':
                return !!matchOption(text, clientOptions) || wantsReadOut(text) ||
                    (confirming && (isAffirmative(text) || isNegative(text)));
            case 'location':
                return !!matchOption(text, locationOptions) || wantsGoBack(text) || wantsReadOut(text) ||
                    (confirming && (isAffirmative(text) || isNegative(text)));
            case 'addbags':
                return isAffirmative(text) || isNegative(text) || wantsGoBack(text) || /\badd bags\b/.test(n);
            case 'category':
                return !!matchOption(text, categoryOptions) || wantsGoBack(text) || wantsReadOut(text) ||
                    (confirming && (isAffirmative(text) || isNegative(text)));
            case 'subcategory':
                return !!matchOption(text, subOptions) || wantsGoBack(text) || wantsReadOut(text) ||
                    (confirming && (isAffirmative(text) || isNegative(text)));
            case 'weight':
            case 'editweight':
                return parseNumber(text) != null || isAffirmative(text) || isNegative(text) || wantsGoBack(text);
            case 'summary':
                return parseSummaryCommand(text).action !== 'unknown' || isAffirmative(text) ||
                    isNegative(text) || wantsGoBack(text);
            case 'done':
                return /\b(menu|home|back|exit|again|another|restart)\b/.test(n);
            default:
                return true;
        }
    };

    // What the cloud needs to know about this screen (options, context).
    const screenContext = () => {
        const ro = readOutRef.current;
        const opts = ro ? ro.opts
            : phase === 'client' ? clientOptions
                : phase === 'location' ? locationOptions
                    : phase === 'category' ? categoryOptions
                        : phase === 'subcategory' ? subOptions
                            : [];
        return {
            phase,
            language: VOICE_LANG,
            options: opts.map((o, i) => ({ n: i + 1, id: o.id, label: o.label })),
            context: {
                place: placeLabel,
                pendingLabel: pending?.label || pending?.catLabel || null,
                items: items.map((it) => ({ label: it.label, kg: it.weight })),
            },
        };
    };

    // `raw` is the phone's own (offline) transcript; `audio` the recorded
    // answer. Online, the audio is transcribed in the cloud knowing what this
    // screen asks — far fewer misheard words — and the phone's transcript is
    // the fallback.
    const handleUtterance = async (raw, audio = null) => {
        let text = String(raw || '').trim();
        let cloudCmd = '';
        setMicText('');
        if (audio) {
            setInterpreting(true);
            const r = await transcribeWithCloud({ audio, ...screenContext() });
            setInterpreting(false);
            if (r?.error) {
                voice.logEvent?.(`cloud STT failed, using phone: ${r.error}`);
            } else if (r) {
                voice.logEvent?.(`cloud heard "${r.transcript}" → "${r.command}" (${r.confidence.toFixed(2)}) · phone heard "${text}"`);
                if (r.transcript) text = r.transcript.trim();
                if (r.command && r.confidence >= 0.3) cloudCmd = r.command;
            }
        }
        if (!text && !cloudCmd) {
            handleNoResult('empty');
            return;
        }
        setHeard(text || cloudCmd);

        if (readOutRef.current) {
            handleReadOutResponse(cloudCmd || text);
            return;
        }

        if (isBareWake(text)) {
            setAgentLine('');
            noResultRef.current = 0;
            wantListenRef.current = phase !== 'done';
            spokenRef.current = '';
            runTurn();
            return;
        }

        if (localCanHandle(text)) {
            routeToPhase(text);
            return;
        }

        // The cloud already worked out what they meant.
        if (cloudCmd) {
            setHeard(`“${text}”  →  ${cloudCmd}`);
            routeToPhase(cloudCmd);
            return;
        }

        // Ambiguous for the local parser — ask the LLM (needs connectivity;
        // falls back to the phase handler's "say the number" prompt otherwise).
        setInterpreting(true);
        voice.logEvent?.(`LLM ? "${text}"`);
        let handled = false;
        try {
            const r = await interpretWithLLM({ transcript: text, ...screenContext() });
            if (!r) {
                voice.logEvent?.('LLM: no reply (offline / not deployed / timeout)');
            } else if (!r.command) {
                voice.logEvent?.(`LLM: unclear — ${r.note || 'no command'}`);
            } else {
                voice.logEvent?.(`LLM → "${r.command}" (${r.confidence.toFixed(2)})`);
                if (r.confidence >= 0.3) {
                    setHeard(`“${text}”  →  ${r.command}`);
                    routeToPhase(r.command);
                    handled = true;
                }
            }
        } catch (e) {
            voice.logEvent?.(`LLM error: ${String(e?.message || e)}`);
        }
        setInterpreting(false);
        if (!handled) routeToPhase(text);
    };
    handleUtteranceRef.current = handleUtterance;

    const toggleVoice = () => {
        cancelReadOut();
        setVoiceOn((on) => {
            if (on) {
                wantListenRef.current = false;
                voice.stopSpeaking();
                voice.stopListening();
            } else {
                spokenRef.current = ''; // force a re-greet + re-listen
            }
            return !on;
        });
    };

    // Manual "talk to me now" — the reliable fallback if auto-listen misses.
    const talkNow = () => {
        cancelReadOut();
        // the worker is answering now — don't let the prompt effect re-speak it
        spokenRef.current = spokenLine;
        noResultRef.current = 0;
        wantListenRef.current = phase !== 'done';
        voice.stopSpeaking();
        listen(grammarRef.current);
    };

    const handleDone = (text) => {
        const n = normalize(text);
        if (/\b(menu|home|back|exit|done|menu|inicio|salir)\b/.test(n)) {
            navigation?.navigate?.(screenNames?.HOME ?? 'home');
        } else if (/\b(again|another|restart|new|more|otra|otro|nuevo|reiniciar|de nuevo)\b/.test(n)) {
            setHeard('');
            spokenRef.current = '';
            startFlow();
        }
    };

    const handleAddBags = (text) => {
        if (wantsGoBack(text)) return goBack();
        const n = normalize(text);
        const yes =
            isAffirmative(text) ||
            /\badd bags\b|\bagregar bolsas\b/.test(n) ||
            matchOption(text, [{ id: 'y', label: 'Yes' }, { id: 'n', label: 'Not now' }])?.option?.id === 'y';
        if (yes && !isNegative(text)) {
            goToCategory(t.openingCategories);
            return;
        }
        if (isNegative(text) || /\bnot now\b|\bahora no\b/.test(n)) {
            setAgentLine(t.noProblemSayYes);
            return;
        }
        setAgentLine(t.sorrySayYes);
    };

    const typeLabelWord = (typeLabel) => {
        if (VOICE_LANG !== 'es') return typeLabel;
        return { client: 'cliente', location: 'ubicación', category: 'categoría', 'sub-category': 'subcategoría' }[typeLabel] || typeLabel;
    };

    const handleSelection = (text, opts, typeLabel) => {
        if (wantsGoBack(text)) return goBack();

        if (confirming && selection) {
            if (parseNumberSelectionRetry(text, opts)) return;
            if (isAffirmative(text)) return confirmSelection(opts, typeLabel);
            if (isNegative(text)) {
                resetSelection();
                setAgentLine(t.okWhich(typeLabelWord(typeLabel)));
                return;
            }
            setAgentLine(t.sayYesToConfirm(selection.option.label));
            return;
        }

        if (wantsReadOut(text)) {
            startReadOut(opts, typeLabel);
            return;
        }

        const match = matchOption(text, opts);
        if (match) {
            setSelection(match);
            setConfirming(true);
            setAgentLine(t.confirmSel(match.option.label));
            return;
        }
        setAgentLine(t.didntGetSayNumber);
    };

    // While confirming, a fresh name/number should re-select (doc: mid-read-out answer / correction).
    const parseNumberSelectionRetry = (text, opts) => {
        if (isAffirmative(text) || isNegative(text)) return false;
        const match = matchOption(text, opts);
        if (match && match.option.id !== selection?.option?.id) {
            setSelection(match);
            setAgentLine(t.gotItConfirm(match.option.label));
            return true;
        }
        return false;
    };

    const confirmSelection = (opts, typeLabel) => {
        const chosen = selection.option;
        if (typeLabel === 'client') {
            const c = chosen.raw;
            setSelectedClient(c);
            setSelectedLocation(null);
            resetSelection();
            if (Array.isArray(c?.locations) && c.locations.length) {
                setPhase('location');
                setQuestion(t.qLocationAt(c.client_name));
                setAgentLine(t.clientSet(c.client_name));
            } else {
                setPhase('addbags');
                setQuestion(t.qAddBagsAt(c.client_name));
                setAgentLine(t.clientSet(c.client_name));
            }
            bumpScroll();
            return;
        }
        if (typeLabel === 'location') {
            const l = chosen.raw;
            setSelectedLocation(l);
            setItems([]);
            setPending(null);
            resetSelection();
            setPhase('addbags');
            setQuestion(t.qAddBagsAt(`${selectedClient?.client_name ?? ''}, ${l.name}`));
            setAgentLine(t.locationSet(l.name));
            bumpScroll();
            return;
        }
        if (typeLabel === 'category') {
            const cat = CATS.find((c) => c.id === chosen.id);
            if (cat.hasSub) {
                setPending({
                    catId: cat.id,
                    catLabel: cat.label,
                    typeWord: cat.typeWord,
                    hasSub: true,
                });
                setPhase('subcategory');
                setQuestion(t.qTypeOf(cat.typeWord));
                setAgentLine(t.openingSub(cat.label));
                resetSelection();
                bumpScroll();
            } else {
                setPending({
                    catId: cat.id,
                    catLabel: cat.label,
                    hasSub: false,
                    subId: cat.id,
                    subLabel: cat.label,
                    label: cat.label,
                });
                setPhase('weight');
                setQuestion(t.qWeightFor(cat.label));
                setAgentLine(t.openingWeight(cat.label));
                resetSelection();
                bumpScroll();
            }
        } else {
            setPending((p) => ({
                ...p,
                subId: chosen.id,
                subLabel: chosen.label,
                label: chosen.label,
            }));
            setPhase('weight');
            setQuestion(t.qWeightFor(chosen.label));
            setAgentLine(t.openingWeight(chosen.label));
            resetSelection();
            bumpScroll();
        }
    };

    const handleWeight = (text) => {
        if (wantsGoBack(text)) return goBack();

        const num = parseNumber(text);
        if (num != null && num > 0) {
            setPending((p) => ({ ...p, weight: num }));
            setConfirming(true);
            setAgentLine(t.confirmWeight(fmt(num), pending?.label));
            return;
        }
        if (confirming && isAffirmative(text)) return saveItem();
        if (confirming && isNegative(text)) {
            setPending((p) => ({ ...p, weight: undefined }));
            setConfirming(false);
            setAgentLine(t.okCorrectWeight);
            return;
        }
        setAgentLine(t.tellWeightExample);
    };

    const saveItem = () => {
        const entry = { ...pending };
        setItems((prev) => {
            const idx = prev.findIndex((i) => i.subId === entry.subId);
            let next;
            if (idx !== -1) {
                next = prev.map((i, k) =>
                    k === idx ? { ...i, weight: (Number(i.weight) || 0) + (Number(entry.weight) || 0) } : i
                );
            } else {
                next = [...prev, entry];
            }
            setPending(null);
            setConfirming(false);
            setPhase('summary');
            setQuestion(t.qSummary);
            setAgentLine(t.savedSummary(itemsSentence(next, VOICE_LANG), fmt(totalKg(next))));
            setSubmitAsking(false);
            setRedoAsking(false);
            setRedoAllConfirm(false);
            bumpScroll();
            return next;
        });
    };

    const findItem = (target) => {
        const n = normalize(target || '');
        if (!n) return null;
        return (
            items.find((i) => normalize(i.label) === n) ||
            items.find((i) => normalize(i.label).includes(n) || n.includes(normalize(i.label))) ||
            null
        );
    };

    const removeItem = (item, buildLine) => {
        setItems((prev) => {
            const next = prev.filter((i) => i.subId !== item.subId);
            setAgentLine(buildLine(next));
            return next;
        });
    };

    const handleSummary = (text) => {
        // nested confirmations first
        if (submitAsking) {
            if (isAffirmative(text)) return doSubmit();
            if (isNegative(text)) {
                setSubmitAsking(false);
                setAgentLine(t.notSubmittingYet);
                return;
            }
            setAgentLine(t.submitYesNo);
            return;
        }
        if (redoAllConfirm) {
            if (isAffirmative(text)) {
                setItems([]);
                setRedoAllConfirm(false);
                goToCategory(t.cleared);
                return;
            }
            if (isNegative(text)) {
                setRedoAllConfirm(false);
                setAgentLine(t.keepingEverything);
                return;
            }
            setAgentLine(t.clearSure);
            return;
        }
        if (redoAsking) {
            const n = normalize(text);
            if (/\b(everything|all|whole|todo)\b/.test(n)) {
                setRedoAsking(false);
                setRedoAllConfirm(true);
                setAgentLine(t.clearAllSure);
                return;
            }
            const target = n.replace(/.*\b(item|one|elemento|uno)\b/, '').trim();
            const item = findItem(target) || findItem(n);
            if (item) {
                setRedoAsking(false);
                removeItem(item, () => '');
                goToCategory(t.removingReenter(item.label));
                return;
            }
            setAgentLine(t.redoWhichAsk);
            return;
        }

        if (wantsGoBack(text)) {
            setAgentLine(t.atSummarySay);
            return;
        }

        const cmd = parseSummaryCommand(text);
        switch (cmd.action) {
            case 'addAnother':
                return goToCategory(t.backToCategory);
            case 'submit':
                setSubmitAsking(true);
                setAgentLine(t.submitThis);
                return;
            case 'readAll':
                setAgentLine(t.readAll(placeLabel, itemsSentence(items, VOICE_LANG), fmt(totalKg(items))));
                return;
            case 'redoAll':
                setRedoAllConfirm(true);
                setAgentLine(t.clearAllSure);
                return;
            case 'redoAsk':
                setRedoAsking(true);
                setAgentLine(t.redoEverythingOrOne);
                return;
            case 'redoOne': {
                const item = findItem(cmd.target);
                if (item) {
                    removeItem(item, () => '');
                    goToCategory(t.removingReenter(item.label));
                } else {
                    setRedoAsking(true);
                    setAgentLine(t.whichRedo);
                }
                return;
            }
            case 'edit': {
                const item = findItem(cmd.target);
                if (item) {
                    setEditTargetId(item.subId);
                    setPhase('editweight');
                    setQuestion(t.qNewWeightFor(item.label));
                    setAgentLine('');
                    bumpScroll();
                } else {
                    setAgentLine(t.whichEdit);
                }
                return;
            }
            case 'delete': {
                const item = findItem(cmd.target);
                if (item) {
                    removeItem(item, (next) => t.removedTotal(item.label, fmt(totalKg(next))));
                } else {
                    setAgentLine(t.whichDelete);
                }
                return;
            }
            default:
                setAgentLine(t.summaryVerbs);
        }
    };

    const handleEditWeight = (text) => {
        if (wantsGoBack(text)) return goToSummary(t.backToSummaryVerbs);
        const num = parseNumber(text);
        if (num != null && num > 0) {
            setItems((prev) => {
                const next = prev.map((i) =>
                    i.subId === editTargetId ? { ...i, weight: num } : i
                );
                const label = next.find((i) => i.subId === editTargetId)?.label ?? 'item';
                setAgentLine(t.updatedTotal(label, fmt(num), fmt(totalKg(next))));
                return next;
            });
            setEditTargetId(null);
            setPhase('summary');
            setQuestion(t.qSummary);
            bumpScroll();
            return;
        }
        setAgentLine(t.tellNewWeightExample);
    };

    const doSubmit = () => {
        setPhase('done');
        setSubmitAsking(false);
        bumpScroll();
    };

    const goBack = () => {
        switch (phase) {
            case 'location':
                goToClient(t.goingBackClientList);
                return;
            case 'addbags':
                if (selectedClient && locationOptions.length) {
                    goToLocation(t.goingBackLocationList);
                } else if (clientOptions.length) {
                    goToClient(t.goingBackClientList);
                } else {
                    onExit?.();
                }
                return;
            case 'category':
                goToAddBags(t.goingBackAddBags);
                return;
            case 'subcategory':
                goToCategory(t.goingBackCategory);
                return;
            case 'weight': {
                if (pending?.hasSub) {
                    setPhase('subcategory');
                    setQuestion(t.qTypeOf(pending.typeWord));
                    setAgentLine(t.goingBackSubList);
                } else {
                    goToCategory(t.goingBackCategory);
                }
                resetSelection();
                bumpScroll();
                return;
            }
            case 'editweight':
                goToSummary(t.goingBackSummary);
                return;
            case 'addbags':
            default:
                onExit?.();
        }
    };

    /* --------------------------------------------------- render pieces       */

    const submit = () => handleUtterance(micText);

    const renderChips = (opts, cols) => (
        <View style={cols === 2 ? styles.optionsGrid : null}>
            {opts.map((opt, i) => {
                const active = selection?.index === i || readOut?.i === i;
                return (
                    <TouchableOpacity
                        key={opt.id}
                        activeOpacity={0.8}
                        onPress={() => handleUtterance(String(i + 1))}
                        style={[
                            styles.chip,
                            cols === 2 ? styles.chipHalf : styles.chipFull,
                            active && styles.chipActive,
                        ]}
                    >
                        <View style={styles.chipIndex}>
                            <Text style={styles.chipIndexText}>{i + 1}</Text>
                        </View>
                        <Text style={styles.chipLabel}>
                            {opt.label}
                            {active && confirming ? (
                                <Text style={styles.chipConfirm}>  — confirm?</Text>
                            ) : null}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );

    const voiceStatusText = () => {
        if (!voice.available) return t.stNotInBuild;
        if (voice.status === 'error') return t.stError(voice.lastError);
        if (!voice.modelReady) return t.stLoading(voice.loadElapsed || 0);
        if (interpreting) return t.stThinking;
        if (readOut) return t.stReading;
        if (!voiceOn) return t.stVoiceOff;
        if (voice.speaking) return t.stSpeaking(AGENT_NAME);
        if (voice.listening) return t.stListening;
        return t.stTapToTalk;
    };

    const onStatusPress = () => {
        if (voice.status === 'error') voice.retryModel?.();
        else talkNow();
    };

    const renderVoiceStatus = () => (
        <>
            <TouchableOpacity
                activeOpacity={0.8}
                onPress={onStatusPress}
                style={[
                    styles.voiceStatus,
                    voice.listening && styles.voiceStatusLive,
                    (!voice.available || voice.status === 'error') && styles.voiceStatusWarn,
                ]}
            >
                <Text style={styles.voiceStatusText}>{voiceStatusText()}</Text>
            </TouchableOpacity>
            {voice.status === 'error' && voice.lastError ? (
                <Text style={styles.voiceError}>{voice.lastError}</Text>
            ) : null}
        </>
    );

    const renderTranscript = () => {
        const live = voice.partial || '';
        const shown = live || heard;
        return (
            <View style={styles.transcriptCard}>
                {shown ? (
                    <Text style={styles.transcriptText}>
                        “{shown}”{live ? <Text style={styles.transcriptPlaceholder}> …</Text> : null}
                    </Text>
                ) : (
                    <Text style={styles.transcriptPlaceholder}>
                        {voice.speaking
                            ? t.transcriptSpeaking(AGENT_NAME)
                            : voice.listening
                              ? t.transcriptListening
                              : t.transcriptIdle}
                    </Text>
                )}
            </View>
        );
    };

    const renderBody = () => {
        if (phase === 'loadingctx') {
            return (
                <View style={styles.doneWrap}>
                    <Listening active label={t.loadingClients} />
                    <Text style={styles.doneSub}>{t.imListening}</Text>
                </View>
            );
        }

        if (phase === 'done') {
            const plural = items.length === 1 ? '' : 's';
            return (
                <View style={styles.doneWrap}>
                    <Text style={styles.doneIcon}>✅</Text>
                    <Text style={styles.doneTitle}>{t.submittedTitle}</Text>
                    <Text style={styles.doneSub}>
                        {t.recordedFor(items.length, plural, fmt(totalKg(items)), placeLabel)}
                    </Text>
                    <TouchableOpacity
                        style={[styles.primaryBtn, styles.chipFull]}
                        onPress={() => navigation?.navigate?.(screenNames?.HOME ?? 'home')}
                    >
                        <Text style={styles.primaryBtnText}>{t.backToMenu}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.chip, styles.chipFull, { justifyContent: 'center' }]}
                        onPress={() => {
                            setHeard('');
                            spokenRef.current = '';
                            startFlow();
                        }}
                    >
                        <Text style={styles.chipLabel}>{t.startAnother}</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        // Interactive voice steps
        return (
            <>
                <View style={styles.stepPill}>
                    <Text style={styles.stepPillText}>{STEP_PILL[phase]}</Text>
                </View>
                <Text style={styles.question}>{question}</Text>
                <TouchableOpacity activeOpacity={0.8} onPress={talkNow}>
                    <Listening
                        active={voice.listening || voice.speaking || interpreting}
                        label={voice.speaking ? t.transcriptSpeaking(AGENT_NAME) : t.transcriptListening}
                    />
                </TouchableOpacity>
                {renderVoiceStatus()}
                {renderTranscript()}
                {agentLine ? <Text style={styles.agentLine}>{agentLine}</Text> : null}

                {phase === 'client' && renderChips(clientOptions, 1)}
                {phase === 'location' && renderChips(locationOptions, 1)}

                {phase === 'addbags' &&
                    renderChips(
                        [
                            { id: 'yes', label: t.chipYes },
                            { id: 'no', label: t.chipNot },
                        ],
                        1
                    )}

                {phase === 'category' && renderChips(categoryOptions, 2)}
                {phase === 'subcategory' && renderChips(subOptions, 2)}

                {phase === 'weight' && (
                    <>
                        <View style={styles.weightReadout}>
                            <Text style={styles.weightValue}>
                                {pending?.weight != null ? `${fmt(pending.weight)} kg` : '— kg'}
                            </Text>
                            <Text style={styles.weightUnitLabel}>{t.weightLabel}</Text>
                        </View>
                        {pending?.weight != null && (
                            <TouchableOpacity
                                style={styles.primaryBtn}
                                onPress={() => handleUtterance(VOICE_LANG === 'es' ? 'sí' : 'yes')}
                            >
                                <Text style={styles.primaryBtnText}>{t.saveContinue}</Text>
                            </TouchableOpacity>
                        )}
                    </>
                )}

                {phase === 'summary' && (
                    <>
                        {items.map((i) => (
                            <View key={i.subId} style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>{i.label}</Text>
                                <Text style={styles.summaryWeight}>{fmt(i.weight)} kg</Text>
                            </View>
                        ))}
                        <Text style={styles.summaryTotal}>
                            {t.classifiedTotal}: {fmt(totalKg(items))} kg
                        </Text>
                        {renderChips(
                            [
                                { id: 'add', label: t.chipAdd },
                                { id: 'submit', label: t.chipSubmit },
                            ],
                            1
                        )}
                    </>
                )}

                <Text style={styles.hint}>{HINTS[phase]}</Text>
            </>
        );
    };

    /* --------------------------------------------------- layout              */

    if (showTest) {
        return <VoiceTest onClose={() => setShowTest(false)} />;
    }

    return (
        <SafeAreaView style={styles.safe}>
            <KeyboardAvoidingView
                style={styles.container}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <View style={styles.topBar}>
                    <TouchableOpacity style={styles.topBarBtn} onPress={() => onExit?.()}>
                        <Text style={styles.topBarBtnText}>{t.exit}</Text>
                    </TouchableOpacity>
                    <View style={{ flexDirection: 'row' }}>
                        <TouchableOpacity
                            style={[styles.topBarBtn, { marginRight: 8 }]}
                            onPress={() => setShowTest(true)}
                        >
                            <Text style={styles.topBarBtnText}>🔧 Mic test</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.topBarBtn, { marginRight: 8 }]}
                            onPress={toggleVoice}
                        >
                            <Text style={styles.topBarBtnText}>{voiceOn ? '🔊' : '🔇'}</Text>
                        </TouchableOpacity>
                        {phase !== 'done' ? (
                            <TouchableOpacity style={styles.topBarBtn} onPress={goBack}>
                                <Text style={styles.topBarBtnText}>{t.back}</Text>
                            </TouchableOpacity>
                        ) : null}
                    </View>
                </View>

                <ScrollView
                    ref={scrollRef}
                    contentContainerStyle={styles.scroll}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    {renderBody()}
                </ScrollView>

                {phase !== 'done' && (
                    <View style={styles.inputBar}>
                        {voice.available && (
                            <TouchableOpacity
                                style={[styles.micBtn, styles.micBtnGhost, voice.listening && styles.micBtnLive]}
                                onPress={talkNow}
                            >
                                <Text style={styles.micBtnText}>{voice.listening ? '🔴' : '🎤'}</Text>
                            </TouchableOpacity>
                        )}
                        <TextInput
                            style={styles.input}
                            value={micText}
                            onChangeText={setMicText}
                            onSubmitEditing={submit}
                            placeholder={t.inputPlaceholder}
                            placeholderTextColor={VC.textFaint}
                            returnKeyType="send"
                            autoCapitalize="none"
                        />
                        <TouchableOpacity style={styles.micBtn} onPress={submit}>
                            <Text style={styles.micBtnText}>➤</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

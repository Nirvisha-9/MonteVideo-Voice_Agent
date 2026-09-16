import es from './es';
import en from './en';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@app_language';

// tiny event system so screens can re-render when the language changes
const listeners = new Set();
const notify = (langCode) => { listeners.forEach(fn => fn(langCode)); };

let currentLang = 'es';
let currentDict = es;

// Load persisted language on app launch
AsyncStorage.getItem(STORAGE_KEY).then((savedLang) => {
  if (savedLang && (savedLang === 'en' || savedLang === 'es') && savedLang !== currentLang) {
    currentDict = savedLang === 'en' ? en : es;
    currentLang = savedLang;
    notify(currentLang);
  }
}).catch((err) => {
  console.error('Failed to load saved language:', err);
});

// Export a stable object that always "reads through" to the current dict.
// This lets you keep: import dictionary from '../localization/dictionary'
const dictionary = new Proxy({}, {
  get(_t, key) { return currentDict[key]; },
  ownKeys() { return Reflect.ownKeys(currentDict); },
  getOwnPropertyDescriptor() { return { enumerable: true, configurable: true }; }
});

export function setLanguage(langCode) {
  const next = langCode === 'en' ? en : es;
  if (next !== currentDict) {
    currentDict = next;
    currentLang = langCode === 'en' ? 'en' : 'es';
    notify(currentLang);
    AsyncStorage.setItem(STORAGE_KEY, currentLang).catch((err) => {
      console.error('Failed to save language:', err);
    });
  }
}

export function getLanguage() { return currentLang; }

// optional: screens that need to reflect external language changes can subscribe
export function subscribeLanguage(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export default dictionary;

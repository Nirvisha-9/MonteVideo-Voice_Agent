import { requireOptionalNativeModule } from 'expo';

// Native full-duplex audio helpers (Android). null when the app was built
// without this module (Expo Go, tests).
export default requireOptionalNativeModule('VoiceDuplex');

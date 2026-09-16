import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// From google-services.json — project: obra-padre-cacho
const firebaseConfig = {
    apiKey: "AIzaSyCiUn4c07GJLWOF3JMBsOtu8r1nhC6Bonc",
    authDomain: "obra-padre-cacho.firebaseapp.com",
    projectId: "obra-padre-cacho",
    storageBucket: "obra-padre-cacho.firebasestorage.app",
    messagingSenderId: "517656003079",
    appId: "1:517656003079:android:570cdcbb2a2e6f6d2f60a2"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
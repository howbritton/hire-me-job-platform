import { initializeApp } from "firebase/app";
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyAA0RWug-zj6PFQigycDJ4xpgpJQr7p2lU",
  authDomain: "hireme-d14cb.firebaseapp.com",
  projectId: "hireme-d14cb",
  storageBucket: "hireme-d14cb.firebasestorage.app",
  messagingSenderId: "390114475630",
  appId: "1:390114475630:web:cf4a03c4257a9c3248707f",
  measurementId: "G-BE23LCVTQZ"
};

const app = initializeApp(firebaseConfig);

export { app };
export const storage = getStorage(app);
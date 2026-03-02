import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAHz0XA_V6UpTn3elXISk2uGnEqt2BMrmc",
  authDomain: "oibre-login.firebaseapp.com",
  projectId: "oibre-login",
  storageBucket: "oibre-login.firebasestorage.app",
  messagingSenderId: "610897540853",
  appId: "1:610897540853:web:1282554f6390299ef877b"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

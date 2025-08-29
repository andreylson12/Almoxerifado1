import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDIjZ486-wpnrnhp3w0HhhiA6HcPnEmW7c",
  authDomain: "almoxerifado-72270.firebaseapp.com",
  projectId: "almoxerifado-72270",
  storageBucket: "almoxerifado-72270.appspot.com",
  messagingSenderId: "672387352641",
  appId: "1:672387352641:web:af2df567bb1d2eebaedec0"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);

// Exporta o auth para usar no login
export const auth = getAuth(app);

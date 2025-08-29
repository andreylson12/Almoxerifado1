// fonte/firebaseConfig.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// 🔑 Pegue essas configs no Console Firebase (Configurações > Suas apps > SDK Firebase)
const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_PROJETO.firebaseapp.com",
  projectId: "SEU_PROJETO",
  storageBucket: "SEU_PROJETO.appspot.com",
  messagingSenderId: "SEU_ID",
  appId: "SUA_APP_ID",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

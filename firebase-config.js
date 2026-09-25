import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBCIMCATqfSNMsmXj0jKl_HzWCpObGMZRw",
  authDomain: "healthcare--web.firebaseapp.com",
  databaseURL: "https://healthcare--web-default-rtdb.firebaseio.com",
  projectId: "healthcare--web",
  storageBucket: "healthcare--web.firebasestorage.app",
  messagingSenderId: "810678951847",
  appId: "1:810678951847:web:2d6194ad7e95a3b489a082"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);

console.log("🔥 Firebase connected to:", firebaseConfig.projectId);
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCNA6BzDw4qtg9ZvJbfOOM-zsxw-l-rENY",
  authDomain: "lecturemateproject.firebaseapp.com",
  projectId: "lecturemateproject",
  storageBucket: "lecturemateproject.firebasestorage.app",
  messagingSenderId: "575572304557",
  appId: "1:575572304557:web:a6d7d75537bff39dd09c24",
  measurementId: "G-L9VPK7Q9C5"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Analytics (only in browser environment)
let analytics;
if (typeof window !== "undefined") {
  analytics = getAnalytics(app);
}

// Initialize Firebase Auth
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// Initialize Firestore
const db = getFirestore(app);

export { app, analytics, auth, googleProvider, db };


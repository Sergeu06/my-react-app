import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore"; // For Firestore
import { getAuth } from "firebase/auth";
import {
  getDatabase,
  ref as databaseRef,
  push,
  set,
  get,
  update,
  onValue,
} from "firebase/database"; // Renamed ref to databaseRef
import {
  getStorage,
  ref as storageRef,
  listAll,
  getDownloadURL,
} from "firebase/storage"; // For Storage

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyD0SXNWUjftNziCo-TImzA1ksA8w8n-Rfc",
  authDomain: "snake-6da20.firebaseapp.com",
  projectId: "snake-6da20",
  storageBucket: "snake-6da20.appspot.com",
  messagingSenderId: "792222318675",
  appId: "1:792222318675:web:5ecacccf554824a7ef46a6",
  measurementId: "G-P9R1G79S57",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app); // Firestore initialization
const auth = getAuth(app); // Authentication initialization
const database = getDatabase(
  app,
  "https://snake-6da20-default-rtdb.europe-west1.firebasedatabase.app"
);
const storage = getStorage(app); // Storage initialization

// Retry Request function
const retryRequest = async (func, retries = 10, delay = 5000) => {
  let attempts = 0;
  while (attempts < retries) {
    try {
      return await func();
    } catch (error) {
      attempts++;
      if (attempts >= retries) {
        throw error; // Прекращаем попытки, если все неудачны
      }
      console.log(`Попытка ${attempts} не удалась. Повтор через ${delay} мс.`);
      await new Promise((resolve) => setTimeout(resolve, delay)); // Ждем перед новой попыткой
    }
  }
};

// Export all necessary functions
export {
  db,
  auth,
  database,
  storage,
  databaseRef, // Renamed to databaseRef to avoid confusion
  storageRef,
  set,
  get,
  push,
  update,
  collection,
  getDocs,
  listAll,
  getDownloadURL,
  onValue,
  retryRequest, // Добавляем функцию retryRequest для использования в других частях
};

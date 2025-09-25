// src/firebase.js
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAh09moZzkbSSAMdBYriSYF0-Kbhkhv3aY",
  authDomain: "neumaticos-olmos.firebaseapp.com",
  projectId: "neumaticos-olmos",
  storageBucket: "neumaticos-olmos.firebasestorage.app",
  messagingSenderId: "680785488994",
  appId: "1:680785488994:web:5b49fd4f4a7e8204b1f53b"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Función para guardar datos
export const guardarDatos = async (datos) => {
  try {
    await setDoc(doc(db, 'neumaticos-data', 'principal'), datos);
    console.log('Datos guardados en Firebase');
    return true;
  } catch (error) {
    console.error('Error guardando datos:', error);
    return false;
  }
};

// Función para obtener datos
export const obtenerDatos = async () => {
  try {
    const docRef = doc(db, 'neumaticos-data', 'principal');
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return docSnap.data();
    } else {
      console.log('No hay datos guardados');
      return null;
    }
  } catch (error) {
    console.error('Error obteniendo datos:', error);
    return null;
  }
};

export { db };

// src/firebase.js
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, writeBatch } from 'firebase/firestore';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  createUserWithEmailAndPassword 
} from 'firebase/auth';

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
const auth = getAuth(app);

// ==================== FUNCIONES DE AUTENTICACIÓN ====================

// Iniciar sesión
export const iniciarSesion = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    console.log('Usuario autenticado:', userCredential.user.email);
    return { success: true, user: userCredential.user };
  } catch (error) {
    console.error('Error al iniciar sesión:', error);
    let mensaje = 'Error al iniciar sesión';
    
    if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
      mensaje = 'Email o contraseña incorrectos';
    } else if (error.code === 'auth/user-not-found') {
      mensaje = 'Usuario no encontrado';
    } else if (error.code === 'auth/too-many-requests') {
      mensaje = 'Demasiados intentos fallidos. Intenta más tarde';
    }
    
    return { success: false, error: mensaje };
  }
};

// Crear nuevo usuario
export const crearUsuario = async (email, password) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    console.log('Usuario creado:', userCredential.user.email);
    return { success: true, user: userCredential.user };
  } catch (error) {
    console.error('Error al crear usuario:', error);
    let mensaje = 'Error al crear usuario';
    
    if (error.code === 'auth/email-already-in-use') {
      mensaje = 'Este email ya está registrado';
    } else if (error.code === 'auth/weak-password') {
      mensaje = 'La contraseña debe tener al menos 6 caracteres';
    } else if (error.code === 'auth/invalid-email') {
      mensaje = 'Email inválido';
    }
    
    return { success: false, error: mensaje };
  }
};

// Cerrar sesión
export const cerrarSesion = async () => {
  try {
    await signOut(auth);
    console.log('Sesión cerrada');
    return { success: true };
  } catch (error) {
    console.error('Error al cerrar sesión:', error);
    return { success: false, error: 'Error al cerrar sesión' };
  }
};

// Observador de estado de autenticación
export const observarEstadoAuth = (callback) => {
  return onAuthStateChanged(auth, callback);
};

// Obtener usuario actual
export const obtenerUsuarioActual = () => {
  return auth.currentUser;
};

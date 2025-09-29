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
// ==================== FUNCIONES DE DATOS ====================

// Función para dividir array en chunks más pequeños
const chunkArray = (array, chunkSize) => {
  const chunks = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
};

// Función para guardar datos en documentos separados
export const guardarDatos = async (datos) => {
  try {
    // Verificar autenticación
    if (!auth.currentUser) {
      console.error('Usuario no autenticado');
      return false;
    }

    console.log('Guardando datos en Firebase...');
    const batch = writeBatch(db);

    // 1. Guardar stock actual
    const stockRef = doc(db, 'neumaticos-data', 'stock-actual');
    batch.set(stockRef, {
      data: datos.stockActual || [],
      ultimaFechaStock: datos.ultimaFechaStock,
      fechaActualizacion: new Date().toISOString()
    });

    // 2. Guardar ventas diarias en chunks de 100 registros
    const ventasDiarias = datos.ventasDiarias || [];
    const ventasChunks = chunkArray(ventasDiarias, 100);
    
    // Limpiar chunks anteriores de ventas diarias
    for (let i = 0; i < 20; i++) {
      const chunkRef = doc(db, 'neumaticos-data', `ventas-diarias-${i}`);
      batch.delete(chunkRef);
    }
    
    // Guardar nuevos chunks de ventas diarias
    ventasChunks.forEach((chunk, index) => {
      const chunkRef = doc(db, 'neumaticos-data', `ventas-diarias-${index}`);
      batch.set(chunkRef, {
        data: chunk,
        chunkIndex: index,
        totalChunks: ventasChunks.length,
        fechaActualizacion: new Date().toISOString()
      });
    });

    // 3. Guardar ventas históricas en chunks de 200 registros
    const ventasHistoricas = datos.ventasHistoricas || [];
    const historicasChunks = chunkArray(ventasHistoricas, 200);
    
    if (ventasHistoricas.length > 0) {
      // Limpiar chunks anteriores de ventas históricas
      for (let i = 0; i < 50; i++) {
        const chunkRef = doc(db, 'neumaticos-data', `ventas-historicas-${i}`);
        batch.delete(chunkRef);
      }
      
      // Guardar nuevos chunks de ventas históricas
      historicasChunks.forEach((chunk, index) => {
        const chunkRef = doc(db, 'neumaticos-data', `ventas-historicas-${index}`);
        batch.set(chunkRef, {
          data: chunk,
          chunkIndex: index,
          totalChunks: historicasChunks.length,
          fechaActualizacion: new Date().toISOString()
        });
      });
    }

    // 4. Guardar metadata
    const metadataRef = doc(db, 'neumaticos-data', 'metadata');
    batch.set(metadataRef, {
      totalVentasDiarias: ventasDiarias.length,
      totalVentasHistoricas: ventasHistoricas.length,
      totalStock: (datos.stockActual || []).length,
      chunksVentasDiarias: ventasChunks.length,
      chunksVentasHistoricas: historicasChunks.length,
      ultimaActualizacion: new Date().toISOString(),
      version: '2.0'
    });

    // Ejecutar todas las operaciones
    await batch.commit();
    console.log('Datos guardados exitosamente en Firebase');
    return true;
  } catch (error) {
    console.error('Error guardando datos:', error);
    return false;
  }
};

// Función para obtener datos desde documentos separados
export const obtenerDatos = async () => {
  try {
    // Verificar autenticación
    if (!auth.currentUser) {
      console.error('Usuario no autenticado');
      return null;
    }

    console.log('Cargando datos desde Firebase...');

    // 1. Obtener metadata
    const metadataRef = doc(db, 'neumaticos-data', 'metadata');
    const metadataSnap = await getDoc(metadataRef);
    
    if (!metadataSnap.exists()) {
      console.log('No hay datos guardados');
      return null;
    }

    const metadata = metadataSnap.data();
    console.log('Metadata encontrada:', metadata);

    // 2. Obtener stock actual
    const stockRef = doc(db, 'neumaticos-data', 'stock-actual');
    const stockSnap = await getDoc(stockRef);
    const stockData = stockSnap.exists() ? stockSnap.data() : { data: [], ultimaFechaStock: null };

    // 3. Obtener ventas diarias
    let ventasDiarias = [];
    for (let i = 0; i < (metadata.chunksVentasDiarias || 0); i++) {
      const chunkRef = doc(db, 'neumaticos-data', `ventas-diarias-${i}`);
      const chunkSnap = await getDoc(chunkRef);
      if (chunkSnap.exists()) {
        const chunkData = chunkSnap.data();
        ventasDiarias = ventasDiarias.concat(chunkData.data || []);
      }
    }

    // 4. Obtener ventas históricas
    let ventasHistoricas = [];
    for (let i = 0; i < (metadata.chunksVentasHistoricas || 0); i++) {
      const chunkRef = doc(db, 'neumaticos-data', `ventas-historicas-${i}`);
      const chunkSnap = await getDoc(chunkRef);
      if (chunkSnap.exists()) {
        const chunkData = chunkSnap.data();
        ventasHistoricas = ventasHistoricas.concat(chunkData.data || []);
      }
    }

    const datosCompletos = {
      stockActual: stockData.data || [],
      ventasDiarias: ventasDiarias,
      ventasHistoricas: ventasHistoricas,
      ultimaFechaStock: stockData.ultimaFechaStock || null
    };

    console.log('Datos cargados:', {
      stock: datosCompletos.stockActual.length,
      ventasDiarias: datosCompletos.ventasDiarias.length,
      ventasHistoricas: datosCompletos.ventasHistoricas.length
    });

    return datosCompletos;

  } catch (error) {
    console.error('Error obteniendo datos:', error);
    return null;
  }
};

export { db, auth };

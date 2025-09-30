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

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

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

export const observarEstadoAuth = (callback) => {
  return onAuthStateChanged(auth, callback);
};

export const obtenerUsuarioActual = () => {
  return auth.currentUser;
};

const chunkArray = (array, chunkSize) => {
  const chunks = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
};

export const guardarDatos = async (datos) => {
  try {
    if (!auth.currentUser) {
      console.error('Usuario no autenticado');
      return false;
    }

    console.log('Guardando datos en Firebase...');
    const batch = writeBatch(db);

    const stockRef = doc(db, 'neumaticos-data', 'stock-actual');
    batch.set(stockRef, {
      data: datos.stockActual || [],
      ultimaFechaStock: datos.ultimaFechaStock,
      fechaActualizacion: new Date().toISOString()
    });

    const ventasDiarias = datos.ventasDiarias || [];
    const ventasChunks = chunkArray(ventasDiarias, 100);
    
    for (let i = 0; i < 20; i++) {
      const chunkRef = doc(db, 'neumaticos-data', 'ventas-diarias-' + i);
      batch.delete(chunkRef);
    }
    
    ventasChunks.forEach((chunk, index) => {
      const chunkRef = doc(db, 'neumaticos-data', 'ventas-diarias-' + index);
      batch.set(chunkRef, {
        data: chunk,
        chunkIndex: index,
        totalChunks: ventasChunks.length,
        fechaActualizacion: new Date().toISOString()
      });
    });

    const ventasHistoricas = datos.ventasHistoricas || [];
    const historicasChunks = chunkArray(ventasHistoricas, 200);
    
    if (ventasHistoricas.length > 0) {
      for (let i = 0; i < 50; i++) {
        const chunkRef = doc(db, 'neumaticos-data', 'ventas-historicas-' + i);
        batch.delete(chunkRef);
      }
      
      historicasChunks.forEach((chunk, index) => {
        const chunkRef = doc(db, 'neumaticos-data', 'ventas-historicas-' + index);
        batch.set(chunkRef, {
          data: chunk,
          chunkIndex: index,
          totalChunks: historicasChunks.length,
          fechaActualizacion: new Date().toISOString()
        });
      });
    }

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

    await batch.commit();
    console.log('Datos guardados exitosamente en Firebase');
    return true;
  } catch (error) {
    console.error('Error guardando datos:', error);
    return false;
  }
};

export const obtenerDatos = async () => {
  try {
    if (!auth.currentUser) {
      console.error('Usuario no autenticado');
      return null;
    }

    console.log('Cargando datos desde Firebase...');

    const metadataRef = doc(db, 'neumaticos-data', 'metadata');
    const metadataSnap = await getDoc(metadataRef);
    
    if (!metadataSnap.exists()) {
      console.log('No hay datos guardados');
      return {
        stockActual: [],
        ventasDiarias: [],
        ventasHistoricas: [],
        ultimaFechaStock: null
      };
    }

    const metadata = metadataSnap.data();
    console.log('Metadata encontrada:', metadata);

    const stockRef = doc(db, 'neumaticos-data', 'stock-actual');
    const stockSnap = await getDoc(stockRef);
    const stockData = stockSnap.exists() ? stockSnap.data() : { data: [], ultimaFechaStock: null };

    console.log('Stock cargado:', stockData.data.length, 'productos');

    let ventasDiarias = [];
    const chunksVentasDiarias = metadata.chunksVentasDiarias || 0;
    console.log('Cargando', chunksVentasDiarias, 'chunks de ventas diarias...');
    
    for (let i = 0; i < chunksVentasDiarias; i++) {
      const chunkRef = doc(db, 'neumaticos-data', 'ventas-diarias-' + i);
      const chunkSnap = await getDoc(chunkRef);
      if (chunkSnap.exists()) {
        const chunkData = chunkSnap.data();
        ventasDiarias = ventasDiarias.concat(chunkData.data || []);
      }
    }

    console.log('Ventas diarias cargadas:', ventasDiarias.length, 'registros');

    let ventasHistoricas = [];
    const chunksVentasHistoricas = metadata.chunksVentasHistoricas || 0;
    console.log('Cargando', chunksVentasHistoricas, 'chunks de ventas historicas...');
    
    for (let i = 0; i < chunksVentasHistoricas; i++) {
      const chunkRef = doc(db, 'neumaticos-data', 'ventas-historicas-' + i);
      const chunkSnap = await getDoc(chunkRef);
      if (chunkSnap.exists()) {
        const chunkData = chunkSnap.data();
        ventasHistoricas = ventasHistoricas.concat(chunkData.data || []);
      }
    }

    console.log('Ventas historicas cargadas:', ventasHistoricas.length, 'registros');

    const datosCompletos = {
      stockActual: stockData.data || [],
      ventasDiarias: ventasDiarias,
      ventasHistoricas: ventasHistoricas,
      ultimaFechaStock: stockData.ultimaFechaStock || null
    };

    console.log('Datos finales cargados:', {
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

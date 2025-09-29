// src/firebase.js
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, collection, writeBatch } from 'firebase/firestore';

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
    console.log('Guardando datos en Firebase...');
    const batch = writeBatch(db);

    // 1. Guardar stock actual (siempre pequeño)
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
    for (let i = 0; i < 20; i++) { // Limpiar hasta 20 chunks previos
      const chunkRef = doc(db, 'neumaticos-data', ventas-diarias-${i});
      batch.delete(chunkRef);
    }
    
    // Guardar nuevos chunks de ventas diarias
    ventasChunks.forEach((chunk, index) => {
      const chunkRef = doc(db, 'neumaticos-data', ventas-diarias-${index});
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
    
    // Solo actualizar si hay datos históricos nuevos
    if (ventasHistoricas.length > 0) {
      // Limpiar chunks anteriores de ventas históricas
      for (let i = 0; i < 50; i++) { // Limpiar hasta 50 chunks previos
        const chunkRef = doc(db, 'neumaticos-data', ventas-historicas-${i});
        batch.delete(chunkRef);
      }
      
      // Guardar nuevos chunks de ventas históricas
      historicasChunks.forEach((chunk, index) => {
        const chunkRef = doc(db, 'neumaticos-data', ventas-historicas-${index});
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
    console.log('Cargando datos desde Firebase...');

    // 1. Obtener metadata para saber cuántos chunks hay
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
      const chunkRef = doc(db, 'neumaticos-data', ventas-diarias-${i});
      const chunkSnap = await getDoc(chunkRef);
      if (chunkSnap.exists()) {
        const chunkData = chunkSnap.data();
        ventasDiarias = ventasDiarias.concat(chunkData.data || []);
      }
    }

    // 4. Obtener ventas históricas
    let ventasHistoricas = [];
    for (let i = 0; i < (metadata.chunksVentasHistoricas || 0); i++) {
      const chunkRef = doc(db, 'neumaticos-data', ventas-historicas-${i});
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

// Función para limpiar datos antiguos (mantener solo últimos 90 días de ventas diarias)
export const limpiarDatosAntiguos = async () => {
  try {
    const hace90Dias = new Date();
    hace90Dias.setDate(hace90Dias.getDate() - 90);
    
    const datos = await obtenerDatos();
    if (!datos) return false;

    // Filtrar ventas diarias - mantener solo últimos 90 días
    const ventasFiltradas = datos.ventasDiarias.filter(venta => {
      const fechaVenta = new Date(venta.fecha);
      return fechaVenta >= hace90Dias;
    });

    // Guardar datos filtrados
    const datosLimpios = {
      ...datos,
      ventasDiarias: ventasFiltradas
    };

    await guardarDatos(datosLimpios);
    console.log(Limpieza completada. Ventas diarias: ${datos.ventasDiarias.length} → ${ventasFiltradas.length});
    return true;
  } catch (error) {
    console.error('Error limpiando datos antiguos:', error);
    return false;
  }
};

export { db };

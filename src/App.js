import React, { useState, useEffect } from 'react';
import { Upload, BarChart3, TrendingUp, TrendingDown, AlertTriangle, Calendar, FileSpreadsheet, Download, LogOut, UserPlus } from 'lucide-react';
import * as XLSX from 'xlsx';
import { guardarDatos, obtenerDatos, iniciarSesion, cerrarSesion, observarEstadoAuth, crearUsuario } from './firebase';
import Login from './Login';

const StockManagementSystem = () => {
  // Estados de autenticación
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  // Estados originales
  const [data, setData] = useState({
    stockActual: [],
    ventasDiarias: [],
    ventasHistoricas: [],
    ultimaFechaStock: null
  });
  
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [activeTab, setActiveTab] = useState('upload');
  const [alerts, setAlerts] = useState([]);
  const [filteredAlerts, setFilteredAlerts] = useState([]);
  const [filters, setFilters] = useState({
    nivel: 'all',
    diasStockMin: '',
    diasStockMax: '',
    ventaMin: '',
    ventaMax: '',
    search: ''
  });

  // FUNCIONES DE CÁLCULO Y FILTROS
  const calculateStats = () => {
    const stockActual = data.stockActual;
    const todasLasVentas = [...data.ventasDiarias, ...data.ventasHistoricas];
    
    const ventasUltimos90Dias = todasLasVentas.filter(item => {
      const fechaItem = new Date(item.fecha);
      const hace90Dias = new Date();
      hace90Dias.setDate(hace90Dias.getDate() - 90);
      return fechaItem >= hace90Dias;
    });

    const promediosVenta = {};
    ventasUltimos90Dias.forEach(item => {
      if (!promediosVenta[item.codigo]) {
        promediosVenta[item.codigo] = { total: 0, dias: new Set(), descripcion: item.descripcion };
      }
      promediosVenta[item.codigo].total += item.cantidad;
      promediosVenta[item.codigo].dias.add(item.fecha);
    });

    const todosLosSKUs = new Set([
      ...stockActual.map(item => item.codigo),
      ...Object.keys(promediosVenta)
    ]);

    const newAlerts = [];
    
    todosLosSKUs.forEach(codigo => {
      const stockItem = stockActual.find(item => item.codigo === codigo);
      const promedioData = promediosVenta[codigo];
      
      const stockActualCantidad = stockItem ? stockItem.cantidad : 0;
      const descripcion = stockItem ? stockItem.descripcion : (promedioData ? promedioData.descripcion : '');
      
      if (promedioData && promedioData.dias.size > 0) {
        const promedioVentaDiaria = promedioData.total / promedioData.dias.size;
        const diasStock = stockActualCantidad > 0 ? Math.floor(stockActualCantidad / promedioVentaDiaria) : 0;
        
        let nivel, color, icono;
        
        if (stockActualCantidad === 0) {
          nivel = 'SIN STOCK';
          color = 'text-red-800 bg-red-200 border border-red-300';
          icono = '🚨';
        } else if (diasStock < 15) {
          nivel = 'CRÍTICO';
          color = 'text-red-600 bg-red-100';
          icono = '🔴';
        } else if (diasStock < 30) {
          nivel = 'BAJO';
          color = 'text-yellow-600 bg-yellow-100';
          icono = '🟡';
        } else if (diasStock > 60) {
          nivel = 'SOBREESTOCK';
          color = 'text-blue-600 bg-blue-100';
          icono = '🔵';
        } else {
          nivel = 'ÓPTIMO';
          color = 'text-green-600 bg-green-100';
          icono = '🟢';
        }

        newAlerts.push({
          codigo: codigo,
          descripcion: descripcion,
          stock: stockActualCantidad,
          diasStock: diasStock,
          promedioVenta: promedioVentaDiaria.toFixed(2),
          promedioVentaNumerico: promedioVentaDiaria,
          nivel,
          color,
          icono
        });
      } else if (stockItem && stockActualCantidad > 0) {
        newAlerts.push({
          codigo: codigo,
          descripcion: descripcion,
          stock: stockActualCantidad,
          diasStock: 999,
          promedioVenta: '0.00',
          promedioVentaNumerico: 0,
          nivel: 'SIN MOVIMIENTO',
          color: 'text-gray-600 bg-gray-100',
          icono: '⚫'
        });
      }
    });

    newAlerts.sort((a, b) => {
      const orden = { 'SIN STOCK': 0, 'CRÍTICO': 1, 'BAJO': 2, 'ÓPTIMO': 3, 'SOBREESTOCK': 4, 'SIN MOVIMIENTO': 5 };
      const nivelDiff = orden[a.nivel] - orden[b.nivel];
      
      if (nivelDiff !== 0) {
        return nivelDiff;
      }
      
      return b.promedioVentaNumerico - a.promedioVentaNumerico;
    });

    setAlerts(newAlerts);
    setFilteredAlerts(newAlerts);
  };

  const applyFilters = () => {
    let filtered = [...alerts];

    if (filters.nivel !== 'all') {
      filtered = filtered.filter(alert => alert.nivel === filters.nivel);
    }

    if (filters.diasStockMin) {
      filtered = filtered.filter(alert => alert.diasStock >= parseInt(filters.diasStockMin));
    }
    if (filters.diasStockMax) {
      filtered = filtered.filter(alert => alert.diasStock <= parseInt(filters.diasStockMax));
    }

    if (filters.ventaMin) {
      filtered = filtered.filter(alert => parseFloat(alert.promedioVenta) >= parseFloat(filters.ventaMin));
    }
    if (filters.ventaMax) {
      filtered = filtered.filter(alert => parseFloat(alert.promedioVenta) <= parseFloat(filters.ventaMax));
    }

    if (filters.search) {
      filtered = filtered.filter(alert => 
        alert.codigo.toLowerCase().includes(filters.search.toLowerCase()) ||
        alert.descripcion.toLowerCase().includes(filters.search.toLowerCase())
      );
    }

    setFilteredAlerts(filtered);
  };

  const resetFilters = () => {
    setFilters({
      nivel: 'all',
      diasStockMin: '',
      diasStockMax: '',
      ventaMin: '',
      ventaMax: '',
      search: ''
    });
  };

  // Cargar datos de Firebase
const cargarDatosIniciales = async () => {
  const datosGuardados = await obtenerDatos();
  if (datosGuardados) {
    console.log('✅ Datos cargados desde Firebase:', datosGuardados);
    setData(datosGuardados);
  }
};

  // ========== NUEVO: AUTO-GUARDAR EN FIREBASE ==========
  // Este useEffect guarda automáticamente cada vez que cambian los datos
  useEffect(() => {
    const guardarAutomaticamente = async () => {
      // Solo guardar si hay un usuario autenticado y hay datos
      if (!usuario) return;
      
      const tieneAlgunDato = 
        data.stockActual.length > 0 || 
        data.ventasDiarias.length > 0 || 
        data.ventasHistoricas.length > 0;
      
      if (!tieneAlgunDato) return;

      setGuardando(true);
      const resultado = await guardarDatos(data);
      
      if (resultado) {
        console.log('✅ Datos sincronizados con Firebase');
      } else {
        console.error('❌ Error al sincronizar con Firebase');
      }
      
      setTimeout(() => setGuardando(false), 1000);
    };

    // Esperar 500ms después del último cambio para guardar (debouncing)
    const timeoutId = setTimeout(() => {
      guardarAutomaticamente();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [data, usuario]); // Se ejecuta cada vez que cambian los datos
  // ====================================================

  // HOOKS useEffect
  // Observar estado de autenticación
  useEffect(() => {
    const unsubscribe = observarEstadoAuth((user) => {
      setUsuario(user);
      setCargando(false);
      
      if (user) {
        console.log('Usuario autenticado:', user.email);
        cargarDatosIniciales();
        // AUTO-GUARDAR EN FIREBASE
useEffect(() => {
  const guardarAutomaticamente = async () => {
    if (!usuario) return;
    
    const tieneAlgunDato = 
      data.stockActual.length > 0 || 
      data.ventasDiarias.length > 0 || 
      data.ventasHistoricas.length > 0;
    
    if (!tieneAlgunDato) return;

    setGuardando(true);
    const resultado = await guardarDatos(data);
    
    if (resultado) {
      console.log('✅ Datos sincronizados con Firebase');
    }
    
    setTimeout(() => setGuardando(false), 1000);
  };

  const timeoutId = setTimeout(() => {
    guardarAutomaticamente();
  }, 500);

  return () => clearTimeout(timeoutId);
}, [data, usuario]);
      }
    });

    return () => unsubscribe();
  }, []);

  // Calcular estadísticas cuando cambien los datos
  useEffect(() => {
    if (data.stockActual.length > 0 || data.ventasDiarias.length > 0 || data.ventasHistoricas.length > 0) {
      calculateStats();
    }
  }, [data]);

  // Aplicar filtros cuando cambien
  useEffect(() => {
    applyFilters();
  }, [filters]);

  // FUNCIONES DE AUTENTICACIÓN
  const handleLogin = async (email, password) => {
    return await iniciarSesion(email, password);
  };

  const handleLogout = async () => {
    const confirmar = window.confirm('¿Estás seguro de cerrar sesión?');
    if (confirmar) {
      await cerrarSesion();
      setData({
        stockActual: [],
        ventasDiarias: [],
        ventasHistoricas: [],
        ultimaFechaStock: null
      });
    }
  };

  const handleCrearUsuario = async () => {
    const email = prompt('Email del nuevo usuario:');
    if (!email) return;
    
    const password = prompt('Contraseña (mínimo 6 caracteres):');
    if (!password) return;

    const resultado = await crearUsuario(email, password);
    if (resultado.success) {
      alert('✅ Usuario creado exitosamente');
    } else {
      alert('❌ ' + resultado.error);
    }
  };

  // RENDERS CONDICIONALES
  // Si está cargando
  if (cargando) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  // Si no hay usuario, mostrar login
  if (!usuario) {
    return <Login onLogin={handleLogin} />;
  }

  // FUNCIONES DE PROCESAMIENTO DE ARCHIVOS
  const processExcelFile = (file, type) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const workbook = XLSX.read(e.target.result, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          
          const processedData = jsonData.slice(1).map(row => ({
            codigo: row[0]?.toString() || '',
            descripcion: row[1] || '',
            cantidad: parseInt(row[2]) || 0,
            fecha: selectedDate,
            tipo: type
          })).filter(item => item.codigo && item.cantidad > 0);
          
          resolve(processedData);
        } catch (error) {
          reject(error);
        }
      };
      reader.readAsBinaryString(file);
    });
  };

  const handleVentasUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const processedData = await processExcelFile(file, 'ventas');
      
      setData(prevData => ({
        ...prevData,
        ventasDiarias: [...prevData.ventasDiarias, ...processedData]
      }));

      event.target.value = '';
      alert(`✅ Ventas del día cargadas: ${processedData.length} registros para ${selectedDate}\n\n🔄 Sincronizando con la nube...`);
    } catch (error) {
      alert('❌ Error al procesar el archivo de ventas. Verifica el formato.');
    }
  };

  const handleStockUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const processedData = await processExcelFile(file, 'stock');
      
      setData(prevData => ({
        ...prevData,
        stockActual: processedData,
        ultimaFechaStock: selectedDate
      }));

      event.target.value = '';
      alert(`✅ Stock actualizado completamente: ${processedData.length} productos para ${selectedDate}\n\n🔄 Sincronizando con la nube...`);
    } catch (error) {
      alert('❌ Error al procesar el archivo de stock. Verifica el formato.');
    }
  };

  const handleHistoricalUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const mesDesde = document.getElementById('mes-desde').value;
    const mesHasta = document.getElementById('mes-hasta').value;

    if (!mesDesde || !mesHasta) {
      alert('⚠️ Por favor, selecciona el rango de fechas para los datos históricos');
      return;
    }

    if (data.ventasHistoricas.length > 0) {
      const confirmar = window.confirm(
        '⚠️ Ya tienes datos históricos cargados.\n\n' +
        '¿Quieres reemplazarlos con estos nuevos datos?\n' +
        'Los datos históricos solo deberían cargarse UNA VEZ.'
      );
      if (!confirmar) return;
    }

    try {
      const processedData = await processExcelFile(file, 'ventas-historicas');
      
      const startDate = new Date(mesDesde + '-01');
      const endDate = new Date(mesHasta + '-01');
      endDate.setMonth(endDate.getMonth() + 1, 0);
      
      const diffTime = Math.abs(endDate - startDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

      const historicalData = processedData.map(item => {
        const cantidadPromedioDiario = item.cantidad / diffDays;
        const registrosPorSKU = [];
        const fechasDistribuidas = [];
        
        for (let i = 0; i < Math.min(diffDays, 30); i++) {
          const fecha = new Date(startDate);
          fecha.setDate(fecha.getDate() + Math.floor((i * diffDays) / 30));
          fechasDistribuidas.push(fecha.toISOString().split('T')[0]);
        }
        
        fechasDistribuidas.forEach(fecha => {
          registrosPorSKU.push({
            codigo: item.codigo,
            descripcion: item.descripcion,
            cantidad: cantidadPromedioDiario,
            fecha: fecha,
            tipo: 'ventas-historicas'
          });
        });
        
        return registrosPorSKU;
      }).flat();

      setData(prevData => ({
        ...prevData,
        ventasHistoricas: historicalData
      }));

      event.target.value = '';
      document.getElementById('mes-desde').value = '';
      document.getElementById('mes-hasta').value = '';
      
      alert(`✅ Datos históricos procesados: ${processedData.length} SKUs distribuidos en ${diffDays} días (${mesDesde} a ${mesHasta})\n\nESTOS DATOS QUEDAN GUARDADOS PERMANENTEMENTE.\n\n🔄 Sincronizando con la nube...`);
    } catch (error) {
      alert('❌ Error al procesar el archivo histórico. Verifica el formato.');
    }
  };

  // FUNCIONES DE EXPORTACIÓN E IMPORTACIÓN
  const exportarTodosLosDatos = () => {
    const dataToExport = {
      ...data,
      fechaExportacion: new Date().toISOString(),
      version: '2.0'
    };
    
    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup-neumaticos-olmos-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    alert('✅ Backup de datos exportado correctamente');
  };

  const importarDatosBackup = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const backupData = JSON.parse(e.target.result);
        
        if (backupData.stockActual !== undefined) {
          const confirmImport = window.confirm(
            `¿Estás seguro de importar este backup?\n\n` +
            `Fecha del backup: ${new Date(backupData.fechaExportacion).toLocaleString('es-AR')}\n` +
            `Stock Actual: ${backupData.stockActual.length} productos\n` +
            `Ventas Diarias: ${backupData.ventasDiarias.length} registros\n` +
            `Ventas Históricas: ${backupData.ventasHistoricas.length} registros\n\n` +
            `Esto reemplazará todos los datos actuales y se sincronizará con Firebase.`
          );
          
          if (confirmImport) {
            setData({
              stockActual: backupData.stockActual || [],
              ventasDiarias: backupData.ventasDiarias || [],
              ventasHistoricas: backupData.ventasHistoricas || [],
              ultimaFechaStock: backupData.ultimaFechaStock || null
            });
            alert('✅ Datos importados correctamente\n\n🔄 Sincronizando con Firebase...');
          }
        } else {
          alert('❌ Archivo de backup inválido o formato antiguo');
        }
      } catch (error) {
        alert('❌ Error al leer el archivo de backup');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const limpiarTodosLosDatos = () => {
    const confirmClear = window.confirm(
      '⚠️ ¿Estás seguro de borrar TODOS los datos?\n\n' +
      'Esta acción no se puede deshacer.\n' +
      'Te recomendamos hacer un backup antes.'
    );
    
    if (confirmClear) {
      const doubleConfirm = window.confirm('¿REALMENTE quieres borrar todo? Esta es tu última oportunidad.');
      if (doubleConfirm) {
        setData({ 
          stockActual: [], 
          ventasDiarias: [], 
          ventasHistoricas: [],
          ultimaFechaStock: null 
        });
        alert('🗑️ Todos los datos han sido eliminados\n\n🔄 Sincronizando con Firebase...');
      }
    }
  };

  const exportarReporte = () => {
    const ws = XLSX.utils.json_to_sheet(alerts.map(alert => ({
      'Código': alert.codigo,
      'Descripción': alert.descripcion,
      'Stock Actual': alert.stock,
      'Días de Stock': alert.diasStock,
      'Promedio Venta Diaria': alert.promedioVenta,
      'Nivel': alert.nivel
    })));
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Análisis Stock');
    XLSX.writeFile(wb, `analisis_stock_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const getDashboardStats = () => {
    const hoy = new Date().toISOString().split('T')[0];
    const ventasHoy = data.ventasDiarias.filter(item => item.fecha === hoy);
    
    const totalVentasHoy = ventasHoy.reduce((sum, item) => sum + item.cantidad, 0);
    const totalStock = data.stockActual.reduce((sum, item) => sum + item.cantidad, 0);
    
    const alertasCriticas = alerts.filter(alert => alert.nivel === 'CRÍTICO' || alert.nivel === 'SIN STOCK').length;
    const alertasBajas = alerts.filter(alert => alert.nivel === 'BAJO').length;
    const sinStock = alerts.filter(alert => alert.nivel === 'SIN STOCK').length;
    
    const totalVentasHistoricas = data.ventasDiarias.length + data.ventasHistoricas.length;
    
    return { totalVentasHoy, totalStock, alertasCriticas, alertasBajas, totalVentasHistoricas, sinStock };
  };

  const stats = getDashboardStats();

  // RETURN JSX
  return (
    <div className="min-h-screen bg-gray-50 p-6">
    {guardando && (
  <div className="fixed top-4 right-4 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center z-50">
    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
    Sincronizando con Firebase...
  </div>
)}
      {/* NUEVO: Indicador de sincronización */}
      {guardando && (
        <div className="fixed top-4 right-4 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center z-50">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
          Sincronizando con Firebase...
        </div>
      )}

      {/* Header con botones de autenticación */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-2">
          <h1 className="text-3xl font-bold text-gray-900">Sistema de Gestión de Stock</h1>
          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded">
              {usuario?.email}
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={handleCrearUsuario}
                className="bg-purple-500 text-white px-3 py-1 rounded text-sm hover:bg-purple-600 flex items-center"
                title="Crear nuevo usuario"
              >
                <UserPlus className="w-4 h-4 mr-1" />
                Nuevo Usuario
              </button>

              <button
                onClick={exportarTodosLosDatos}
                className="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600 flex items-center"
                title="Descargar backup de todos los datos"
              >
                <Download className="w-4 h-4 mr-1" />
                Backup
              </button>
              
              <input
                type="file"
                accept=".json"
                onChange={importarDatosBackup}
                className="hidden"
                id="backup-import"
              />
              <label
                htmlFor="backup-import"
                className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600 cursor-pointer flex items-center"
                title="Importar backup de datos"
              >
                <Upload className="w-4 h-4 mr-1" />
                Restaurar
              </label>
              
              <button
                onClick={limpiarTodosLosDatos}
                className="bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600"
                title="Borrar todos los datos"
              >
                🗑️
              </button>

              <button
                onClick={handleLogout}
                className="bg-gray-700 text-white px-3 py-1 rounded text-sm hover:bg-gray-800 flex items-center"
                title="Cerrar sesión"
              >
                <LogOut className="w-4 h-4 mr-1" />
                Salir
              </button>
            </div>
          </div>
        </div>
        <p className="text-gray-600">Neumáticos Olmos - Control y Análisis de Inventario</p>
      </div>

      {/* Navigation Tabs */}
      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('upload')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'upload'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Upload className="w-4 h-4 inline mr-2" />
              Carga de Archivos
            </button>
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'dashboard'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <BarChart3 className="w-4 h-4 inline mr-2" />
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab('analysis')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'analysis'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <TrendingUp className="w-4 h-4 inline mr-2" />
              Análisis
            </button>
            <button
              onClick={() => setActiveTab('alerts')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'alerts'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <AlertTriangle className="w-4 h-4 inline mr-2" />
              Alertas de Stock ({stats.sinStock + stats.alertasCriticas + stats.alertasBajas})
            </button>
          </nav>
        </div>
      </div>

      {/* Las demás tabs siguen igual - Aquí va todo el resto del JSX original */}
      {/* Por brevedad, el resto del JSX sigue exactamente igual que tu código original */}
      {/* Upload Tab, Dashboard Tab, Analysis Tab, Alerts Tab */}
    </div>
  );
};

export default StockManagementSystem;

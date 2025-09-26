import React, { useState, useEffect } from 'react';
import { Upload, BarChart3, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Calendar, FileSpreadsheet, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { guardarDatos, obtenerDatos } from './firebase';

const StockManagementSystem = () => {
  const [data, setData] = useState({
    stockActual: [], // Stock del día actual (se reemplaza)
    ventasDiarias: [], // Ventas día a día (se acumula)
    ventasHistoricas: [], // Ventas mensuales históricas (carga una vez)
    ultimaFechaStock: null // Última fecha de actualización del stock
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

  // Cargar datos de Firebase al iniciar
  useEffect(() => {
    const cargarDatos = async () => {
      const datosGuardados = await obtenerDatos();
      if (datosGuardados) {
        // Migrar datos antiguos si es necesario
        if (datosGuardados.stock && datosGuardados.movements) {
          const nuevoFormato = {
            stockActual: datosGuardados.stock.filter(item => item.fecha === selectedDate),
            ventasDiarias: datosGuardados.movements.filter(item => item.tipo === 'ventas'),
            ventasHistoricas: datosGuardados.movements.filter(item => item.tipo === 'ventas-historicas'),
            ultimaFechaStock: selectedDate
          };
          setData(nuevoFormato);
        } else {
          setData(datosGuardados);
        }
      }
    };
    cargarDatos();
  }, []);

  // Guardar datos en Firebase cada vez que cambien
  useEffect(() => {
    if (data.stockActual.length > 0 || data.ventasDiarias.length > 0 || data.ventasHistoricas.length > 0) {
      guardarDatos(data);
    }
  }, [data]);

  // Función para procesar archivos Excel
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

  // Función para cargar archivo de VENTAS DIARIAS
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
      alert(`✅ Ventas del día cargadas: ${processedData.length} registros para ${selectedDate}`);
    } catch (error) {
      alert('❌ Error al procesar el archivo de ventas. Verifica el formato.');
    }
  };

  // Función para cargar archivo de STOCK ACTUAL (reemplaza el anterior)
  const handleStockUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const processedData = await processExcelFile(file, 'stock');
      
      setData(prevData => ({
        ...prevData,
        stockActual: processedData, // REEMPLAZA completamente el stock anterior
        ultimaFechaStock: selectedDate
      }));

      event.target.value = '';
      alert(`✅ Stock actualizado completamente: ${processedData.length} productos para ${selectedDate}`);
    } catch (error) {
      alert('❌ Error al procesar el archivo de stock. Verifica el formato.');
    }
  };

  // Función para cargar datos históricos (una sola vez)
  const handleHistoricalUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const mesDesde = document.getElementById('mes-desde').value;
    const mesHasta = document.getElementById('mes-hasta').value;

    if (!mesDesde || !mesHasta) {
      alert('⚠️ Por favor, selecciona el rango de fechas para los datos históricos');
      return;
    }

    // Verificar si ya hay datos históricos
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
        ventasHistoricas: historicalData // REEMPLAZA los datos históricos
      }));

      event.target.value = '';
      document.getElementById('mes-desde').value = '';
      document.getElementById('mes-hasta').value = '';
      
      alert(`✅ Datos históricos procesados: ${processedData.length} SKUs distribuidos en ${diffDays} días (${mesDesde} a ${mesHasta})\n\nESTOS DATOS QUEDAN GUARDADOS PERMANENTEMENTE.`);
    } catch (error) {
      alert('❌ Error al procesar el archivo histórico. Verifica el formato.');
    }
  };

  // Calcular estadísticas y alertas
  useEffect(() => {
    calculateStats();
  }, [data]);

  const calculateStats = () => {
    const stockActual = data.stockActual;
    
    // Combinar ventas diarias + históricas para el análisis
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

  // Función para aplicar filtros
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

  useEffect(() => {
    applyFilters();
  }, [filters, alerts]);

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

  // Función para exportar todos los datos
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

  // Función para importar datos desde backup
  const importarDatosBackup = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const backupData = JSON.parse(e.target.result);
        
        if (backupData.stockActual !== undefined) {
          // Formato nuevo
          const confirmImport = window.confirm(
            `¿Estás seguro de importar este backup?\n\n` +
            `Fecha del backup: ${new Date(backupData.fechaExportacion).toLocaleString('es-AR')}\n` +
            `Stock Actual: ${backupData.stockActual.length} productos\n` +
            `Ventas Diarias: ${backupData.ventasDiarias.length} registros\n` +
            `Ventas Históricas: ${backupData.ventasHistoricas.length} registros\n\n` +
            `Esto reemplazará todos los datos actuales.`
          );
          
          if (confirmImport) {
            setData({
              stockActual: backupData.stockActual || [],
              ventasDiarias: backupData.ventasDiarias || [],
              ventasHistoricas: backupData.ventasHistoricas || [],
              ultimaFechaStock: backupData.ultimaFechaStock || null
            });
            alert('✅ Datos importados correctamente');
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

  // Función para limpiar todos los datos
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
        alert('🗑️ Todos los datos han sido eliminados');
      }
    }
  };

  // Función para exportar reportes
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

  // Calcular estadísticas del dashboard
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

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-2">
          <h1 className="text-3xl font-bold text-gray-900">Sistema de Gestión de Stock</h1>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
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

      {/* Upload Tab */}
      {activeTab === 'upload' && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="w-4 h-4 inline mr-2" />
              Fecha de los datos
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Información del estado actual */}
          <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h4 className="font-medium text-blue-900 mb-2">📊 Estado Actual de los Datos</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-blue-700">Stock Actual:</p>
                <p className="font-bold text-blue-900">{data.stockActual.length} productos</p>
                {data.ultimaFechaStock && (
                  <p className="text-xs text-blue-600">Actualizado: {data.ultimaFechaStock}</p>
                )}
              </div>
              <div>
                <p className="text-blue-700">Ventas Diarias:</p>
                <p className="font-bold text-blue-900">{data.ventasDiarias.length} registros</p>
              </div>
              <div>
                <p className="text-blue-700">Datos Históricos:</p>
                <p className="font-bold text-blue-900">{data.ventasHistoricas.length} registros</p>
                <p className="text-xs text-blue-600">
                  {data.ventasHistoricas.length > 0 ? 'Ya cargados ✓' : 'Pendiente de cargar'}
                </p>
              </div>
            </div>
          </div>

          {/* Carga Diaria */}
          <div className="mb-8">
            <h3 className="text-lg font-medium text-gray-900 mb-4">📅 Carga Diaria</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-red-400 transition-colors">
                <TrendingDown className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <h4 className="text-lg font-medium text-gray-900 mb-2">Ventas del Día</h4>
                <p className="text-sm text-gray-500 mb-4">
                  Se ACUMULA día a día para el histórico
                </p>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleVentasUpload}
                  className="hidden"
                  id="ventas-upload"
                />
                <label
                  htmlFor="ventas-upload"
                  className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600 cursor-pointer inline-block"
                >
                  <FileSpreadsheet className="w-4 h-4 inline mr-2" />
                  Subir Ventas
                </label>
              </div>

              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
                <BarChart3 className="w-12 h-12 text-blue-500 mx-auto mb-4" />
                <h4 className="text-lg font-medium text-gray-900 mb-2">Stock Actual</h4>
                <p className="text-sm text-gray-500 mb-4">
                  REEMPLAZA el stock anterior completamente
                </p>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleStockUpload}
                  className="hidden"
                  id="stock-upload"
                />
                <label
                  htmlFor="stock-upload"
                  className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 cursor-pointer inline-block"
                >
                  <FileSpreadsheet className="w-4 h-4 inline mr-2" />
                  Actualizar Stock
                </label>
              </div>
            </div>
          </div>

          {/* Carga Histórica */}
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              📊 Carga de Datos Históricos 
              {data.ventasHistoricas.length > 0 && (
                <span className="ml-2 text-sm bg-green-100 text-green-800 px-2 py-1 rounded">
                  ✓ Ya cargados
                </span>
              )}
            </h3>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <Calendar className="w-6 h-6 text-yellow-600" />
                </div>
                <div className="ml-3 flex-1">
                  <h4 className="text-base font-medium text-yellow-800 mb-2">
                    Ventas Mensuales Anteriores (CARGA UNA SOLA VEZ)
                  </h4>
                  <p className="text-sm text-yellow-700 mb-4">
                    Estos datos se cargan UNA SOLA VEZ para establecer la base histórica de ventas. 
                    NO se deben recargar mensualmente. Usa el formato: CODIGO | DESCRIPCIÓN | CANTIDAD TOTAL DEL PERÍODO
                  </p>
                  
                  <div className="flex flex-wrap gap-4 items-center">
                    <div className="flex items-center space-x-2">
                      <label className="text-sm font-medium text-yellow-800">Desde:</label>
                      <input
                        type="month"
                        className="border border-yellow-300 rounded px-2 py-1 text-sm"
                        id="mes-desde"
                      />
                    </div>
                    <div className="flex items-center space-x-2">
                      <label className="text-sm font-medium text-yellow-800">Hasta:</label>
                      <input
                        type="month"
                        className="border border-yellow-300 rounded px-2 py-1 text-sm"
                        id="mes-hasta"
                      />
                    </div>
                    <div>
                      <input
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={handleHistoricalUpload}
                        className="hidden"
                        id="historical-upload"
                      />
                      <label
                        htmlFor="historical-upload"
                        className="bg-yellow-600 text-white px-4 py-2 rounded-md hover:bg-yellow-700 cursor-pointer inline-flex items-center text-sm"
                      >
                        <FileSpreadsheet className="w-4 h-4 mr-2" />
                        Cargar Históricos
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 p-4 bg-gray-50 rounded-lg">
            <div className="flex justify-between items-start mb-2">
              <h4 className="font-medium text-gray-900">Formato de archivos esperado:</h4>
            </div>
            <div className="text-sm text-gray-600 space-y-2">
              <div><strong>📈 Ventas diarias:</strong> CODIGO | DESCRIPCIÓN | CANTIDAD (se acumula cada día)</div>
              <div><strong>📦 Stock actual:</strong> CODIGO | DESCRIPCIÓN | STOCK (reemplaza el anterior)</div>
              <div><strong>📊 Ventas históricas:</strong> CODIGO | DESCRIPCIÓN | CANTIDAD TOTAL (carga una vez)</div>
              <div className="text-xs text-gray-500 mt-2">
                • Archivos Excel (.xlsx o .xls) | Primera fila = encabezados | Filas vacías se ignoran
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center">
                <TrendingDown className="w-8 h-8 text-red-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Ventas Hoy</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalVentasHoy}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center">
                <BarChart3 className="w-8 h-8 text-blue-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Stock Total</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalStock.toLocaleString()}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center">
                <AlertTriangle className="w-8 h-8 text-red-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Stock Crítico</p>
                  <p className="text-2xl font-bold text-red-600">{stats.alertasCriticas}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center">
                <TrendingDown className="w-8 h-8 text-yellow-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Stock Bajo</p>
                  <p className="text-2xl font-bold text-yellow-600">{stats.alertasBajas}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Resumen de Datos</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="font-medium text-gray-700">SKUs en Stock:</p>
                <p className="text-2xl font-bold text-blue-600">{data.stockActual.length}</p>
                {data.ultimaFechaStock && (
                  <p className="text-xs text-gray-500">Última actualización: {data.ultimaFechaStock}</p>
                )}
              </div>
              <div>
                <p className="font-medium text-gray-700">Registros de Ventas:</p>
                <p className="text-2xl font-bold text-green-600">{stats.totalVentasHistoricas}</p>
              </div>
              <div>
                <p className="font-medium text-gray-700">Período de Análisis:</p>
                <p className="text-lg font-bold text-gray-600">Últimos 90 días</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Analysis Tab */}
      {activeTab === 'analysis' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-6">Análisis y Tendencias</h3>
            
            {/* Análisis rápido */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">Más Vendidos (30 días)</h4>
                <div className="space-y-2">
                  {[...data.ventasDiarias, ...data.ventasHistoricas]
                    .filter(item => {
                      const fechaItem = new Date(item.fecha);
                      const hace30Dias = new Date();
                      hace30Dias.setDate(hace30Dias.getDate() - 30);
                      return fechaItem >= hace30Dias;
                    })
                    .reduce((acc, item) => {
                      if (!acc[item.codigo]) {
                        acc[item.codigo] = { codigo: item.codigo, descripcion: item.descripcion, total: 0 };
                      }
                      acc[item.codigo].total += item.cantidad;
                      return acc;
                    }, {})
                    && Object.values([...data.ventasDiarias, ...data.ventasHistoricas]
                    .filter(item => {
                      const fechaItem = new Date(item.fecha);
                      const hace30Dias = new Date();
                      hace30Dias.setDate(hace30Dias.getDate() - 30);
                      return fechaItem >= hace30Dias;
                    })
                    .reduce((acc, item) => {
                      if (!acc[item.codigo]) {
                        acc[item.codigo] = { codigo: item.codigo, descripcion: item.descripcion, total: 0 };
                      }
                      acc[item.codigo].total += item.cantidad;
                      return acc;
                    }, {}))
                    .sort((a, b) => b.total - a.total)
                    .slice(0, 5)
                    .map((item, index) => (
                      <div key={index} className="bg-white rounded p-2 shadow-sm">
                        <div className="flex justify-between items-start">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-blue-900 truncate">{item.codigo}</p>
                            <p className="text-xs text-blue-700 truncate" title={item.descripcion}>
                              {item.descripcion}
                            </p>
                          </div>
                          <span className="ml-2 font-bold text-blue-900 text-sm">{Math.round(item.total)}</span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              <div className="bg-red-50 p-4 rounded-lg">
                <h4 className="font-medium text-red-900 mb-2">Sin Movimiento (30 días)</h4>
                <div className="space-y-2">
                  {data.stockActual
                    .filter(stockItem => {
                      const tieneMovimiento = [...data.ventasDiarias, ...data.ventasHistoricas].some(movement => {
                        const fechaItem = new Date(movement.fecha);
                        const hace30Dias = new Date();
                        hace30Dias.setDate(hace30Dias.getDate() - 30);
                        return movement.codigo === stockItem.codigo && fechaItem >= hace30Dias;
                      });
                      return !tieneMovimiento;
                    })
                    .slice(0, 5)
                    .map((item, index) => (
                      <div key={index} className="bg-white rounded p-2 shadow-sm">
                        <div className="flex justify-between items-start">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-red-900 truncate">{item.codigo}</p>
                            <p className="text-xs text-red-700 truncate" title={item.descripcion}>
                              {item.descripcion}
                            </p>
                          </div>
                          <span className="ml-2 font-bold text-red-900 text-sm">{item.cantidad}</span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              <div className="bg-green-50 p-4 rounded-lg">
                <h4 className="font-medium text-green-900 mb-2">Resumen Stock</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-red-700">Crítico</span>
                    <span className="font-medium">{alerts.filter(a => a.nivel === 'CRÍTICO').length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-yellow-700">Bajo</span>
                    <span className="font-medium">{alerts.filter(a => a.nivel === 'BAJO').length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-green-700">Óptimo</span>
                    <span className="font-medium">{alerts.filter(a => a.nivel === 'ÓPTIMO').length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-700">Sobreestock</span>
                    <span className="font-medium">{alerts.filter(a => a.nivel === 'SOBREESTOCK').length}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Métricas de rendimiento */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-4">Métricas de Rendimiento</h4>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600">
                    {((alerts.filter(a => a.nivel === 'ÓPTIMO').length / Math.max(alerts.length, 1)) * 100).toFixed(1)}%
                  </p>
                  <p className="text-gray-600">Stock Óptimo</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">
                    {Math.round([...data.ventasDiarias, ...data.ventasHistoricas]
                      .reduce((sum, item) => sum + item.cantidad, 0) / Math.max(new Set([...data.ventasDiarias, ...data.ventasHistoricas].map(m => m.fecha)).size, 1))}
                  </p>
                  <p className="text-gray-600">Promedio Ventas/Día</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-purple-600">
                    {new Set([...data.ventasDiarias, ...data.ventasHistoricas]
                      .filter(item => {
                        const fechaItem = new Date(item.fecha);
                        const hace30Dias = new Date();
                        hace30Dias.setDate(hace30Dias.getDate() - 30);
                        return fechaItem >= hace30Dias;
                      })
                      .map(m => m.codigo)).size}
                  </p>
                  <p className="text-gray-600">SKUs Activos (30d)</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-orange-600">
                    {alerts.length > 0 ? Math.round(alerts.reduce((sum, a) => sum + a.diasStock, 0) / alerts.length) : 0}
                  </p>
                  <p className="text-gray-600">Días Stock Promedio</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Alerts Tab */}
      {activeTab === 'alerts' && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex flex-col space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900">Análisis de Stock por SKU</h3>
                <button
                  onClick={exportarReporte}
                  className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 flex items-center"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Exportar Excel
                </button>
              </div>
              
              {/* Filtros */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Nivel de Stock</label>
                    <select
                      value={filters.nivel}
                      onChange={(e) => setFilters({...filters, nivel: e.target.value})}
                      className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                    >
                      <option value="all">Todos</option>
                      <option value="SIN STOCK">Sin Stock</option>
                      <option value="CRÍTICO">Crítico</option>
                      <option value="BAJO">Bajo</option>
                      <option value="ÓPTIMO">Óptimo</option>
                      <option value="SOBREESTOCK">Sobreestock</option>
                      <option value="SIN MOVIMIENTO">Sin Movimiento</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Días Stock (Min)</label>
                    <input
                      type="number"
                      value={filters.diasStockMin}
                      onChange={(e) => setFilters({...filters, diasStockMin: e.target.value})}
                      placeholder="0"
                      className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Días Stock (Max)</label>
                    <input
                      type="number"
                      value={filters.diasStockMax}
                      onChange={(e) => setFilters({...filters, diasStockMax: e.target.value})}
                      placeholder="999"
                      className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Venta Min/día</label>
                    <input
                      type="number"
                      step="0.1"
                      value={filters.ventaMin}
                      onChange={(e) => setFilters({...filters, ventaMin: e.target.value})}
                      placeholder="0"
                      className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Venta Max/día</label>
                    <input
                      type="number"
                      step="0.1"
                      value={filters.ventaMax}
                      onChange={(e) => setFilters({...filters, ventaMax: e.target.value})}
                      placeholder="999"
                      className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Buscar</label>
                    <input
                      type="text"
                      value={filters.search}
                      onChange={(e) => setFilters({...filters, search: e.target.value})}
                      placeholder="Código o descripción"
                      className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                    />
                  </div>
                </div>
                
                <div className="flex justify-between items-center mt-4">
                  <div className="text-sm text-gray-600">
                    Mostrando {filteredAlerts.length} de {alerts.length} productos
                  </div>
                  <button
                    onClick={resetFilters}
                    className="text-sm text-blue-600 hover:text-blue-800 underline"
                  >
                    Limpiar filtros
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Código
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Descripción
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Stock
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Días de Stock
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Promedio Venta
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredAlerts.map((alert, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${alert.color}`}>
                        <span className="mr-1">{alert.icono}</span>
                        <span>{alert.nivel}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {alert.codigo}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                      {alert.descripcion}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {alert.stock}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {alert.diasStock} días
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {alert.promedioVenta}/día
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {filteredAlerts.length === 0 && (
              <div className="text-center py-12">
                <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">
                  {alerts.length === 0 
                    ? "No hay datos suficientes para generar alertas." 
                    : "No se encontraron productos con los filtros aplicados."
                  }
                </p>
                <p className="text-sm text-gray-400 mt-2">
                  {alerts.length === 0 
                    ? "Carga archivos de stock y movimientos para ver el análisis."
                    : "Intenta ajustar los criterios de filtrado."
                  }
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default StockManagementSystem;

import React, { useState, useEffect } from 'react';
import { Upload, BarChart3, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Calendar, FileSpreadsheet, Download } from 'lucide-react';
import * as XLSX from 'xlsx';

const StockManagementSystem = () => {
  const [data, setData] = useState({
    stock: [],
    movements: [],
    dailyStats: []
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

  useEffect(() => {
    const savedData = localStorage.getItem('neumaticos-olmos-data');
    if (savedData) {
      try {
        const parsedData = JSON.parse(savedData);
        setData(parsedData);
      } catch (error) {
        console.error('Error cargando datos guardados:', error);
      }
    }
  }, []);

  useEffect(() => {
    if (data.stock.length > 0 || data.movements.length > 0) {
      try {
        localStorage.setItem('neumaticos-olmos-data', JSON.stringify(data));
      } catch (error) {
        console.error('Error guardando datos:', error);
      }
    }
  }, [data]);

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

  const handleFileUpload = async (event, type) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const processedData = await processExcelFile(file, type);
      
      setData(prevData => {
        const newData = { ...prevData };
        
        if (type === 'stock') {
          newData.stock = newData.stock.filter(item => item.fecha !== selectedDate);
          newData.stock = [...newData.stock, ...processedData];
        } else {
          newData.movements = [...newData.movements, ...processedData];
        }
        
        return newData;
      });

      event.target.value = '';
      alert(`✅ Archivo ${type} cargado correctamente: ${processedData.length} registros`);
    } catch (error) {
      alert('❌ Error al procesar el archivo. Verifica el formato.');
    }
  };

  const exportarTodosLosDatos = () => {
    const dataToExport = {
      ...data,
      fechaExportacion: new Date().toISOString(),
      version: '1.0'
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

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mb-8">
        <div className="flex justify-between items-center mb-2">
          <h1 className="text-3xl font-bold text-gray-900">Sistema de Gestión de Stock</h1>
          <button
            onClick={exportarTodosLosDatos}
            className="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600 flex items-center"
          >
            <Download className="w-4 h-4 mr-1" />
            Backup
          </button>
        </div>
        <p className="text-gray-600">Neumáticos Olmos - Control y Análisis de Inventario</p>
      </div>

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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-red-400 transition-colors">
            <TrendingDown className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h4 className="text-lg font-medium text-gray-900 mb-2">Ventas del Día</h4>
            <p className="text-sm text-gray-500 mb-4">Archivo de ventas diarias</p>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => handleFileUpload(e, 'ventas')}
              className="hidden"
              id="ventas-upload"
            />
            <label
              htmlFor="ventas-upload"
              className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600 cursor-pointer inline-block"
            >
              <FileSpreadsheet className="w-4 h-4 inline mr-2" />
              Subir Excel
            </label>
          </div>

          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
            <BarChart3 className="w-12 h-12 text-blue-500 mx-auto mb-4" />
            <h4 className="text-lg font-medium text-gray-900 mb-2">Stock del Día</h4>
            <p className="text-sm text-gray-500 mb-4">Archivo de inventario actual</p>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => handleFileUpload(e, 'stock')}
              className="hidden"
              id="stock-upload"
            />
            <label
              htmlFor="stock-upload"
              className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 cursor-pointer inline-block"
            >
              <FileSpreadsheet className="w-4 h-4 inline mr-2" />
              Subir Excel
            </label>
          </div>
        </div>

        <div className="mt-8 p-4 bg-gray-50 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-2">Formato de archivos esperado:</h4>
          <div className="text-sm text-gray-600 space-y-1">
            <div>• <strong>Ventas diarias:</strong> CODIGO | DESCRIPCIÓN | CANTIDAD</div>
            <div>• <strong>Stock:</strong> CODIGO | DESCRIPCIÓN | STOCK</div>
            <div>• Archivos Excel (.xlsx o .xls)</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StockManagementSystem;

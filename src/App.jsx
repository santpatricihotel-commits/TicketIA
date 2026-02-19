import React, { useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera, Upload, FileText, BarChart3, Download,
  Check, Plus, Search, Filter, Trash2,
  Home, List, CheckCircle2, Circle, FileSpreadsheet,
  Eye, X
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, PieChart as RePieChart, Pie, Cell,
  AreaChart, Area, CartesianGrid
} from 'recharts';
import Tesseract from 'tesseract.js';
 
const CATEGORIES = [
  { id: 'food', name: 'Comida', emoji: '🍽️', color: '#f97316' },
  { id: 'transport', name: 'Transporte', emoji: '🚗', color: '#3b82f6' },
  { id: 'accommodation', name: 'Alojamiento', emoji: '🏠', color: '#8b5cf6' },
  { id: 'office', name: 'Oficina', emoji: '💼', color: '#6366f1' },
  { id: 'tech', name: 'Tecnologia', emoji: '📱', color: '#06b6d4' },
  { id: 'health', name: 'Salud', emoji: '🏥', color: '#ef4444' },
  { id: 'travel', name: 'Viajes', emoji: '✈️', color: '#14b8a6' },
  { id: 'shopping', name: 'Compras', emoji: '🛍️', color: '#ec4899' },
  { id: 'services', name: 'Servicios', emoji: '⚡', color: '#84cc16' },
  { id: 'other', name: 'Otros', emoji: '📄', color: '#6b7280' },
];

const sampleData = [
  { vendor: 'Restaurante El Buen Sabor', amount: 45.80, date: '2026-02-15', category: 'food', desc: 'Comida de negocios', tax: 9.62, paid: true },
  { vendor: 'Repsol Gasolinera', amount: 65.00, date: '2026-02-14', category: 'transport', desc: 'Combustible', tax: 13.65, paid: true },
  { vendor: 'Amazon Business', amount: 129.99, date: '2026-02-12', category: 'office', desc: 'Material de oficina', tax: 27.30, paid: false },
  { vendor: 'Movistar', amount: 49.90, date: '2026-02-10', category: 'services', desc: 'Factura mensual internet', tax: 10.48, paid: true },
  { vendor: 'Hotel NH Madrid', amount: 185.00, date: '2026-02-08', category: 'accommodation', desc: 'Estancia 1 noche Madrid', tax: 38.85, paid: true },
  { vendor: 'Uber', amount: 12.50, date: '2026-02-08', category: 'transport', desc: 'Trayecto aeropuerto-hotel', tax: 2.63, paid: true },
  { vendor: 'Mercadona', amount: 78.35, date: '2026-02-06', category: 'food', desc: 'Compra semanal', tax: 7.84, paid: true },
  { vendor: 'MediaMarkt', amount: 299.00, date: '2026-02-04', category: 'tech', desc: 'Teclado y raton inalambricos', tax: 62.79, paid: false },
  { vendor: 'Farmacia Cruz', amount: 15.60, date: '2026-02-03', category: 'health', desc: 'Medicamentos', tax: 1.56, paid: true },
  { vendor: 'Endesa', amount: 95.40, date: '2026-02-01', category: 'services', desc: 'Factura electrica febrero', tax: 20.03, paid: false },
  { vendor: 'Vueling', amount: 156.00, date: '2026-01-28', category: 'travel', desc: 'Vuelo BCN-MAD', tax: 32.76, paid: true },
  { vendor: 'Zara', amount: 89.90, date: '2026-01-25', category: 'shopping', desc: 'Ropa de trabajo', tax: 18.88, paid: true },
  { vendor: 'Bar La Tasca', amount: 32.50, date: '2026-01-22', category: 'food', desc: 'Cena con equipo', tax: 6.83, paid: true },
  { vendor: 'Renfe', amount: 45.00, date: '2026-01-20', category: 'transport', desc: 'AVE Madrid-Barcelona', tax: 9.45, paid: true },
  { vendor: 'Naturgy', amount: 68.20, date: '2026-01-15', category: 'services', desc: 'Factura gas enero', tax: 14.32, paid: true },
  { vendor: 'FNAC', amount: 24.95, date: '2026-01-10', category: 'tech', desc: 'Funda tablet', tax: 5.24, paid: true },
  { vendor: 'Carrefour', amount: 92.15, date: '2026-01-08', category: 'food', desc: 'Compra quincenal', tax: 9.22, paid: true },
  { vendor: 'Clinica Dental', amount: 120.00, date: '2026-01-05', category: 'health', desc: 'Revision dental', tax: 0, paid: false },
];

const initReceipts = sampleData.map((item, i) => ({
  id: i + 1,
  vendor: item.vendor,
  amount: item.amount,
  date: item.date,
  category: item.category,
  description: item.desc,
  invoiceNumber: 'F-2026-' + String(234 + i).padStart(4, '0'),
  taxAmount: item.tax,
  paid: item.paid,
  fileType: i % 3 === 0 ? 'pdf' : 'jpg',
  imageData: null,
}));

const getCat = (id) => CATEGORIES.find(c => c.id === id) || CATEGORIES[9];
const fmt = (n) => n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + ' \u20AC';

/* ===== NUEVO: Parser OCR - Lee texto real de la imagen ===== */
function parseOCRText(text) {
  var lines = text.split('\n').map(function(l) { return l.trim(); }).filter(function(l) { return l.length > 0; });
  var result = {
    vendor: '',
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    category: 'other',
    description: '',
    invoiceNumber: '',
    taxAmount: 0,
  };

  // Buscar importes
  var amounts = [];
  var patterns = [
    /(\d{1,6}[.,]\d{2})\s*€/g,
    /€\s*(\d{1,6}[.,]\d{2})/g,
    /total[:\s]+(\d{1,6}[.,]\d{2})/gi,
    /importe[:\s]+(\d{1,6}[.,]\d{2})/gi,
    /(\d{1,6}[.,]\d{2})\s*EUR/gi,
    /TOTAL\s+(\d{1,6}[.,]\d{2})/g,
    /(\d{1,6}[.,]\d{2})\s*$/gm,
  ];
  patterns.forEach(function(p) {
    var m;
    while ((m = p.exec(text)) !== null) {
      var v = parseFloat((m[1] || m[2] || '0').replace(',', '.'));
      if (v > 0.5 && v < 99999) amounts.push(v);
    }
  });
  if (amounts.length > 0) {
    result.amount = Math.max.apply(null, amounts);
    result.taxAmount = parseFloat((result.amount * 0.21 / 1.21).toFixed(2));
  }

  // Buscar IVA especifico
  var ivaMatch = text.match(/(?:iva|i\.v\.a)[:\s]+(\d{1,6}[.,]\d{2})/i);
  if (ivaMatch) {
    result.taxAmount = parseFloat(ivaMatch[1].replace(',', '.'));
  }

  // Buscar fecha
  var dateMatch = text.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (dateMatch) {
    var d = parseInt(dateMatch[1]);
    var mo = parseInt(dateMatch[2]);
    var y = parseInt(dateMatch[3]);
    if (y < 100) y += 2000;
    if (mo > 12) { var tmp = d; d = mo; mo = tmp; }
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
      result.date = y + '-' + String(mo).padStart(2, '0') + '-' + String(d).padStart(2, '0');
    }
  }

  // Buscar numero de factura
  var invMatch = text.match(/(?:factura|fra|ticket|n[ºo°]|num)[:\s#]*([A-Z0-9][\w\-\/]{2,})/i);
  if (!invMatch) invMatch = text.match(/([A-Z]{1,3}[\-\/]\d{3,})/);
  result.invoiceNumber = invMatch ? invMatch[1].trim() : ('T-' + Date.now().toString().slice(-6));

  // Buscar proveedor (primera linea con texto significativo)
  for (var i = 0; i < Math.min(lines.length, 8); i++) {
    var clean = lines[i].replace(/[^a-zA-ZáéíóúñÁÉÍÓÚÑ\s]/g, '').trim();
    if (clean.length > 3 && clean.length < 50) {
      result.vendor = clean;
      break;
    }
  }
  if (!result.vendor) result.vendor = 'Proveedor no detectado';

  // Auto-categorizar por palabras clave
  var lt = text.toLowerCase();
  var kwMap = {
    food: ['restaurante','bar ','cafeteria','mercadona','carrefour','supermercado','alimentacion','comida','menu del dia','cafe','lidl','dia','aldi','burger','pizza','kebab'],
    transport: ['gasolinera','repsol','bp','cepsa','uber','cabify','taxi','combustible','gasolina','diesel','parking','aparcamiento','shell'],
    accommodation: ['hotel','hostal','alojamiento','airbnb','booking','habitacion','pension'],
    office: ['oficina','papeleria','material','amazon','staples'],
    tech: ['mediamarkt','fnac','apple','samsung','pc componentes','electronica','informatica','movil','portatil'],
    health: ['farmacia','clinica','dental','optica','medico','salud','hospital','parafarmacia'],
    travel: ['vueling','iberia','ryanair','renfe','vuelo','billete','avion','tren','autobus'],
    shopping: ['zara','primark','corte ingles','mango','h&m','ropa','tienda','boutique'],
    services: ['movistar','vodafone','orange','endesa','naturgy','iberdrola','telefon','internet','luz','gas','agua','seguro'],
  };
  var catKeys = Object.keys(kwMap);
  for (var ci = 0; ci < catKeys.length; ci++) {
    var cat = catKeys[ci];
    var kws = kwMap[cat];
    for (var ki = 0; ki < kws.length; ki++) {
      if (lt.indexOf(kws[ki]) !== -1) {
        result.category = cat;
        ci = catKeys.length; // break outer
        break;
      }
    }
  }

  result.description = result.vendor !== 'Proveedor no detectado'
    ? result.vendor
    : 'Factura de ' + getCat(result.category).name;

  return result;
}

export default function App() {
  var _s = useState('dashboard'); var view = _s[0]; var setView = _s[1];
  var _r = useState(initReceipts); var receipts = _r[0]; var setReceipts = _r[1];
  var _sr = useState(null); var selectedReceipt = _sr[0]; var setSelectedReceipt = _sr[1];
  var _sc = useState(false); var isScanning = _sc[0]; var setIsScanning = _sc[1];
  var _sp = useState(0); var scanProgress = _sp[0]; var setScanProgress = _sp[1];
  var _ef = useState(null); var editForm = _ef[0]; var setEditForm = _ef[1];
  var _sq = useState(''); var searchQuery = _sq[0]; var setSearchQuery = _sq[1];
  var _fc = useState('all'); var filterCategory = _fc[0]; var setFilterCategory = _fc[1];
  var _fp = useState('all'); var filterPaid = _fp[0]; var setFilterPaid = _fp[1];
  var _sf = useState(false); var showFilters = _sf[0]; var setShowFilters = _sf[1];
  var _n = useState(null); var notification = _n[0]; var setNotification = _n[1];
  var _ni = useState(20); var nextId = _ni[0]; var setNextId = _ni[1];
  var _ip = useState(null); var showImagePreview = _ip[0]; var setShowImagePreview = _ip[1];
  var _st = useState(''); var scanStatus = _st[0]; var setScanStatus = _st[1];

  var fileInputRef = useRef(null);
  var cameraInputRef = useRef(null);

  var showNotif = function(msg) {
    setNotification(msg);
    setTimeout(function() { setNotification(null); }, 3000);
  };

  /* ===== NUEVO: Escaneo REAL con Tesseract.js OCR ===== */
  var realAIScan = function(imageData, fileName, fileType) {
    setIsScanning(true);
    setScanProgress(0);
    setScanStatus('Iniciando OCR...');

    Tesseract.recognize(imageData, 'spa+eng', {
      logger: function(m) {
        if (m.status === 'recognizing text') {
          setScanProgress(20 + m.progress * 70);
          setScanStatus('Leyendo texto...');
        } else if (m.status === 'loading language traineddata') {
          setScanProgress(5 + m.progress * 15);
          setScanStatus('Cargando idioma (solo la primera vez)...');
        } else if (m.status === 'initializing api') {
          setScanProgress(3);
          setScanStatus('Preparando motor OCR...');
        }
      },
    }).then(function(result) {
      setScanProgress(95);
      setScanStatus('Analizando datos...');
      var ocrText = (result && result.data && result.data.text) || '';
      var parsed = parseOCRText(ocrText);
      setScanProgress(100);
      setScanStatus('Completado!');

      setTimeout(function() {
        setEditForm(Object.assign({}, parsed, {
          paid: false,
          fileType: fileType || 'jpg',
          fileName: fileName,
          imageData: imageData,
          ocrText: ocrText,
        }));
        setIsScanning(false);
        setScanProgress(0);
        setScanStatus('');
        if (ocrText.length < 10) {
          showNotif('Poco texto detectado. Revisa los datos.');
        } else {
          showNotif('Texto detectado! Revisa los datos.');
        }
      }, 600);

    }).catch(function(err) {
      console.error('OCR Error:', err);
      setEditForm({
        vendor: '', amount: 0,
        date: new Date().toISOString().split('T')[0],
        category: 'other', description: '', invoiceNumber: 'T-' + Date.now().toString().slice(-6),
        taxAmount: 0, paid: false,
        fileType: fileType || 'jpg', fileName: fileName,
        imageData: imageData, ocrText: '',
      });
      setIsScanning(false);
      setScanProgress(0);
      setScanStatus('');
      showNotif('Error al leer. Introduce datos manualmente.');
    });
  };

  /* ===== NUEVO: Lee la imagen como base64 antes de escanear ===== */
  var handleFileUpload = function(e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(ev) {
      var dataUrl = ev.target.result;
      var isPDF = file.type === 'application/pdf' || file.name.toLowerCase().indexOf('.pdf') !== -1;
      if (isPDF) {
        setEditForm({
          vendor: '', amount: 0,
          date: new Date().toISOString().split('T')[0],
          category: 'other', description: '', invoiceNumber: 'T-' + Date.now().toString().slice(-6),
          taxAmount: 0, paid: false, fileType: 'pdf',
          fileName: file.name, imageData: dataUrl, ocrText: '',
        });
        showNotif('PDF adjuntado. Introduce los datos.');
      } else {
        realAIScan(dataUrl, file.name, 'jpg');
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  var saveReceipt = function() {
    if (!editForm) return;
    var newReceipt = Object.assign({}, editForm, { id: nextId });
    setReceipts(function(prev) { return [newReceipt].concat(prev); });
    setNextId(function(p) { return p + 1; });
    setEditForm(null);
    setView('receipts');
    showNotif('Factura guardada con imagen');
  };

  var togglePaid = function(id) {
    setReceipts(function(prev) {
      return prev.map(function(r) { return r.id === id ? Object.assign({}, r, { paid: !r.paid }) : r; });
    });
    if (selectedReceipt && selectedReceipt.id === id) {
      setSelectedReceipt(function(prev) { return prev ? Object.assign({}, prev, { paid: !prev.paid }) : null; });
    }
  };

  var deleteReceipt = function(id) {
    setReceipts(function(prev) { return prev.filter(function(r) { return r.id !== id; }); });
    setSelectedReceipt(null);
    showNotif('Factura eliminada');
  };

  var filteredReceipts = useMemo(function() {
    return receipts.filter(function(r) {
      var ms = !searchQuery || r.vendor.toLowerCase().indexOf(searchQuery.toLowerCase()) !== -1 ||
        r.description.toLowerCase().indexOf(searchQuery.toLowerCase()) !== -1 ||
        r.invoiceNumber.toLowerCase().indexOf(searchQuery.toLowerCase()) !== -1;
      var mc = filterCategory === 'all' || r.category === filterCategory;
      var mp = filterPaid === 'all' || (filterPaid === 'paid' && r.paid) || (filterPaid === 'unpaid' && !r.paid);
      return ms && mc && mp;
    });
  }, [receipts, searchQuery, filterCategory, filterPaid]);

  var stats = useMemo(function() {
    var total = receipts.reduce(function(s, r) { return s + r.amount; }, 0);
    var totalTax = receipts.reduce(function(s, r) { return s + r.taxAmount; }, 0);
    var unpaid = receipts.filter(function(r) { return !r.paid; });
    var unpaidTotal = unpaid.reduce(function(s, r) { return s + r.amount; }, 0);
    var categoryTotals = CATEGORIES.map(function(cat) {
      var cr = receipts.filter(function(r) { return r.category === cat.id; });
      return Object.assign({}, cat, { total: cr.reduce(function(s, r) { return s + r.amount; }, 0), count: cr.length });
    }).filter(function(c) { return c.count > 0; }).sort(function(a, b) { return b.total - a.total; });
    var md = {};
    receipts.forEach(function(r) {
      var m = r.date.substring(0, 7);
      md[m] = (md[m] || 0) + r.amount;
    });
    var monthlyChart = Object.entries(md)
      .sort(function(a, b) { return a[0].localeCompare(b[0]); })
      .map(function(entry) {
        return {
          name: new Date(entry[0] + '-01').toLocaleDateString('es-ES', { month: 'short', year: '2-digit' }),
          total: parseFloat(entry[1].toFixed(2)),
        };
      });
    return { total: total, totalTax: totalTax, unpaidCount: unpaid.length, unpaidTotal: unpaidTotal, categoryTotals: categoryTotals, monthlyChart: monthlyChart };
  }, [receipts]);

  var exportCSV = function() {
    try {
      var h = ['Fecha', 'Proveedor', 'No Factura', 'Descripcion', 'Categoria', 'Importe', 'IVA', 'Pagada'];
      var rows = filteredReceipts.map(function(r) {
        return [r.date, r.vendor, r.invoiceNumber, r.description, getCat(r.category).name, r.amount.toFixed(2), r.taxAmount.toFixed(2), r.paid ? 'Si' : 'No'];
      });
      var csv = [h].concat(rows).map(function(row) { return row.map(function(c) { return '"' + c + '"'; }).join(','); }).join('\n');
      var blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'facturas_' + new Date().toISOString().split('T')[0] + '.csv';
      a.click();
      showNotif('Excel/CSV exportado');
    } catch (err) { showNotif('Error al exportar'); }
  };

  var exportPDF = function() {
    var ta = filteredReceipts.reduce(function(s, r) { return s + r.amount; }, 0);
    var tt = filteredReceipts.reduce(function(s, r) { return s + r.taxAmount; }, 0);
    var tableRows = filteredReceipts.map(function(r) {
      return '<tr><td>' + r.date + '</td><td>' + r.vendor + '</td><td>' + r.invoiceNumber + '</td>' +
        '<td>' + getCat(r.category).emoji + ' ' + getCat(r.category).name + '</td><td>' + r.amount.toFixed(2) + ' EUR</td>' +
        '<td>' + r.taxAmount.toFixed(2) + ' EUR</td><td class="' + (r.paid ? 'g' : 'r') + '">' + (r.paid ? 'Pagada' : 'Pendiente') + '</td></tr>';
    }).join('');
    var html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Informe - TicketAI</title>' +
      '<style>body{font-family:Arial,sans-serif;padding:40px;color:#333}h1{color:#4f46e5;border-bottom:2px solid #4f46e5;padding-bottom:10px}' +
      'table{width:100%;border-collapse:collapse;margin:20px 0}th{background:#4f46e5;color:#fff;padding:10px;text-align:left;font-size:13px}' +
      'td{padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:13px}tr:nth-child(even){background:#f9fafb}' +
      '.tot{font-weight:700;background:#eef2ff!important}.g{color:#16a34a}.r{color:#dc2626}' +
      '.cards{display:flex;gap:20px;margin:20px 0;flex-wrap:wrap}.card{background:#f3f4f6;padding:15px 25px;border-radius:8px;min-width:150px}' +
      '.card h3{margin:0;color:#6b7280;font-size:13px}.card p{margin:5px 0 0;font-size:22px;font-weight:700;color:#4f46e5}' +
      '@media print{body{padding:20px}}</style></head><body>' +
      '<h1>TicketAI - Informe de Gastos</h1>' +
      '<p style="color:#6b7280">Generado: ' + new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) + '</p>' +
      '<div class="cards"><div class="card"><h3>Total Gastos</h3><p>' + ta.toFixed(2) + ' EUR</p></div>' +
      '<div class="card"><h3>IVA Total</h3><p>' + tt.toFixed(2) + ' EUR</p></div>' +
      '<div class="card"><h3>Base Imponible</h3><p>' + (ta - tt).toFixed(2) + ' EUR</p></div>' +
      '<div class="card"><h3>Facturas</h3><p>' + filteredReceipts.length + '</p></div></div>' +
      '<table><tr><th>Fecha</th><th>Proveedor</th><th>No Factura</th><th>Categoria</th><th>Importe</th><th>IVA</th><th>Estado</th></tr>' +
      tableRows +
      '<tr class="tot"><td colspan="4">TOTAL</td><td>' + ta.toFixed(2) + ' EUR</td><td>' + tt.toFixed(2) + ' EUR</td><td></td></tr></table>' +
      '<p style="color:#9ca3af;font-size:12px;margin-top:30px">Generado con TicketAI</p>' +
      '<script>window.print();<\/script></body></html>';
    try {
      var w = window.open('', '_blank');
      if (w) { w.document.write(html); w.document.close(); }
      showNotif('PDF listo para imprimir');
    } catch (err) { showNotif('Permite pop-ups para exportar PDF'); }
  };

  var navTo = function(v) {
    setView(v);
    if (v === 'receipts') setSelectedReceipt(null);
    if (v === 'upload') { setEditForm(null); setIsScanning(false); setScanStatus(''); }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-lg mx-auto relative overflow-hidden">

      {/* NUEVO: Modal imagen ampliada */}
      <AnimatePresence>
        {showImagePreview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4"
            onClick={function() { setShowImagePreview(null); }}
          >
            <button className="absolute top-4 right-4 text-white bg-white/20 rounded-full p-2 z-10">
              <X size={24} />
            </button>
            <img src={showImagePreview} alt="Ampliada" className="max-w-full max-h-full object-contain rounded-lg" />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -40 }}
            className="fixed top-4 left-0 right-0 z-50 flex justify-center pointer-events-none"
          >
            <div className="bg-gray-900 text-white px-5 py-2.5 rounded-xl shadow-xl text-sm font-medium pointer-events-auto">
              {notification}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-5 pt-5 pb-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight">TicketAI</h1>
            <p className="text-indigo-200 text-xs mt-0.5">Gestion inteligente de facturas</p>
          </div>
          <button onClick={function() { navTo('upload'); }} className="bg-white text-indigo-600 rounded-full p-2.5 shadow-lg active:scale-95 transition-transform">
            <Plus size={18} strokeWidth={3} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-24">
        <AnimatePresence mode="wait">

          {view === 'dashboard' && (
            <motion.div key="dash" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="px-4 py-4">
              <div className="grid grid-cols-2 gap-3 mb-5">
                {[
                  { label: 'Total Gastos', val: fmt(stats.total), sub: receipts.length + ' facturas', color: 'text-gray-900' },
                  { label: 'IVA Soportado', val: fmt(stats.totalTax), sub: 'Deducible', color: 'text-indigo-600' },
                  { label: 'Pendientes', val: String(stats.unpaidCount), sub: fmt(stats.unpaidTotal), color: 'text-amber-500' },
                ].map(function(c, i) {
                  return (
                    <motion.div key={i} whileTap={{ scale: 0.97 }} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                      <p className="text-xs text-gray-500 font-medium">{c.label}</p>
                      <p className={'text-lg font-bold mt-1 ' + c.color}>{c.val}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{c.sub}</p>
                    </motion.div>
                  );
                })}
                <motion.div whileTap={{ scale: 0.97 }} onClick={function() { navTo('upload'); }} className="bg-indigo-50 rounded-2xl p-4 shadow-sm border border-indigo-100 cursor-pointer">
                  <p className="text-xs text-indigo-500 font-medium">Escanear</p>
                  <Camera size={22} className="text-indigo-500 mt-1.5" />
                  <p className="text-xs text-indigo-400 mt-1">+ Nueva factura</p>
                </motion.div>
              </div>

              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Gastos por Categoria</h3>
                {stats.categoryTotals.slice(0, 6).map(function(cat, i) {
                  return (
                    <div key={cat.id} className="flex items-center mb-2.5 last:mb-0">
                      <span className="text-base mr-2 w-6 text-center">{cat.emoji}</span>
                      <div className="flex-1">
                        <div className="flex justify-between items-center mb-0.5">
                          <span className="text-xs font-medium text-gray-600">{cat.name}</span>
                          <span className="text-xs font-bold text-gray-800">{fmt(cat.total)}</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <motion.div initial={{ width: 0 }} animate={{ width: Math.max((cat.total / stats.total) * 100, 2) + '%' }} transition={{ duration: 0.8, delay: i * 0.08 }} className="h-full rounded-full" style={{ backgroundColor: cat.color }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {stats.monthlyChart.length > 0 && (
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-5">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Tendencia Mensual</h3>
                  <ResponsiveContainer width="100%" height={150}>
                    <AreaChart data={stats.monthlyChart}>
                      <defs><linearGradient id="colorGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} /><stop offset="95%" stopColor="#6366f1" stopOpacity={0} /></linearGradient></defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                      <YAxis tick={{ fontSize: 10 }} stroke="#9ca3af" width={45} />
                      <Tooltip formatter={function(v) { return [v + ' EUR', 'Total']; }} />
                      <Area type="monotone" dataKey="total" stroke="#6366f1" fill="url(#colorGrad)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}

              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-semibold text-gray-700">Ultimas Facturas</h3>
                <button onClick={function() { navTo('receipts'); }} className="text-xs text-indigo-500 font-medium">Ver todas</button>
              </div>
              {receipts.slice(0, 5).map(function(r) {
                var cat = getCat(r.category);
                return (
                  <motion.div key={r.id} whileTap={{ scale: 0.98 }} onClick={function() { setSelectedReceipt(r); setView('receipts'); }} className="bg-white rounded-xl p-3 mb-2 shadow-sm border border-gray-100 flex items-center cursor-pointer">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0" style={{ backgroundColor: cat.color + '18' }}>
                      {r.imageData ? <img src={r.imageData} alt="" className="w-full h-full object-cover rounded-xl" /> : cat.emoji}
                    </div>
                    <div className="flex-1 ml-3 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{r.vendor}</p>
                      <p className="text-xs text-gray-400">{r.date}</p>
                    </div>
                    <div className="text-right ml-2">
                      <p className="text-sm font-bold text-gray-800">{fmt(r.amount)}</p>
                      <span className={'text-xs ' + (r.paid ? 'text-emerald-500' : 'text-amber-500')}>{r.paid ? 'Pagada' : 'Pendiente'}</span>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          )}

          {view === 'upload' && (
            <motion.div key="upload" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="px-4 py-4">
              {!isScanning && !editForm && (
                <div>
                  <h2 className="text-lg font-bold text-gray-800 mb-1">Escanear Factura</h2>
                  <p className="text-sm text-gray-500 mb-5">Sube una foto o PDF y la IA extraera los datos reales</p>
                  <motion.button whileTap={{ scale: 0.97 }} onClick={function() { cameraInputRef.current && cameraInputRef.current.click(); }} className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-2xl p-6 mb-4 flex flex-col items-center shadow-lg">
                    <Camera size={36} className="mb-2" />
                    <span className="font-semibold">Hacer Foto</span>
                    <span className="text-indigo-200 text-xs mt-1">Camara del movil</span>
                  </motion.button>
                  <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileUpload} />
                  <motion.div whileTap={{ scale: 0.98 }} onClick={function() { fileInputRef.current && fileInputRef.current.click(); }} className="w-full border-2 border-dashed border-gray-300 rounded-2xl p-8 flex flex-col items-center cursor-pointer hover:border-indigo-400 transition-colors">
                    <Upload size={32} className="text-gray-400 mb-3" />
                    <span className="font-medium text-gray-600 text-sm">Subir archivo</span>
                    <span className="text-gray-400 text-xs mt-1">JPG, PNG (las fotos se leen con OCR)</span>
                  </motion.div>
                  <input ref={fileInputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleFileUpload} />
                  <button onClick={function() { setEditForm({ vendor: '', amount: 0, date: new Date().toISOString().split('T')[0], category: 'other', description: '', invoiceNumber: '', taxAmount: 0, paid: false, fileType: 'manual', imageData: null, ocrText: '' }); }} className="w-full mt-4 py-3 text-indigo-600 font-medium text-sm border border-indigo-200 rounded-xl">
                    Introducir manualmente
                  </button>
                </div>
              )}

              {isScanning && (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center py-16">
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }} className="w-16 h-16 rounded-full border-4 border-indigo-200 border-t-indigo-600 mb-6" />
                  <h3 className="text-lg font-bold text-gray-800 mb-2">Leyendo con OCR real...</h3>
                  <p className="text-sm text-gray-500 mb-1">{scanStatus || 'Procesando imagen...'}</p>
                  <p className="text-xs text-amber-500 mb-4">(La primera vez tarda mas al descargar idioma)</p>
                  <div className="w-full max-w-xs bg-gray-200 rounded-full h-2 mb-2">
                    <motion.div className="bg-indigo-600 h-2 rounded-full" style={{ width: Math.min(scanProgress, 100) + '%' }} />
                  </div>
                  <p className="text-xs text-gray-400 mb-6">{Math.min(Math.round(scanProgress), 100)}%</p>
                  <div className="space-y-2 w-full max-w-xs">
                    {[
                      { t: 3, l: 'Motor OCR iniciado' },
                      { t: 15, l: 'Idioma cargado' },
                      { t: 30, l: 'Leyendo texto de la imagen...' },
                      { t: 80, l: 'Texto extraido' },
                      { t: 95, l: 'Datos analizados' },
                    ].filter(function(s) { return scanProgress > s.t; }).map(function(s, i) {
                      return (
                        <motion.div key={i} initial={{ opacity: 0, x: -15 }} animate={{ opacity: 1, x: 0 }} className="flex items-center text-sm text-emerald-600">
                          <Check size={14} className="mr-2 flex-shrink-0" />{s.l}
                        </motion.div>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {editForm && !isScanning && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-gray-800">Revisar Datos</h3>
                    <span className="text-xs bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full font-medium">OCR Real</span>
                  </div>

                  {/* NUEVO: Preview de la imagen capturada */}
                  {editForm.imageData && editForm.imageData.indexOf('image') !== -1 && (
                    <div className="mb-4">
                      <img
                        src={editForm.imageData}
                        alt="Documento escaneado"
                        className="w-full max-h-48 object-contain rounded-xl border border-gray-200 cursor-pointer bg-gray-50"
                        onClick={function() { setShowImagePreview(editForm.imageData); }}
                      />
                      <p className="text-xs text-gray-400 mt-1 text-center">📷 Foto guardada - Toca para ampliar</p>
                    </div>
                  )}

                  {/* NUEVO: Texto OCR detectado (desplegable) */}
                  {editForm.ocrText && editForm.ocrText.length > 0 && (
                    <details className="mb-4 bg-blue-50 rounded-xl p-3 border border-blue-100">
                      <summary className="text-xs text-blue-600 cursor-pointer font-medium">🔍 Ver texto detectado por OCR ({editForm.ocrText.length} caracteres)</summary>
                      <pre className="text-xs text-gray-600 mt-2 bg-white p-2 rounded-lg whitespace-pre-wrap max-h-32 overflow-y-auto border">{editForm.ocrText}</pre>
                    </details>
                  )}

                  <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
                    <div>
                      <label className="text-xs font-medium text-gray-500 mb-1 block">Proveedor</label>
                      <input type="text" value={editForm.vendor} onChange={function(e) { setEditForm(Object.assign({}, editForm, { vendor: e.target.value })); }} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-gray-500 mb-1 block">Importe (EUR)</label>
                        <input type="number" step="0.01" value={editForm.amount} onChange={function(e) { setEditForm(Object.assign({}, editForm, { amount: parseFloat(e.target.value) || 0 })); }} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500 mb-1 block">IVA (EUR)</label>
                        <input type="number" step="0.01" value={editForm.taxAmount} onChange={function(e) { setEditForm(Object.assign({}, editForm, { taxAmount: parseFloat(e.target.value) || 0 })); }} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-gray-500 mb-1 block">Fecha</label>
                        <input type="date" value={editForm.date} onChange={function(e) { setEditForm(Object.assign({}, editForm, { date: e.target.value })); }} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500 mb-1 block">No Factura</label>
                        <input type="text" value={editForm.invoiceNumber} onChange={function(e) { setEditForm(Object.assign({}, editForm, { invoiceNumber: e.target.value })); }} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 mb-1 block">Categoria</label>
                      <select value={editForm.category} onChange={function(e) { setEditForm(Object.assign({}, editForm, { category: e.target.value })); }} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                        {CATEGORIES.map(function(c) { return <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>; })}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 mb-1 block">Descripcion</label>
                      <input type="text" value={editForm.description} onChange={function(e) { setEditForm(Object.assign({}, editForm, { description: e.target.value })); }} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <button onClick={function() { setEditForm(Object.assign({}, editForm, { paid: !editForm.paid })); }} className="flex items-center pt-1">
                      {editForm.paid ? <CheckCircle2 size={20} className="text-emerald-500 mr-2" /> : <Circle size={20} className="text-gray-300 mr-2" />}
                      <span className="text-sm text-gray-600">Marcar como pagada</span>
                    </button>
                  </div>
                  <div className="flex gap-3 mt-4">
                    <button onClick={function() { setEditForm(null); }} className="flex-1 py-3 border border-gray-200 rounded-xl text-gray-600 font-medium text-sm">Cancelar</button>
                    <button onClick={saveReceipt} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-medium text-sm shadow-lg">Guardar</button>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}

          {view === 'receipts' && !selectedReceipt && (
            <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="px-4 py-4">
              <div className="relative mb-3">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" placeholder="Buscar facturas..." value={searchQuery} onChange={function(e) { setSearchQuery(e.target.value); }} className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
                <button onClick={function() { setShowFilters(!showFilters); }} className={'flex items-center px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ' + (showFilters ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600')}>
                  <Filter size={12} className="mr-1" /> Categoria
                </button>
                <button onClick={function() { setFilterPaid(filterPaid === 'unpaid' ? 'all' : 'unpaid'); }} className={'px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ' + (filterPaid === 'unpaid' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600')}>Pendientes</button>
                <button onClick={function() { setFilterPaid(filterPaid === 'paid' ? 'all' : 'paid'); }} className={'px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ' + (filterPaid === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600')}>Pagadas</button>
              </div>
              {showFilters && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="mb-3">
                  <select value={filterCategory} onChange={function(e) { setFilterCategory(e.target.value); }} className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm">
                    <option value="all">Todas las categorias</option>
                    {CATEGORIES.map(function(c) { return <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>; })}
                  </select>
                </motion.div>
              )}
              <div className="flex justify-between items-center mb-3">
                <p className="text-xs text-gray-400">{filteredReceipts.length} facturas</p>
                <p className="text-xs font-semibold text-gray-600">Total: {fmt(filteredReceipts.reduce(function(s, r) { return s + r.amount; }, 0))}</p>
              </div>
              {filteredReceipts.map(function(r, i) {
                var cat = getCat(r.category);
                return (
                  <motion.div key={r.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.3) }} className="bg-white rounded-xl p-3 mb-2 shadow-sm border border-gray-100 flex items-center">
                    <button onClick={function(e) { e.stopPropagation(); togglePaid(r.id); }} className="mr-2.5 flex-shrink-0">
                      {r.paid ? <CheckCircle2 size={22} className="text-emerald-500" /> : <Circle size={22} className="text-gray-300" />}
                    </button>
                    <div className="flex-1 flex items-center cursor-pointer min-w-0" onClick={function() { setSelectedReceipt(r); }}>
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center text-base flex-shrink-0 overflow-hidden" style={{ backgroundColor: cat.color + '18' }}>
                        {r.imageData ? <img src={r.imageData} alt="" className="w-full h-full object-cover" /> : cat.emoji}
                      </div>
                      <div className="flex-1 ml-2.5 min-w-0">
                        <p className={'text-sm font-medium truncate ' + (r.paid ? 'text-gray-400 line-through' : 'text-gray-800')}>{r.vendor}</p>
                        <p className="text-xs text-gray-400 truncate">{r.date} - {r.invoiceNumber}</p>
                      </div>
                      <div className="text-right ml-2 flex-shrink-0">
                        <p className="text-sm font-bold text-gray-800">{fmt(r.amount)}</p>
                        <p className="text-xs text-gray-400">{r.imageData ? '📷 ' : ''}{cat.name}</p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
              {filteredReceipts.length === 0 && (
                <div className="text-center py-16">
                  <FileText size={40} className="mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-400 text-sm">No se encontraron facturas</p>
                </div>
              )}
            </motion.div>
          )}

          {view === 'receipts' && selectedReceipt && (
            <motion.div key="detail" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="px-4 py-4">
              <button onClick={function() { setSelectedReceipt(null); }} className="text-sm text-indigo-600 font-medium mb-4">Volver</button>
              {(function() {
                var r = selectedReceipt;
                var cat = getCat(r.category);
                return (
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-5 text-center border-b border-gray-100" style={{ backgroundColor: cat.color + '10' }}>
                      <span className="text-3xl block mb-1">{cat.emoji}</span>
                      <h3 className="text-base font-bold text-gray-800">{r.vendor}</h3>
                      <p className="text-3xl font-bold mt-2" style={{ color: cat.color }}>{fmt(r.amount)}</p>
                      <span className={'inline-block mt-2 px-3 py-1 rounded-full text-xs font-medium ' + (r.paid ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700')}>
                        {r.paid ? 'Pagada' : 'Pendiente'}
                      </span>
                    </div>

                    {/* NUEVO: Mostrar imagen guardada */}
                    {r.imageData && r.imageData.indexOf('image') !== -1 && (
                      <div className="p-4 border-b border-gray-100 bg-gray-50">
                        <p className="text-xs font-medium text-gray-500 mb-2">📷 Documento adjunto</p>
                        <img
                          src={r.imageData}
                          alt="Documento"
                          className="w-full max-h-64 object-contain rounded-lg cursor-pointer border border-gray-200 bg-white"
                          onClick={function() { setShowImagePreview(r.imageData); }}
                        />
                        <p className="text-xs text-gray-400 mt-1 text-center">Toca para ampliar</p>
                      </div>
                    )}

                    <div className="p-5 space-y-0">
                      {[
                        ['Fecha', r.date],
                        ['No Factura', r.invoiceNumber],
                        ['Categoria', cat.emoji + ' ' + cat.name],
                        ['IVA', fmt(r.taxAmount)],
                        ['Base imponible', fmt(r.amount - r.taxAmount)],
                        ['Descripcion', r.description],
                      ].map(function(pair, i) {
                        return (
                          <div key={i} className="flex justify-between py-2.5 border-b border-gray-50 last:border-0">
                            <span className="text-sm text-gray-500">{pair[0]}</span>
                            <span className="text-sm font-medium text-gray-800 text-right max-w-xs truncate">{pair[1]}</span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="p-4 border-t border-gray-100 flex gap-2">
                      <button onClick={function() { togglePaid(r.id); setSelectedReceipt(Object.assign({}, r, { paid: !r.paid })); }} className={'flex-1 py-2.5 rounded-xl text-sm font-medium ' + (r.paid ? 'bg-amber-50 text-amber-600 border border-amber-200' : 'bg-emerald-50 text-emerald-600 border border-emerald-200')}>
                        {r.paid ? 'Marcar pendiente' : 'Marcar pagada'}
                      </button>
                      <button onClick={function() { deleteReceipt(r.id); }} className="px-4 py-2.5 bg-red-50 text-red-500 rounded-xl border border-red-200">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              })()}
            </motion.div>
          )}

          {view === 'reports' && (
            <motion.div key="reports" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="px-4 py-4">
              <h2 className="text-lg font-bold text-gray-800 mb-4">Informes</h2>
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Distribucion por Categoria</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <RePieChart>
                    <Pie data={stats.categoryTotals} cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={3} dataKey="total" nameKey="name">
                      {stats.categoryTotals.map(function(e, i) { return <Cell key={i} fill={e.color} />; })}
                    </Pie>
                    <Tooltip formatter={function(v) { return [v.toFixed(2) + ' EUR', '']; }} />
                  </RePieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 justify-center">
                  {stats.categoryTotals.map(function(c) {
                    return <span key={c.id} className="flex items-center text-xs text-gray-600"><span className="w-2 h-2 rounded-full mr-1 inline-block" style={{ backgroundColor: c.color }} />{c.emoji} {c.name}</span>;
                  })}
                </div>
              </div>
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Ranking de Gastos</h3>
                <ResponsiveContainer width="100%" height={Math.max(stats.categoryTotals.length * 32, 100)}>
                  <BarChart data={stats.categoryTotals} layout="vertical" margin={{ left: 5, right: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis type="number" tick={{ fontSize: 10 }} stroke="#9ca3af" />
                    <YAxis dataKey="emoji" type="category" tick={{ fontSize: 14 }} width={28} stroke="#9ca3af" />
                    <Tooltip formatter={function(v) { return [v.toFixed(2) + ' EUR', 'Total']; }} />
                    <Bar dataKey="total" radius={4}>
                      {stats.categoryTotals.map(function(e, i) { return <Cell key={i} fill={e.color} />; })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Resumen Detallado</h3>
                {stats.categoryTotals.map(function(c) {
                  return (
                    <div key={c.id} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                      <div className="flex items-center">
                        <span className="text-base mr-2">{c.emoji}</span>
                        <div>
                          <p className="text-sm font-medium text-gray-700">{c.name}</p>
                          <p className="text-xs text-gray-400">{c.count} factura{c.count !== 1 ? 's' : ''}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-gray-800">{fmt(c.total)}</p>
                        <p className="text-xs text-gray-400">{((c.total / stats.total) * 100).toFixed(1)}%</p>
                      </div>
                    </div>
                  );
                })}
                <div className="flex items-center justify-between pt-3 mt-1 border-t-2 border-indigo-100">
                  <span className="text-sm font-bold text-gray-800">TOTAL</span>
                  <span className="text-base font-bold text-indigo-600">{fmt(stats.total)}</span>
                </div>
              </div>
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Evolucion Mensual</h3>
                <ResponsiveContainer width="100%" height={160}>
                  <AreaChart data={stats.monthlyChart}>
                    <defs><linearGradient id="colorGrad2" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} /><stop offset="95%" stopColor="#6366f1" stopOpacity={0} /></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                    <YAxis tick={{ fontSize: 10 }} stroke="#9ca3af" width={45} />
                    <Tooltip formatter={function(v) { return [v + ' EUR', 'Total']; }} />
                    <Area type="monotone" dataKey="total" stroke="#6366f1" fill="url(#colorGrad2)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          )}

          {view === 'export' && (
            <motion.div key="export" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="px-4 py-4">
              <h2 className="text-lg font-bold text-gray-800 mb-1">Exportar</h2>
              <p className="text-sm text-gray-500 mb-5">Genera informes para tu gestor o contable</p>
              <motion.button whileTap={{ scale: 0.97 }} onClick={exportCSV} className="w-full bg-white rounded-2xl p-5 mb-3 shadow-sm border border-gray-100 flex items-center text-left active:bg-gray-50">
                <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mr-4 flex-shrink-0"><FileSpreadsheet size={24} className="text-emerald-600" /></div>
                <div><h3 className="font-semibold text-gray-800">Exportar Excel (CSV)</h3><p className="text-xs text-gray-500 mt-0.5">Compatible con Excel, Google Sheets</p></div>
              </motion.button>
              <motion.button whileTap={{ scale: 0.97 }} onClick={exportPDF} className="w-full bg-white rounded-2xl p-5 mb-3 shadow-sm border border-gray-100 flex items-center text-left active:bg-gray-50">
                <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center mr-4 flex-shrink-0"><FileText size={24} className="text-red-600" /></div>
                <div><h3 className="font-semibold text-gray-800">Exportar PDF</h3><p className="text-xs text-gray-500 mt-0.5">Informe formateado para imprimir</p></div>
              </motion.button>
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mt-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Vista Previa del Informe</h3>
                <p className="text-xs text-gray-500 mb-3">Se exportaran {filteredReceipts.length} facturas</p>
                <div className="bg-gray-50 rounded-xl p-3.5 space-y-2">
                  {[
                    ['Total facturas', String(filteredReceipts.length)],
                    ['Importe total', fmt(filteredReceipts.reduce(function(s, r) { return s + r.amount; }, 0))],
                    ['IVA total', fmt(filteredReceipts.reduce(function(s, r) { return s + r.taxAmount; }, 0))],
                    ['Base imponible', fmt(filteredReceipts.reduce(function(s, r) { return s + (r.amount - r.taxAmount); }, 0))],
                  ].map(function(pair, i) {
                    return <div key={i} className="flex justify-between text-xs"><span className="text-gray-500">{pair[0]}</span><span className="font-bold text-gray-800">{pair[1]}</span></div>;
                  })}
                </div>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg bg-white border-t border-gray-200 z-40 shadow-lg">
        <div className="flex justify-around items-end pt-1.5 pb-2 px-1">
          {[
            { id: 'dashboard', icon: Home, label: 'Inicio' },
            { id: 'receipts', icon: List, label: 'Facturas' },
            { id: 'upload', icon: Camera, label: 'Escanear', special: true },
            { id: 'reports', icon: BarChart3, label: 'Informes' },
            { id: 'export', icon: Download, label: 'Exportar' },
          ].map(function(tab) {
            return (
              <button key={tab.id} onClick={function() { navTo(tab.id); }} className={'flex flex-col items-center px-2 py-1 transition-colors ' + (view === tab.id ? 'text-indigo-600' : 'text-gray-400')}>
                {tab.special ? (
                  <div className={'p-2.5 rounded-full -mt-6 shadow-lg transition-colors text-white ' + (view === tab.id ? 'bg-indigo-600' : 'bg-indigo-500')}>
                    <tab.icon size={20} />
                  </div>
                ) : (
                  <tab.icon size={20} />
                )}
                <span className="text-xs mt-1 font-medium">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

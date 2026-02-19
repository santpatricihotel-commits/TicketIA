import React, { useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera, Upload, FileText, BarChart3, Download,
  Check, Plus, Search, Filter, Trash2,
  Home, List, CheckCircle2, Circle, FileSpreadsheet
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, PieChart as RePieChart, Pie, Cell,
  AreaChart, Area, CartesianGrid
} from 'recharts';

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

const VENDORS = {
  food: ['Restaurante El Buen Sabor', 'Bar La Tasca', 'Mercadona', 'Carrefour'],
  transport: ['Repsol', 'Uber', 'Cabify', 'Renfe', 'BP Gasolinera'],
  accommodation: ['Hotel NH', 'Airbnb', 'Booking.com'],
  office: ['Amazon Business', 'Staples', 'Bureau Vallee'],
  tech: ['MediaMarkt', 'FNAC', 'Apple Store', 'PC Componentes'],
  health: ['Farmacia Cruz', 'Clinica Dental', 'Optica Central'],
  travel: ['Iberia', 'Vueling', 'Renfe AVE'],
  shopping: ['Zara', 'El Corte Ingles', 'Primark'],
  services: ['Movistar', 'Endesa', 'Naturgy', 'Vodafone'],
  other: ['Correos', 'Notaria', 'Gestion Admin'],
};

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
}));

const getCat = (id) => CATEGORIES.find(c => c.id === id) || CATEGORIES[9];
const fmt = (n) => n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + ' \u20AC';

export default function App() {
  const [view, setView] = useState('dashboard');
  const [receipts, setReceipts] = useState(initReceipts);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [editForm, setEditForm] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterPaid, setFilterPaid] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [notification, setNotification] = useState(null);
  const [nextId, setNextId] = useState(20);

  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const showNotif = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const simulateAIScan = (fileName, fileType) => {
    setIsScanning(true);
    setScanProgress(0);
    const interval = setInterval(() => {
      setScanProgress(p => {
        if (p >= 100) { clearInterval(interval); return 100; }
        return p + Math.random() * 15 + 5;
      });
    }, 200);
    setTimeout(() => {
      clearInterval(interval);
      setScanProgress(100);
      setTimeout(() => {
        const catKeys = CATEGORIES.map(c => c.id);
        const rc = catKeys[Math.floor(Math.random() * (catKeys.length - 1))];
        const vs = VENDORS[rc] || VENDORS.other;
        const rv = vs[Math.floor(Math.random() * vs.length)];
        const ra = parseFloat((Math.random() * 200 + 10).toFixed(2));
        const rd = new Date(Date.now() - Math.random() * 7 * 864e5);
        setEditForm({
          vendor: rv,
          amount: ra,
          date: rd.toISOString().split('T')[0],
          category: rc,
          description: 'Factura de ' + getCat(rc).name,
          invoiceNumber: 'F-2026-' + String(Math.floor(Math.random() * 9000) + 1000),
          taxAmount: parseFloat((ra * 0.21).toFixed(2)),
          paid: false,
          fileType: fileType || 'jpg',
          fileName: fileName,
        });
        setIsScanning(false);
        setScanProgress(0);
      }, 500);
    }, 2500);
  };

  const handleFileUpload = (e) => {
    var file = e.target.files && e.target.files[0];
    if (file) simulateAIScan(file.name, file.name.endsWith('.pdf') ? 'pdf' : 'jpg');
    e.target.value = '';
  };

  const saveReceipt = () => {
    if (!editForm) return;
    var newReceipt = Object.assign({}, editForm, { id: nextId });
    setReceipts(prev => [newReceipt].concat(prev));
    setNextId(p => p + 1);
    setEditForm(null);
    setView('receipts');
    showNotif('Factura guardada correctamente');
  };

  const togglePaid = (id) => {
    setReceipts(prev => prev.map(r => r.id === id ? Object.assign({}, r, { paid: !r.paid }) : r));
    if (selectedReceipt && selectedReceipt.id === id) {
      setSelectedReceipt(prev => prev ? Object.assign({}, prev, { paid: !prev.paid }) : null);
    }
  };

  const deleteReceipt = (id) => {
    setReceipts(prev => prev.filter(r => r.id !== id));
    setSelectedReceipt(null);
    showNotif('Factura eliminada');
  };

  const filteredReceipts = useMemo(() => {
    return receipts.filter(r => {
      var ms = !searchQuery || r.vendor.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase());
      var mc = filterCategory === 'all' || r.category === filterCategory;
      var mp = filterPaid === 'all' || (filterPaid === 'paid' && r.paid) || (filterPaid === 'unpaid' && !r.paid);
      return ms && mc && mp;
    });
  }, [receipts, searchQuery, filterCategory, filterPaid]);

  const stats = useMemo(() => {
    var total = receipts.reduce((s, r) => s + r.amount, 0);
    var totalTax = receipts.reduce((s, r) => s + r.taxAmount, 0);
    var unpaid = receipts.filter(r => !r.paid);
    var unpaidTotal = unpaid.reduce((s, r) => s + r.amount, 0);
    var categoryTotals = CATEGORIES.map(cat => {
      var cr = receipts.filter(r => r.category === cat.id);
      return Object.assign({}, cat, { total: cr.reduce((s, r) => s + r.amount, 0), count: cr.length });
    }).filter(c => c.count > 0).sort((a, b) => b.total - a.total);
    var md = {};
    receipts.forEach(r => {
      var m = r.date.substring(0, 7);
      md[m] = (md[m] || 0) + r.amount;
    });
    var monthlyChart = Object.entries(md)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(entry => ({
        name: new Date(entry[0] + '-01').toLocaleDateString('es-ES', { month: 'short', year: '2-digit' }),
        total: parseFloat(entry[1].toFixed(2)),
      }));
    return { total: total, totalTax: totalTax, unpaidCount: unpaid.length, unpaidTotal: unpaidTotal, categoryTotals: categoryTotals, monthlyChart: monthlyChart };
  }, [receipts]);

  const exportCSV = () => {
    try {
      var h = ['Fecha', 'Proveedor', 'No Factura', 'Descripcion', 'Categoria', 'Importe', 'IVA', 'Pagada'];
      var rows = filteredReceipts.map(r => [
        r.date, r.vendor, r.invoiceNumber, r.description,
        getCat(r.category).name, r.amount.toFixed(2), r.taxAmount.toFixed(2), r.paid ? 'Si' : 'No'
      ]);
      var csv = [h].concat(rows).map(row => row.map(c => '"' + c + '"').join(',')).join('\n');
      var blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'facturas_' + new Date().toISOString().split('T')[0] + '.csv';
      a.click();
      showNotif('Excel/CSV exportado');
    } catch (err) {
      showNotif('Error al exportar');
    }
  };

  var exportPDF = function() {
    var ta = filteredReceipts.reduce((s, r) => s + r.amount, 0);
    var tt = filteredReceipts.reduce((s, r) => s + r.taxAmount, 0);
    var tableRows = filteredReceipts.map(r =>
      '<tr><td>' + r.date + '</td><td>' + r.vendor + '</td><td>' + r.invoiceNumber + '</td>' +
      '<td>' + getCat(r.category).emoji + ' ' + getCat(r.category).name + '</td><td>' + r.amount.toFixed(2) + ' EUR</td>' +
      '<td>' + r.taxAmount.toFixed(2) + ' EUR</td><td class="' + (r.paid ? 'g' : 'r') + '">' + (r.paid ? 'Pagada' : 'Pendiente') + '</td></tr>'
    ).join('');
    var html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Informe de Gastos - TicketAI</title>' +
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
    } catch (err) {
      showNotif('Permite pop-ups para exportar PDF');
    }
  };

  var navTo = function(v) {
    setView(v);
    if (v === 'receipts') setSelectedReceipt(null);
    if (v === 'upload') { setEditForm(null); setIsScanning(false); }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-lg mx-auto relative overflow-hidden">

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
            <h1 className="text-xl font-bold tracking-tight flex items-center gap-1.5">
              TicketAI
            </h1>
            <p className="text-indigo-200 text-xs mt-0.5">Gestion inteligente de facturas</p>
          </div>
          <button
            onClick={() => navTo('upload')}
            className="bg-white text-indigo-600 rounded-full p-2.5 shadow-lg active:scale-95 transition-transform"
          >
            <Plus size={18} strokeWidth={3} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-24">
        <AnimatePresence mode="wait">

          {view === 'dashboard' && (
            <motion.div
              key="dash"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="px-4 py-4"
            >
              <div className="grid grid-cols-2 gap-3 mb-5">
                {[
                  { label: 'Total Gastos', val: fmt(stats.total), sub: receipts.length + ' facturas', color: 'text-gray-900' },
                  { label: 'IVA Soportado', val: fmt(stats.totalTax), sub: 'Deducible', color: 'text-indigo-600' },
                  { label: 'Pendientes', val: String(stats.unpaidCount), sub: fmt(stats.unpaidTotal), color: 'text-amber-500' },
                ].map((c, i) => (
                  <motion.div
                    key={i}
                    whileTap={{ scale: 0.97 }}
                    className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100"
                  >
                    <p className="text-xs text-gray-500 font-medium">{c.label}</p>
                    <p className={'text-lg font-bold mt-1 ' + c.color}>{c.val}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{c.sub}</p>
                  </motion.div>
                ))}
                <motion.div
                  whileTap={{ scale: 0.97 }}
                  onClick={() => navTo('upload')}
                  className="bg-indigo-50 rounded-2xl p-4 shadow-sm border border-indigo-100 cursor-pointer"
                >
                  <p className="text-xs text-indigo-500 font-medium">Escanear</p>
                  <Camera size={22} className="text-indigo-500 mt-1.5" />
                  <p className="text-xs text-indigo-400 mt-1">+ Nueva factura</p>
                </motion.div>
              </div>

              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Gastos por Categoria</h3>
                {stats.categoryTotals.slice(0, 6).map((cat, i) => (
                  <div key={cat.id} className="flex items-center mb-2.5 last:mb-0">
                    <span className="text-base mr-2 w-6 text-center">{cat.emoji}</span>
                    <div className="flex-1">
                      <div className="flex justify-between items-center mb-0.5">
                        <span className="text-xs font-medium text-gray-600">{cat.name}</span>
                        <span className="text-xs font-bold text-gray-800">{fmt(cat.total)}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: Math.max((cat.total / stats.total) * 100, 2) + '%' }}
                          transition={{ duration: 0.8, delay: i * 0.08 }}
                          className="h-full rounded-full"
                          style={{ backgroundColor: cat.color }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {stats.monthlyChart.length > 0 && (
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-5">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Tendencia Mensual</h3>
                  <ResponsiveContainer width="100%" height={150}>
                    <AreaChart data={stats.monthlyChart}>
                      <defs>
                        <linearGradient id="colorGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                      <YAxis tick={{ fontSize: 10 }} stroke="#9ca3af" width={45} />
                      <Tooltip formatter={(v) => [v + ' EUR', 'Total']} />
                      <Area type="monotone" dataKey="total" stroke="#6366f1" fill="url(#colorGrad)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}

              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-semibold text-gray-700">Ultimas Facturas</h3>
                <button onClick={() => navTo('receipts')} className="text-xs text-indigo-500 font-medium">
                  Ver todas
                </button>
              </div>
              {receipts.slice(0, 5).map(r => {
                var cat = getCat(r.category);
                return (
                  <motion.div
                    key={r.id}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => { setSelectedReceipt(r); setView('receipts'); }}
                    className="bg-white rounded-xl p-3 mb-2 shadow-sm border border-gray-100 flex items-center cursor-pointer"
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                      style={{ backgroundColor: cat.color + '18' }}
                    >
                      {cat.emoji}
                    </div>
                    <div className="flex-1 ml-3 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{r.vendor}</p>
                      <p className="text-xs text-gray-400">{r.date}</p>
                    </div>
                    <div className="text-right ml-2">
                      <p className="text-sm font-bold text-gray-800">{fmt(r.amount)}</p>
                      <span className={'text-xs ' + (r.paid ? 'text-emerald-500' : 'text-amber-500')}>
                        {r.paid ? 'Pagada' : 'Pendiente'}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          )}

          {view === 'upload' && (
            <motion.div
              key="upload"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="px-4 py-4"
            >
              {!isScanning && !editForm && (
                <div>
                  <h2 className="text-lg font-bold text-gray-800 mb-1">Escanear Factura</h2>
                  <p className="text-sm text-gray-500 mb-5">Sube una foto o PDF y la IA extraera los datos</p>

                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => cameraInputRef.current && cameraInputRef.current.click()}
                    className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-2xl p-6 mb-4 flex flex-col items-center shadow-lg"
                  >
                    <Camera size={36} className="mb-2" />
                    <span className="font-semibold">Hacer Foto</span>
                    <span className="text-indigo-200 text-xs mt-1">Camara del movil</span>
                  </motion.button>
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleFileUpload}
                  />

                  <motion.div
                    whileTap={{ scale: 0.98 }}
                    onClick={() => fileInputRef.current && fileInputRef.current.click()}
                    className="w-full border-2 border-dashed border-gray-300 rounded-2xl p-8 flex flex-col items-center cursor-pointer hover:border-indigo-400 transition-colors"
                  >
                    <Upload size={32} className="text-gray-400 mb-3" />
                    <span className="font-medium text-gray-600 text-sm">Subir archivo</span>
                    <span className="text-gray-400 text-xs mt-1">PDF, JPG, PNG</span>
                  </motion.div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,.pdf"
                    className="hidden"
                    onChange={handleFileUpload}
                  />

                  <button
                    onClick={() =>
                      setEditForm({
                        vendor: '',
                        amount: 0,
                        date: new Date().toISOString().split('T')[0],
                        category: 'other',
                        description: '',
                        invoiceNumber: '',
                        taxAmount: 0,
                        paid: false,
                        fileType: 'manual',
                      })
                    }
                    className="w-full mt-4 py-3 text-indigo-600 font-medium text-sm border border-indigo-200 rounded-xl"
                  >
                    Introducir manualmente
                  </button>
                </div>
              )}

              {isScanning && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center py-16"
                >
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                    className="w-16 h-16 rounded-full border-4 border-indigo-200 border-t-indigo-600 mb-6"
                  />
                  <h3 className="text-lg font-bold text-gray-800 mb-2">Analizando con IA...</h3>
                  <p className="text-sm text-gray-500 mb-4">Extrayendo datos del documento</p>
                  <div className="w-full max-w-xs bg-gray-200 rounded-full h-2 mb-2">
                    <motion.div
                      className="bg-indigo-600 h-2 rounded-full"
                      style={{ width: Math.min(scanProgress, 100) + '%' }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mb-6">{Math.min(Math.round(scanProgress), 100)}%</p>
                  <div className="space-y-2 w-full max-w-xs">
                    {[
                      { t: 20, l: 'Documento detectado' },
                      { t: 45, l: 'Texto extraido (OCR)' },
                      { t: 70, l: 'Datos identificados' },
                      { t: 90, l: 'Categoria asignada' },
                    ]
                      .filter(s => scanProgress > s.t)
                      .map((s, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -15 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="flex items-center text-sm text-emerald-600"
                        >
                          <Check size={14} className="mr-2 flex-shrink-0" />
                          {s.l}
                        </motion.div>
                      ))}
                  </div>
                </motion.div>
              )}

              {editForm && !isScanning && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-gray-800">Revisar Datos</h3>
                    <span className="text-xs bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full font-medium">
                      IA
                    </span>
                  </div>
                  <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
                    <div>
                      <label className="text-xs font-medium text-gray-500 mb-1 block">Proveedor</label>
                      <input
                        type="text"
                        value={editForm.vendor}
                        onChange={e => setEditForm(Object.assign({}, editForm, { vendor: e.target.value }))}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-gray-500 mb-1 block">Importe (EUR)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={editForm.amount}
                          onChange={e => setEditForm(Object.assign({}, editForm, { amount: parseFloat(e.target.value) || 0 }))}
                          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500 mb-1 block">IVA (EUR)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={editForm.taxAmount}
                          onChange={e => setEditForm(Object.assign({}, editForm, { taxAmount: parseFloat(e.target.value) || 0 }))}
                          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-gray-500 mb-1 block">Fecha</label>
                        <input
                          type="date"
                          value={editForm.date}
                          onChange={e => setEditForm(Object.assign({}, editForm, { date: e.target.value }))}
                          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500 mb-1 block">No Factura</label>
                        <input
                          type="text"
                          value={editForm.invoiceNumber}
                          onChange={e => setEditForm(Object.assign({}, editForm, { invoiceNumber: e.target.value }))}
                          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 mb-1 block">Categoria</label>
                      <select
                        value={editForm.category}
                        onChange={e => setEditForm(Object.assign({}, editForm, { category: e.target.value }))}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                      >
                        {CATEGORIES.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.emoji} {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 mb-1 block">Descripcion</label>
                      <input
                        type="text"
                        value={editForm.description}
                        onChange={e => setEditForm(Object.assign({}, editForm, { description: e.target.value }))}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <button
                      onClick={() => setEditForm(Object.assign({}, editForm, { paid: !editForm.paid }))}
                      className="flex items-center pt-1"
                    >
                      {editForm.paid ? (
                        <CheckCircle2 size={20} className="text-emerald-500 mr-2" />
                      ) : (
                        <Circle size={20} className="text-gray-300 mr-2" />
                      )}
                      <span className="text-sm text-gray-600">Marcar como pagada</span>
                    </button>
                  </div>
                  <div className="flex gap-3 mt-4">
                    <button
                      onClick={() => setEditForm(null)}
                      className="flex-1 py-3 border border-gray-200 rounded-xl text-gray-600 font-medium text-sm"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={saveReceipt}
                      className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-medium text-sm shadow-lg"
                    >
                      Guardar
                    </button>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}

          {view === 'receipts' && !selectedReceipt && (
            <motion.div
              key="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="px-4 py-4"
            >
              <div className="relative mb-3">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar facturas..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex gap-2 mb-3 overflow-x-auto pb-1 scrollbar-hide">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={'flex items-center px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ' +
                    (showFilters ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600')}
                >
                  <Filter size={12} className="mr-1" /> Categoria
                </button>
                <button
                  onClick={() => setFilterPaid(filterPaid === 'unpaid' ? 'all' : 'unpaid')}
                  className={'px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ' +
                    (filterPaid === 'unpaid' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600')}
                >
                  Pendientes
                </button>
                <button
                  onClick={() => setFilterPaid(filterPaid === 'paid' ? 'all' : 'paid')}
                  className={'px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ' +
                    (filterPaid === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600')}
                >
                  Pagadas
                </button>
              </div>

              {showFilters && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="mb-3">
                  <select
                    value={filterCategory}
                    onChange={e => setFilterCategory(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm"
                  >
                    <option value="all">Todas las categorias</option>
                    {CATEGORIES.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.emoji} {c.name}
                      </option>
                    ))}
                  </select>
                </motion.div>
              )}

              <div className="flex justify-between items-center mb-3">
                <p className="text-xs text-gray-400">{filteredReceipts.length} facturas</p>
                <p className="text-xs font-semibold text-gray-600">
                  Total: {fmt(filteredReceipts.reduce((s, r) => s + r.amount, 0))}
                </p>
              </div>

              {filteredReceipts.map((r, i) => {
                var cat = getCat(r.category);
                return (
                  <motion.div
                    key={r.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.03, 0.3) }}
                    className="bg-white rounded-xl p-3 mb-2 shadow-sm border border-gray-100 flex items-center"
                  >
                    <button
                      onClick={e => { e.stopPropagation(); togglePaid(r.id); }}
                      className="mr-2.5 flex-shrink-0"
                    >
                      {r.paid ? (
                        <CheckCircle2 size={22} className="text-emerald-500" />
                      ) : (
                        <Circle size={22} className="text-gray-300" />
                      )}
                    </button>
                    <div
                      className="flex-1 flex items-center cursor-pointer min-w-0"
                      onClick={() => setSelectedReceipt(r)}
                    >
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center text-base flex-shrink-0"
                        style={{ backgroundColor: cat.color + '18' }}
                      >
                        {cat.emoji}
                      </div>
                      <div className="flex-1 ml-2.5 min-w-0">
                        <p className={'text-sm font-medium truncate ' + (r.paid ? 'text-gray-400 line-through' : 'text-gray-800')}>
                          {r.vendor}
                        </p>
                        <p className="text-xs text-gray-400 truncate">{r.date} - {r.invoiceNumber}</p>
                      </div>
                      <div className="text-right ml-2 flex-shrink-0">
                        <p className="text-sm font-bold text-gray-800">{fmt(r.amount)}</p>
                        <p className="text-xs text-gray-400">{cat.name}</p>
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
            <motion.div
              key="detail"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              className="px-4 py-4"
            >
              <button onClick={() => setSelectedReceipt(null)} className="text-sm text-indigo-600 font-medium mb-4">
                Volver
              </button>
              {(function() {
                var r = selectedReceipt;
                var cat = getCat(r.category);
                return (
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-5 text-center border-b border-gray-100" style={{ backgroundColor: cat.color + '10' }}>
                      <span className="text-3xl block mb-1">{cat.emoji}</span>
                      <h3 className="text-base font-bold text-gray-800">{r.vendor}</h3>
                      <p className="text-3xl font-bold mt-2" style={{ color: cat.color }}>
                        {fmt(r.amount)}
                      </p>
                      <span
                        className={'inline-block mt-2 px-3 py-1 rounded-full text-xs font-medium ' +
                          (r.paid ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700')}
                      >
                        {r.paid ? 'Pagada' : 'Pendiente'}
                      </span>
                    </div>
                    <div className="p-5 space-y-0">
                      {[
                        ['Fecha', r.date],
                        ['No Factura', r.invoiceNumber],
                        ['Categoria', cat.emoji + ' ' + cat.name],
                        ['IVA', fmt(r.taxAmount)],
                        ['Base imponible', fmt(r.amount - r.taxAmount)],
                        ['Descripcion', r.description],
                      ].map((pair, i) => (
                        <div key={i} className="flex justify-between py-2.5 border-b border-gray-50 last:border-0">
                          <span className="text-sm text-gray-500">{pair[0]}</span>
                          <span className="text-sm font-medium text-gray-800 text-right max-w-xs truncate">{pair[1]}</span>
                        </div>
                      ))}
                    </div>
                    <div className="p-4 border-t border-gray-100 flex gap-2">
                      <button
                        onClick={() => {
                          togglePaid(r.id);
                          setSelectedReceipt(Object.assign({}, r, { paid: !r.paid }));
                        }}
                        className={'flex-1 py-2.5 rounded-xl text-sm font-medium ' +
                          (r.paid
                            ? 'bg-amber-50 text-amber-600 border border-amber-200'
                            : 'bg-emerald-50 text-emerald-600 border border-emerald-200')}
                      >
                        {r.paid ? 'Marcar pendiente' : 'Marcar pagada'}
                      </button>
                      <button
                        onClick={() => deleteReceipt(r.id)}
                        className="px-4 py-2.5 bg-red-50 text-red-500 rounded-xl border border-red-200"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              })()}
            </motion.div>
          )}

          {view === 'reports' && (
            <motion.div
              key="reports"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="px-4 py-4"
            >
              <h2 className="text-lg font-bold text-gray-800 mb-4">Informes</h2>

              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Distribucion por Categoria</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <RePieChart>
                    <Pie
                      data={stats.categoryTotals}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="total"
                      nameKey="name"
                    >
                      {stats.categoryTotals.map((e, i) => (
                        <Cell key={i} fill={e.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={v => [v.toFixed(2) + ' EUR', '']} />
                  </RePieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 justify-center">
                  {stats.categoryTotals.map(c => (
                    <span key={c.id} className="flex items-center text-xs text-gray-600">
                      <span
                        className="w-2 h-2 rounded-full mr-1 inline-block flex-shrink-0"
                        style={{ backgroundColor: c.color }}
                      />
                      {c.emoji} {c.name}
                    </span>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Ranking de Gastos</h3>
                <ResponsiveContainer width="100%" height={Math.max(stats.categoryTotals.length * 32, 100)}>
                  <BarChart data={stats.categoryTotals} layout="vertical" margin={{ left: 5, right: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis type="number" tick={{ fontSize: 10 }} stroke="#9ca3af" />
                    <YAxis dataKey="emoji" type="category" tick={{ fontSize: 14 }} width={28} stroke="#9ca3af" />
                    <Tooltip formatter={v => [v.toFixed(2) + ' EUR', 'Total']} />
                    <Bar dataKey="total" radius={4}>
                      {stats.categoryTotals.map((e, i) => (
                        <Cell key={i} fill={e.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Resumen Detallado</h3>
                {stats.categoryTotals.map(c => (
                  <div key={c.id} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                    <div className="flex items-center">
                      <span className="text-base mr-2">{c.emoji}</span>
                      <div>
                        <p className="text-sm font-medium text-gray-700">{c.name}</p>
                        <p className="text-xs text-gray-400">
                          {c.count} factura{c.count !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-800">{fmt(c.total)}</p>
                      <p className="text-xs text-gray-400">{((c.total / stats.total) * 100).toFixed(1)}%</p>
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-3 mt-1 border-t-2 border-indigo-100">
                  <span className="text-sm font-bold text-gray-800">TOTAL</span>
                  <span className="text-base font-bold text-indigo-600">{fmt(stats.total)}</span>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Evolucion Mensual</h3>
                <ResponsiveContainer width="100%" height={160}>
                  <AreaChart data={stats.monthlyChart}>
                    <defs>
                      <linearGradient id="colorGrad2" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                    <YAxis tick={{ fontSize: 10 }} stroke="#9ca3af" width={45} />
                    <Tooltip formatter={v => [v + ' EUR', 'Total']} />
                    <Area type="monotone" dataKey="total" stroke="#6366f1" fill="url(#colorGrad2)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          )}

          {view === 'export' && (
            <motion.div
              key="export"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="px-4 py-4"
            >
              <h2 className="text-lg font-bold text-gray-800 mb-1">Exportar</h2>
              <p className="text-sm text-gray-500 mb-5">Genera informes para tu gestor o contable</p>

              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={exportCSV}
                className="w-full bg-white rounded-2xl p-5 mb-3 shadow-sm border border-gray-100 flex items-center text-left active:bg-gray-50"
              >
                <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mr-4 flex-shrink-0">
                  <FileSpreadsheet size={24} className="text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800">Exportar Excel (CSV)</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Compatible con Excel, Google Sheets</p>
                </div>
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={exportPDF}
                className="w-full bg-white rounded-2xl p-5 mb-3 shadow-sm border border-gray-100 flex items-center text-left active:bg-gray-50"
              >
                <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center mr-4 flex-shrink-0">
                  <FileText size={24} className="text-red-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800">Exportar PDF</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Informe formateado para imprimir</p>
                </div>
              </motion.button>

              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mt-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Vista Previa del Informe</h3>
                <p className="text-xs text-gray-500 mb-3">
                  Se exportaran {filteredReceipts.length} facturas (filtros activos)
                </p>
                <div className="bg-gray-50 rounded-xl p-3.5 space-y-2">
                  {[
                    ['Total facturas', String(filteredReceipts.length)],
                    ['Importe total', fmt(filteredReceipts.reduce((s, r) => s + r.amount, 0))],
                    ['IVA total', fmt(filteredReceipts.reduce((s, r) => s + r.taxAmount, 0))],
                    ['Base imponible', fmt(filteredReceipts.reduce((s, r) => s + (r.amount - r.taxAmount), 0))],
                  ].map((pair, i) => (
                    <div key={i} className="flex justify-between text-xs">
                      <span className="text-gray-500">{pair[0]}</span>
                      <span className="font-bold text-gray-800">{pair[1]}</span>
                    </div>
                  ))}
                  <div className="border-t border-gray-200 pt-2 mt-2 flex justify-between">
                    <div className="text-xs">
                      <span className="text-emerald-600 font-bold">{filteredReceipts.filter(r => r.paid).length}</span>
                      <span className="text-gray-400"> pagadas</span>
                    </div>
                    <div className="text-xs">
                      <span className="text-amber-500 font-bold">{filteredReceipts.filter(r => !r.paid).length}</span>
                      <span className="text-gray-400"> pendientes</span>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-3">
                  Usa los filtros en Facturas para exportar solo las que necesites
                </p>
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
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => navTo(tab.id)}
              className={'flex flex-col items-center px-2 py-1 transition-colors ' +
                (view === tab.id ? 'text-indigo-600' : 'text-gray-400')}
            >
              {tab.special ? (
                <div
                  className={'p-2.5 rounded-full -mt-6 shadow-lg transition-colors text-white ' +
                    (view === tab.id ? 'bg-indigo-600' : 'bg-indigo-500')}
                >
                  <tab.icon size={20} />
                </div>
              ) : (
                <tab.icon size={20} />
              )}
              <span className="text-xs mt-1 font-medium">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

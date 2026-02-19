import React, { useState, useRef, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera, Upload, FileText, BarChart3, Download, Check, Plus, Search,
  Filter, Trash2, Home, List, CheckCircle2, Circle, FileSpreadsheet, X, Loader2, Cloud, CloudOff
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart as RePieChart, Pie, Cell, AreaChart, Area, CartesianGrid
} from 'recharts';
import { createWorker } from 'tesseract.js';
import { fbLoadReceipts, fbSaveReceipt, fbUpdateReceipt, fbDeleteReceipt } from './firebase';
 
/* ===== CONSTANTES ===== */
var CATEGORIES = [
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

var getCat = function (id) { return CATEGORIES.find(function (c) { return c.id === id; }) || CATEGORIES[9]; };
var fmt = function (n) { return n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + ' \u20AC'; };

/* ===== PREPROCESAR IMAGEN (fix capturas) ===== */
function preprocessImage(source) {
  return new Promise(function (resolve) {
    var timer = setTimeout(function () { resolve(source); }, 15000);
    var blobUrl = null;
    var img = new Image();

    img.onload = function () {
      clearTimeout(timer);
      if (blobUrl) try { URL.revokeObjectURL(blobUrl); } catch (e) { }
      try {
        var canvas = document.createElement('canvas');
        var w = img.naturalWidth || img.width;
        var h = img.naturalHeight || img.height;
        if (!w || !h) { resolve(source); return; }
        var MAX = 1600;
        var sc = Math.min(1, MAX / Math.max(w, h));
        if (Math.max(w, h) < 600) sc = Math.min(2, 1200 / Math.max(w, h));
        canvas.width = Math.round(w * sc);
        canvas.height = Math.round(h * sc);
        var ctx = canvas.getContext('2d');
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        try {
          var id = ctx.getImageData(0, 0, canvas.width, canvas.height);
          var d = id.data;
          for (var i = 0; i < d.length; i += 4) {
            var g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
            var v = Math.min(255, Math.max(0, (g - 128) * 1.5 + 128));
            d[i] = v; d[i + 1] = v; d[i + 2] = v;
          }
          ctx.putImageData(id, 0, 0);
        } catch (e) { /* tainted canvas */ }
        resolve(canvas.toDataURL('image/png'));
      } catch (e) { resolve(source); }
    };

    img.onerror = function () {
      clearTimeout(timer);
      if (blobUrl) try { URL.revokeObjectURL(blobUrl); } catch (e) { }
      if (blobUrl && typeof source === 'string' && source.startsWith('data:')) {
        blobUrl = null;
        img.onload = img.onload;
        img.onerror = function () { resolve(source); };
        img.src = source;
      } else {
        resolve(source);
      }
    };

    if (typeof source === 'string' && source.startsWith('data:')) {
      try {
        var parts = source.split(',');
        var mime = parts[0].match(/:(.*?);/)[1];
        var bstr = atob(parts[1]);
        var u8 = new Uint8Array(bstr.length);
        for (var i = 0; i < bstr.length; i++) u8[i] = bstr.charCodeAt(i);
        var blob = new Blob([u8], { type: mime });
        blobUrl = URL.createObjectURL(blob);
        img.src = blobUrl;
      } catch (e) { img.src = source; }
    } else if (source instanceof Blob || source instanceof File) {
      blobUrl = URL.createObjectURL(source);
      img.src = blobUrl;
    } else {
      img.src = source;
    }
  });
}

/* ===== CARGAR PDF.JS ===== */
function loadPdfJs() {
  return new Promise(function (resolve, reject) {
    if (window.pdfjsLib) { resolve(window.pdfjsLib); return; }
    var t = setTimeout(function () { reject(new Error('Timeout PDF.js')); }, 20000);
    var s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    s.onload = function () {
      clearTimeout(t);
      try {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        resolve(window.pdfjsLib);
      } catch (e) { reject(e); }
    };
    s.onerror = function () { clearTimeout(t); reject(new Error('PDF.js fail')); };
    document.head.appendChild(s);
  });
}

/* ===== PARSER OCR ===== */
function parseOCRText(text) {
  if (!text || text.trim().length < 3) return { vendor: '', amount: 0, date: new Date().toISOString().split('T')[0], category: 'other', description: '', invoiceNumber: '', taxAmount: 0 };
  var lines = text.split('\n').map(function (l) { return l.trim(); }).filter(function (l) { return l.length > 0; });
  var fullText = text;
  var lt = fullText.toLowerCase();
  var result = { vendor: '', amount: 0, date: new Date().toISOString().split('T')[0], category: 'other', description: '', invoiceNumber: '', taxAmount: 0 };

  var knownBrands = [
    { kw: ['vueling'], vendor: 'Vueling', cat: 'travel' },
    { kw: ['ryanair'], vendor: 'Ryanair', cat: 'travel' },
    { kw: ['iberia'], vendor: 'Iberia', cat: 'travel' },
    { kw: ['renfe'], vendor: 'Renfe', cat: 'transport' },
    { kw: ['uber'], vendor: 'Uber', cat: 'transport' },
    { kw: ['cabify'], vendor: 'Cabify', cat: 'transport' },
    { kw: ['repsol'], vendor: 'Repsol', cat: 'transport' },
    { kw: ['cepsa'], vendor: 'Cepsa', cat: 'transport' },
    { kw: ['mercadona'], vendor: 'Mercadona', cat: 'food' },
    { kw: ['carrefour'], vendor: 'Carrefour', cat: 'food' },
    { kw: ['lidl'], vendor: 'Lidl', cat: 'food' },
    { kw: ['aldi'], vendor: 'Aldi', cat: 'food' },
    { kw: ['eroski'], vendor: 'Eroski', cat: 'food' },
    { kw: ['mediamarkt', 'media markt'], vendor: 'MediaMarkt', cat: 'tech' },
    { kw: ['fnac'], vendor: 'FNAC', cat: 'tech' },
    { kw: ['pccomponentes'], vendor: 'PcComponentes', cat: 'tech' },
    { kw: ['movistar'], vendor: 'Movistar', cat: 'services' },
    { kw: ['vodafone'], vendor: 'Vodafone', cat: 'services' },
    { kw: ['endesa'], vendor: 'Endesa', cat: 'services' },
    { kw: ['naturgy'], vendor: 'Naturgy', cat: 'services' },
    { kw: ['iberdrola'], vendor: 'Iberdrola', cat: 'services' },
    { kw: ['booking.com'], vendor: 'Booking.com', cat: 'accommodation' },
    { kw: ['airbnb'], vendor: 'Airbnb', cat: 'accommodation' },
    { kw: ['nh hotel', 'hotel nh'], vendor: 'NH Hotels', cat: 'accommodation' },
    { kw: ['zara '], vendor: 'Zara', cat: 'shopping' },
    { kw: ['corte ingles', 'el corte'], vendor: 'El Corte Ingles', cat: 'shopping' },
    { kw: ['amazon'], vendor: 'Amazon', cat: 'shopping' },
    { kw: ['mcdon', 'mcdonald'], vendor: "McDonald's", cat: 'food' },
    { kw: ['burger king'], vendor: 'Burger King', cat: 'food' },
    { kw: ['glovo'], vendor: 'Glovo', cat: 'food' },
    { kw: ['farmacia'], vendor: 'Farmacia', cat: 'health' },
  ];

  var brandFound = false;
  for (var bi = 0; bi < knownBrands.length; bi++) {
    for (var ki = 0; ki < knownBrands[bi].kw.length; ki++) {
      if (lt.indexOf(knownBrands[bi].kw[ki]) !== -1) {
        result.vendor = knownBrands[bi].vendor;
        result.category = knownBrands[bi].cat;
        brandFound = true; break;
      }
    }
    if (brandFound) break;
  }

  if (!result.vendor) {
    for (var vi = 0; vi < Math.min(lines.length, 15); vi++) {
      var cl = lines[vi].replace(/[^a-zA-ZáéíóúñÁÉÍÓÚÑüÜ\s\-\.&]/g, '').trim();
      if (cl.length < 2 || cl.length > 60) continue;
      if (/^\d+$/.test(lines[vi].trim())) continue;
      if (/^(fecha|date|hora|time|total|iva|nif|cif|tel|fax|email|web|www|http|dir|invoice|factura|ticket|recibo)/i.test(lines[vi].trim())) continue;
      if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/.test(lines[vi].trim())) continue;
      if ((cl.match(/[a-zA-ZáéíóúñÁÉÍÓÚÑ]/g) || []).length < 2) continue;
      result.vendor = cl; break;
    }
  }

  /* AMOUNTS */
  var totalAmounts = [];
  for (var tl = 0; tl < lines.length; tl++) {
    if (/\btotal\b/i.test(lines[tl])) {
      var am = lines[tl].match(/(\d{1,6}[.,]\d{2})/g);
      if (am) am.forEach(function (a) { var v = parseFloat(a.replace(',', '.')); if (v > 0.5 && v < 100000) totalAmounts.push(v); });
    }
  }
  var trx = [/(?:total|importe\s*total|a\s*pagar|amount\s*due)[:\s]*(\d{1,6}[.,]\d{2})/gi, /(\d{1,6}[.,]\d{2})\s*(?:EUR|€)?\s*(?:total|a\s*pagar)/gi];
  trx.forEach(function (rx) { var m; while ((m = rx.exec(fullText)) !== null) { var v = parseFloat(m[1].replace(',', '.')); if (v > 0.5 && v < 100000) totalAmounts.push(v); } });
  if (totalAmounts.length > 0) {
    result.amount = Math.max.apply(null, totalAmounts);
  } else {
    var all = [];
    var ps = [/(\d{1,6}[.,]\d{2})\s*[€E]/g, /[€E]\s*(\d{1,6}[.,]\d{2})/g, /(\d{1,6}[.,]\d{2})\s*EUR/gi, /(\d{2,6}[.,]\d{2})\s*$/gm];
    ps.forEach(function (p) { var m; while ((m = p.exec(fullText)) !== null) { var v = parseFloat(m[1].replace(',', '.')); if (v > 0.5 && v < 99999) all.push(v); } });
    if (all.length > 0) result.amount = Math.max.apply(null, all);
  }

  /* TAX */
  var taxA = [];
  [/(?:iva|i\.v\.a|vat|tax)[:\s]*(\d{1,6}[.,]\d{2})/gi, /(\d{1,6}[.,]\d{2})\s*(?:EUR|€)?\s*(?:iva|vat)/gi].forEach(function (rx) {
    var m; while ((m = rx.exec(fullText)) !== null) taxA.push(parseFloat(m[1].replace(',', '.')));
  });
  if (taxA.length > 0) {
    var vt = taxA.filter(function (t) { return t < result.amount * 0.5 && t > 0; });
    result.taxAmount = vt.length > 0 ? Math.max.apply(null, vt) : Math.min.apply(null, taxA);
  } else if (result.amount > 0) {
    result.taxAmount = parseFloat((result.amount * 0.21 / 1.21).toFixed(2));
  }

  /* DATE */
  var dr = /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/g; var dm;
  while ((dm = dr.exec(fullText)) !== null) {
    var dd = parseInt(dm[1]); var mm = parseInt(dm[2]); var yy = parseInt(dm[3]);
    if (yy < 100) yy += 2000;
    if (mm > 12 && dd <= 12) { var tmp = dd; dd = mm; mm = tmp; }
    if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31 && yy >= 2020 && yy <= 2030) {
      result.date = yy + '-' + String(mm).padStart(2, '0') + '-' + String(dd).padStart(2, '0'); break;
    }
  }

  /* INVOICE NUMBER */
  var ips = [/(?:invoice|factura|fra|ticket|n[°ºo]|num|receipt|ref)[.:\s#]*([A-Z0-9][\w\-\/]{4,})/i, /([A-Z]{1,4}\d{6,})/, /([A-Z]{1,3}[\-\/]\d{3,})/];
  for (var ip = 0; ip < ips.length; ip++) { var im = fullText.match(ips[ip]); if (im) { result.invoiceNumber = im[1].trim(); break; } }
  if (!result.invoiceNumber) result.invoiceNumber = 'T-' + Date.now().toString().slice(-6);

  /* CATEGORY FROM KEYWORDS */
  if (!brandFound) {
    var kwMap = { food: ['restaurante', 'bar ', 'cafeteria', 'supermercado', 'comida', 'menu', 'cafe'], transport: ['gasolinera', 'combustible', 'gasolina', 'parking', 'taxi'], accommodation: ['hotel', 'hostal', 'alojamiento'], office: ['oficina', 'papeleria'], tech: ['electronica', 'informatica', 'movil'], health: ['farmacia', 'clinica', 'dental', 'medico', 'hospital'], travel: ['vuelo', 'billete', 'avion', 'flight', 'boarding'], shopping: ['ropa', 'tienda', 'boutique'], services: ['telefon', 'internet', 'luz', 'gas', 'agua', 'seguro'] };
    var ks = Object.keys(kwMap);
    outer: for (var ci = 0; ci < ks.length; ci++) {
      for (var kk = 0; kk < kwMap[ks[ci]].length; kk++) {
        if (lt.indexOf(kwMap[ks[ci]][kk]) !== -1) { result.category = ks[ci]; break outer; }
      }
    }
  }

  result.description = result.vendor ? ('Factura ' + result.vendor) : ('Factura de ' + getCat(result.category).name);
  return result;
}

/* ===== COMPONENTE PRINCIPAL ===== */
export default function App() {
  var _v = useState('dashboard'); var view = _v[0]; var setView = _v[1];
  var _r = useState([]); var receipts = _r[0]; var setReceipts = _r[1];
  var _sel = useState(null); var selectedReceipt = _sel[0]; var setSelectedReceipt = _sel[1];
  var _sc = useState(false); var isScanning = _sc[0]; var setIsScanning = _sc[1];
  var _sp = useState(0); var scanProgress = _sp[0]; var setScanProgress = _sp[1];
  var _ef = useState(null); var editForm = _ef[0]; var setEditForm = _ef[1];
  var _sq = useState(''); var searchQuery = _sq[0]; var setSearchQuery = _sq[1];
  var _fc = useState('all'); var filterCategory = _fc[0]; var setFilterCategory = _fc[1];
  var _fp = useState('all'); var filterPaid = _fp[0]; var setFilterPaid = _fp[1];
  var _sf = useState(false); var showFilters = _sf[0]; var setShowFilters = _sf[1];
  var _n = useState(null); var notification = _n[0]; var setNotification = _n[1];
  var _ni = useState(1); var nextId = _ni[0]; var setNextId = _ni[1];
  var _ip = useState(null); var showImagePreview = _ip[0]; var setShowImagePreview = _ip[1];
  var _st = useState(''); var scanStatus = _st[0]; var setScanStatus = _st[1];
  var _lo = useState(true); var isLoading = _lo[0]; var setIsLoading = _lo[1];
  var _sv = useState(false); var isSaving = _sv[0]; var setIsSaving = _sv[1];
  var _on = useState(true); var isOnline = _on[0]; var setIsOnline = _on[1];

  var fileInputRef = useRef(null);
  var cameraInputRef = useRef(null);
  var pendingFileRef = useRef(null);

  var showNotif = function (msg) { setNotification(msg); setTimeout(function () { setNotification(null); }, 3500); };

  /* ===== CARGAR DESDE FIREBASE AL MONTAR ===== */
  useEffect(function () {
    fbLoadReceipts().then(function (data) {
      var mapped = data.map(function (d, i) {
        return {
          id: i + 1, firebaseId: d.firebaseId, vendor: d.vendor, amount: d.amount,
          date: d.date, category: d.category, description: d.description,
          invoiceNumber: d.invoiceNumber, taxAmount: d.taxAmount, paid: d.paid,
          fileType: d.fileType, imageData: d.imageData, imagePath: d.imagePath, ocrText: d.ocrText || '',
        };
      });
      setReceipts(mapped);
      setNextId(mapped.length + 1);
      setIsOnline(true);
      setIsLoading(false);
    }).catch(function (err) {
      console.error('Firebase load error:', err);
      setIsOnline(false);
      setIsLoading(false);
      showNotif('Sin conexion a Firebase. Modo local.');
    });
  }, []);

  /* ===== FORMULARIO MANUAL ===== */
  var openManualForm = function (fileName, fileType) {
    setEditForm({
      vendor: '', amount: 0, date: new Date().toISOString().split('T')[0],
      category: 'other', description: '', invoiceNumber: 'T-' + Date.now().toString().slice(-6),
      taxAmount: 0, paid: false, fileType: fileType || 'manual', fileName: fileName || '',
      imageData: null, ocrText: '',
    });
  };

  /* ===== OCR ===== */
  var realAIScan = async function (ocrSource, imageDataForPreview, fileName, fileType) {
    setIsScanning(true); setScanProgress(0); setScanStatus('Preparando imagen...');
    try {
      setScanProgress(5);
      var processedImage = await preprocessImage(ocrSource);
      setScanProgress(10); setScanStatus('Iniciando motor OCR...');
      var worker = await createWorker('spa', 1, {
        logger: function (info) {
          if (info.status === 'recognizing text') { setScanProgress(25 + Math.round(info.progress * 60)); setScanStatus('Leyendo texto... ' + Math.round(info.progress * 100) + '%'); }
          else if (info.status === 'loading language traineddata') { setScanProgress(10 + Math.round(info.progress * 15)); setScanStatus('Descargando idioma...'); }
          else if (info.status === 'initializing api') { setScanProgress(22); setScanStatus('Inicializando...'); }
        }
      });
      setScanProgress(25); setScanStatus('Analizando imagen...');
      var ocrResult = await worker.recognize(processedImage);
      var ocrText = (ocrResult && ocrResult.data && ocrResult.data.text) || '';
      await worker.terminate();

      if (ocrSource && typeof ocrSource === 'string' && ocrSource.startsWith('blob:')) {
        try { URL.revokeObjectURL(ocrSource); } catch (e) { }
      }

      setScanProgress(90); setScanStatus('Extrayendo datos...');
      var parsed = parseOCRText(ocrText);
      setScanProgress(100); setScanStatus('Completado!');
      setTimeout(function () {
        setEditForm({
          vendor: parsed.vendor, amount: parsed.amount, date: parsed.date,
          category: parsed.category, description: parsed.description,
          invoiceNumber: parsed.invoiceNumber, taxAmount: parsed.taxAmount,
          paid: false, fileType: fileType || 'jpg', fileName: fileName,
          imageData: imageDataForPreview, ocrText: ocrText,
        });
        setIsScanning(false); setScanProgress(0); setScanStatus('');
        showNotif(ocrText.trim().length < 5 ? 'Poco texto detectado. Revisa datos.' : 'Texto leido (' + ocrText.trim().split('\n').length + ' lineas). Revisa datos.');
      }, 500);
    } catch (err) {
      if (ocrSource && typeof ocrSource === 'string' && ocrSource.startsWith('blob:')) { try { URL.revokeObjectURL(ocrSource); } catch (e) { } }
      setEditForm({
        vendor: '', amount: 0, date: new Date().toISOString().split('T')[0], category: 'other',
        description: '', invoiceNumber: 'T-' + Date.now().toString().slice(-6), taxAmount: 0,
        paid: false, fileType: fileType || 'jpg', fileName: fileName,
        imageData: imageDataForPreview, ocrText: 'Error: ' + (err && err.message ? err.message : 'OCR fallo'),
      });
      setIsScanning(false); setScanProgress(0); setScanStatus('');
      showNotif('Error OCR. Introduce datos manualmente.');
    }
  };

  /* ===== PROCESAR PDF ===== */
  var processPdf = function (dataUrl, fileName) {
    setIsScanning(true); setScanProgress(5); setScanStatus('Cargando lector PDF...');
    pendingFileRef.current = null;
    var timeout = setTimeout(function () {
      setIsScanning(false); setScanProgress(0); setScanStatus('');
      openManualForm(fileName, 'pdf'); showNotif('PDF tardo demasiado.');
    }, 30000);

    loadPdfJs().then(function (pdfjsLib) {
      setScanProgress(15); setScanStatus('Abriendo PDF...');
      var base64 = dataUrl.split(',')[1]; var bin = atob(base64);
      var bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return pdfjsLib.getDocument({ data: bytes }).promise;
    }).then(function (pdf) {
      setScanProgress(25); setScanStatus('Leyendo pagina 1...');
      return pdf.getPage(1);
    }).then(function (page) {
      var vp = page.getViewport({ scale: 2 });
      var canvas = document.createElement('canvas');
      canvas.width = vp.width; canvas.height = vp.height;
      var ctx = canvas.getContext('2d');
      ctx.fillStyle = '#FFF'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      return page.render({ canvasContext: ctx, viewport: vp }).promise.then(function () {
        var imgUrl = canvas.toDataURL('image/jpeg', 0.9);
        return page.getTextContent().then(function (tc) {
          var txt = ''; var ly = null;
          tc.items.forEach(function (it) { if (ly !== null && Math.abs(it.transform[5] - ly) > 5) txt += '\n'; txt += it.str + ' '; ly = it.transform[5]; });
          return { image: imgUrl, text: txt };
        }).catch(function () { return { image: imgUrl, text: '' }; });
      });
    }).then(function (res) {
      clearTimeout(timeout);
      if (res.text && res.text.trim().length > 20) {
        setScanProgress(80); setScanStatus('Analizando texto PDF...');
        var parsed = parseOCRText(res.text);
        setScanProgress(100); setScanStatus('Completado!');
        setTimeout(function () {
          setEditForm({
            vendor: parsed.vendor, amount: parsed.amount, date: parsed.date, category: parsed.category,
            description: parsed.description, invoiceNumber: parsed.invoiceNumber, taxAmount: parsed.taxAmount,
            paid: false, fileType: 'pdf', fileName: fileName, imageData: res.image, ocrText: res.text,
          });
          setIsScanning(false); setScanProgress(0); setScanStatus('');
          showNotif('PDF leido! Revisa los datos.');
        }, 400);
      } else {
        setScanProgress(30); setScanStatus('PDF sin texto, escaneando imagen...');
        setIsScanning(false);
        realAIScan(res.image, res.image, fileName, 'pdf');
      }
    }).catch(function () {
      clearTimeout(timeout);
      setIsScanning(false); setScanProgress(0); setScanStatus('');
      openManualForm(fileName, 'pdf'); showNotif('Error PDF. Introduce datos manualmente.');
    });
  };

  /* ===== SUBIR ARCHIVO (fix capturas: usa blobUrl) ===== */
  var handleFileUpload = function (e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    var name = file.name || 'archivo';
    showNotif('Archivo recibido: ' + name.substring(0, 25));
    if (file.size > 15 * 1024 * 1024) { showNotif('Archivo muy grande (max 15MB)'); e.target.value = ''; return; }
    var isPDF = file.type === 'application/pdf' || name.toLowerCase().indexOf('.pdf') !== -1;

    if (isPDF) {
      pendingFileRef.current = null;
      var reader = new FileReader();
      reader.onload = function (ev) { processPdf(ev.target.result, name); };
      reader.onerror = function () { showNotif('Error leyendo PDF'); };
      reader.readAsDataURL(file);
    } else {
      pendingFileRef.current = file;
      var blobUrl = URL.createObjectURL(file);
      var reader2 = new FileReader();
      reader2.onload = function (ev) {
        var dataUrl = ev.target.result;
        realAIScan(blobUrl, dataUrl, name, 'jpg');
      };
      reader2.onerror = function () {
        realAIScan(blobUrl, blobUrl, name, 'jpg');
      };
      reader2.readAsDataURL(file);
    }
    e.target.value = '';
  };

  /* ===== GUARDAR (Firebase) ===== */
  var saveReceipt = async function () {
    if (!editForm) return;
    setIsSaving(true);
    try {
      var saved = await fbSaveReceipt(editForm, pendingFileRef.current);
      pendingFileRef.current = null;
      var nr = {
        id: nextId, firebaseId: saved.firebaseId, vendor: editForm.vendor,
        amount: editForm.amount, date: editForm.date, category: editForm.category,
        description: editForm.description, invoiceNumber: editForm.invoiceNumber,
        taxAmount: editForm.taxAmount, paid: editForm.paid, fileType: editForm.fileType,
        imageData: saved.imageUrl || editForm.imageData,
        imagePath: saved.imagePath, ocrText: editForm.ocrText,
      };
      setReceipts(function (p) { return [nr].concat(p); });
      setNextId(function (p) { return p + 1; });
      setEditForm(null); setView('receipts');
      showNotif('Factura guardada en la nube ☁️');
    } catch (err) {
      console.error('Save error:', err);
      pendingFileRef.current = null;
      var nr2 = {
        id: nextId, firebaseId: null, vendor: editForm.vendor,
        amount: editForm.amount, date: editForm.date, category: editForm.category,
        description: editForm.description, invoiceNumber: editForm.invoiceNumber,
        taxAmount: editForm.taxAmount, paid: editForm.paid, fileType: editForm.fileType,
        imageData: editForm.imageData, imagePath: null, ocrText: editForm.ocrText,
      };
      setReceipts(function (p) { return [nr2].concat(p); });
      setNextId(function (p) { return p + 1; });
      setEditForm(null); setView('receipts');
      showNotif('Guardada localmente (error nube)');
    }
    setIsSaving(false);
  };

  /* ===== TOGGLE PAGADA (Firebase) ===== */
  var togglePaid = function (id) {
    setReceipts(function (prev) {
      return prev.map(function (r) {
        if (r.id === id) {
          var updated = Object.assign({}, r, { paid: !r.paid });
          if (r.firebaseId) fbUpdateReceipt(r.firebaseId, { paid: updated.paid }).catch(function () { });
          return updated;
        }
        return r;
      });
    });
    if (selectedReceipt && selectedReceipt.id === id) {
      setSelectedReceipt(function (p) { return p ? Object.assign({}, p, { paid: !p.paid }) : null; });
    }
  };

  /* ===== ELIMINAR (Firebase) ===== */
  var deleteReceipt = async function (id) {
    var receipt = receipts.find(function (r) { return r.id === id; });
    if (receipt && receipt.firebaseId) {
      try { await fbDeleteReceipt(receipt.firebaseId, receipt.imagePath); } catch (e) { }
    }
    setReceipts(function (p) { return p.filter(function (r) { return r.id !== id; }); });
    setSelectedReceipt(null);
    showNotif('Factura eliminada');
  };

  /* ===== FILTROS ===== */
  var filteredReceipts = useMemo(function () {
    return receipts.filter(function (r) {
      var ms = !searchQuery || r.vendor.toLowerCase().indexOf(searchQuery.toLowerCase()) !== -1 || r.description.toLowerCase().indexOf(searchQuery.toLowerCase()) !== -1 || r.invoiceNumber.toLowerCase().indexOf(searchQuery.toLowerCase()) !== -1;
      var mc = filterCategory === 'all' || r.category === filterCategory;
      var mp = filterPaid === 'all' || (filterPaid === 'paid' && r.paid) || (filterPaid === 'unpaid' && !r.paid);
      return ms && mc && mp;
    });
  }, [receipts, searchQuery, filterCategory, filterPaid]);

  /* ===== STATS ===== */
  var stats = useMemo(function () {
    var total = receipts.reduce(function (s, r) { return s + r.amount; }, 0);
    var totalTax = receipts.reduce(function (s, r) { return s + r.taxAmount; }, 0);
    var unpaid = receipts.filter(function (r) { return !r.paid; });
    var unpaidTotal = unpaid.reduce(function (s, r) { return s + r.amount; }, 0);
    var categoryTotals = CATEGORIES.map(function (cat) {
      var cr = receipts.filter(function (r) { return r.category === cat.id; });
      return Object.assign({}, cat, { total: cr.reduce(function (s, r) { return s + r.amount; }, 0), count: cr.length });
    }).filter(function (c) { return c.count > 0; }).sort(function (a, b) { return b.total - a.total; });
    var md = {};
    receipts.forEach(function (r) { var m = r.date.substring(0, 7); md[m] = (md[m] || 0) + r.amount; });
    var monthlyChart = Object.entries(md).sort(function (a, b) { return a[0].localeCompare(b[0]); }).map(function (e) {
      return { name: new Date(e[0] + '-01').toLocaleDateString('es-ES', { month: 'short', year: '2-digit' }), total: parseFloat(e[1].toFixed(2)) };
    });
    return { total: total, totalTax: totalTax, unpaidCount: unpaid.length, unpaidTotal: unpaidTotal, categoryTotals: categoryTotals, monthlyChart: monthlyChart };
  }, [receipts]);

  /* ===== EXPORTAR ===== */
  var exportCSV = function () {
    try {
      var h = ['Fecha', 'Proveedor', 'No Factura', 'Descripcion', 'Categoria', 'Importe', 'IVA', 'Pagada'];
      var rows = filteredReceipts.map(function (r) { return [r.date, r.vendor, r.invoiceNumber, r.description, getCat(r.category).name, r.amount.toFixed(2), r.taxAmount.toFixed(2), r.paid ? 'Si' : 'No']; });
      var csv = [h].concat(rows).map(function (row) { return row.map(function (c) { return '"' + c + '"'; }).join(','); }).join('\n');
      var blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'facturas_' + new Date().toISOString().split('T')[0] + '.csv'; a.click();
      showNotif('CSV exportado');
    } catch (e) { showNotif('Error al exportar'); }
  };

  var exportPDF = function () {
    var ta = filteredReceipts.reduce(function (s, r) { return s + r.amount; }, 0);
    var tt = filteredReceipts.reduce(function (s, r) { return s + r.taxAmount; }, 0);
    var tableRows = filteredReceipts.map(function (r) {
      return '<tr><td>' + r.date + '</td><td>' + r.vendor + '</td><td>' + r.invoiceNumber + '</td><td>' + getCat(r.category).emoji + ' ' + getCat(r.category).name + '</td><td>' + r.amount.toFixed(2) + ' EUR</td><td>' + r.taxAmount.toFixed(2) + ' EUR</td><td class="' + (r.paid ? 'g' : 'r') + '">' + (r.paid ? 'Pagada' : 'Pendiente') + '</td></tr>';
    }).join('');
    var html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>TicketAI</title><style>body{font-family:Arial;padding:40px;color:#333}h1{color:#4f46e5;border-bottom:2px solid #4f46e5;padding-bottom:10px}table{width:100%;border-collapse:collapse;margin:20px 0}th{background:#4f46e5;color:#fff;padding:10px;text-align:left;font-size:13px}td{padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:13px}tr:nth-child(even){background:#f9fafb}.g{color:#16a34a}.r{color:#dc2626}.cards{display:flex;gap:20px;margin:20px 0;flex-wrap:wrap}.card{background:#f3f4f6;padding:15px 25px;border-radius:8px;min-width:150px}.card h3{margin:0;color:#6b7280;font-size:13px}.card p{margin:5px 0 0;font-size:22px;font-weight:700;color:#4f46e5}@media print{body{padding:20px}}</style></head><body><h1>TicketAI - Informe de Gastos</h1><p style="color:#6b7280">' + new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) + '</p><div class="cards"><div class="card"><h3>Total</h3><p>' + ta.toFixed(2) + ' EUR</p></div><div class="card"><h3>IVA</h3><p>' + tt.toFixed(2) + ' EUR</p></div><div class="card"><h3>Facturas</h3><p>' + filteredReceipts.length + '</p></div></div><table><tr><th>Fecha</th><th>Proveedor</th><th>No Factura</th><th>Categoria</th><th>Importe</th><th>IVA</th><th>Estado</th></tr>' + tableRows + '</table><script>window.print();<\/script></body></html>';
    try { var w = window.open('', '_blank'); if (w) { w.document.write(html); w.document.close(); } } catch (e) { showNotif('Permite pop-ups'); }
  };

  var navTo = function (v) {
    setView(v);
    if (v === 'receipts') setSelectedReceipt(null);
    if (v === 'upload') { setEditForm(null); setIsScanning(false); setScanStatus(''); pendingFileRef.current = null; }
  };

  /* ===== LOADING SCREEN ===== */
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center max-w-lg mx-auto">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }} className="w-12 h-12 rounded-full border-4 border-indigo-200 border-t-indigo-600 mb-4" />
        <h2 className="text-lg font-bold text-gray-700">TicketAI</h2>
        <p className="text-sm text-gray-400 mt-1">Conectando con Firebase...</p>
      </div>
    );
  }

  /* ===== RENDER ===== */
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-lg mx-auto relative overflow-hidden">

      <AnimatePresence>
        {showImagePreview && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4" onClick={function () { setShowImagePreview(null); }}>
            <button className="absolute top-4 right-4 text-white bg-white/20 rounded-full p-2"><X size={24} /></button>
            <img src={showImagePreview} alt="Preview" className="max-w-full max-h-full object-contain rounded-lg" />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {notification && (
          <motion.div initial={{ opacity: 0, y: -40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -40 }} className="fixed top-4 left-0 right-0 z-50 flex justify-center pointer-events-none">
            <div className="bg-gray-900 text-white px-5 py-2.5 rounded-xl shadow-xl text-sm font-medium pointer-events-auto">{notification}</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HEADER */}
      <div className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-5 pt-5 pb-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight">TicketAI</h1>
              {isOnline ? <Cloud size={14} className="text-emerald-300" /> : <CloudOff size={14} className="text-red-300" />}
            </div>
            <p className="text-indigo-200 text-xs mt-0.5">{isOnline ? 'Conectado a Firebase' : 'Modo sin conexion'}</p>
          </div>
          <button onClick={function () { navTo('upload'); }} className="bg-white text-indigo-600 rounded-full p-2.5 shadow-lg active:scale-95 transition-transform"><Plus size={18} strokeWidth={3} /></button>
        </div>
      </div>

      {/* CONTENT */}
      <div className="flex-1 overflow-y-auto pb-24">
        <AnimatePresence mode="wait">

          {/* ===== DASHBOARD ===== */}
          {view === 'dashboard' && (
            <motion.div key="dash" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="px-4 py-4">
              {receipts.length === 0 ? (
                <div className="text-center py-20">
                  <Camera size={48} className="mx-auto text-indigo-300 mb-4" />
                  <h3 className="text-lg font-bold text-gray-700 mb-2">Bienvenido a TicketAI</h3>
                  <p className="text-sm text-gray-400 mb-6">Escanea tu primera factura para empezar</p>
                  <button onClick={function () { navTo('upload'); }} className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-medium text-sm shadow-lg">Escanear Factura</button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3 mb-5">
                    {[
                      { label: 'Total Gastos', val: fmt(stats.total), sub: receipts.length + ' facturas', color: 'text-gray-900' },
                      { label: 'IVA Soportado', val: fmt(stats.totalTax), sub: 'Deducible', color: 'text-indigo-600' },
                      { label: 'Pendientes', val: String(stats.unpaidCount), sub: fmt(stats.unpaidTotal), color: 'text-amber-500' },
                    ].map(function (c, i) {
                      return (
                        <motion.div key={i} whileTap={{ scale: 0.97 }} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                          <p className="text-xs text-gray-500 font-medium">{c.label}</p>
                          <p className={'text-lg font-bold mt-1 ' + c.color}>{c.val}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{c.sub}</p>
                        </motion.div>
                      );
                    })}
                    <motion.div whileTap={{ scale: 0.97 }} onClick={function () { navTo('upload'); }} className="bg-indigo-50 rounded-2xl p-4 shadow-sm border border-indigo-100 cursor-pointer">
                      <p className="text-xs text-indigo-500 font-medium">Escanear</p>
                      <Camera size={22} className="text-indigo-500 mt-1.5" />
                      <p className="text-xs text-indigo-400 mt-1">+ Nueva factura</p>
                    </motion.div>
                  </div>

                  <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-5">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Gastos por Categoria</h3>
                    {stats.categoryTotals.slice(0, 6).map(function (cat, i) {
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
                          <defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} /><stop offset="95%" stopColor="#6366f1" stopOpacity={0} /></linearGradient></defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                          <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                          <YAxis tick={{ fontSize: 10 }} stroke="#9ca3af" width={45} />
                          <Tooltip formatter={function (v) { return [v + ' EUR', 'Total']; }} />
                          <Area type="monotone" dataKey="total" stroke="#6366f1" fill="url(#cg)" strokeWidth={2} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-sm font-semibold text-gray-700">Ultimas Facturas</h3>
                    <button onClick={function () { navTo('receipts'); }} className="text-xs text-indigo-500 font-medium">Ver todas</button>
                  </div>
                  {receipts.slice(0, 5).map(function (r) {
                    var cat = getCat(r.category);
                    return (
                      <motion.div key={r.id} whileTap={{ scale: 0.98 }} onClick={function () { setSelectedReceipt(r); setView('receipts'); }} className="bg-white rounded-xl p-3 mb-2 shadow-sm border border-gray-100 flex items-center cursor-pointer">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 overflow-hidden" style={{ backgroundColor: cat.color + '18' }}>
                          {r.imageData ? <img src={r.imageData} alt="" className="w-full h-full object-cover" /> : cat.emoji}
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
                </>
              )}
            </motion.div>
          )}

          {/* ===== UPLOAD / SCAN ===== */}
          {view === 'upload' && (
            <motion.div key="upload" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="px-4 py-4">
              {!isScanning && !editForm && (
                <div>
                  <h2 className="text-lg font-bold text-gray-800 mb-1">Escanear Factura</h2>
                  <p className="text-sm text-gray-500 mb-5">Haz foto, sube imagen/captura o PDF</p>
                  <motion.button whileTap={{ scale: 0.97 }} onClick={function () { cameraInputRef.current && cameraInputRef.current.click(); }} className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-2xl p-6 mb-4 flex flex-col items-center shadow-lg">
                    <Camera size={36} className="mb-2" />
                    <span className="font-semibold">Hacer Foto</span>
                    <span className="text-indigo-200 text-xs mt-1">Camara del movil</span>
                  </motion.button>
                  <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileUpload} />
                  <motion.button whileTap={{ scale: 0.98 }} onClick={function () { fileInputRef.current && fileInputRef.current.click(); }} className="w-full border-2 border-dashed border-gray-300 rounded-2xl p-8 flex flex-col items-center hover:border-indigo-400 transition-colors">
                    <Upload size={32} className="text-gray-400 mb-3" />
                    <span className="font-medium text-gray-600 text-sm">Subir archivo o captura</span>
                    <span className="text-gray-400 text-xs mt-1">JPG, PNG, capturas o PDF</span>
                  </motion.button>
                  <input ref={fileInputRef} type="file" accept="image/*,.pdf,application/pdf" className="hidden" onChange={handleFileUpload} />
                  <button onClick={function () { openManualForm('', 'manual'); }} className="w-full mt-4 py-3 text-indigo-600 font-medium text-sm border border-indigo-200 rounded-xl">Introducir manualmente</button>
                </div>
              )}

              {isScanning && (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center py-16">
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }} className="w-16 h-16 rounded-full border-4 border-indigo-200 border-t-indigo-600 mb-6" />
                  <h3 className="text-lg font-bold text-gray-800 mb-2">Procesando...</h3>
                  <p className="text-sm text-gray-500 mb-1">{scanStatus || 'Procesando...'}</p>
                  <p className="text-xs text-amber-500 mb-4">La primera vez tarda mas</p>
                  <div className="w-full max-w-xs bg-gray-200 rounded-full h-2 mb-2">
                    <motion.div className="bg-indigo-600 h-2 rounded-full" style={{ width: Math.min(scanProgress, 100) + '%' }} />
                  </div>
                  <p className="text-xs text-gray-400 mb-6">{Math.min(Math.round(scanProgress), 100)}%</p>
                  <div className="space-y-2 w-full max-w-xs">
                    {[{ t: 3, l: 'Archivo recibido' }, { t: 10, l: 'Motor listo' }, { t: 30, l: 'Leyendo texto...' }, { t: 60, l: 'Texto extraido' }, { t: 90, l: 'Datos analizados' }].filter(function (s) { return scanProgress > s.t; }).map(function (s, i) {
                      return <motion.div key={i} initial={{ opacity: 0, x: -15 }} animate={{ opacity: 1, x: 0 }} className="flex items-center text-sm text-emerald-600"><Check size={14} className="mr-2 flex-shrink-0" />{s.l}</motion.div>;
                    })}
                  </div>
                  <button onClick={function () { setIsScanning(false); setScanProgress(0); setScanStatus(''); openManualForm('', 'manual'); }} className="mt-8 text-sm text-red-500 underline">Cancelar</button>
                </motion.div>
              )}

              {editForm && !isScanning && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-gray-800">Revisar Datos</h3>
                    <span className="text-xs bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full font-medium">
                      {editForm.fileType === 'pdf' ? 'PDF' : editForm.fileType === 'manual' ? 'Manual' : 'OCR'}
                    </span>
                  </div>
                  {editForm.imageData && (
                    <div className="mb-4">
                      <img src={editForm.imageData} alt="Documento" className="w-full max-h-48 object-contain rounded-xl border border-gray-200 cursor-pointer bg-gray-50" onClick={function () { setShowImagePreview(editForm.imageData); }} />
                      <p className="text-xs text-gray-400 mt-1 text-center">Toca para ampliar</p>
                    </div>
                  )}
                  {editForm.ocrText && editForm.ocrText.length > 0 && (
                    <details className="mb-4 bg-blue-50 rounded-xl p-3 border border-blue-100">
                      <summary className="text-xs text-blue-600 cursor-pointer font-medium">🔍 Texto detectado ({editForm.ocrText.length} chars)</summary>
                      <pre className="text-xs text-gray-600 mt-2 bg-white p-2 rounded-lg whitespace-pre-wrap max-h-40 overflow-y-auto border">{editForm.ocrText}</pre>
                    </details>
                  )}
                  <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
                    <div>
                      <label className="text-xs font-medium text-gray-500 mb-1 block">Proveedor</label>
                      <input type="text" value={editForm.vendor} onChange={function (e) { setEditForm(Object.assign({}, editForm, { vendor: e.target.value })); }} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><label className="text-xs font-medium text-gray-500 mb-1 block">Importe (EUR)</label><input type="number" step="0.01" value={editForm.amount} onChange={function (e) { setEditForm(Object.assign({}, editForm, { amount: parseFloat(e.target.value) || 0 })); }} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div>
                      <div><label className="text-xs font-medium text-gray-500 mb-1 block">IVA (EUR)</label><input type="number" step="0.01" value={editForm.taxAmount} onChange={function (e) { setEditForm(Object.assign({}, editForm, { taxAmount: parseFloat(e.target.value) || 0 })); }} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><label className="text-xs font-medium text-gray-500 mb-1 block">Fecha</label><input type="date" value={editForm.date} onChange={function (e) { setEditForm(Object.assign({}, editForm, { date: e.target.value })); }} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div>
                      <div><label className="text-xs font-medium text-gray-500 mb-1 block">No Factura</label><input type="text" value={editForm.invoiceNumber} onChange={function (e) { setEditForm(Object.assign({}, editForm, { invoiceNumber: e.target.value })); }} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 mb-1 block">Categoria</label>
                      <select value={editForm.category} onChange={function (e) { setEditForm(Object.assign({}, editForm, { category: e.target.value })); }} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                        {CATEGORIES.map(function (c) { return <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>; })}
                      </select>
                    </div>
                    <div><label className="text-xs font-medium text-gray-500 mb-1 block">Descripcion</label><input type="text" value={editForm.description} onChange={function (e) { setEditForm(Object.assign({}, editForm, { description: e.target.value })); }} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div>
                    <button onClick={function () { setEditForm(Object.assign({}, editForm, { paid: !editForm.paid })); }} className="flex items-center pt-1">
                      {editForm.paid ? <CheckCircle2 size={20} className="text-emerald-500 mr-2" /> : <Circle size={20} className="text-gray-300 mr-2" />}
                      <span className="text-sm text-gray-600">Marcar como pagada</span>
                    </button>
                  </div>
                  <div className="flex gap-3 mt-4">
                    <button onClick={function () { setEditForm(null); pendingFileRef.current = null; }} className="flex-1 py-3 border border-gray-200 rounded-xl text-gray-600 font-medium text-sm">Cancelar</button>
                    <button onClick={saveReceipt} disabled={isSaving} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-medium text-sm shadow-lg disabled:opacity-50 flex items-center justify-center gap-2">
                      {isSaving && <Loader2 size={16} className="animate-spin" />}
                      {isSaving ? 'Guardando...' : 'Guardar'}
                    </button>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* ===== LISTA FACTURAS ===== */}
          {view === 'receipts' && !selectedReceipt && (
            <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="px-4 py-4">
              <div className="relative mb-3">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" placeholder="Buscar facturas..." value={searchQuery} onChange={function (e) { setSearchQuery(e.target.value); }} className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
                <button onClick={function () { setShowFilters(!showFilters); }} className={'flex items-center px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ' + (showFilters ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600')}><Filter size={12} className="mr-1" /> Categoria</button>
                <button onClick={function () { setFilterPaid(filterPaid === 'unpaid' ? 'all' : 'unpaid'); }} className={'px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ' + (filterPaid === 'unpaid' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600')}>Pendientes</button>
                <button onClick={function () { setFilterPaid(filterPaid === 'paid' ? 'all' : 'paid'); }} className={'px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ' + (filterPaid === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600')}>Pagadas</button>
              </div>
              {showFilters && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="mb-3">
                  <select value={filterCategory} onChange={function (e) { setFilterCategory(e.target.value); }} className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm">
                    <option value="all">Todas las categorias</option>
                    {CATEGORIES.map(function (c) { return <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>; })}
                  </select>
                </motion.div>
              )}
              <div className="flex justify-between items-center mb-3">
                <p className="text-xs text-gray-400">{filteredReceipts.length} facturas</p>
                <p className="text-xs font-semibold text-gray-600">Total: {fmt(filteredReceipts.reduce(function (s, r) { return s + r.amount; }, 0))}</p>
              </div>
              {filteredReceipts.length === 0 && (
                <div className="text-center py-16"><FileText size={40} className="mx-auto text-gray-300 mb-3" /><p className="text-gray-400 text-sm">No hay facturas</p><button onClick={function () { navTo('upload'); }} className="mt-4 text-indigo-600 text-sm font-medium">Escanear primera factura</button></div>
              )}
              {filteredReceipts.map(function (r, i) {
                var cat = getCat(r.category);
                return (
                  <motion.div key={r.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.3) }} className="bg-white rounded-xl p-3 mb-2 shadow-sm border border-gray-100 flex items-center">
                    <button onClick={function (e) { e.stopPropagation(); togglePaid(r.id); }} className="mr-2.5 flex-shrink-0">
                      {r.paid ? <CheckCircle2 size={22} className="text-emerald-500" /> : <Circle size={22} className="text-gray-300" />}
                    </button>
                    <div className="flex-1 flex items-center cursor-pointer min-w-0" onClick={function () { setSelectedReceipt(r); }}>
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center text-base flex-shrink-0 overflow-hidden" style={{ backgroundColor: cat.color + '18' }}>
                        {r.imageData ? <img src={r.imageData} alt="" className="w-full h-full object-cover" /> : cat.emoji}
                      </div>
                      <div className="flex-1 ml-2.5 min-w-0">
                        <p className={'text-sm font-medium truncate ' + (r.paid ? 'text-gray-400 line-through' : 'text-gray-800')}>{r.vendor}</p>
                        <p className="text-xs text-gray-400 truncate">{r.date} · {r.invoiceNumber}</p>
                      </div>
                      <div className="text-right ml-2 flex-shrink-0">
                        <p className="text-sm font-bold text-gray-800">{fmt(r.amount)}</p>
                        <p className="text-xs text-gray-400">{r.firebaseId ? '☁️' : ''} {cat.name}</p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          )}

          {/* ===== DETALLE ===== */}
          {view === 'receipts' && selectedReceipt && (
            <motion.div key="detail" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="px-4 py-4">
              <button onClick={function () { setSelectedReceipt(null); }} className="text-sm text-indigo-600 font-medium mb-4">← Volver</button>
              {(function () {
                var r = selectedReceipt; var cat = getCat(r.category);
                return (
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-5 text-center border-b border-gray-100" style={{ backgroundColor: cat.color + '10' }}>
                      <span className="text-3xl block mb-1">{cat.emoji}</span>
                      <h3 className="text-base font-bold text-gray-800">{r.vendor}</h3>
                      <p className="text-3xl font-bold mt-2" style={{ color: cat.color }}>{fmt(r.amount)}</p>
                      <div className="flex items-center justify-center gap-2 mt-2">
                        <span className={'inline-block px-3 py-1 rounded-full text-xs font-medium ' + (r.paid ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700')}>{r.paid ? 'Pagada' : 'Pendiente'}</span>
                        {r.firebaseId && <span className="text-xs text-gray-400">☁️ En la nube</span>}
                      </div>
                    </div>
                    {r.imageData && (
                      <div className="p-4 border-b border-gray-100 bg-gray-50">
                        <p className="text-xs font-medium text-gray-500 mb-2">📷 Documento</p>
                        <img src={r.imageData} alt="Doc" className="w-full max-h-64 object-contain rounded-lg cursor-pointer border border-gray-200 bg-white" onClick={function () { setShowImagePreview(r.imageData); }} />
                      </div>
                    )}
                    <div className="p-5 space-y-0">
                      {[['Fecha', r.date], ['No Factura', r.invoiceNumber], ['Categoria', cat.emoji + ' ' + cat.name], ['IVA', fmt(r.taxAmount)], ['Base imponible', fmt(r.amount - r.taxAmount)], ['Descripcion', r.description]].map(function (p, i) {
                        return <div key={i} className="flex justify-between py-2.5 border-b border-gray-50 last:border-0"><span className="text-sm text-gray-500">{p[0]}</span><span className="text-sm font-medium text-gray-800 text-right max-w-xs truncate">{p[1]}</span></div>;
                      })}
                    </div>
                    <div className="p-4 border-t border-gray-100 flex gap-2">
                      <button onClick={function () { togglePaid(r.id); setSelectedReceipt(Object.assign({}, r, { paid: !r.paid })); }} className={'flex-1 py-2.5 rounded-xl text-sm font-medium ' + (r.paid ? 'bg-amber-50 text-amber-600 border border-amber-200' : 'bg-emerald-50 text-emerald-600 border border-emerald-200')}>{r.paid ? 'Marcar pendiente' : 'Marcar pagada'}</button>
                      <button onClick={function () { deleteReceipt(r.id); }} className="px-4 py-2.5 bg-red-50 text-red-500 rounded-xl border border-red-200"><Trash2 size={16} /></button>
                    </div>
                  </div>
                );
              })()}
            </motion.div>
          )}

          {/* ===== INFORMES ===== */}
          {view === 'reports' && (
            <motion.div key="reports" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="px-4 py-4">
              <h2 className="text-lg font-bold text-gray-800 mb-4">Informes</h2>
              {receipts.length === 0 ? (
                <div className="text-center py-16"><BarChart3 size={40} className="mx-auto text-gray-300 mb-3" /><p className="text-gray-400 text-sm">Anade facturas para ver informes</p></div>
              ) : (
                <>
                  <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-4">
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Distribucion</h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <RePieChart><Pie data={stats.categoryTotals} cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={3} dataKey="total" nameKey="name">{stats.categoryTotals.map(function (e, i) { return <Cell key={i} fill={e.color} />; })}</Pie><Tooltip formatter={function (v) { return [v.toFixed(2) + ' EUR', '']; }} /></RePieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 justify-center">{stats.categoryTotals.map(function (c) { return <span key={c.id} className="flex items-center text-xs text-gray-600"><span className="w-2 h-2 rounded-full mr-1 inline-block" style={{ backgroundColor: c.color }} />{c.emoji} {c.name}</span>; })}</div>
                  </div>
                  <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-4">
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Ranking</h3>
                    <ResponsiveContainer width="100%" height={Math.max(stats.categoryTotals.length * 32, 100)}>
                      <BarChart data={stats.categoryTotals} layout="vertical" margin={{ left: 5, right: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                        <XAxis type="number" tick={{ fontSize: 10 }} stroke="#9ca3af" />
                        <YAxis dataKey="emoji" type="category" tick={{ fontSize: 14 }} width={28} stroke="#9ca3af" />
                        <Tooltip formatter={function (v) { return [v.toFixed(2) + ' EUR', 'Total']; }} />
                        <Bar dataKey="total" radius={4}>{stats.categoryTotals.map(function (e, i) { return <Cell key={i} fill={e.color} />; })}</Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-4">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Detalle</h3>
                    {stats.categoryTotals.map(function (c) {
                      return (
                        <div key={c.id} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                          <div className="flex items-center"><span className="text-base mr-2">{c.emoji}</span><div><p className="text-sm font-medium text-gray-700">{c.name}</p><p className="text-xs text-gray-400">{c.count} factura{c.count !== 1 ? 's' : ''}</p></div></div>
                          <div className="text-right"><p className="text-sm font-bold text-gray-800">{fmt(c.total)}</p><p className="text-xs text-gray-400">{((c.total / stats.total) * 100).toFixed(1)}%</p></div>
                        </div>
                      );
                    })}
                    <div className="flex items-center justify-between pt-3 mt-1 border-t-2 border-indigo-100"><span className="text-sm font-bold text-gray-800">TOTAL</span><span className="text-base font-bold text-indigo-600">{fmt(stats.total)}</span></div>
                  </div>
                </>
              )}
            </motion.div>
          )}

          {/* ===== EXPORTAR ===== */}
          {view === 'export' && (
            <motion.div key="export" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="px-4 py-4">
              <h2 className="text-lg font-bold text-gray-800 mb-1">Exportar</h2>
              <p className="text-sm text-gray-500 mb-5">Informes para tu gestor o contable</p>
              <motion.button whileTap={{ scale: 0.97 }} onClick={exportCSV} className="w-full bg-white rounded-2xl p-5 mb-3 shadow-sm border border-gray-100 flex items-center text-left">
                <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mr-4 flex-shrink-0"><FileSpreadsheet size={24} className="text-emerald-600" /></div>
                <div><h3 className="font-semibold text-gray-800">Exportar Excel (CSV)</h3><p className="text-xs text-gray-500 mt-0.5">Compatible con Excel, Google Sheets</p></div>
              </motion.button>
              <motion.button whileTap={{ scale: 0.97 }} onClick={exportPDF} className="w-full bg-white rounded-2xl p-5 mb-3 shadow-sm border border-gray-100 flex items-center text-left">
                <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center mr-4 flex-shrink-0"><FileText size={24} className="text-red-600" /></div>
                <div><h3 className="font-semibold text-gray-800">Exportar PDF</h3><p className="text-xs text-gray-500 mt-0.5">Informe formateado</p></div>
              </motion.button>
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mt-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Resumen</h3>
                <div className="bg-gray-50 rounded-xl p-3.5 space-y-2">
                  {[['Total facturas', String(filteredReceipts.length)], ['Importe total', fmt(filteredReceipts.reduce(function (s, r) { return s + r.amount; }, 0))], ['IVA total', fmt(filteredReceipts.reduce(function (s, r) { return s + r.taxAmount; }, 0))], ['Base imponible', fmt(filteredReceipts.reduce(function (s, r) { return s + (r.amount - r.taxAmount); }, 0))]].map(function (p, i) {
                    return <div key={i} className="flex justify-between text-xs"><span className="text-gray-500">{p[0]}</span><span className="font-bold text-gray-800">{p[1]}</span></div>;
                  })}
                </div>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* BOTTOM NAV */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg bg-white border-t border-gray-200 z-40 shadow-lg">
        <div className="flex justify-around items-end pt-1.5 pb-2 px-1">
          {[
            { id: 'dashboard', icon: Home, label: 'Inicio' },
            { id: 'receipts', icon: List, label: 'Facturas' },
            { id: 'upload', icon: Camera, label: 'Escanear', special: true },
            { id: 'reports', icon: BarChart3, label: 'Informes' },
            { id: 'export', icon: Download, label: 'Exportar' },
          ].map(function (tab) {
            return (
              <button key={tab.id} onClick={function () { navTo(tab.id); }} className={'flex flex-col items-center px-2 py-1 transition-colors ' + (view === tab.id ? 'text-indigo-600' : 'text-gray-400')}>
                {tab.special ? <div className={'p-2.5 rounded-full -mt-6 shadow-lg transition-colors text-white ' + (view === tab.id ? 'bg-indigo-600' : 'bg-indigo-500')}><tab.icon size={20} /></div> : <tab.icon size={20} />}
                <span className="text-xs mt-1 font-medium">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

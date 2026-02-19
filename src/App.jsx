import React, { useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera, Upload, FileText, BarChart3, Download,
  Check, Plus, Search, Filter, Trash2,
  Home, List, CheckCircle2, Circle, FileSpreadsheet,
  X
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, PieChart as RePieChart, Pie, Cell,
  AreaChart, Area, CartesianGrid
} from 'recharts';
import { createWorker } from 'tesseract.js';

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

var sampleData = [
  { vendor: 'Restaurante El Buen Sabor', amount: 45.80, date: '2026-02-15', category: 'food', desc: 'Comida de negocios', tax: 9.62, paid: true },
  { vendor: 'Repsol Gasolinera', amount: 65.00, date: '2026-02-14', category: 'transport', desc: 'Combustible', tax: 13.65, paid: true },
  { vendor: 'Amazon Business', amount: 129.99, date: '2026-02-12', category: 'office', desc: 'Material de oficina', tax: 27.30, paid: false },
];

var initReceipts = sampleData.map(function (item, i) {
  return {
    id: i + 1, vendor: item.vendor, amount: item.amount, date: item.date,
    category: item.category, description: item.desc,
    invoiceNumber: 'F-2026-' + String(234 + i).padStart(4, '0'),
    taxAmount: item.tax, paid: item.paid,
    fileType: i % 3 === 0 ? 'pdf' : 'jpg', imageData: null, ocrText: '',
  };
});

var getCat = function (id) { return CATEGORIES.find(function (c) { return c.id === id; }) || CATEGORIES[9]; };
var fmt = function (n) { return n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + ' \u20AC'; };

/* ===== PREPROCESAR IMAGEN ===== */
function preprocessImage(dataUrl) {
  return new Promise(function (resolve) {
    var img = new Image();
    img.onload = function () {
      var canvas = document.createElement('canvas');
      var MAX = 2000;
      var sc = Math.min(1, MAX / Math.max(img.width, img.height));
      if (Math.max(img.width, img.height) < 1000) sc = 2;
      canvas.width = Math.round(img.width * sc);
      canvas.height = Math.round(img.height * sc);
      var ctx = canvas.getContext('2d');
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      var imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      var d = imgData.data;
      for (var i = 0; i < d.length; i += 4) {
        var gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        var enhanced = ((gray - 128) * 1.6) + 128;
        enhanced = Math.min(255, Math.max(0, enhanced));
        d[i] = enhanced; d[i + 1] = enhanced; d[i + 2] = enhanced;
      }
      ctx.putImageData(imgData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = function () { resolve(dataUrl); };
    img.src = dataUrl;
  });
}

/* ===== PDF: Cargar pdf.js desde CDN (no necesita npm install) ===== */
function loadPdfJs() {
  return new Promise(function (resolve, reject) {
    if (window.pdfjsLib) { resolve(window.pdfjsLib); return; }
    var script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.onload = function () {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      resolve(window.pdfjsLib);
    };
    script.onerror = function () { reject(new Error('No se pudo cargar pdf.js')); };
    document.head.appendChild(script);
  });
}

function extractTextFromPdf(dataUrl) {
  return loadPdfJs().then(function (pdfjsLib) {
    var base64 = dataUrl.split(',')[1];
    var binary = atob(base64);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return pdfjsLib.getDocument({ data: bytes }).promise;
  }).then(function (pdf) {
    var pagePromises = [];
    for (var p = 1; p <= Math.min(pdf.numPages, 3); p++) {
      pagePromises.push(
        pdf.getPage(p).then(function (page) {
          return page.getTextContent().then(function (tc) {
            var lastY = null; var text = '';
            tc.items.forEach(function (item) {
              if (lastY !== null && Math.abs(item.transform[5] - lastY) > 5) text += '\n';
              text += item.str + ' ';
              lastY = item.transform[5];
            });
            return text;
          });
        })
      );
    }
    return Promise.all(pagePromises).then(function (texts) { return texts.join('\n'); });
  });
}

function pdfToImage(dataUrl) {
  return loadPdfJs().then(function (pdfjsLib) {
    var base64 = dataUrl.split(',')[1];
    var binary = atob(base64);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return pdfjsLib.getDocument({ data: bytes }).promise;
  }).then(function (pdf) {
    return pdf.getPage(1);
  }).then(function (page) {
    var scale = 2;
    var viewport = page.getViewport({ scale: scale });
    var canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return page.render({ canvasContext: ctx, viewport: viewport }).promise.then(function () {
      return canvas.toDataURL('image/jpeg', 0.92);
    });
  });
}

/* ===== PARSER OCR MEJORADO ===== */
function parseOCRText(text) {
  if (!text || text.trim().length < 3) {
    return { vendor: '', amount: 0, date: new Date().toISOString().split('T')[0], category: 'other', description: '', invoiceNumber: '', taxAmount: 0 };
  }
  var lines = text.split('\n').map(function (l) { return l.trim(); }).filter(function (l) { return l.length > 0; });
  var fullText = text;
  var lt = fullText.toLowerCase();
  var result = { vendor: '', amount: 0, date: new Date().toISOString().split('T')[0], category: 'other', description: '', invoiceNumber: '', taxAmount: 0 };

  /* --- 1) PROVEEDOR: base de datos de marcas conocidas --- */
  var knownBrands = [
    { kw: ['vueling'], vendor: 'Vueling', cat: 'travel' },
    { kw: ['ryanair'], vendor: 'Ryanair', cat: 'travel' },
    { kw: ['iberia'], vendor: 'Iberia', cat: 'travel' },
    { kw: ['air europa'], vendor: 'Air Europa', cat: 'travel' },
    { kw: ['easyjet'], vendor: 'EasyJet', cat: 'travel' },
    { kw: ['volotea'], vendor: 'Volotea', cat: 'travel' },
    { kw: ['air nostrum'], vendor: 'Air Nostrum', cat: 'travel' },
    { kw: ['transavia'], vendor: 'Transavia', cat: 'travel' },
    { kw: ['wizzair', 'wizz air'], vendor: 'Wizz Air', cat: 'travel' },
    { kw: ['norwegian'], vendor: 'Norwegian', cat: 'travel' },
    { kw: ['renfe'], vendor: 'Renfe', cat: 'transport' },
    { kw: ['uber'], vendor: 'Uber', cat: 'transport' },
    { kw: ['cabify'], vendor: 'Cabify', cat: 'transport' },
    { kw: ['bolt'], vendor: 'Bolt', cat: 'transport' },
    { kw: ['repsol'], vendor: 'Repsol', cat: 'transport' },
    { kw: ['cepsa'], vendor: 'Cepsa', cat: 'transport' },
    { kw: ['shell'], vendor: 'Shell', cat: 'transport' },
    { kw: ['galp'], vendor: 'Galp', cat: 'transport' },
    { kw: ['alsa'], vendor: 'Alsa', cat: 'transport' },
    { kw: ['blablacar'], vendor: 'BlaBlaCar', cat: 'transport' },
    { kw: ['mercadona'], vendor: 'Mercadona', cat: 'food' },
    { kw: ['carrefour'], vendor: 'Carrefour', cat: 'food' },
    { kw: ['lidl'], vendor: 'Lidl', cat: 'food' },
    { kw: ['aldi'], vendor: 'Aldi', cat: 'food' },
    { kw: ['eroski'], vendor: 'Eroski', cat: 'food' },
    { kw: ['alcampo'], vendor: 'Alcampo', cat: 'food' },
    { kw: ['consum '], vendor: 'Consum', cat: 'food' },
    { kw: ['bonpreu'], vendor: 'Bonpreu', cat: 'food' },
    { kw: ['condis'], vendor: 'Condis', cat: 'food' },
    { kw: ['mediamarkt', 'media markt'], vendor: 'MediaMarkt', cat: 'tech' },
    { kw: ['fnac'], vendor: 'FNAC', cat: 'tech' },
    { kw: ['pccomponentes', 'pc componentes'], vendor: 'PcComponentes', cat: 'tech' },
    { kw: ['apple store', 'apple.com'], vendor: 'Apple', cat: 'tech' },
    { kw: ['samsung'], vendor: 'Samsung', cat: 'tech' },
    { kw: ['movistar'], vendor: 'Movistar', cat: 'services' },
    { kw: ['vodafone'], vendor: 'Vodafone', cat: 'services' },
    { kw: ['orange'], vendor: 'Orange', cat: 'services' },
    { kw: ['jazztel'], vendor: 'Jazztel', cat: 'services' },
    { kw: ['digi '], vendor: 'Digi', cat: 'services' },
    { kw: ['endesa'], vendor: 'Endesa', cat: 'services' },
    { kw: ['naturgy'], vendor: 'Naturgy', cat: 'services' },
    { kw: ['iberdrola'], vendor: 'Iberdrola', cat: 'services' },
    { kw: ['booking.com'], vendor: 'Booking.com', cat: 'accommodation' },
    { kw: ['airbnb'], vendor: 'Airbnb', cat: 'accommodation' },
    { kw: ['nh hotel', 'hotel nh'], vendor: 'NH Hotels', cat: 'accommodation' },
    { kw: ['melia', 'meliá'], vendor: 'Meliá', cat: 'accommodation' },
    { kw: ['zara '], vendor: 'Zara', cat: 'shopping' },
    { kw: ['primark'], vendor: 'Primark', cat: 'shopping' },
    { kw: ['corte ingles', 'corte inglés', 'el corte'], vendor: 'El Corte Inglés', cat: 'shopping' },
    { kw: ['decathlon'], vendor: 'Decathlon', cat: 'shopping' },
    { kw: ['ikea'], vendor: 'IKEA', cat: 'shopping' },
    { kw: ['leroy merlin'], vendor: 'Leroy Merlin', cat: 'shopping' },
    { kw: ['amazon'], vendor: 'Amazon', cat: 'shopping' },
    { kw: ['mcdon', 'mcdonald'], vendor: "McDonald's", cat: 'food' },
    { kw: ['burger king'], vendor: 'Burger King', cat: 'food' },
    { kw: ['telepizza'], vendor: 'Telepizza', cat: 'food' },
    { kw: ['just eat', 'justeat'], vendor: 'Just Eat', cat: 'food' },
    { kw: ['glovo'], vendor: 'Glovo', cat: 'food' },
    { kw: ['deliveroo'], vendor: 'Deliveroo', cat: 'food' },
    { kw: ['farmacia'], vendor: 'Farmacia', cat: 'health' },
  ];

  var brandFound = false;
  for (var bi = 0; bi < knownBrands.length; bi++) {
    var brand = knownBrands[bi];
    for (var ki = 0; ki < brand.kw.length; ki++) {
      if (lt.indexOf(brand.kw[ki]) !== -1) {
        result.vendor = brand.vendor;
        result.category = brand.cat;
        brandFound = true;
        break;
      }
    }
    if (brandFound) break;
  }

  if (!result.vendor) {
    var skipPat = [
      /^\d+$/, /^(fecha|date|hora|time|total|iva|nif|cif|tel|fax|email|web|www|http|dir)/i,
      /^(invoice|factura|ticket|recibo|albaran|presupuesto)\s/i,
      /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/,
      /^[A-Z0-9]{2,3}[\-\/]\d+/,
      /^(name|nombre|address|direccion|town|city|phone|vat\s*number|purchase)/i,
    ];
    for (var vi = 0; vi < Math.min(lines.length, 15); vi++) {
      var cl = lines[vi].replace(/[^a-zA-ZáéíóúñÁÉÍÓÚÑüÜ\s\-\.&]/g, '').trim();
      if (cl.length < 2 || cl.length > 60) continue;
      var skip = false;
      for (var si = 0; si < skipPat.length; si++) {
        if (skipPat[si].test(lines[vi].trim())) { skip = true; break; }
      }
      if (skip) continue;
      if ((cl.match(/[a-zA-ZáéíóúñÁÉÍÓÚÑ]/g) || []).length < 2) continue;
      result.vendor = cl;
      break;
    }
  }

  /* --- 2) IMPORTE TOTAL --- */
  var totalAmounts = [];

  // Buscar lineas con palabra "total" y sacar el mayor importe de esa linea
  for (var tli = 0; tli < lines.length; tli++) {
    var tline = lines[tli];
    if (/\btotal\b/i.test(tline) && !/\btotal\s*(fare|charges|fees)\b/i.test(tline)) {
      var amtsInLine = tline.match(/(\d{1,6}[.,]\d{2})/g);
      if (amtsInLine) {
        for (var ai = 0; ai < amtsInLine.length; ai++) {
          var av = parseFloat(amtsInLine[ai].replace(',', '.'));
          if (av > 0.5 && av < 100000) totalAmounts.push(av);
        }
      }
    }
  }

  // Regex directos
  var totalRegexes = [
    /(?:total|importe\s*total|grand\s*total|a\s*pagar|total\s*factura|amount\s*due)[:\s]*(\d{1,6}[.,]\d{2})/gi,
    /(\d{1,6}[.,]\d{2})\s*(?:EUR|€)?\s*(?:total|a\s*pagar)/gi,
  ];
  for (var tr = 0; tr < totalRegexes.length; tr++) {
    var tm;
    while ((tm = totalRegexes[tr].exec(fullText)) !== null) {
      var tv = parseFloat(tm[1].replace(',', '.'));
      if (tv > 0.5 && tv < 100000) totalAmounts.push(tv);
    }
  }

  if (totalAmounts.length > 0) {
    result.amount = Math.max.apply(null, totalAmounts);
  } else {
    var allAmounts = [];
    var ap1 = /(\d{1,6}[.,]\d{2})\s*[€E]/g; var m1;
    while ((m1 = ap1.exec(fullText)) !== null) allAmounts.push(parseFloat(m1[1].replace(',', '.')));
    var ap2 = /[€E]\s*(\d{1,6}[.,]\d{2})/g; var m2;
    while ((m2 = ap2.exec(fullText)) !== null) allAmounts.push(parseFloat(m2[1].replace(',', '.')));
    var ap3 = /(\d{1,6}[.,]\d{2})\s*EUR/gi; var m3;
    while ((m3 = ap3.exec(fullText)) !== null) allAmounts.push(parseFloat(m3[1].replace(',', '.')));
    var ap4 = /(\d{2,6}[.,]\d{2})\s*$/gm; var m4;
    while ((m4 = ap4.exec(fullText)) !== null) {
      var v4 = parseFloat(m4[1].replace(',', '.'));
      if (v4 > 1 && v4 < 50000) allAmounts.push(v4);
    }
    allAmounts = allAmounts.filter(function (a) { return a > 0.5 && a < 99999; });
    if (allAmounts.length > 0) result.amount = Math.max.apply(null, allAmounts);
  }

  /* --- 3) IVA / VAT --- */
  var taxAmounts = [];
  var taxPatterns = [
    /(?:iva|i\.v\.a|vat|tax|impuesto)[:\s]*(\d{1,6}[.,]\d{2})/gi,
    /(\d{1,6}[.,]\d{2})\s*(?:EUR|€)?\s*(?:iva|vat)/gi,
  ];
  for (var txp = 0; txp < taxPatterns.length; txp++) {
    var txm;
    while ((txm = taxPatterns[txp].exec(fullText)) !== null) {
      var txv = parseFloat(txm[1].replace(',', '.'));
      if (txv > 0) taxAmounts.push(txv);
    }
  }
  for (var txi = 0; txi < lines.length; txi++) {
    var txline = lines[txi];
    if (/(?:\biva\b|\bvat\b|\btax\b)/i.test(txline) && !/(?:vat\s*number|numero|nif|cif|n[°ºo]\s*iva)/i.test(txline)) {
      var txInLine = txline.match(/(\d{1,6}[.,]\d{2})/g);
      if (txInLine) {
        for (var txa = 0; txa < txInLine.length; txa++) {
          var txVal = parseFloat(txInLine[txa].replace(',', '.'));
          if (txVal > 0) taxAmounts.push(txVal);
        }
      }
    }
  }
  if (taxAmounts.length > 0) {
    var validTax = taxAmounts.filter(function (t) { return t < result.amount * 0.5 && t > 0; });
    if (validTax.length > 0) {
      result.taxAmount = Math.max.apply(null, validTax);
    } else if (taxAmounts.length > 0) {
      result.taxAmount = Math.min.apply(null, taxAmounts);
    }
  } else if (result.amount > 0) {
    result.taxAmount = parseFloat((result.amount * 0.21 / 1.21).toFixed(2));
  }

  /* --- 4) FECHA --- */
  var dateRegex = /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/g;
  var dm;
  while ((dm = dateRegex.exec(fullText)) !== null) {
    var dd = parseInt(dm[1]); var mm = parseInt(dm[2]); var yy = parseInt(dm[3]);
    if (yy < 100) yy += 2000;
    if (mm > 12 && dd <= 12) { var tmp = dd; dd = mm; mm = tmp; }
    if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31 && yy >= 2020 && yy <= 2030) {
      result.date = yy + '-' + String(mm).padStart(2, '0') + '-' + String(dd).padStart(2, '0');
      break;
    }
  }

  /* --- 5) NUMERO FACTURA --- */
  var invPatterns = [
    /(?:invoice|factura|fra|ticket|n[°ºo]|num|receipt|albaran|ref)[.:\s#]*([A-Z0-9][\w\-\/]{4,})/i,
    /([A-Z]{1,4}\d{6,})/,
    /([A-Z]{1,3}[\-\/]\d{3,})/,
  ];
  for (var ip = 0; ip < invPatterns.length; ip++) {
    var im = fullText.match(invPatterns[ip]);
    if (im) { result.invoiceNumber = im[1].trim(); break; }
  }
  if (!result.invoiceNumber) result.invoiceNumber = 'T-' + Date.now().toString().slice(-6);

  /* --- 6) AUTO-CATEGORIA si no se detecto por marca --- */
  if (!brandFound) {
    var kwMap = {
      food: ['restaurante', 'bar ', 'cafeteria', 'mercadona', 'carrefour', 'supermercado', 'alimentacion', 'comida', 'menu', 'cafe', 'lidl', ' dia ', 'aldi', 'burger', 'pizza', 'kebab', 'mcdon', 'telepizza', 'just eat', 'glovo', 'deliveroo'],
      transport: ['gasolinera', 'repsol', ' bp ', 'cepsa', 'uber', 'cabify', 'taxi', 'combustible', 'gasolina', 'diesel', 'parking', 'aparcamiento', 'shell', 'galp', 'renfe', 'tren', 'autobus'],
      accommodation: ['hotel', 'hostal', 'alojamiento', 'airbnb', 'booking', 'habitacion', 'pension'],
      office: ['oficina', 'papeleria', 'material oficina', 'amazon', 'staples'],
      tech: ['mediamarkt', 'fnac', 'apple', 'samsung', 'pc componentes', 'electronica', 'informatica', 'movil', 'portatil', 'phone house'],
      health: ['farmacia', 'clinica', 'dental', 'optica', 'medico', 'salud', 'hospital', 'parafarmacia'],
      travel: ['vueling', 'iberia', 'ryanair', 'vuelo', 'billete', 'avion', 'flight', 'boarding', 'airline', 'air europa', 'easyjet', 'volotea', 'bcn-', '-bcn', 'mad-', '-mad', 'departure', 'tktt'],
      shopping: ['zara', 'primark', 'corte ingles', 'mango', 'h&m', 'ropa', 'tienda', 'boutique', 'decathlon', 'ikea', 'leroy merlin'],
      services: ['movistar', 'vodafone', 'orange', 'endesa', 'naturgy', 'iberdrola', 'telefon', 'internet', 'luz', 'gas', 'agua', 'seguro', 'jazztel', 'digi'],
    };
    var catKeys = Object.keys(kwMap);
    outer: for (var ci = 0; ci < catKeys.length; ci++) {
      var kws = kwMap[catKeys[ci]];
      for (var kwi = 0; kwi < kws.length; kwi++) {
        if (lt.indexOf(kws[kwi]) !== -1) { result.category = catKeys[ci]; break outer; }
      }
    }
  }

  result.description = result.vendor ? ('Factura ' + result.vendor) : ('Factura de ' + getCat(result.category).name);
  return result;
}

/* ===== COMPONENTE PRINCIPAL ===== */
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

  var showNotif = function (msg) {
    setNotification(msg);
    setTimeout(function () { setNotification(null); }, 3500);
  };

  /* ===== ESCANEO OCR ===== */
  var realAIScan = async function (imageData, fileName, fileType) {
    setIsScanning(true);
    setScanProgress(0);
    setScanStatus('Preparando imagen...');

    try {
      setScanProgress(5);
      var processedImage = await preprocessImage(imageData);

      setScanProgress(10);
      setScanStatus('Iniciando motor OCR...');

      var worker = await createWorker('spa+eng', 1, {
        logger: function (info) {
          if (info.status === 'recognizing text') {
            setScanProgress(25 + Math.round(info.progress * 60));
            setScanStatus('Leyendo texto... ' + Math.round(info.progress * 100) + '%');
          } else if (info.status === 'loading language traineddata') {
            setScanProgress(10 + Math.round(info.progress * 15));
            setScanStatus('Descargando idiomas (solo 1a vez)...');
          } else if (info.status === 'initializing api') {
            setScanProgress(22);
            setScanStatus('Inicializando...');
          }
        }
      });

      setScanProgress(25);
      setScanStatus('Analizando imagen...');
      var ocrResult = await worker.recognize(processedImage);
      var ocrText = (ocrResult && ocrResult.data && ocrResult.data.text) || '';
      await worker.terminate();

      setScanProgress(90);
      setScanStatus('Extrayendo datos...');
      var parsed = parseOCRText(ocrText);

      setScanProgress(100);
      setScanStatus('Completado!');

      setTimeout(function () {
        setEditForm({
          vendor: parsed.vendor, amount: parsed.amount, date: parsed.date,
          category: parsed.category, description: parsed.description,
          invoiceNumber: parsed.invoiceNumber, taxAmount: parsed.taxAmount,
          paid: false, fileType: fileType || 'jpg', fileName: fileName,
          imageData: imageData, ocrText: ocrText,
        });
        setIsScanning(false); setScanProgress(0); setScanStatus('');
        if (!ocrText || ocrText.trim().length < 5) {
          showNotif('Poco texto detectado. Revisa los datos.');
        } else {
          showNotif('Texto leido (' + ocrText.trim().split('\n').length + ' lineas). Revisa datos.');
        }
      }, 600);

    } catch (err) {
      console.error('OCR Error:', err);
      setEditForm({
        vendor: '', amount: 0, date: new Date().toISOString().split('T')[0],
        category: 'other', description: '', invoiceNumber: 'T-' + Date.now().toString().slice(-6),
        taxAmount: 0, paid: false, fileType: fileType || 'jpg', fileName: fileName,
        imageData: imageData, ocrText: 'Error: ' + (err && err.message ? err.message : 'OCR fallo'),
      });
      setIsScanning(false); setScanProgress(0); setScanStatus('');
      showNotif('Error OCR. Introduce datos manualmente.');
    }
  };

  /* ===== SUBIR ARCHIVO (IMAGENES + PDF) ===== */
  var handleFileUpload = function (e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      showNotif('Archivo demasiado grande (max 20MB)');
      e.target.value = '';
      return;
    }

    var reader = new FileReader();
    reader.onload = function (ev) {
      var dataUrl = ev.target.result;
      var isPDF = file.type === 'application/pdf' || file.name.toLowerCase().indexOf('.pdf') !== -1;

      if (isPDF) {
        /* --- PDF: extraer texto directo, si no hay texto → OCR --- */
        setIsScanning(true);
        setScanProgress(3);
        setScanStatus('Cargando lector de PDF...');

        extractTextFromPdf(dataUrl).then(function (pdfText) {
          if (pdfText && pdfText.trim().length > 20) {
            setScanProgress(60);
            setScanStatus('Texto extraido del PDF, analizando...');
            var parsed = parseOCRText(pdfText);

            return pdfToImage(dataUrl).then(function (pdfImage) {
              setScanProgress(100);
              setScanStatus('Completado!');
              setTimeout(function () {
                setEditForm({
                  vendor: parsed.vendor, amount: parsed.amount, date: parsed.date,
                  category: parsed.category, description: parsed.description,
                  invoiceNumber: parsed.invoiceNumber, taxAmount: parsed.taxAmount,
                  paid: false, fileType: 'pdf', fileName: file.name,
                  imageData: pdfImage, ocrText: pdfText,
                });
                setIsScanning(false); setScanProgress(0); setScanStatus('');
                showNotif('PDF leido! (' + pdfText.trim().split(/\s+/).length + ' palabras). Revisa datos.');
              }, 500);
            }).catch(function () {
              setTimeout(function () {
                setEditForm({
                  vendor: parsed.vendor, amount: parsed.amount, date: parsed.date,
                  category: parsed.category, description: parsed.description,
                  invoiceNumber: parsed.invoiceNumber, taxAmount: parsed.taxAmount,
                  paid: false, fileType: 'pdf', fileName: file.name,
                  imageData: null, ocrText: pdfText,
                });
                setIsScanning(false); setScanProgress(0); setScanStatus('');
                showNotif('PDF leido (sin vista previa). Revisa datos.');
              }, 500);
            });
          } else {
            setScanProgress(10);
            setScanStatus('PDF sin texto, convirtiendo a imagen...');
            return pdfToImage(dataUrl).then(function (pdfImage) {
              setScanProgress(15);
              setScanStatus('Imagen lista, escaneando con OCR...');
              realAIScan(pdfImage, file.name, 'pdf');
            });
          }
        }).catch(function (err) {
          console.error('PDF error:', err);
          setIsScanning(false); setScanProgress(0); setScanStatus('');
          setEditForm({
            vendor: '', amount: 0, date: new Date().toISOString().split('T')[0],
            category: 'other', description: '', invoiceNumber: 'T-' + Date.now().toString().slice(-6),
            taxAmount: 0, paid: false, fileType: 'pdf', fileName: file.name,
            imageData: null, ocrText: '',
          });
          showNotif('Error leyendo PDF. Introduce datos manualmente.');
        });

      } else {
        /* --- Imagen: limpiar a JPEG y escanear --- */
        var img = new Image();
        img.onload = function () {
          var canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          var ctx = canvas.getContext('2d');
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
          var cleanJpeg = canvas.toDataURL('image/jpeg', 0.95);
          realAIScan(cleanJpeg, file.name, 'jpg');
        };
        img.onerror = function () {
          realAIScan(dataUrl, file.name, 'jpg');
        };
        img.src = dataUrl;
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  var saveReceipt = function () {
    if (!editForm) return;
    var nr = Object.assign({}, editForm, { id: nextId });
    setReceipts(function (prev) { return [nr].concat(prev); });
    setNextId(function (p) { return p + 1; });
    setEditForm(null);
    setView('receipts');
    showNotif('Factura guardada' + (editForm.imageData ? ' con foto' : ''));
  };

  var togglePaid = function (id) {
    setReceipts(function (prev) { return prev.map(function (r) { return r.id === id ? Object.assign({}, r, { paid: !r.paid }) : r; }); });
    if (selectedReceipt && selectedReceipt.id === id) {
      setSelectedReceipt(function (prev) { return prev ? Object.assign({}, prev, { paid: !prev.paid }) : null; });
    }
  };

  var deleteReceipt = function (id) {
    setReceipts(function (prev) { return prev.filter(function (r) { return r.id !== id; }); });
    setSelectedReceipt(null);
    showNotif('Factura eliminada');
  };

  var filteredReceipts = useMemo(function () {
    return receipts.filter(function (r) {
      var ms = !searchQuery || r.vendor.toLowerCase().indexOf(searchQuery.toLowerCase()) !== -1 || r.description.toLowerCase().indexOf(searchQuery.toLowerCase()) !== -1 || r.invoiceNumber.toLowerCase().indexOf(searchQuery.toLowerCase()) !== -1;
      var mc = filterCategory === 'all' || r.category === filterCategory;
      var mp = filterPaid === 'all' || (filterPaid === 'paid' && r.paid) || (filterPaid === 'unpaid' && !r.paid);
      return ms && mc && mp;
    });
  }, [receipts, searchQuery, filterCategory, filterPaid]);

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

  var exportCSV = function () {
    try {
      var h = ['Fecha', 'Proveedor', 'No Factura', 'Descripcion', 'Categoria', 'Importe', 'IVA', 'Pagada'];
      var rows = filteredReceipts.map(function (r) { return [r.date, r.vendor, r.invoiceNumber, r.description, getCat(r.category).name, r.amount.toFixed(2), r.taxAmount.toFixed(2), r.paid ? 'Si' : 'No']; });
      var csv = [h].concat(rows).map(function (row) { return row.map(function (c) { return '"' + c + '"'; }).join(','); }).join('\n');
      var blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'facturas_' + new Date().toISOString().split('T')[0] + '.csv'; a.click();
      showNotif('CSV exportado');
    } catch (err) { showNotif('Error al exportar'); }
  };

  var exportPDF = function () {
    var ta = filteredReceipts.reduce(function (s, r) { return s + r.amount; }, 0);
    var tt = filteredReceipts.reduce(function (s, r) { return s + r.taxAmount; }, 0);
    var tableRows = filteredReceipts.map(function (r) {
      return '<tr><td>' + r.date + '</td><td>' + r.vendor + '</td><td>' + r.invoiceNumber + '</td><td>' + getCat(r.category).emoji + ' ' + getCat(r.category).name + '</td><td>' + r.amount.toFixed(2) + ' EUR</td><td>' + r.taxAmount.toFixed(2) + ' EUR</td><td class="' + (r.paid ? 'g' : 'r') + '">' + (r.paid ? 'Pagada' : 'Pendiente') + '</td></tr>';
    }).join('');
    var html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Informe TicketAI</title><style>body{font-family:Arial,sans-serif;padding:40px;color:#333}h1{color:#4f46e5;border-bottom:2px solid #4f46e5;padding-bottom:10px}table{width:100%;border-collapse:collapse;margin:20px 0}th{background:#4f46e5;color:#fff;padding:10px;text-align:left;font-size:13px}td{padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:13px}tr:nth-child(even){background:#f9fafb}.tot{font-weight:700;background:#eef2ff!important}.g{color:#16a34a}.r{color:#dc2626}.cards{display:flex;gap:20px;margin:20px 0;flex-wrap:wrap}.card{background:#f3f4f6;padding:15px 25px;border-radius:8px;min-width:150px}.card h3{margin:0;color:#6b7280;font-size:13px}.card p{margin:5px 0 0;font-size:22px;font-weight:700;color:#4f46e5}@media print{body{padding:20px}}</style></head><body><h1>TicketAI - Informe de Gastos</h1><p style="color:#6b7280">Generado: ' + new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) + '</p><div class="cards"><div class="card"><h3>Total</h3><p>' + ta.toFixed(2) + ' EUR</p></div><div class="card"><h3>IVA</h3><p>' + tt.toFixed(2) + ' EUR</p></div><div class="card"><h3>Base</h3><p>' + (ta - tt).toFixed(2) + ' EUR</p></div><div class="card"><h3>Facturas</h3><p>' + filteredReceipts.length + '</p></div></div><table><tr><th>Fecha</th><th>Proveedor</th><th>No Factura</th><th>Categoria</th><th>Importe</th><th>IVA</th><th>Estado</th></tr>' + tableRows + '<tr class="tot"><td colspan="4">TOTAL</td><td>' + ta.toFixed(2) + ' EUR</td><td>' + tt.toFixed(2) + ' EUR</td><td></td></tr></table><script>window.print();<\/script></body></html>';
    try { var w = window.open('', '_blank'); if (w) { w.document.write(html); w.document.close(); } showNotif('PDF listo'); } catch (err) { showNotif('Permite pop-ups'); }
  };

  var navTo = function (v) {
    setView(v);
    if (v === 'receipts') setSelectedReceipt(null);
    if (v === 'upload') { setEditForm(null); setIsScanning(false); setScanStatus(''); }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-lg mx-auto relative overflow-hidden">

      <AnimatePresence>
        {showImagePreview && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4" onClick={function () { setShowImagePreview(null); }}>
            <button className="absolute top-4 right-4 text-white bg-white/20 rounded-full p-2"><X size={24} /></button>
            <img src={showImagePreview} alt="Ampliada" className="max-w-full max-h-full object-contain rounded-lg" />
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

      <div className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-5 pt-5 pb-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight">TicketAI</h1>
            <p className="text-indigo-200 text-xs mt-0.5">Gestion inteligente de facturas</p>
          </div>
          <button onClick={function () { navTo('upload'); }} className="bg-white text-indigo-600 rounded-full p-2.5 shadow-lg active:scale-95 transition-transform">
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
                      <defs><linearGradient id="colorGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} /><stop offset="95%" stopColor="#6366f1" stopOpacity={0} /></linearGradient></defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                      <YAxis tick={{ fontSize: 10 }} stroke="#9ca3af" width={45} />
                      <Tooltip formatter={function (v) { return [v + ' EUR', 'Total']; }} />
                      <Area type="monotone" dataKey="total" stroke="#6366f1" fill="url(#colorGrad)" strokeWidth={2} />
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
            </motion.div>
          )}

          {view === 'upload' && (
            <motion.div key="upload" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="px-4 py-4">
              {!isScanning && !editForm && (
                <div>
                  <h2 className="text-lg font-bold text-gray-800 mb-1">Escanear Factura</h2>
                  <p className="text-sm text-gray-500 mb-5">Haz foto, sube imagen o PDF</p>
                  <motion.button whileTap={{ scale: 0.97 }} onClick={function () { cameraInputRef.current && cameraInputRef.current.click(); }} className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-2xl p-6 mb-4 flex flex-col items-center shadow-lg">
                    <Camera size={36} className="mb-2" />
                    <span className="font-semibold">Hacer Foto</span>
                    <span className="text-indigo-200 text-xs mt-1">Camara del movil</span>
                  </motion.button>
                  <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileUpload} />
                  <motion.div whileTap={{ scale: 0.98 }} onClick={function () { fileInputRef.current && fileInputRef.current.click(); }} className="w-full border-2 border-dashed border-gray-300 rounded-2xl p-8 flex flex-col items-center cursor-pointer hover:border-indigo-400 transition-colors">
                    <Upload size={32} className="text-gray-400 mb-3" />
                    <span className="font-medium text-gray-600 text-sm">Subir archivo</span>
                    <span className="text-gray-400 text-xs mt-1">JPG, PNG o PDF</span>
                  </motion.div>
                  <input ref={fileInputRef} type="file" accept="image/*,.pdf,application/pdf" className="hidden" onChange={handleFileUpload} />
                  <button onClick={function () { setEditForm({ vendor: '', amount: 0, date: new Date().toISOString().split('T')[0], category: 'other', description: '', invoiceNumber: '', taxAmount: 0, paid: false, fileType: 'manual', imageData: null, ocrText: '' }); }} className="w-full mt-4 py-3 text-indigo-600 font-medium text-sm border border-indigo-200 rounded-xl">
                    Introducir manualmente
                  </button>
                </div>
              )}

              {isScanning && (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center py-16">
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }} className="w-16 h-16 rounded-full border-4 border-indigo-200 border-t-indigo-600 mb-6" />
                  <h3 className="text-lg font-bold text-gray-800 mb-2">Procesando...</h3>
                  <p className="text-sm text-gray-500 mb-1">{scanStatus || 'Procesando...'}</p>
                  <p className="text-xs text-amber-500 mb-4">La primera vez tarda mas (descarga idiomas)</p>
                  <div className="w-full max-w-xs bg-gray-200 rounded-full h-2 mb-2">
                    <motion.div className="bg-indigo-600 h-2 rounded-full" style={{ width: Math.min(scanProgress, 100) + '%' }} />
                  </div>
                  <p className="text-xs text-gray-400 mb-6">{Math.min(Math.round(scanProgress), 100)}%</p>
                  <div className="space-y-2 w-full max-w-xs">
                    {[
                      { t: 3, l: 'Archivo recibido' },
                      { t: 10, l: 'Motor OCR listo' },
                      { t: 30, l: 'Leyendo texto...' },
                      { t: 60, l: 'Texto extraido' },
                      { t: 90, l: 'Datos analizados' },
                    ].filter(function (s) { return scanProgress > s.t; }).map(function (s, i) {
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
                    <span className="text-xs bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full font-medium">
                      {editForm.fileType === 'pdf' ? 'PDF' : editForm.fileType === 'manual' ? 'Manual' : 'OCR'}
                    </span>
                  </div>

                  {editForm.imageData && editForm.imageData.indexOf('image') !== -1 && (
                    <div className="mb-4">
                      <img src={editForm.imageData} alt="Documento" className="w-full max-h-48 object-contain rounded-xl border border-gray-200 cursor-pointer bg-gray-50" onClick={function () { setShowImagePreview(editForm.imageData); }} />
                      <p className="text-xs text-gray-400 mt-1 text-center">Toca para ampliar</p>
                    </div>
                  )}

                  {editForm.ocrText && editForm.ocrText.length > 0 && (
                    <details className="mb-4 bg-blue-50 rounded-xl p-3 border border-blue-100">
                      <summary className="text-xs text-blue-600 cursor-pointer font-medium">🔍 Texto detectado ({editForm.ocrText.length} caracteres)</summary>
                      <pre className="text-xs text-gray-600 mt-2 bg-white p-2 rounded-lg whitespace-pre-wrap max-h-40 overflow-y-auto border">{editForm.ocrText}</pre>
                    </details>
                  )}

                  <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
                    <div>
                      <label className="text-xs font-medium text-gray-500 mb-1 block">Proveedor</label>
                      <input type="text" value={editForm.vendor} onChange={function (e) { setEditForm(Object.assign({}, editForm, { vendor: e.target.value })); }} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-gray-500 mb-1 block">Importe (EUR)</label>
                        <input type="number" step="0.01" value={editForm.amount} onChange={function (e) { setEditForm(Object.assign({}, editForm, { amount: parseFloat(e.target.value) || 0 })); }} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500 mb-1 block">IVA (EUR)</label>
                        <input type="number" step="0.01" value={editForm.taxAmount} onChange={function (e) { setEditForm(Object.assign({}, editForm, { taxAmount: parseFloat(e.target.value) || 0 })); }} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-gray-500 mb-1 block">Fecha</label>
                        <input type="date" value={editForm.date} onChange={function (e) { setEditForm(Object.assign({}, editForm, { date: e.target.value })); }} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500 mb-1 block">No Factura</label>
                        <input type="text" value={editForm.invoiceNumber} onChange={function (e) { setEditForm(Object.assign({}, editForm, { invoiceNumber: e.target.value })); }} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 mb-1 block">Categoria</label>
                      <select value={editForm.category} onChange={function (e) { setEditForm(Object.assign({}, editForm, { category: e.target.value })); }} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                        {CATEGORIES.map(function (c) { return <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>; })}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 mb-1 block">Descripcion</label>
                      <input type="text" value={editForm.description} onChange={function (e) { setEditForm(Object.assign({}, editForm, { description: e.target.value })); }} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <button onClick={function () { setEditForm(Object.assign({}, editForm, { paid: !editForm.paid })); }} className="flex items-center pt-1">
                      {editForm.paid ? <CheckCircle2 size={20} className="text-emerald-500 mr-2" /> : <Circle size={20} className="text-gray-300 mr-2" />}
                      <span className="text-sm text-gray-600">Marcar como pagada</span>
                    </button>
                  </div>
                  <div className="flex gap-3 mt-4">
                    <button onClick={function () { setEditForm(null); }} className="flex-1 py-3 border border-gray-200 rounded-xl text-gray-600 font-medium text-sm">Cancelar</button>
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
                <input type="text" placeholder="Buscar facturas..." value={searchQuery} onChange={function (e) { setSearchQuery(e.target.value); }} className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
                <button onClick={function () { setShowFilters(!showFilters); }} className={'flex items-center px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ' + (showFilters ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600')}>
                  <Filter size={12} className="mr-1" /> Categoria
                </button>
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
                        <p className="text-xs text-gray-400 truncate">{r.date} - {r.invoiceNumber}</p>
                      </div>
                      <div className="text-right ml-2 flex-shrink-0">
                        <p className="text-sm font-bold text-gray-800">{fmt(r.amount)}</p>
                        <p className="text-xs text-gray-400">{r.imageData ? '📷' : ''} {cat.name}</p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
              {filteredReceipts.length === 0 && (
                <div className="text-center py-16"><FileText size={40} className="mx-auto text-gray-300 mb-3" /><p className="text-gray-400 text-sm">No se encontraron facturas</p></div>
              )}
            </motion.div>
          )}

          {view === 'receipts' && selectedReceipt && (
            <motion.div key="detail" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="px-4 py-4">
              <button onClick={function () { setSelectedReceipt(null); }} className="text-sm text-indigo-600 font-medium mb-4">Volver</button>
              {(function () {
                var r = selectedReceipt; var cat = getCat(r.category);
                return (
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-5 text-center border-b border-gray-100" style={{ backgroundColor: cat.color + '10' }}>
                      <span className="text-3xl block mb-1">{cat.emoji}</span>
                      <h3 className="text-base font-bold text-gray-800">{r.vendor}</h3>
                      <p className="text-3xl font-bold mt-2" style={{ color: cat.color }}>{fmt(r.amount)}</p>
                      <span className={'inline-block mt-2 px-3 py-1 rounded-full text-xs font-medium ' + (r.paid ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700')}>{r.paid ? 'Pagada' : 'Pendiente'}</span>
                    </div>
                    {r.imageData && r.imageData.indexOf('image') !== -1 && (
                      <div className="p-4 border-b border-gray-100 bg-gray-50">
                        <p className="text-xs font-medium text-gray-500 mb-2">📷 Documento adjunto</p>
                        <img src={r.imageData} alt="Documento" className="w-full max-h-64 object-contain rounded-lg cursor-pointer border border-gray-200 bg-white" onClick={function () { setShowImagePreview(r.imageData); }} />
                        <p className="text-xs text-gray-400 mt-1 text-center">Toca para ampliar</p>
                      </div>
                    )}
                    <div className="p-5 space-y-0">
                      {[['Fecha', r.date], ['No Factura', r.invoiceNumber], ['Categoria', cat.emoji + ' ' + cat.name], ['IVA', fmt(r.taxAmount)], ['Base imponible', fmt(r.amount - r.taxAmount)], ['Descripcion', r.description]].map(function (pair, i) {
                        return (
                          <div key={i} className="flex justify-between py-2.5 border-b border-gray-50 last:border-0">
                            <span className="text-sm text-gray-500">{pair[0]}</span>
                            <span className="text-sm font-medium text-gray-800 text-right max-w-xs truncate">{pair[1]}</span>
                          </div>
                        );
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

          {view === 'reports' && (
            <motion.div key="reports" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="px-4 py-4">
              <h2 className="text-lg font-bold text-gray-800 mb-4">Informes</h2>
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Distribucion por Categoria</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <RePieChart><Pie data={stats.categoryTotals} cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={3} dataKey="total" nameKey="name">{stats.categoryTotals.map(function (e, i) { return <Cell key={i} fill={e.color} />; })}</Pie><Tooltip formatter={function (v) { return [v.toFixed(2) + ' EUR', '']; }} /></RePieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 justify-center">
                  {stats.categoryTotals.map(function (c) { return <span key={c.id} className="flex items-center text-xs text-gray-600"><span className="w-2 h-2 rounded-full mr-1 inline-block" style={{ backgroundColor: c.color }} />{c.emoji} {c.name}</span>; })}
                </div>
              </div>
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Ranking de Gastos</h3>
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
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Resumen Detallado</h3>
                {stats.categoryTotals.map(function (c) {
                  return (
                    <div key={c.id} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                      <div className="flex items-center"><span className="text-base mr-2">{c.emoji}</span><div><p className="text-sm font-medium text-gray-700">{c.name}</p><p className="text-xs text-gray-400">{c.count} factura{c.count !== 1 ? 's' : ''}</p></div></div>
                      <div className="text-right"><p className="text-sm font-bold text-gray-800">{fmt(c.total)}</p><p className="text-xs text-gray-400">{((c.total / stats.total) * 100).toFixed(1)}%</p></div>
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
                    <Tooltip formatter={function (v) { return [v + ' EUR', 'Total']; }} />
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
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Vista Previa</h3>
                <div className="bg-gray-50 rounded-xl p-3.5 space-y-2">
                  {[
                    ['Total facturas', String(filteredReceipts.length)],
                    ['Importe total', fmt(filteredReceipts.reduce(function (s, r) { return s + r.amount; }, 0))],
                    ['IVA total', fmt(filteredReceipts.reduce(function (s, r) { return s + r.taxAmount; }, 0))],
                    ['Base imponible', fmt(filteredReceipts.reduce(function (s, r) { return s + (r.amount - r.taxAmount); }, 0))],
                  ].map(function (pair, i) { return <div key={i} className="flex justify-between text-xs"><span className="text-gray-500">{pair[0]}</span><span className="font-bold text-gray-800">{pair[1]}</span></div>; })}
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
          ].map(function (tab) {
            return (
              <button key={tab.id} onClick={function () { navTo(tab.id); }} className={'flex flex-col items-center px-2 py-1 transition-colors ' + (view === tab.id ? 'text-indigo-600' : 'text-gray-400')}>
                {tab.special ? (
                  <div className={'p-2.5 rounded-full -mt-6 shadow-lg transition-colors text-white ' + (view === tab.id ? 'bg-indigo-600' : 'bg-indigo-500')}><tab.icon size={20} /></div>
                ) : (<tab.icon size={20} />)}
                <span className="text-xs mt-1 font-medium">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

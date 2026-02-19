import { initializeApp } from 'firebase/app';
import {
  getFirestore, collection, addDoc, getDocs,
  deleteDoc, doc, updateDoc, query, orderBy
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCKTiet4UmEfOGDwFFbhep7ntGk5rCu_HA",
  authDomain: "ticketai-fcd3a.firebaseapp.com",
  projectId: "ticketai-fcd3a",
  storageBucket: "ticketai-fcd3a.firebasestorage.app",
  messagingSenderId: "127099138034",
  appId: "1:127099138034:web:36b183718f95dc0681856b"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

/* ===== COMPRIMIR IMAGEN PARA FIRESTORE (max ~700KB base64) ===== */
function compressImage(dataUrl, maxSize, quality) {
  maxSize = maxSize || 600;
  quality = quality || 0.5;
  return new Promise(function (resolve) {
    if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
      resolve(null);
      return;
    }
    var img = new Image();
    img.onload = function () {
      try {
        var canvas = document.createElement('canvas');
        var w = img.naturalWidth || img.width;
        var h = img.naturalHeight || img.height;
        var scale = Math.min(1, maxSize / Math.max(w, h));
        canvas.width = Math.round(w * scale);
        canvas.height = Math.round(h * scale);
        var ctx = canvas.getContext('2d');
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        var result = canvas.toDataURL('image/jpeg', quality);
        if (result.length > 700000) {
          canvas.width = Math.round(canvas.width * 0.5);
          canvas.height = Math.round(canvas.height * 0.5);
          ctx = canvas.getContext('2d');
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          result = canvas.toDataURL('image/jpeg', 0.3);
        }
        resolve(result);
      } catch (e) { resolve(null); }
    };
    img.onerror = function () { resolve(null); };
    img.src = dataUrl;
  });
}

/* ===== CARGAR FACTURAS ===== */
export async function fbLoadReceipts() {
  try {
    var q = query(collection(db, 'receipts'), orderBy('createdAt', 'desc'));
    var snap = await getDocs(q);
    return snap.docs.map(function (d) {
      var data = d.data();
      return {
        firebaseId: d.id,
        vendor: data.vendor || '',
        amount: data.amount || 0,
        date: data.date || '',
        category: data.category || 'other',
        description: data.description || '',
        invoiceNumber: data.invoiceNumber || '',
        taxAmount: data.taxAmount || 0,
        paid: !!data.paid,
        fileType: data.fileType || 'manual',
        imageData: data.imageData || data.imageUrl || null,
        ocrText: data.ocrText || '',
      };
    });
  } catch (e) {
    console.error('fbLoadReceipts error:', e);
    var snap2 = await getDocs(collection(db, 'receipts'));
    return snap2.docs.map(function (d) {
      var data = d.data();
      return {
        firebaseId: d.id, vendor: data.vendor || '', amount: data.amount || 0,
        date: data.date || '', category: data.category || 'other',
        description: data.description || '', invoiceNumber: data.invoiceNumber || '',
        taxAmount: data.taxAmount || 0, paid: !!data.paid, fileType: data.fileType || 'manual',
        imageData: data.imageData || data.imageUrl || null, ocrText: data.ocrText || '',
      };
    });
  }
}

/* ===== GUARDAR FACTURA ===== */
export async function fbSaveReceipt(data) {
  var compressed = await compressImage(data.imageData, 600, 0.5);

  var docData = {
    vendor: data.vendor || '',
    amount: data.amount || 0,
    date: data.date || '',
    category: data.category || 'other',
    description: data.description || '',
    invoiceNumber: data.invoiceNumber || '',
    taxAmount: data.taxAmount || 0,
    paid: !!data.paid,
    fileType: data.fileType || 'manual',
    imageData: compressed,
    ocrText: (data.ocrText || '').substring(0, 5000),
    createdAt: new Date(),
  };
  var docRef = await addDoc(collection(db, 'receipts'), docData);
  return { firebaseId: docRef.id, imageData: compressed };
}

/* ===== ACTUALIZAR ===== */
export async function fbUpdateReceipt(firebaseId, updates) {
  await updateDoc(doc(db, 'receipts', firebaseId), updates);
}

/* ===== ELIMINAR ===== */
export async function fbDeleteReceipt(firebaseId) {
  await deleteDoc(doc(db, 'receipts', firebaseId));
}

import { initializeApp } from 'firebase/app';
import {
  getFirestore, collection, addDoc, getDocs,
  deleteDoc, doc, updateDoc, query, orderBy
} from 'firebase/firestore';
import {
  getStorage, ref, uploadBytes, uploadString,
  getDownloadURL, deleteObject
} from 'firebase/storage';

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
export const storage = getStorage(app);

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
        imageData: data.imageUrl || null,
        imagePath: data.imagePath || null,
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
        imageData: data.imageUrl || null, imagePath: data.imagePath || null, ocrText: data.ocrText || '',
      };
    });
  }
}

/* ===== GUARDAR FACTURA ===== */
export async function fbSaveReceipt(data, imageFile) {
  var imageUrl = null;
  var imagePath = null;
  var pathId = Date.now() + '_' + Math.random().toString(36).substr(2, 8);

  if (imageFile) {
    imagePath = 'receipts/' + pathId;
    var imgRef = ref(storage, imagePath);
    await uploadBytes(imgRef, imageFile);
    imageUrl = await getDownloadURL(imgRef);
  } else if (data.imageData && typeof data.imageData === 'string' && data.imageData.startsWith('data:')) {
    imagePath = 'receipts/' + pathId;
    var imgRef2 = ref(storage, imagePath);
    await uploadString(imgRef2, data.imageData, 'data_url');
    imageUrl = await getDownloadURL(imgRef2);
  }

  var docData = {
    vendor: data.vendor || '', amount: data.amount || 0, date: data.date || '',
    category: data.category || 'other', description: data.description || '',
    invoiceNumber: data.invoiceNumber || '', taxAmount: data.taxAmount || 0,
    paid: !!data.paid, fileType: data.fileType || 'manual',
    imageUrl: imageUrl, imagePath: imagePath,
    ocrText: (data.ocrText || '').substring(0, 5000),
    createdAt: new Date(),
  };
  var docRef = await addDoc(collection(db, 'receipts'), docData);
  return { firebaseId: docRef.id, imageUrl: imageUrl, imagePath: imagePath };
}

/* ===== ACTUALIZAR ===== */
export async function fbUpdateReceipt(firebaseId, updates) {
  await updateDoc(doc(db, 'receipts', firebaseId), updates);
}

/* ===== ELIMINAR ===== */
export async function fbDeleteReceipt(firebaseId, imagePath) {
  await deleteDoc(doc(db, 'receipts', firebaseId));
  if (imagePath) {
    try { await deleteObject(ref(storage, imagePath)); } catch (e) { /* ignore */ }
  }
}

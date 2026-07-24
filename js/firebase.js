/**
 * firebase.js
 * -----------------------------------------------------------------------
 * Satu-satunya file yang boleh meng-import SDK Firebase secara langsung.
 * Semua modul lain (storage.js, auth.service.js) HARUS lewat
 * getFirebaseServices() / getSecondaryAuthServices() di sini — jangan
 * pernah import 'firebase-*.js' dari file lain.
 *
 * Backend: Realtime Database (bukan Firestore) + Authentication,
 * project "kira-finance-78d0d" (lihat FIREBASE_CONFIG di config.js).
 * Firebase Storage SENGAJA TIDAK dipakai — butuh plan Blaze (kartu kredit
 * ter-link). Dokumen/lampiran (documents.js) disimpan sebagai base64 di
 * Realtime Database saja, tetap 100% gratis di plan Spark. Kalau nanti
 * project di-upgrade ke Blaze, tinggal tambah lagi `firebase-storage.js`
 * di loadSdk() di bawah dan ganti uploadDocumentFile() di documents.js.
 *
 * Kenapa ada "secondary app"? Firebase Auth client SDK tidak punya Admin
 * SDK di browser — createUserWithEmailAndPassword() otomatis SIGN-IN
 * sebagai user baru itu di instance Auth yang dipakai. Kalau dipanggil di
 * instance Auth utama, admin yang lagi login akan ke-logout & tergantikan
 * sesi user baru. Solusinya: instance Firebase App KEDUA (terpisah, dengan
 * config yang sama) khusus dipakai saat admin membuat/seed user baru, lalu
 * langsung sign-out dari instance itu — sesi admin di app utama tidak
 * pernah tersentuh.
 *
 * KETERBATASAN YANG PERLU DISADARI (bukan bug, ini batas SDK client-side
 * tanpa backend/Cloud Functions):
 *  - Admin TIDAK BISA mengatur ulang password pengguna lain secara
 *    langsung → dipakai sendPasswordResetEmail() (users.js).
 *  - Admin TIDAK BISA menghapus akun Auth pengguna lain → deleteUser() di
 *    auth.service.js hanya menghapus profil (akses aplikasi), akun Auth-nya
 *    sendiri harus dihapus manual lewat Firebase Console > Authentication,
 *    atau nanti lewat Cloud Function kalau proyek ini upgrade ke backend.
 * -----------------------------------------------------------------------
 */

import { FIREBASE_CONFIG } from './config.js';

const SDK_VERSION = '10.12.2';
const CDN = `https://www.gstatic.com/firebasejs/${SDK_VERSION}`;

const isConfigured = Boolean(FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.databaseURL);

let sdkPromise = null;
let firebaseApp = null;
let db = null;
let auth = null;
let authReadyPromise = null;

let secondaryApp = null;
let secondaryAuth = null;
let secondaryDb = null;

function loadSdk() {
  if (!sdkPromise) {
    sdkPromise = Promise.all([
      import(/* @vite-ignore */ `${CDN}/firebase-app.js`),
      import(/* @vite-ignore */ `${CDN}/firebase-database.js`),
      import(/* @vite-ignore */ `${CDN}/firebase-auth.js`),
    ]).then(([appMod, databaseMod, authMod]) => ({ appMod, databaseMod, authMod }));
  }
  return sdkPromise;
}

/**
 * Inisialisasi Firebase (app utama). Aman dipanggil berkali-kali — hanya
 * benar-benar init sekali (singleton).
 * @returns {Promise<boolean>} true jika berhasil, false jika config kosong/gagal
 */
export async function initFirebase() {
  if (!isConfigured) {
    console.error('[firebase.js] FIREBASE_CONFIG belum lengkap (apiKey/databaseURL kosong). Isi js/config.js.');
    return false;
  }
  if (firebaseApp) return true;

  try {
    const { appMod, databaseMod, authMod } = await loadSdk();
    firebaseApp = appMod.initializeApp(FIREBASE_CONFIG);
    db = databaseMod.getDatabase(firebaseApp);
    auth = authMod.getAuth(firebaseApp);

    // Resolve sekali setelah Firebase Auth selesai memeriksa sesi tersimpan
    // (IndexedDB) saat pertama kali load — dipakai getSession() di auth.service.js.
    authReadyPromise = new Promise((resolve) => {
      const unsubscribe = authMod.onAuthStateChanged(auth, (user) => {
        unsubscribe();
        resolve(user);
      });
    });

    return true;
  } catch (error) {
    console.error('[firebase.js] Gagal inisialisasi Firebase:', error);
    return false;
  }
}

export function isFirebaseActive() {
  return Boolean(firebaseApp);
}

/** Resolve dengan firebase.User saat ini (atau null) setelah auth siap. */
export function waitForAuthReady() {
  return authReadyPromise || Promise.resolve(null);
}

/**
 * Bundle service utama: instance (db/auth) + namespace modul SDK
 * (database/authApi) supaya pemanggil bisa pakai fungsi modular Firebase
 * (ref, get, set, signInWithEmailAndPassword, dst) tanpa meng-import ulang
 * CDN di file lain.
 */
export async function getFirebaseServices() {
  const ok = await initFirebase();
  if (!ok) {
    throw new Error('Firebase belum terkonfigurasi dengan benar. Periksa FIREBASE_CONFIG di js/config.js.');
  }
  const { databaseMod, authMod } = await loadSdk();
  return {
    app: firebaseApp,
    db,
    auth,
    database: databaseMod,
    authApi: authMod,
  };
}

/**
 * Instance Auth + Database KEDUA (lihat catatan di atas file), khusus
 * dipakai saat membuat user baru (seed admin default & admin menambah
 * pengguna) supaya tidak mengganggu sesi login yang sedang aktif di app
 * utama. db kedua ini penting khusus untuk seedDefaultAdmin(): saat admin
 * PERTAMA dibuat, belum ada siapa pun yang login di app utama (primary auth
 * masih null) — jadi profil admin pertama itu harus ditulis lewat db
 * instance ini, terautentikasi sebagai DIRINYA SENDIRI (uid baru), supaya
 * cocok dengan security rule "boleh menulis node profil milik sendiri"
 * tanpa perlu sudah jadi admin duluan (lihat database.rules.json).
 */
export async function getSecondaryAuthServices() {
  await initFirebase(); // pastikan app utama & SDK sudah siap dulu
  const { appMod, authMod, databaseMod } = await loadSdk();

  if (!secondaryAuth) {
    secondaryApp = appMod.initializeApp(FIREBASE_CONFIG, 'secondary');
    secondaryAuth = authMod.getAuth(secondaryApp);
    secondaryDb = databaseMod.getDatabase(secondaryApp);
  }

  return { auth: secondaryAuth, authApi: authMod, db: secondaryDb, database: databaseMod };
}

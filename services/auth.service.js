/**
 * auth.service.js
 * -----------------------------------------------------------------------
 * Business logic autentikasi berbasis Firebase Authentication (Email/
 * Password) — password TIDAK PERNAH disimpan/di-hash manual di sini lagi,
 * sepenuhnya ditangani Firebase. Yang disimpan di Realtime Database
 * (STORAGE_KEYS.USERS) cuma profil aplikasi: { id (=uid Auth), name,
 * email, role, active }.
 *
 * Baca catatan "KETERBATASAN" di js/firebase.js soal reset password &
 * hapus user — itu bukan bug, itu batas Firebase Auth client SDK tanpa
 * Cloud Functions/Admin SDK.
 * -----------------------------------------------------------------------
 */

import * as storage from '../js/storage.js';
import { STORAGE_KEYS, ROLES } from '../js/config.js';
import { getFirebaseServices, getSecondaryAuthServices, waitForAuthReady } from '../js/firebase.js';

const AUTH_ERROR_MESSAGES = {
  'auth/invalid-credential': 'Email atau kata sandi salah.',
  'auth/invalid-email': 'Format email tidak valid.',
  'auth/user-not-found': 'Email atau kata sandi salah.',
  'auth/wrong-password': 'Email atau kata sandi salah.',
  'auth/too-many-requests': 'Terlalu banyak percobaan gagal. Coba lagi beberapa saat lagi.',
  'auth/user-disabled': 'Akun ini dinonaktifkan.',
  'auth/email-already-in-use': 'Email sudah terdaftar.',
  'auth/weak-password': 'Kata sandi terlalu lemah, minimal 6 karakter.',
};

function friendlyError(error, fallback) {
  return new Error(AUTH_ERROR_MESSAGES[error?.code] || fallback);
}

/**
 * Pastikan minimal ada satu akun admin agar aplikasi tidak "terkunci" (idempotent).
 *
 * PENTING: fungsi ini dipanggil saat bootstrap, SEBELUM siapa pun login — jadi
 * TIDAK BOLEH membaca node yang butuh "auth != null" (mis. kira-finance:users),
 * karena pasti kena permission-denied dan bikin seluruh app gagal muat. Sebagai
 * gantinya, pengecekan "admin sudah ada?" pakai flag kecil yang publik-bisa-
 * dibaca: kira-finance:meta/adminSeeded (lihat database.rules.json).
 */
export async function seedDefaultAdmin() {
  const { db, database } = await getFirebaseServices();
  const seededSnap = await database.get(database.ref(db, `${STORAGE_KEYS.META}/adminSeeded`));
  if (seededSnap.exists() && seededSnap.val() === true) return;

  const { auth: secAuth, authApi, db: secDb, database: secDatabase } = await getSecondaryAuthServices();
  try {
    const cred = await authApi.createUserWithEmailAndPassword(secAuth, 'admin@sekolah.sch.id', 'admin123');
    const now = new Date().toISOString();
    const profile = {
      id: cred.user.uid,
      name: 'Administrator Sekolah',
      email: 'admin@sekolah.sch.id',
      role: ROLES.ADMIN,
      active: true,
      createdAt: now,
      updatedAt: now,
    };
    // Ditulis lewat db instance KEDUA sambil terautentikasi sebagai diri sendiri
    // (uid baru itu) — lihat catatan getSecondaryAuthServices() di js/firebase.js.
    await secDatabase.set(secDatabase.ref(secDb, `${STORAGE_KEYS.USERS}/${cred.user.uid}`), profile);
    await secDatabase.set(secDatabase.ref(secDb, `${STORAGE_KEYS.META}/adminSeeded`), true);
  } catch (error) {
    // Sudah ada (dibuat sesi/perangkat lain) — abaikan, ini memang tujuan idempotent-nya.
    if (error?.code !== 'auth/email-already-in-use') {
      console.error('[auth.service.js] Gagal seed admin default:', error);
    }
  } finally {
    await authApi.signOut(secAuth).catch(() => {});
  }
}

export async function login(email, password) {
  const { auth, authApi, db, database } = await getFirebaseServices();

  let credential;
  try {
    credential = await authApi.signInWithEmailAndPassword(auth, email.trim(), password);
  } catch (error) {
    throw friendlyError(error, 'Gagal masuk. Periksa koneksi internet Anda.');
  }

  const profile = await storage.getById(STORAGE_KEYS.USERS, credential.user.uid);
  if (!profile || !profile.active) {
    await authApi.signOut(auth);
    throw new Error('Akun tidak ditemukan atau nonaktif. Hubungi administrator.');
  }

  // Self-healing: kalau flag adminSeeded belum sempat ke-set (race condition
  // saat seeding pertama), set sekarang selagi sudah terautentikasi — supaya
  // load berikutnya tidak coba seeding ulang tanpa perlu.
  if (profile.role === ROLES.ADMIN) {
    database.set(database.ref(db, `${STORAGE_KEYS.META}/adminSeeded`), true).catch(() => {});
  }

  return {
    userId: profile.id,
    name: profile.name,
    email: profile.email,
    role: profile.role,
    loggedInAt: new Date().toISOString(),
  };
}

export async function logout() {
  const { auth, authApi } = await getFirebaseServices();
  await authApi.signOut(auth);
}

/** Dipanggil sekali saat bootstrap app — nunggu Firebase Auth selesai baca sesi tersimpan. */
export async function getSession() {
  const { auth } = await getFirebaseServices();
  await waitForAuthReady();

  const user = auth.currentUser;
  if (!user) return null;

  const profile = await storage.getById(STORAGE_KEYS.USERS, user.uid);
  if (!profile || !profile.active) return null;

  return {
    userId: profile.id,
    name: profile.name,
    email: profile.email,
    role: profile.role,
    loggedInAt: new Date().toISOString(),
  };
}

export async function listUsers() {
  return storage.getAll(STORAGE_KEYS.USERS);
}

/** Admin membuat pengguna baru — pakai instance Auth kedua (lihat firebase.js). */
export async function createUser({ name, email, role, password }) {
  const { auth: secAuth, authApi } = await getSecondaryAuthServices();

  let credential;
  try {
    credential = await authApi.createUserWithEmailAndPassword(secAuth, email.trim(), password || 'sekolah123');
  } catch (error) {
    await authApi.signOut(secAuth).catch(() => {});
    throw friendlyError(error, 'Gagal membuat pengguna baru.');
  }

  const profile = await storage.create(STORAGE_KEYS.USERS, {
    id: credential.user.uid,
    name,
    email: email.trim(),
    role,
    active: true,
  });

  await authApi.signOut(secAuth).catch(() => {});
  return profile;
}

/**
 * Update profil pengguna (nama/role/status aktif). `patch.password` SENGAJA
 * diabaikan — admin tidak bisa mengatur ulang password pengguna lain lewat
 * client SDK. Pakai sendPasswordReset(email) untuk kirim tautan reset.
 */
export async function updateUser(id, patch) {
  const { password, ...safePatch } = patch;
  return storage.update(STORAGE_KEYS.USERS, id, safePatch);
}

/** Kirim email reset password — satu-satunya cara client-side yang aman untuk mengubah password pengguna lain. */
export async function sendPasswordReset(email) {
  const { auth, authApi } = await getFirebaseServices();
  try {
    await authApi.sendPasswordResetEmail(auth, email.trim());
  } catch (error) {
    throw friendlyError(error, 'Gagal mengirim email reset password.');
  }
}

/**
 * Hapus profil pengguna (mencabut akses aplikasi). Akun Firebase Auth-nya
 * sendiri TIDAK terhapus (butuh Admin SDK/Cloud Function) — hapus manual
 * lewat Firebase Console > Authentication jika benar-benar perlu.
 */
export async function deleteUser(id) {
  return storage.remove(STORAGE_KEYS.USERS, id);
}

export function hasPermission(session, allowedRoles) {
  if (!allowedRoles || allowedRoles.length === 0) return true;
  return Boolean(session) && allowedRoles.includes(session.role);
}

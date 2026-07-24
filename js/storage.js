/**
 * storage.js
 * -----------------------------------------------------------------------
 * Lapisan persistensi generik berbasis "collection" (mirip Firestore
 * collection/doc), backend-nya Firebase Realtime Database. Semua service
 * (income, expense, accounts, dst) HARUS lewat modul ini untuk baca/tulis
 * data — jangan pernah import firebase.js langsung dari file lain selain
 * modul ini (dan documents.js untuk Storage/file upload).
 *
 * collectionKey (mis. "kira-finance:income") dipakai apa adanya sebagai
 * path node root di Realtime Database — aman karena RTDB hanya melarang
 * karakter ". # $ [ ] /" di nama key, dan ":" tidak termasuk larangan itu.
 * Tiap dokumen disimpan sebagai child bernama id-nya sendiri (bukan
 * push-id acak) supaya skema `{ id, createdAt, updatedAt, ...data }` yang
 * dipakai seluruh service layer tetap konsisten.
 * -----------------------------------------------------------------------
 */

import { generateId } from './utils.js';
import { getFirebaseServices } from './firebase.js';

async function services() {
  return getFirebaseServices();
}

/**
 * Ambil semua dokumen dalam collection, opsional difilter di client.
 * (Skala sekolah — ratusan/ribuan baris per collection — cukup aman
 * di-fetch penuh lalu difilter di JS, konsisten dengan cara service layer
 * yang sudah ada, tanpa perlu index RTDB tambahan.)
 * @param {string} collectionKey
 * @param {(item: object) => boolean} [predicate]
 */
export async function getAll(collectionKey, predicate) {
  const { db, database } = await services();
  const snap = await database.get(database.ref(db, collectionKey));
  const val = snap.exists() ? snap.val() : null;
  const items = val ? Object.values(val) : [];
  return predicate ? items.filter(predicate) : items;
}

/** Ambil satu dokumen berdasarkan id */
export async function getById(collectionKey, id) {
  if (!id) return null;
  const { db, database } = await services();
  const snap = await database.get(database.ref(db, `${collectionKey}/${id}`));
  return snap.exists() ? snap.val() : null;
}

/**
 * Tambah dokumen baru. Otomatis mengisi id, createdAt, updatedAt jika
 * belum ada di `data` (kalau `data.id` sudah diisi, id itu yang dipakai —
 * dipakai auth.service.js untuk menyamakan id dokumen profil dengan uid
 * Firebase Auth).
 */
export async function create(collectionKey, data, idPrefix = 'doc') {
  const { db, database } = await services();
  const now = new Date().toISOString();
  const doc = {
    id: data.id || generateId(idPrefix),
    createdAt: now,
    updatedAt: now,
    ...data,
  };
  await database.set(database.ref(db, `${collectionKey}/${doc.id}`), doc);
  return doc;
}

/** Update sebagian field dokumen berdasarkan id */
export async function update(collectionKey, id, patch) {
  const { db, database } = await services();
  const path = `${collectionKey}/${id}`;
  const snap = await database.get(database.ref(db, path));
  if (!snap.exists()) return null;
  const updated = { ...snap.val(), ...patch, updatedAt: new Date().toISOString() };
  await database.set(database.ref(db, path), updated);
  return updated;
}

/** Hapus dokumen berdasarkan id */
export async function remove(collectionKey, id) {
  const { db, database } = await services();
  const path = `${collectionKey}/${id}`;
  const snap = await database.get(database.ref(db, path));
  if (!snap.exists()) return false;
  await database.remove(database.ref(db, path));
  return true;
}

/** Timpa seluruh isi collection sekaligus (dipakai fitur restore backup) */
export async function replaceAll(collectionKey, items) {
  const { db, database } = await services();
  const keyed = {};
  items.forEach((item) => {
    if (item && item.id) keyed[item.id] = item;
  });
  await database.set(database.ref(db, collectionKey), keyed);
  return items;
}

/** Hapus seluruh isi collection */
export async function clearCollection(collectionKey) {
  const { db, database } = await services();
  await database.remove(database.ref(db, collectionKey));
}

/** Ambil satu value non-array (dipakai untuk settings, license) */
export async function getValue(key, fallback = null) {
  const { db, database } = await services();
  const snap = await database.get(database.ref(db, key));
  return snap.exists() ? snap.val() : fallback;
}

/** Simpan satu value non-array */
export async function setValue(key, value) {
  const { db, database } = await services();
  await database.set(database.ref(db, key), value);
  return true;
}

/** Hapus satu value */
export async function removeValue(key) {
  const { db, database } = await services();
  await database.remove(database.ref(db, key));
}

/**
 * Export snapshot seluruh data (dipakai fitur backup). Mengumpulkan semua
 * node top-level yang berprefix "kira-finance:" jadi satu object.
 */
/**
 * Export snapshot seluruh data (dipakai fitur backup). PENTING: tidak boleh
 * baca root '/' database — root di-kunci ".read": false di security rules
 * (lihat database.rules.json), jadi harus baca tiap koleksi yang memang
 * diizinkan satu per satu lalu digabung.
 * @param {string[]} collectionKeys daftar STORAGE_KEYS yang mau di-backup
 */
export async function exportSnapshot(collectionKeys) {
  const { db, database } = await services();
  const snapshot = {};

  await Promise.all(collectionKeys.map(async (key) => {
    const snap = await database.get(database.ref(db, key));
    if (snap.exists()) snapshot[key] = snap.val();
  }));

  return snapshot;
}

/**
 * Restore snapshot hasil exportSnapshot(). Ditulis per-koleksi (bukan satu
 * multi-path update di root) supaya konsisten dengan exportSnapshot — dan
 * supaya tidak tersandung batasan write di root yang sama.
 */
export async function restoreSnapshot(snapshot) {
  const { db, database } = await services();
  await Promise.all(
    Object.entries(snapshot).map(([key, value]) => database.set(database.ref(db, key), value))
  );
  return true;
}

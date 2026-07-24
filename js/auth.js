/**
 * auth.js
 * -----------------------------------------------------------------------
 * Jembatan antara services/auth.service.js dan lapisan UI (router, navbar,
 * sidebar). Menyimpan cache session di memori supaya komponen lain (navbar,
 * sidebar) tidak perlu memanggil ulang Firebase, dan menyiarkan event saat
 * login/logout terjadi supaya komponen itu bisa re-render.
 * -----------------------------------------------------------------------
 */

import * as authService from '../services/auth.service.js';
import { ROUTE_PERMISSIONS } from './config.js';

let currentSession = null;
const listeners = new Set();

export async function initAuth() {
  await authService.seedDefaultAdmin();
  currentSession = await authService.getSession();
  return currentSession;
}

export function getCurrentSession() {
  return currentSession;
}

export function isAuthenticated() {
  return Boolean(currentSession);
}

export function onAuthChange(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function emitChange() {
  listeners.forEach((cb) => cb(currentSession));
}

export async function login(email, password) {
  currentSession = await authService.login(email, password);
  emitChange();
  return currentSession;
}

export async function logout() {
  await authService.logout();
  currentSession = null;
  emitChange();
}

/** Cek apakah session sekarang boleh mengakses sebuah path route */
export function canAccessRoute(path) {
  const allowedRoles = ROUTE_PERMISSIONS[path];
  if (!allowedRoles) return true;
  return authService.hasPermission(currentSession, allowedRoles);
}

/**
 * account.service.js
 * -----------------------------------------------------------------------
 * Business logic akun kas/bank: CRUD akun + perhitungan saldo berjalan
 * berdasarkan transaksi income/expense yang terhubung ke akun tersebut.
 * -----------------------------------------------------------------------
 */

import * as storage from '../js/storage.js';
import { STORAGE_KEYS } from '../js/config.js';
import { sumBy } from '../js/utils.js';

export async function listAccounts() {
  const accounts = await storage.getAll(STORAGE_KEYS.ACCOUNTS);
  return accounts.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getAccount(id) {
  return storage.getById(STORAGE_KEYS.ACCOUNTS, id);
}

export async function createAccount({ name, type, openingBalance }) {
  return storage.create(STORAGE_KEYS.ACCOUNTS, {
    name,
    type: type || 'kas',
    openingBalance: Number(openingBalance) || 0,
  }, 'acc');
}

export async function updateAccount(id, patch) {
  return storage.update(STORAGE_KEYS.ACCOUNTS, id, patch);
}

export async function deleteAccount(id) {
  return storage.remove(STORAGE_KEYS.ACCOUNTS, id);
}

/**
 * Hitung saldo akun = saldo awal + semua pemasukan - semua pengeluaran
 * yang statusnya "posted" pada akun tersebut.
 */
export async function getAccountBalance(accountId) {
  const account = await getAccount(accountId);
  if (!account) return 0;

  const [incomes, expenses] = await Promise.all([
    storage.getAll(STORAGE_KEYS.INCOME, (t) => t.accountId === accountId && t.status !== 'void'),
    storage.getAll(STORAGE_KEYS.EXPENSE, (t) => t.accountId === accountId && t.status !== 'void'),
  ]);

  return (Number(account.openingBalance) || 0) + sumBy(incomes, 'amount') - sumBy(expenses, 'amount');
}

/** Saldo semua akun sekaligus, untuk dashboard/laporan */
export async function getAllBalances() {
  const accounts = await listAccounts();
  const balances = await Promise.all(accounts.map((acc) => getAccountBalance(acc.id)));
  return accounts.map((acc, i) => ({ ...acc, balance: balances[i] }));
}

export async function getTotalCash() {
  const balances = await getAllBalances();
  return sumBy(balances, 'balance');
}

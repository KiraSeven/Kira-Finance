/**
 * report.service.js
 * -----------------------------------------------------------------------
 * Agregasi lintas-domain untuk kebutuhan laporan & dashboard: arus kas
 * bulanan, ringkasan neraca sederhana, dan perbandingan periode.
 * Tidak melakukan CRUD — murni membaca & mengolah data dari service lain.
 * -----------------------------------------------------------------------
 */

import { listIncome, getTotalIncome, getIncomeByCategory } from './income.service.js';
import { listExpense, getTotalExpense, getExpenseByCategory } from './expense.service.js';
import { getTotalCash, getAllBalances } from './account.service.js';

/** Ringkasan kartu metrik dashboard untuk satu rentang tanggal */
export async function getSummary({ from, to } = {}) {
  const [totalIncome, totalExpense, totalCash] = await Promise.all([
    getTotalIncome({ from, to }),
    getTotalExpense({ from, to }),
    getTotalCash(),
  ]);

  return {
    totalIncome,
    totalExpense,
    netCashFlow: totalIncome - totalExpense,
    totalCash,
  };
}

/**
 * Arus kas per bulan dalam N bulan terakhir (default 6), untuk chart tren.
 * @returns {{ month: string, income: number, expense: number }[]}
 */
export async function getMonthlyCashFlow(monthsCount = 6) {
  const now = new Date();
  const months = [];
  for (let i = monthsCount - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: d });
  }

  const [allIncome, allExpense] = await Promise.all([listIncome(), listExpense()]);

  return months.map(({ key, label }) => {
    const income = allIncome
      .filter((t) => t.date.startsWith(key) && t.status !== 'void')
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const expense = allExpense
      .filter((t) => t.date.startsWith(key) && t.status !== 'void')
      .reduce((sum, t) => sum + Number(t.amount), 0);
    return {
      month: new Intl.DateTimeFormat('id-ID', { month: 'short', year: '2-digit' }).format(label),
      income,
      expense,
    };
  });
}

/** Data untuk laporan Laba/Rugi sederhana (Surplus-Defisit) periode tertentu */
export async function getIncomeStatement({ from, to }) {
  const [incomeByCategory, expenseByCategory, totalIncome, totalExpense] = await Promise.all([
    getIncomeByCategory({ from, to }),
    getExpenseByCategory({ from, to }),
    getTotalIncome({ from, to }),
    getTotalExpense({ from, to }),
  ]);

  return {
    incomeByCategory: incomeByCategory.sort((a, b) => b.total - a.total),
    expenseByCategory: expenseByCategory.sort((a, b) => b.total - a.total),
    totalIncome,
    totalExpense,
    surplus: totalIncome - totalExpense,
  };
}

/** Posisi kas per akun — dasar laporan "Neraca Kas" sederhana */
export async function getCashPosition() {
  return getAllBalances();
}

/**
 * dashboard.js
 * -----------------------------------------------------------------------
 * Page module Dashboard: kartu ringkasan (kas, pemasukan, pengeluaran,
 * surplus), tren arus kas 6 bulan, dan breakdown kategori pengeluaran.
 * Setiap page module mengekspor `render(container)` — konvensi ini dipakai
 * router.js/app.js untuk mount semua halaman secara seragam.
 * -----------------------------------------------------------------------
 */

import { getSummary, getMonthlyCashFlow } from '../services/report.service.js';
import { getExpenseByCategory } from '../services/expense.service.js';
import { listIncome } from '../services/income.service.js';
import { listExpense } from '../services/expense.service.js';
import { createMetricCard } from '../components/card.js';
import { createBarChart, createDonutChart } from '../components/chart.js';
import { createTable } from '../components/table.js';
import { formatCurrency, formatDate } from './utils.js';
import { getCurrentSession } from './auth.js';

const ICON_WALLET = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>';
const ICON_IN = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>';
const ICON_OUT = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
const ICON_SURPLUS = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18M7 14l4-4 3 3 5-6"/></svg>';

export async function render(container) {
  const session = getCurrentSession();
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const monthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-31`;

  container.innerHTML = `
    <div class="page-header">
      <div class="page-header__text">
        <h1 class="text-2xl">Halo, ${session?.name?.split(' ')[0] || ''} 👋</h1>
        <p>Ringkasan keuangan sekolah bulan ${new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(now)}.</p>
      </div>
    </div>
    <div class="section dashboard-grid" data-metrics></div>
    <div class="section grid grid-cols-2">
      <div class="card">
        <h3 class="text-lg" style="margin-bottom:var(--space-4);">Tren Arus Kas (6 Bulan Terakhir)</h3>
        <div data-cashflow-chart></div>
      </div>
      <div class="card">
        <h3 class="text-lg" style="margin-bottom:var(--space-4);">Pengeluaran per Kategori (Bulan Ini)</h3>
        <div data-expense-donut></div>
      </div>
    </div>
    <div class="section card">
      <h3 class="text-lg" style="margin-bottom:var(--space-4);">Transaksi Terbaru</h3>
      <div data-recent-table></div>
    </div>
  `;

  const [summary, cashflow, expenseByCategory, recentIncome, recentExpense] = await Promise.all([
    getSummary({ from: monthStart, to: monthEnd }),
    getMonthlyCashFlow(6),
    getExpenseByCategory({ from: monthStart, to: monthEnd }),
    listIncome(),
    listExpense(),
  ]);

  const metricsEl = container.querySelector('[data-metrics]');
  metricsEl.appendChild(createMetricCard({
    label: 'Total Saldo Kas & Bank', value: formatCurrency(summary.totalCash), icon: ICON_WALLET,
  }));
  metricsEl.appendChild(createMetricCard({
    label: 'Pemasukan Bulan Ini', value: formatCurrency(summary.totalIncome), icon: ICON_IN, trend: 'up',
  }));
  metricsEl.appendChild(createMetricCard({
    label: 'Pengeluaran Bulan Ini', value: formatCurrency(summary.totalExpense), icon: ICON_OUT, trend: 'down',
  }));
  metricsEl.appendChild(createMetricCard({
    label: 'Surplus / Defisit', value: formatCurrency(summary.netCashFlow), icon: ICON_SURPLUS,
    trend: summary.netCashFlow >= 0 ? 'up' : 'down',
  }));

  container.querySelector('[data-cashflow-chart]').appendChild(createBarChart(cashflow));

  const donutSlot = container.querySelector('[data-expense-donut]');
  if (expenseByCategory.length === 0) {
    donutSlot.innerHTML = '<p class="text-muted">Belum ada pengeluaran bulan ini.</p>';
  } else {
    donutSlot.appendChild(createDonutChart(expenseByCategory));
  }

  const recent = [
    ...recentIncome.map((t) => ({ ...t, kind: 'income' })),
    ...recentExpense.map((t) => ({ ...t, kind: 'expense' })),
  ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);

  container.querySelector('[data-recent-table]').appendChild(createTable({
    columns: [
      { key: 'date', label: 'Tanggal', render: (r) => formatDate(r.date) },
      { key: 'docNumber', label: 'No. Dokumen' },
      { key: 'category', label: 'Kategori' },
      { key: 'description', label: 'Keterangan' },
      {
        key: 'amount', label: 'Jumlah', align: 'right',
        render: (r) => `<span class="num ${r.kind === 'income' ? 'text-income' : 'text-expense'}">${r.kind === 'income' ? '+' : '-'} ${formatCurrency(r.amount)}</span>`,
      },
    ],
    rows: recent,
    emptyMessage: 'Belum ada transaksi tercatat.',
  }));
}

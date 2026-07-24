/**
 * chart.js
 * -----------------------------------------------------------------------
 * Chart ringan berbasis <canvas>, tanpa dependency eksternal. Cukup untuk
 * kebutuhan dashboard/laporan (bar chart arus kas, donut chart kategori).
 * Warna diambil dari --chart-1..6 di variables.css lewat getComputedStyle.
 * -----------------------------------------------------------------------
 */

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function setupCanvas(canvas, height) {
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.clientWidth || canvas.parentElement.clientWidth || 400;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.height = `${height}px`;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  return { ctx, width, height };
}

/**
 * Grouped bar chart (income vs expense per bulan).
 * @param {{ month: string, income: number, expense: number }[]} data
 */
export function createBarChart(data, { height = 260 } = {}) {
  const wrap = document.createElement('div');
  const canvas = document.createElement('canvas');
  wrap.appendChild(canvas);

  requestAnimationFrame(() => {
    const { ctx, width } = setupCanvas(canvas, height);
    const padding = { top: 16, right: 8, bottom: 28, left: 8 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    const max = Math.max(1, ...data.flatMap((d) => [d.income, d.expense]));
    const groupW = chartW / data.length;
    const barW = Math.min(18, groupW / 4);

    const incomeColor = cssVar('--color-income') || '#3FBF8F';
    const expenseColor = cssVar('--color-expense') || '#E2685C';
    const textColor = cssVar('--color-text-tertiary') || '#6B7590';
    const borderColor = cssVar('--color-border') || 'rgba(255,255,255,0.08)';

    ctx.strokeStyle = borderColor;
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top + chartH);
    ctx.lineTo(padding.left + chartW, padding.top + chartH);
    ctx.stroke();

    ctx.font = '11px Inter, sans-serif';
    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';

    data.forEach((d, i) => {
      const groupX = padding.left + i * groupW + groupW / 2;
      const incomeH = (d.income / max) * chartH;
      const expenseH = (d.expense / max) * chartH;

      ctx.fillStyle = incomeColor;
      const ir = 3;
      roundRectTop(ctx, groupX - barW - 3, padding.top + chartH - incomeH, barW, incomeH, ir);

      ctx.fillStyle = expenseColor;
      roundRectTop(ctx, groupX + 3, padding.top + chartH - expenseH, barW, expenseH, ir);

      ctx.fillStyle = textColor;
      ctx.fillText(d.month, groupX, height - 8);
    });
  });

  const legend = document.createElement('div');
  legend.className = 'chart-legend';
  legend.innerHTML = `
    <span class="chart-legend__item"><span class="chart-legend__swatch" style="background:var(--color-income)"></span>Pemasukan</span>
    <span class="chart-legend__item"><span class="chart-legend__swatch" style="background:var(--color-expense)"></span>Pengeluaran</span>
  `;
  wrap.appendChild(legend);

  return wrap;
}

function roundRectTop(ctx, x, y, w, h, r) {
  if (h <= 0) return;
  const radius = Math.min(r, w / 2, h);
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.lineTo(x + w - radius, y);
  ctx.arcTo(x + w, y, x + w, y + radius, radius);
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
  ctx.fill();
}

/**
 * Donut chart untuk breakdown kategori.
 * @param {{ category: string, total: number }[]} data
 */
export function createDonutChart(data, { size = 220 } = {}) {
  const wrap = document.createElement('div');
  wrap.style.display = 'flex';
  wrap.style.gap = '20px';
  wrap.style.alignItems = 'center';
  wrap.style.flexWrap = 'wrap';

  const canvas = document.createElement('canvas');
  wrap.appendChild(canvas);

  const colors = [1, 2, 3, 4, 5, 6].map((n) => cssVar(`--chart-${n}`));
  const total = data.reduce((sum, d) => sum + d.total, 0) || 1;

  requestAnimationFrame(() => {
    const { ctx } = setupCanvas(canvas, size);
    canvas.style.width = `${size}px`;
    const cx = size / 2;
    const cy = size / 2;
    const outerR = size / 2 - 8;
    const innerR = outerR * 0.62;

    let startAngle = -Math.PI / 2;
    data.forEach((d, i) => {
      const sliceAngle = (d.total / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.fillStyle = colors[i % colors.length];
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, outerR, startAngle, startAngle + sliceAngle);
      ctx.closePath();
      ctx.fill();
      startAngle += sliceAngle;
    });

    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  });

  const legend = document.createElement('div');
  legend.className = 'chart-legend';
  legend.style.flexDirection = 'column';
  legend.style.marginTop = '0';
  data.forEach((d, i) => {
    const percent = ((d.total / total) * 100).toFixed(1);
    const item = document.createElement('span');
    item.className = 'chart-legend__item';
    item.innerHTML = `<span class="chart-legend__swatch" style="background:${colors[i % colors.length]}"></span>${d.category} — ${percent}%`;
    legend.appendChild(item);
  });
  wrap.appendChild(legend);

  return wrap;
}

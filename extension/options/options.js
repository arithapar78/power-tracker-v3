// options/options.js
// Role: load watt history and render the stats + line chart.
//
// Chart logic:
//   - X axis: time. Points are spread evenly across canvas width proportional
//     to their actual timestamps so gaps are visible.
//   - Y axis: watts. Range is 0 → max(watts) padded by 20%, so the line
//     never touches the top edge.
//   - Drawn with native canvas 2D — no library needed.
//   - A thin grid of horizontal guide lines is drawn at 25% intervals.

const PADDING = { top: 16, right: 16, bottom: 32, left: 44 };

// ── Data loading ────────────────────────────────────────────────────────────

async function loadAndRender() {
  const response = await chrome.runtime.sendMessage({ type: 'GET_HISTORY' });
  const history = response?.history ?? [];

  if (history.length === 0) {
    document.getElementById('chart').classList.add('hidden');
    document.getElementById('empty-msg').classList.remove('hidden');
    setStats(null);
    return;
  }

  setStats(history);
  drawChart(history);
}

// ── Stats ───────────────────────────────────────────────────────────────────

function setStats(history) {
  const currentEl = document.getElementById('stat-current');
  const avgEl     = document.getElementById('stat-avg');
  const peakEl    = document.getElementById('stat-peak');

  if (!history || history.length === 0) {
    currentEl.textContent = '—';
    avgEl.textContent     = '—';
    peakEl.textContent    = '—';
    return;
  }

  const watts = history.map((e) => e.watts);
  const current = watts[watts.length - 1];
  const avg  = watts.reduce((s, v) => s + v, 0) / watts.length;
  const peak = Math.max(...watts);

  currentEl.textContent = current.toFixed(2);
  avgEl.textContent     = avg.toFixed(2);
  peakEl.textContent    = peak.toFixed(2);
}

// ── Site colours ────────────────────────────────────────────────────────────

const SITE_COLORS = {
  openai:     '#10a37f',
  anthropic:  '#d4651f',
  google:     '#4285f4',
  stability:  '#7c3aed',
  mistral:    '#f59e0b',
  cohere:     '#ec4899',
  huggingface:'#f97316',
  together:   '#06b6d4',
  replicate:  '#6366f1',
};

function siteColor(site) {
  return SITE_COLORS[site] ?? '#888';
}

// ── Chart ───────────────────────────────────────────────────────────────────

function drawChart(history) {
  const canvas = document.getElementById('chart');
  const ctx    = canvas.getContext('2d');

  // Sync canvas buffer to actual rendered CSS size (handles devicePixelRatio).
  const dpr  = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width  = Math.round(rect.width  * dpr);
  canvas.height = Math.round(rect.height * dpr);
  ctx.scale(dpr, dpr);
  const W = rect.width;
  const H = rect.height;

  const pl = PADDING.left, pr = PADDING.right;
  const pt = PADDING.top,  pb = PADDING.bottom;
  const chartW = W - pl - pr;
  const chartH = H - pt - pb;

  ctx.clearRect(0, 0, W, H);

  // Y range: 0 to peak + 20% headroom.
  const peak = Math.max(...history.map((e) => e.watts));
  const yMax = peak > 0 ? peak * 1.2 : 1;

  // ── Horizontal grid lines + Y labels ─────────────────────────────────────
  ctx.font      = '10px -apple-system, sans-serif';
  ctx.textAlign = 'right';

  for (let i = 0; i <= 4; i++) {
    const wVal = (yMax * i) / 4;
    const yPx  = pt + chartH - (i / 4) * chartH;

    ctx.strokeStyle = '#e8e8e8';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(pl, yPx);
    ctx.lineTo(W - pr, yPx);
    ctx.stroke();

    ctx.fillStyle = '#999';
    ctx.fillText(wVal.toFixed(1), pl - 4, yPx + 3);
  }

  // ── Bars ──────────────────────────────────────────────────────────────────
  // Each entry gets an equal-width slot. Gap is 20% of slot width.
  const n       = history.length;
  const slotW   = chartW / n;
  const barW    = Math.max(1, slotW * 0.8);
  const gapW    = slotW - barW;

  history.forEach((entry, i) => {
    const barH  = (entry.watts / yMax) * chartH;
    const x     = pl + i * slotW + gapW / 2;
    const y     = pt + chartH - barH;

    ctx.fillStyle = siteColor(entry.site);
    ctx.fillRect(x, y, barW, barH);
  });

  // ── X axis time labels ────────────────────────────────────────────────────
  // Show up to 5 evenly-spaced labels, centred on their bar.
  ctx.fillStyle = '#999';
  ctx.textAlign = 'center';
  const labelCount = Math.min(n, 5);
  for (let i = 0; i < labelCount; i++) {
    const idx   = Math.round((i / (labelCount - 1 || 1)) * (n - 1));
    const entry = history[idx];
    const xMid  = pl + idx * slotW + slotW / 2;
    const label = new Date(entry.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    ctx.fillText(label, xMid, H - 6);
  }

  // ── Legend ────────────────────────────────────────────────────────────────
  // Show one dot + name for each distinct site present.
  const sites = [...new Set(history.map((e) => e.site).filter(Boolean))];
  if (sites.length > 0) {
    ctx.textAlign = 'left';
    ctx.font      = '9px -apple-system, sans-serif';
    let lx = pl;
    for (const site of sites) {
      ctx.fillStyle = siteColor(site);
      ctx.beginPath();
      ctx.arc(lx + 4, pt - 4, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#666';
      ctx.fillText(site, lx + 12, pt - 1);
      lx += ctx.measureText(site).width + 24;
    }
  }
}

// ── Clear button ────────────────────────────────────────────────────────────

document.getElementById('clear-btn').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'CLEAR_HISTORY' });
  await loadAndRender();
});

// ── Init ────────────────────────────────────────────────────────────────────

loadAndRender();

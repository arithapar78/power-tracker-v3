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

// ── Chart ───────────────────────────────────────────────────────────────────

function drawChart(history) {
  const canvas = document.getElementById('chart');
  const ctx    = canvas.getContext('2d');
  const W      = canvas.width;
  const H      = canvas.height;
  const pl = PADDING.left, pr = PADDING.right;
  const pt = PADDING.top,  pb = PADDING.bottom;
  const chartW = W - pl - pr;
  const chartH = H - pt - pb;

  ctx.clearRect(0, 0, W, H);

  // Y range: 0 to peak + 20% headroom.
  const peak   = Math.max(...history.map((e) => e.watts));
  const yMax   = peak > 0 ? peak * 1.2 : 1;

  // X range: first to last timestamp.
  const tMin   = history[0].ts;
  const tMax   = history[history.length - 1].ts;
  const tRange = tMax - tMin || 1; // avoid divide-by-zero for single point

  // Helper: data coords → canvas pixel coords.
  function px(ts, watts) {
    const x = pl + ((ts - tMin) / tRange) * chartW;
    const y = pt + chartH - (watts / yMax) * chartH;
    return [x, y];
  }

  // ── Grid lines ────────────────────────────────────────────────────────────
  ctx.strokeStyle = '#e8e8e8';
  ctx.lineWidth   = 1;
  ctx.fillStyle   = '#999';
  ctx.font        = '10px -apple-system, sans-serif';
  ctx.textAlign   = 'right';

  for (let i = 0; i <= 4; i++) {
    const wVal = (yMax * i) / 4;
    const yPx  = pt + chartH - (i / 4) * chartH;

    ctx.beginPath();
    ctx.moveTo(pl, yPx);
    ctx.lineTo(W - pr, yPx);
    ctx.stroke();

    ctx.fillText(wVal.toFixed(1), pl - 4, yPx + 3);
  }

  // ── X axis labels ─────────────────────────────────────────────────────────
  ctx.textAlign = 'center';
  const labelCount = Math.min(history.length, 5);
  for (let i = 0; i < labelCount; i++) {
    const idx  = Math.round((i / (labelCount - 1 || 1)) * (history.length - 1));
    const entry = history[idx];
    const [xPx] = px(entry.ts, 0);
    const label = new Date(entry.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    ctx.fillStyle = '#999';
    ctx.fillText(label, xPx, H - 6);
  }

  // ── Line ──────────────────────────────────────────────────────────────────
  ctx.beginPath();
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth   = 2;
  ctx.lineJoin    = 'round';

  history.forEach((entry, i) => {
    const [x, y] = px(entry.ts, entry.watts);
    if (i === 0) ctx.moveTo(x, y);
    else         ctx.lineTo(x, y);
  });

  ctx.stroke();

  // ── Dots at each data point ───────────────────────────────────────────────
  // Only draw dots when there are few enough points to be readable.
  if (history.length <= 60) {
    ctx.fillStyle = '#1a1a1a';
    history.forEach((entry) => {
      const [x, y] = px(entry.ts, entry.watts);
      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    });
  }
}

// ── Clear button ────────────────────────────────────────────────────────────

document.getElementById('clear-btn').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'CLEAR_HISTORY' });
  await loadAndRender();
});

// ── Init ────────────────────────────────────────────────────────────────────

loadAndRender();

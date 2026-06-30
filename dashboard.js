// ============================================================
// SHE INJURY INTELLIGENCE — dashboard.js
// Set your Apps Script URL below
// ============================================================

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxzV_PzGZ05yf54N7x-sTWP0HgXRk8yRhjkrFwwZy9t4TKvWxZSxQjuo79Ad_-BA6QNzQ/exec";

Chart.defaults.color = "#64748b";
Chart.defaults.font.family = "'Inter', system-ui, sans-serif";
Chart.defaults.font.size = 11;
Chart.defaults.plugins.legend.display = false;

const COLORS = ["#00d4ff","#8b5cf6","#10b981","#f59e0b","#ef4444","#38bdf8","#f472b6","#84cc16","#fb923c","#22d3ee"];
const GRID = "rgba(255,255,255,0.04)";
const BORDER = "rgba(255,255,255,0.08)";

let charts = {};
let appData = {};

// ── Nav ──────────────────────────────────────────────────────
function showView(id, btn) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('view-' + id).classList.add('active');
  if (btn) btn.classList.add('active');
  const titles = { overview:'Dashboard', trends:'Trends', departments:'Departments', injuries:'Injury Types', records:'Records', prediction:'AI Prediction' };
  document.getElementById('viewTitle').textContent = titles[id] || id;
}

// ── API ──────────────────────────────────────────────────────
async function api(action) {
  const res = await fetch(`${APPS_SCRIPT_URL}?action=${action}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ── Animated counter ─────────────────────────────────────────
function animateCounter(el, target, duration = 900) {
  const start = 0;
  const startTime = performance.now();
  function tick(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(start + (target - start) * eased).toLocaleString();
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// ── Load all ─────────────────────────────────────────────────
async function loadAll() {
  const loader = document.getElementById('pageLoader');
  const refreshBtn = document.getElementById('refreshBtn');
  refreshBtn.classList.add('spinning');

  if (APPS_SCRIPT_URL.includes('YOUR_SCRIPT_ID')) {
    document.getElementById('configBanner').classList.add('show');
    loadDemoData();
    finishLoad(loader, refreshBtn);
    return;
  }

  try {
    const [stats, monthly, injury, raw] = await Promise.all([
      api('stats'), api('monthly'), api('injury'), api('raw')
    ]);
    appData = { stats, monthly, injury, raw };
    renderAll();
    document.getElementById('lastSync').textContent = new Date().toLocaleTimeString();
    loadPrediction();
  } catch (e) {
    console.error(e);
    document.getElementById('configBanner').classList.add('show');
    loadDemoData();
  } finally {
    finishLoad(loader, refreshBtn);
  }
}

function finishLoad(loader, refreshBtn) {
  setTimeout(() => {
    loader.classList.add('done');
    refreshBtn.classList.remove('spinning');
  }, 300);
}

// ── Demo data ────────────────────────────────────────────────
function loadDemoData() {
  const depts = ['Primary Production','Packing','Engineering','ETD','Administration','Kitchen','Quality','Maintenance'];
  const injTypes = ['Abrasion','Pain','Trauma','Foreign Body','Pain & Swelling','Burn','Laceration'];
  const natures = ['Contact with hard object','Hit with hard object','Contact with sharp object','Fall of hard object','Slip and fall','Chemical spill','Enter of Dust'];
  const bodyParts = ['Right Hand','Left Hand','Right Foot','Left Foot','Right Eye','Left Eye','Both Eyes','Head','Leg','Knee','Finger','Thumb','Elbow','Shoulder'];

  const monthly = [];
  for (let y = 2015; y <= 2024; y++) {
    for (let m = 1; m <= 12; m++) {
      const base = 18 + Math.sin(m * 0.5) * 4;
      const trend = (y - 2015) * 0.3;
      monthly.push({ month: `${y}-${String(m).padStart(2,'0')}`, count: Math.round(base + trend + Math.random() * 6) });
    }
  }
  for (let m = 1; m <= 9; m++) monthly.push({ month: `2025-${String(m).padStart(2,'0')}`, count: Math.round(22 + Math.random() * 8) });

  const total = monthly.reduce((s, m) => s + m.count, 0);
  const byYear = {};
  monthly.forEach(m => { const y = m.month.split('-')[0]; byYear[y] = (byYear[y]||0)+m.count; });

  const byDept = {};
  depts.forEach((d,i) => byDept[d] = Math.round(total * [0.24,0.20,0.16,0.12,0.10,0.08,0.06,0.04][i]));

  const byBodyPart = {};
  bodyParts.forEach((b,i) => byBodyPart[b] = Math.round(total * (0.12 - i*0.008)));

  appData = {
    stats: { total, byGender:{ Male: Math.round(total*0.72), Female: Math.round(total*0.28) }, byYear, byDepartment: byDept, byBodyPart },
    monthly: { monthly },
    injury: {
      injuryTypes: Object.fromEntries(injTypes.map((t,i) => [t, Math.round(total*(0.35-i*0.04))])),
      natures: Object.fromEntries(natures.map((n,i) => [n, Math.round(total*(0.25-i*0.03))]))
    },
    raw: { data: [], total }
  };
  renderAll();
  document.getElementById('lastSync').textContent = 'Demo mode';
}

// ── Render everything ────────────────────────────────────────
function renderAll() {
  renderKPIs();
  renderTrendChart();
  renderDeptBars();
  renderInjuryDonut();
  renderYearChart();
  renderGenderChart();
  renderHeatmap();
  renderNatureChart();
  renderBodyChart();
  renderAllDeptBars();
  renderDeptAllChart();
  renderInjTypeBars();
  renderNatureBars();
  renderBodyBars();
  renderRecords();
}

// ── KPIs ─────────────────────────────────────────────────────
function renderKPIs() {
  const { stats, monthly } = appData;
  animateCounter(document.getElementById('kpi-total'), stats.total);

  const years = Object.keys(stats.byYear || {}).sort();
  const currentYear = years[years.length - 1] || new Date().getFullYear().toString();
  const prevYear = years[years.length - 2];
  const thisYearVal = stats.byYear?.[currentYear] || 0;
  const prevYearVal = stats.byYear?.[prevYear] || 0;

  animateCounter(document.getElementById('kpi-year'), thisYearVal);
  document.getElementById('kpi-year-label').textContent = `Year ${currentYear}`;

  const avg = monthly.monthly.length ? Math.round(stats.total / monthly.monthly.length) : 0;
  animateCounter(document.getElementById('kpi-avg'), avg);

  const m = stats.byGender?.Male || 0, f = stats.byGender?.Female || 0;
  const pct = m+f ? Math.round(m/(m+f)*100) : 0;
  document.getElementById('kpi-gender').textContent = `${pct}% M`;
  document.getElementById('kpi-gender-sub').textContent = `${m} male, ${f} female`;

  const topDept = Object.entries(stats.byDepartment||{}).sort((a,b)=>b[1]-a[1])[0];
  if (topDept) {
    document.getElementById('kpi-dept').textContent = topDept[0].length > 16 ? topDept[0].slice(0,14)+'…' : topDept[0];
    document.getElementById('kpi-dept-sub').textContent = `${topDept[1]} incidents recorded`;
  }

  // Trend insight chip on the monthly trend chart
  if (monthly.monthly.length >= 2) {
    const last = monthly.monthly[monthly.monthly.length-1].count;
    const prev = monthly.monthly[monthly.monthly.length-2].count;
    const diff = last - prev;
    const chip = document.getElementById('trendInsightChip');
    const text = document.getElementById('trendInsightText');
    if (diff !== 0) {
      chip.style.display = 'inline-flex';
      text.textContent = diff > 0
        ? `+${diff} vs last month`
        : `${diff} vs last month`;
      chip.style.background = diff > 0 ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)';
      chip.style.color = diff > 0 ? '#ef4444' : '#10b981';
    }
  }
}

// ── Mini animated bar list (used in multiple panels) ──────────
function renderBarList(containerId, entries, colorFn, maxItems) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const sliced = maxItems ? entries.slice(0, maxItems) : entries;
  const max = Math.max(...sliced.map(([,v]) => v), 1);

  container.innerHTML = sliced.map(([label, value], i) => `
    <div class="stat-row">
      <div class="stat-name" style="flex:0 0 140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${label}">${label}</div>
      <div class="stat-bar-wrap">
        <div class="stat-bar-track">
          <div class="stat-bar-fill" data-w="${(value/max*100).toFixed(1)}" style="background:${colorFn(i)}"></div>
        </div>
      </div>
      <div class="stat-num">${value}</div>
    </div>
  `).join('');

  // Trigger animation after paint
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      container.querySelectorAll('.stat-bar-fill').forEach(el => {
        el.style.width = el.dataset.w + '%';
      });
    });
  });
}

function renderDeptBars() {
  const sorted = Object.entries(appData.stats.byDepartment||{}).sort((a,b)=>b[1]-a[1]).slice(0,6);
  renderBarList('deptBars', sorted, i => COLORS[i % COLORS.length]);
}
function renderAllDeptBars() {
  const sorted = Object.entries(appData.stats.byDepartment||{}).sort((a,b)=>b[1]-a[1]);
  renderBarList('allDeptBars', sorted, i => COLORS[i % COLORS.length]);
}
function renderInjTypeBars() {
  const sorted = Object.entries(appData.injury.injuryTypes||{}).sort((a,b)=>b[1]-a[1]);
  renderBarList('injTypeBars', sorted, i => COLORS[i % COLORS.length]);
}
function renderNatureBars() {
  const sorted = Object.entries(appData.injury.natures||{}).sort((a,b)=>b[1]-a[1]);
  renderBarList('natureBars', sorted, () => '#f59e0b');
}
function renderBodyBars() {
  const sorted = Object.entries(appData.stats.byBodyPart||{}).sort((a,b)=>b[1]-a[1]);
  renderBarList('bodyBars', sorted, () => '#8b5cf6');
}

// ── Trend chart ──────────────────────────────────────────────
function renderTrendChart() {
  const ctx = document.getElementById('trendChart').getContext('2d');
  if (charts.trend) charts.trend.destroy();
  const data = appData.monthly.monthly;
  const labels = data.map(d => {
    const [y,m] = d.month.split('-');
    const mn = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+m-1];
    return m === '01' ? `${mn} ${y}` : mn;
  });

  const gradient = ctx.createLinearGradient(0, 0, 0, 200);
  gradient.addColorStop(0, 'rgba(0,212,255,0.25)');
  gradient.addColorStop(1, 'rgba(0,212,255,0)');

  charts.trend = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data: data.map(d => d.count),
        borderColor: '#00d4ff',
        backgroundColor: gradient,
        borderWidth: 2, tension: 0.4, fill: true,
        pointRadius: 0, pointHoverRadius: 5,
        pointHoverBackgroundColor: '#00d4ff',
        pointHoverBorderColor: '#fff', pointHoverBorderWidth: 2
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: { duration: 900, easing: 'easeOutQuart' },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#111827', borderColor: '#1e293b', borderWidth: 1,
          padding: 10, titleColor: '#e2e8f0', bodyColor: '#94a3b8',
          titleFont: { weight: 600 }, displayColors: false
        }
      },
      scales: {
        x: { grid: { color: GRID }, border: { color: BORDER }, ticks: { maxTicksLimit: 14, maxRotation: 0 } },
        y: { grid: { color: GRID }, border: { color: BORDER }, beginAtZero: true }
      }
    }
  });
}

// ── Injury Donut ─────────────────────────────────────────────
function renderInjuryDonut() {
  const ctx = document.getElementById('injuryDonut').getContext('2d');
  if (charts.donut) charts.donut.destroy();
  const sorted = Object.entries(appData.injury.injuryTypes||{}).sort((a,b)=>b[1]-a[1]).slice(0,7);
  charts.donut = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: sorted.map(([k])=>k),
      datasets: [{ data: sorted.map(([,v])=>v), backgroundColor: COLORS.slice(0,7), borderWidth: 0, hoverOffset: 6, borderRadius: 3 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '64%',
      animation: { animateRotate: true, duration: 900 },
      plugins: {
        legend: { display: true, position: 'right', labels: { boxWidth: 8, padding: 8, font: { size: 10 }, color: '#94a3b8' } },
        tooltip: { backgroundColor: '#111827', borderColor: '#1e293b', borderWidth: 1, padding: 10 }
      }
    }
  });
}

// ── Year Chart ───────────────────────────────────────────────
function renderYearChart() {
  const ctx = document.getElementById('yearChart').getContext('2d');
  if (charts.year) charts.year.destroy();
  const sorted = Object.entries(appData.stats.byYear||{}).sort((a,b)=>a[0]-b[0]);
  charts.year = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: sorted.map(([k])=>k),
      datasets: [{ data: sorted.map(([,v])=>v), backgroundColor: '#00d4ff', borderRadius: 6, maxBarThickness: 36 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: { duration: 800, easing: 'easeOutQuart' },
      plugins: { legend: { display: false }, tooltip: { backgroundColor: '#111827', borderColor: '#1e293b', borderWidth: 1 } },
      scales: {
        x: { grid: { color: GRID }, border: { color: BORDER } },
        y: { grid: { color: GRID }, border: { color: BORDER }, beginAtZero: true }
      }
    }
  });
}

// ── Gender Chart ─────────────────────────────────────────────
function renderGenderChart() {
  const ctx = document.getElementById('genderChart').getContext('2d');
  if (charts.gender) charts.gender.destroy();
  const m = appData.stats.byGender?.Male || 0;
  const f = appData.stats.byGender?.Female || 0;
  charts.gender = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Male', 'Female'],
      datasets: [{ data: [m, f], backgroundColor: ['#00d4ff', '#f472b6'], borderWidth: 0, hoverOffset: 6 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '70%',
      animation: { animateRotate: true, duration: 900 },
      plugins: {
        legend: { display: true, position: 'bottom', labels: { boxWidth: 8, padding: 14, color: '#94a3b8' } },
        tooltip: { backgroundColor: '#111827', borderColor: '#1e293b', borderWidth: 1 }
      }
    }
  });
}

// ── Heatmap ──────────────────────────────────────────────────
function renderHeatmap() {
  const container = document.getElementById('heatmapGrid');
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const totals = new Array(12).fill(0);
  const counts = new Array(12).fill(0);
  appData.monthly.monthly.forEach(({ month, count }) => {
    const m = parseInt(month.split('-')[1]) - 1;
    totals[m] += count; counts[m]++;
  });
  const avgs = totals.map((t,i) => counts[i] ? Math.round(t/counts[i]) : 0);
  const maxAvg = Math.max(...avgs, 1);

  container.innerHTML = avgs.map((v, i) => {
    const intensity = v / maxAvg;
    const r = Math.round(0 + (239-0)*intensity);
    const g = Math.round(212 + (68-212)*intensity);
    const b = Math.round(255 + (68-255)*intensity);
    return `
      <div class="heat-cell" style="background:rgba(${r},${g},${b},${0.15 + intensity*0.7});opacity:${0.6+intensity*0.4}" title="${monthNames[i]}: avg ${v} incidents">
        ${v}
        <span class="heat-month">${monthNames[i]}</span>
      </div>
    `;
  }).join('');
}

// ── Nature Chart ─────────────────────────────────────────────
function renderNatureChart() {
  const ctx = document.getElementById('natureChart').getContext('2d');
  if (charts.nature) charts.nature.destroy();
  const sorted = Object.entries(appData.injury.natures||{}).sort((a,b)=>b[1]-a[1]).slice(0,8);
  charts.nature = new Chart(ctx, {
    type: 'bar', indexAxis: 'y',
    data: { labels: sorted.map(([k])=>k.length>20?k.slice(0,18)+'…':k), datasets: [{ data: sorted.map(([,v])=>v), backgroundColor: '#10b981', borderRadius: 5 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: { duration: 800 },
      plugins: { legend: { display: false }, tooltip: { backgroundColor: '#111827', borderColor: '#1e293b', borderWidth: 1 } },
      scales: {
        x: { grid: { color: GRID }, border: { color: BORDER }, beginAtZero: true },
        y: { grid: { display: false }, border: { color: BORDER } }
      }
    }
  });
}

// ── Body Chart ───────────────────────────────────────────────
function renderBodyChart() {
  const ctx = document.getElementById('bodyChart').getContext('2d');
  if (charts.body) charts.body.destroy();
  const sorted = Object.entries(appData.stats.byBodyPart||{}).sort((a,b)=>b[1]-a[1]).slice(0,8);
  charts.body = new Chart(ctx, {
    type: 'bar', indexAxis: 'y',
    data: { labels: sorted.map(([k])=>k), datasets: [{ data: sorted.map(([,v])=>v), backgroundColor: '#8b5cf6', borderRadius: 5 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: { duration: 800 },
      plugins: { legend: { display: false }, tooltip: { backgroundColor: '#111827', borderColor: '#1e293b', borderWidth: 1 } },
      scales: {
        x: { grid: { color: GRID }, border: { color: BORDER }, beginAtZero: true },
        y: { grid: { display: false }, border: { color: BORDER } }
      }
    }
  });
}

// ── Dept All Chart (horizontal) ───────────────────────────────
function renderDeptAllChart() {
  const ctx = document.getElementById('deptAllChart').getContext('2d');
  if (charts.deptAll) charts.deptAll.destroy();
  const sorted = Object.entries(appData.stats.byDepartment||{}).sort((a,b)=>b[1]-a[1]).slice(0,8);
  charts.deptAll = new Chart(ctx, {
    type: 'bar', indexAxis: 'y',
    data: { labels: sorted.map(([k])=>k), datasets: [{ data: sorted.map(([,v])=>v), backgroundColor: COLORS.slice(0,sorted.length), borderRadius: 5 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: { duration: 800 },
      plugins: { legend: { display: false }, tooltip: { backgroundColor: '#111827', borderColor: '#1e293b', borderWidth: 1 } },
      scales: {
        x: { grid: { color: GRID }, border: { color: BORDER }, beginAtZero: true },
        y: { grid: { display: false }, border: { color: BORDER } }
      }
    }
  });
}

// ── Records table ────────────────────────────────────────────
function renderRecords() {
  const tbody = document.getElementById('recordsTbody');
  const rows = appData.raw?.data || [];
  document.getElementById('recordCount').textContent = rows.length
    ? `Showing ${rows.length} of ${appData.raw.total} records`
    : 'No data available (demo mode)';

  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--muted);padding:40px">No records — connect your Apps Script URL to see live data</td></tr>';
    return;
  }

  const genderBadge = g => g === 'Male' ? 'badge-cyan' : g === 'Female' ? 'badge-purple' : 'badge-muted';

  tbody.innerHTML = rows.map(r => `
    <tr>
      <td style="white-space:nowrap;font-family:var(--font-mono);font-size:11px">${r['Date'] ? new Date(r['Date']).toLocaleDateString('en-GB') : '—'}</td>
      <td style="max-width:240px">${r['Description of Incident']||'—'}</td>
      <td>${r['Nature of Incident']||'—'}</td>
      <td><span class="badge badge-amber">${r['Type of Injury']||'—'}</span></td>
      <td>${r['Affected part']||'—'}</td>
      <td><span class="badge ${genderBadge(r['Gender'])}">${r['Gender']||'—'}</span></td>
      <td>${r['Name']||'—'}</td>
      <td>${r['Section']||'—'}</td>
      <td>${r['Dept']||'—'}</td>
    </tr>
  `).join('');
}

// ── AI Prediction ────────────────────────────────────────────
async function loadPrediction() {
  if (APPS_SCRIPT_URL.includes('YOUR_SCRIPT_ID')) return;
  try {
    const result = await api('prediction');
    if (result.prediction) {
      renderPrediction(result.prediction, result.cachedAt);
      document.getElementById('predBadge').style.display = 'inline-flex';
    }
  } catch (e) { console.warn('Prediction load failed', e); }
}

const AI_STEPS = [
  'Reading incident register…',
  'Computing department risk scores…',
  'Cross-referencing seasonal patterns…',
  'Generating prevention strategy…'
];

async function triggerPrediction() {
  const btn = document.getElementById('genBtn');
  const loading = document.getElementById('aiLoading');
  const output = document.getElementById('predOutput');
  const empty = document.getElementById('predEmpty');
  const stepsEl = document.getElementById('aiSteps');

  btn.disabled = true;
  btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="animation:spin 0.8s linear infinite"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg> Generating…`;
  loading.style.display = 'flex';
  output.style.display = 'none';
  empty.style.display = 'none';

  stepsEl.innerHTML = '';
  AI_STEPS.forEach((step, i) => {
    setTimeout(() => {
      const el = document.createElement('div');
      el.className = 'ai-step';
      el.style.animationDelay = '0s';
      el.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg> ${step}`;
      stepsEl.appendChild(el);
    }, i * 700);
  });

  const resetBtn = () => {
    btn.disabled = false;
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> Generate Now`;
  };

  if (APPS_SCRIPT_URL.includes('YOUR_SCRIPT_ID')) {
    await new Promise(r => setTimeout(r, 3200));
    renderPrediction(DEMO_PREDICTION, new Date().toISOString());
    loading.style.display = 'none';
    resetBtn();
    return;
  }

  try {
    const result = await api('trigger_prediction');
    if (result.prediction) {
      renderPrediction(result.prediction, result.cachedAt);
    } else {
      empty.style.display = 'block';
      empty.querySelector('div').textContent = result.error || 'Generation failed';
    }
  } catch (e) {
    empty.style.display = 'block';
    empty.querySelector('div').textContent = 'Error: ' + e.message;
  } finally {
    loading.style.display = 'none';
    resetBtn();
  }
}

function renderPrediction(p, cachedAt) {
  const output = document.getElementById('predOutput');
  document.getElementById('predEmpty').style.display = 'none';

  const riskColor = { Low:'#10b981', Medium:'#f59e0b', High:'#ef4444', Critical:'#ef4444' }[p.riskLevel] || '#00d4ff';
  const riskDim = { Low:'var(--green-dim)', Medium:'var(--amber-dim)', High:'var(--red-dim)', Critical:'var(--red-dim)' }[p.riskLevel] || 'var(--cyan-dim)';

  output.innerHTML = `
    <div class="pred-hero">
      <div class="pred-month">Prediction for ${p.generatedFor || '—'}</div>
      <div class="pred-summary">${p.summary || ''}</div>
      ${cachedAt ? `<div class="pred-meta">Generated ${new Date(cachedAt).toLocaleString()}</div>` : ''}
    </div>

    <div class="pred-stats">
      <div class="kpi-card" style="border-top:1px solid ${riskColor}55">
        <div class="kpi-label">Risk Level</div>
        <div class="kpi-value" style="font-size:22px;color:${riskColor}">${p.riskLevel||'—'}</div>
      </div>
      <div class="kpi-card c-cyan">
        <div class="kpi-label">Predicted Incidents</div>
        <div class="kpi-value">${p.predictedIncidents ?? '—'}</div>
        <div class="kpi-sub">This month estimate</div>
      </div>
      <div class="kpi-card c-green">
        <div class="kpi-label">Confidence</div>
        <div class="kpi-value">${p.confidencePercent ?? '—'}%</div>
        <div class="kpi-sub">Model confidence</div>
      </div>
    </div>

    ${p.trendInsight || p.seasonalFactors ? `
    <div class="pred-factors">
      ${p.trendInsight ? `<div><span class="factor-label trend">Trend</span>${p.trendInsight}</div>` : ''}
      ${p.seasonalFactors ? `<div style="margin-top:6px"><span class="factor-label season">Seasonal</span>${p.seasonalFactors}</div>` : ''}
    </div>` : ''}

    ${(p.highRiskDepartments||[]).length ? `
    <div class="section-header"><div class="section-title">High-risk departments</div></div>
    <div class="dept-tags">${p.highRiskDepartments.map(d=>`<span class="dept-tag">${d}</span>`).join('')}</div>
    ` : ''}

    <div class="section-header"><div class="section-title">Top risk factors</div></div>
    <div class="risk-cards">
      ${(p.topRisks||[]).map(r => {
        const likeColor = r.likelihood === 'High' ? 'badge-red' : r.likelihood === 'Medium' ? 'badge-amber' : 'badge-green';
        return `
        <div class="risk-card">
          <div>
            <div class="risk-name">${r.risk}</div>
            <div class="risk-detail">${r.detail}</div>
            <div class="risk-badges">
              <span class="badge ${likeColor}">Likelihood: ${r.likelihood}</span>
              <span class="badge badge-muted">Impact: ${r.impact}</span>
            </div>
          </div>
        </div>`;
      }).join('')}
    </div>

    <div class="section-header" style="margin-top:18px"><div class="section-title">Prevention actions</div></div>
    <div class="action-cards">
      ${(p.preventionActions||[]).map((a,i) => {
        const numStyle = a.priority === 'Urgent' ? 'background:var(--red-dim);color:var(--red)' : a.priority === 'High' ? 'background:var(--amber-dim);color:var(--amber)' : 'background:var(--cyan-dim);color:var(--cyan)';
        const badgeClass = a.priority === 'Urgent' ? 'badge-red' : a.priority === 'High' ? 'badge-amber' : 'badge-muted';
        return `
        <div class="action-card">
          <div class="action-num" style="${numStyle}">${i+1}</div>
          <div>
            <div class="action-title">${a.action} <span class="badge ${badgeClass}" style="margin-left:6px">${a.priority}</span></div>
            <div class="action-desc">${a.description}</div>
          </div>
        </div>`;
      }).join('')}
    </div>
  `;
  output.style.display = 'block';
}

// ── Demo Prediction ──────────────────────────────────────────
const DEMO_PREDICTION = {
  generatedFor: "July 2026",
  riskLevel: "High",
  predictedIncidents: 26,
  confidencePercent: 74,
  summary: "Based on historical patterns from 2015–2026, July typically shows elevated incident rates due to increased production load and monsoon-related hazards. Primary Production and Packing departments account for over 50% of incidents and warrant heightened monitoring this month.",
  topRisks: [
    { risk: "Hand/Finger contact injuries", likelihood: "High", impact: "High", detail: "Abrasion and cut injuries to hands consistently peak in production-heavy months." },
    { risk: "Eye foreign body exposure", likelihood: "High", impact: "Medium", detail: "CED and mechanical sections show recurring chemical and dust-related eye incidents." },
    { risk: "Slip and fall — wet floors", likelihood: "Medium", impact: "Medium", detail: "Canteen and admin areas see seasonal slip incidents during the monsoon period." },
    { risk: "Chemical spill (spring-setting)", likelihood: "Medium", impact: "High", detail: "Spring-setting section historically has 2–3 chemical incidents per quarter." }
  ],
  highRiskDepartments: ["Primary Production", "Packing", "Engineering"],
  preventionActions: [
    { action: "Hand protection audit", priority: "Urgent", description: "Conduct glove compliance check across all production lines before shift start daily." },
    { action: "Eye wash station inspection", priority: "High", description: "Verify all eye-wash stations in CED and Mechanical sections are operational." },
    { action: "Wet floor signage", priority: "High", description: "Deploy additional slip-warning signage in kitchen, canteen, and admin corridors." },
    { action: "Chemical handling refresher", priority: "Medium", description: "Schedule a 30-minute toolbox talk on chemical spill SOP for spring-setting operators." }
  ],
  seasonalFactors: "July marks the monsoon onset in Kerala — wet floors and humidity increase slip and chemical handling risks.",
  trendInsight: "Incident counts show a gradual upward trend of ~5% year-on-year since 2020, suggesting need for systemic intervention."
};

// ── Init ──────────────────────────────────────────────────────
loadAll();

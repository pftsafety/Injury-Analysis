// ============================================================
// SHE INJURY ANALYTICS — dashboard.js
// Replace APPS_SCRIPT_URL with your deployed Apps Script URL
// ============================================================

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxzV_PzGZ05yf54N7x-sTWP0HgXRk8yRhjkrFwwZy9t4TKvWxZSxQjuo79Ad_-BA6QNzQ/exec";

// Chart.js global defaults
Chart.defaults.color = "#8b90a0";
Chart.defaults.font.family = "'Inter', system-ui, sans-serif";
Chart.defaults.font.size = 11;
Chart.defaults.plugins.legend.display = false;

// Color palette
const COLORS = ["#4f8ef7","#31c48d","#f0a429","#e84b4b","#a78bfa","#38bdf8","#fb923c","#f472b6","#84cc16","#22d3ee"];
const GRID_COLOR = "rgba(255,255,255,0.05)";
const BORDER_COLOR = "rgba(255,255,255,0.08)";

let charts = {};
let appData = {};

// ── Navigation ───────────────────────────────────────────────
function showView(id, btn) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  document.getElementById('view-' + id).classList.add('active');
  if (btn) btn.classList.add('active');
  const titles = { overview:'Dashboard', trends:'Trends', departments:'Departments', injuries:'Injury Types', records:'Records', prediction:'AI Prediction' };
  document.getElementById('viewTitle').textContent = titles[id] || id;
}

// ── Fetch helper ─────────────────────────────────────────────
async function api(action) {
  const url = `${APPS_SCRIPT_URL}?action=${action}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ── Load everything ──────────────────────────────────────────
async function loadAll() {
  const loader = document.getElementById('pageLoader');
  loader.classList.remove('hidden');

  // Check config
  if (APPS_SCRIPT_URL.includes('YOUR_SCRIPT_ID')) {
    document.getElementById('configBanner').classList.add('visible');
    loadDemoData();
    loader.classList.add('hidden');
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
    document.getElementById('configBanner').classList.add('visible');
    loadDemoData();
  } finally {
    loader.classList.add('hidden');
  }
}

// ── Demo data (when not connected) ──────────────────────────
function loadDemoData() {
  // Generate realistic demo data based on the sheet structure
  const depts = ['Primary Production','Packing','Engineering','ETD','Administration','Kitchen','Quality'];
  const injTypes = ['Abrasion','Pain','Trauma','Foreign Body','Pain & Swelling','Burn','Laceration'];
  const natures = ['Contact with hard object','Hit with hard object','Contact with sharp object','Fall of hard object','Slip and fall','Chemical spill','Enter of Dust'];
  const bodyParts = ['Right Hand','Left Hand','Right Foot','Left Foot','Right Eye','Left Eye','Both Eyes','Head','Leg','Knee','Finger','Thumb','Elbow','Shoulder'];

  // Monthly data 2015-2026
  const monthly = [];
  for (let y = 2015; y <= 2024; y++) {
    for (let m = 1; m <= 12; m++) {
      const base = 18 + Math.sin(m * 0.5) * 4;
      const trend = (y - 2015) * 0.3;
      monthly.push({ month: `${y}-${String(m).padStart(2,'0')}`, count: Math.round(base + trend + Math.random() * 6) });
    }
  }
  // 2025 partial
  for (let m = 1; m <= 9; m++) monthly.push({ month: `2025-${String(m).padStart(2,'0')}`, count: Math.round(22 + Math.random() * 8) });

  const total = monthly.reduce((s, m) => s + m.count, 0);

  const byYear = {};
  monthly.forEach(m => { const y = m.month.split('-')[0]; byYear[y] = (byYear[y]||0)+m.count; });

  const byDept = {};
  depts.forEach((d,i) => byDept[d] = Math.round(total * [0.28,0.22,0.18,0.12,0.08,0.07,0.05][i]));

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

// ── Render all views ──────────────────────────────────────────
function renderAll() {
  renderKPIs();
  renderTrendChart();
  renderDeptChart();
  renderInjuryChart();
  renderYearChart();
  renderHeatChart();
  renderNatureChart();
  renderBodyChart();
  renderDeptAllChart();
  renderInjType2Chart();
  renderNature2Chart();
  renderBodyAllChart();
  renderRecords();
}

// ── KPIs ─────────────────────────────────────────────────────
function renderKPIs() {
  const { stats, monthly } = appData;
  document.getElementById('kpi-total').textContent = stats.total.toLocaleString();

  const currentYear = new Date().getFullYear().toString();
  const prevYear = (new Date().getFullYear()-1).toString();
  const thisYearVal = stats.byYear?.[currentYear] || stats.byYear?.[prevYear] || '—';
  document.getElementById('kpi-year').textContent = thisYearVal.toLocaleString?.() ?? thisYearVal;
  document.getElementById('kpi-year-label').textContent = `Year ${currentYear}`;

  const avg = monthly.monthly.length ? Math.round(stats.total / monthly.monthly.length) : 0;
  document.getElementById('kpi-avg').textContent = avg;

  const m = stats.byGender?.Male || 0, f = stats.byGender?.Female || 0;
  document.getElementById('kpi-gender').textContent = `${Math.round(m/(m+f)*100)||0}% M`;
  document.getElementById('kpi-gender-sub').textContent = `${m} male, ${f} female`;

  const topDept = Object.entries(stats.byDepartment||{}).sort((a,b)=>b[1]-a[1])[0];
  if (topDept) {
    document.getElementById('kpi-dept-val').textContent = topDept[0].length > 14 ? topDept[0].slice(0,12)+'…' : topDept[0];
    document.getElementById('kpi-dept-sub').textContent = `${topDept[1]} incidents`;
  }
}

// ── Trend Chart (overview) ────────────────────────────────────
function renderTrendChart() {
  const ctx = document.getElementById('trendChart').getContext('2d');
  if (charts.trend) charts.trend.destroy();
  const data = appData.monthly.monthly;
  const labels = data.map(d => d.month.replace(/^(\d{4})-(\d{2})$/, (_, y, m) => {
    const mn = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+m-1];
    return m === '01' ? `${mn} ${y}` : mn;
  }));
  charts.trend = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data: data.map(d => d.count),
        borderColor: '#4f8ef7',
        backgroundColor: 'rgba(79,142,247,0.08)',
        borderWidth: 2,
        tension: 0.4,
        fill: true,
        pointRadius: 0,
        pointHoverRadius: 4,
        pointHoverBackgroundColor: '#4f8ef7'
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1e2130', borderColor: '#2a2d3e', borderWidth: 1, padding: 10 } },
      scales: {
        x: { grid: { color: GRID_COLOR }, border: { color: BORDER_COLOR }, ticks: { maxTicksLimit: 16, maxRotation: 0 } },
        y: { grid: { color: GRID_COLOR }, border: { color: BORDER_COLOR }, beginAtZero: true }
      }
    }
  });
}

// ── Department Chart (overview) ───────────────────────────────
function renderDeptChart() {
  const ctx = document.getElementById('deptChart').getContext('2d');
  if (charts.dept) charts.dept.destroy();
  const sorted = Object.entries(appData.stats.byDepartment||{}).sort((a,b)=>b[1]-a[1]).slice(0,8);
  charts.dept = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: sorted.map(([k]) => k.length>16?k.slice(0,14)+'…':k),
      datasets: [{ data: sorted.map(([,v])=>v), backgroundColor: COLORS.slice(0,8), borderRadius: 4 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: GRID_COLOR }, border: { color: BORDER_COLOR }, ticks: { maxRotation: 30 } },
        y: { grid: { color: GRID_COLOR }, border: { color: BORDER_COLOR }, beginAtZero: true }
      }
    }
  });
}

// ── Injury Doughnut ───────────────────────────────────────────
function renderInjuryChart() {
  const ctx = document.getElementById('injuryChart').getContext('2d');
  if (charts.injury) charts.injury.destroy();
  const sorted = Object.entries(appData.injury.injuryTypes||{}).sort((a,b)=>b[1]-a[1]).slice(0,7);
  charts.injury = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: sorted.map(([k])=>k),
      datasets: [{ data: sorted.map(([,v])=>v), backgroundColor: COLORS.slice(0,7), borderWidth: 0, hoverOffset: 4 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: { display: true, position: 'right', labels: { boxWidth: 10, padding: 10, font: { size: 10 }, color: '#8b90a0' } }
      }
    }
  });
}

// ── Year Chart ────────────────────────────────────────────────
function renderYearChart() {
  const ctx = document.getElementById('yearChart').getContext('2d');
  if (charts.year) charts.year.destroy();
  const sorted = Object.entries(appData.stats.byYear||{}).sort((a,b)=>a[0]-b[0]);
  charts.year = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: sorted.map(([k])=>k),
      datasets: [{ data: sorted.map(([,v])=>v), backgroundColor: '#4f8ef7', borderRadius: 5 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: GRID_COLOR }, border: { color: BORDER_COLOR } },
        y: { grid: { color: GRID_COLOR }, border: { color: BORDER_COLOR }, beginAtZero: true }
      }
    }
  });
}

// ── Heat / Seasonal Chart ─────────────────────────────────────
function renderHeatChart() {
  const ctx = document.getElementById('heatChart').getContext('2d');
  if (charts.heat) charts.heat.destroy();
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const monthTotals = new Array(12).fill(0);
  const monthCounts = new Array(12).fill(0);
  appData.monthly.monthly.forEach(({ month, count }) => {
    const m = parseInt(month.split('-')[1]) - 1;
    monthTotals[m] += count;
    monthCounts[m]++;
  });
  const avgs = monthTotals.map((t, i) => monthCounts[i] ? Math.round(t / monthCounts[i]) : 0);
  const maxAvg = Math.max(...avgs);
  const bgColors = avgs.map(v => {
    const intensity = v / maxAvg;
    const r = Math.round(79 + (232-79)*intensity);
    const g = Math.round(142 + (75-142)*intensity);
    const b = Math.round(247 + (75-247)*intensity);
    return `rgba(${r},${g},${b},0.85)`;
  });
  charts.heat = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: monthNames,
      datasets: [{ data: avgs, backgroundColor: bgColors, borderRadius: 4 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: GRID_COLOR }, border: { color: BORDER_COLOR } },
        y: { grid: { color: GRID_COLOR }, border: { color: BORDER_COLOR }, beginAtZero: true, title: { display: true, text: 'Avg incidents', color: '#8b90a0' } }
      }
    }
  });
}

// ── Nature Chart ──────────────────────────────────────────────
function renderNatureChart() {
  const ctx = document.getElementById('natureChart').getContext('2d');
  if (charts.nature) charts.nature.destroy();
  const sorted = Object.entries(appData.injury.natures||{}).sort((a,b)=>b[1]-a[1]).slice(0,8);
  charts.nature = new Chart(ctx, {
    type: 'bar', indexAxis: 'y',
    data: {
      labels: sorted.map(([k])=>k.length>22?k.slice(0,20)+'…':k),
      datasets: [{ data: sorted.map(([,v])=>v), backgroundColor: '#31c48d', borderRadius: 4 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: GRID_COLOR }, border: { color: BORDER_COLOR }, beginAtZero: true },
        y: { grid: { display: false }, border: { color: BORDER_COLOR } }
      }
    }
  });
}

// ── Body Parts Chart ──────────────────────────────────────────
function renderBodyChart() {
  const ctx = document.getElementById('bodyChart').getContext('2d');
  if (charts.body) charts.body.destroy();
  const sorted = Object.entries(appData.stats.byBodyPart||{}).sort((a,b)=>b[1]-a[1]).slice(0,8);
  charts.body = new Chart(ctx, {
    type: 'bar', indexAxis: 'y',
    data: {
      labels: sorted.map(([k])=>k),
      datasets: [{ data: sorted.map(([,v])=>v), backgroundColor: '#a78bfa', borderRadius: 4 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: GRID_COLOR }, border: { color: BORDER_COLOR }, beginAtZero: true },
        y: { grid: { display: false }, border: { color: BORDER_COLOR } }
      }
    }
  });
}

// ── All Depts Horizontal ──────────────────────────────────────
function renderDeptAllChart() {
  const ctx = document.getElementById('deptAllChart').getContext('2d');
  if (charts.deptAll) charts.deptAll.destroy();
  const sorted = Object.entries(appData.stats.byDepartment||{}).sort((a,b)=>b[1]-a[1]);
  document.getElementById('deptAllChartWrap').style.height = (sorted.length * 36 + 60) + 'px';
  charts.deptAll = new Chart(ctx, {
    type: 'bar', indexAxis: 'y',
    data: {
      labels: sorted.map(([k])=>k),
      datasets: [{ data: sorted.map(([,v])=>v), backgroundColor: '#4f8ef7', borderRadius: 4 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: GRID_COLOR }, border: { color: BORDER_COLOR }, beginAtZero: true },
        y: { grid: { display: false }, border: { color: BORDER_COLOR } }
      }
    }
  });
}

function renderInjType2Chart() {
  const ctx = document.getElementById('injType2Chart').getContext('2d');
  if (charts.injType2) charts.injType2.destroy();
  const sorted = Object.entries(appData.injury.injuryTypes||{}).sort((a,b)=>b[1]-a[1]);
  charts.injType2 = new Chart(ctx, {
    type: 'bar', indexAxis: 'y',
    data: {
      labels: sorted.map(([k])=>k),
      datasets: [{ data: sorted.map(([,v])=>v), backgroundColor: COLORS.slice(0,sorted.length), borderRadius: 4 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: GRID_COLOR }, border: { color: BORDER_COLOR }, beginAtZero: true },
        y: { grid: { display: false }, border: { color: BORDER_COLOR } }
      }
    }
  });
}

function renderNature2Chart() {
  const ctx = document.getElementById('nature2Chart').getContext('2d');
  if (charts.nature2) charts.nature2.destroy();
  const sorted = Object.entries(appData.injury.natures||{}).sort((a,b)=>b[1]-a[1]);
  charts.nature2 = new Chart(ctx, {
    type: 'bar', indexAxis: 'y',
    data: {
      labels: sorted.map(([k])=>k.length>24?k.slice(0,22)+'…':k),
      datasets: [{ data: sorted.map(([,v])=>v), backgroundColor: '#f0a429', borderRadius: 4 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: GRID_COLOR }, border: { color: BORDER_COLOR }, beginAtZero: true },
        y: { grid: { display: false }, border: { color: BORDER_COLOR } }
      }
    }
  });
}

function renderBodyAllChart() {
  const ctx = document.getElementById('bodyAllChart').getContext('2d');
  if (charts.bodyAll) charts.bodyAll.destroy();
  const sorted = Object.entries(appData.stats.byBodyPart||{}).sort((a,b)=>b[1]-a[1]);
  document.getElementById('bodyAllWrap').style.height = (sorted.length * 34 + 60) + 'px';
  charts.bodyAll = new Chart(ctx, {
    type: 'bar', indexAxis: 'y',
    data: {
      labels: sorted.map(([k])=>k),
      datasets: [{ data: sorted.map(([,v])=>v), backgroundColor: '#a78bfa', borderRadius: 4 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: GRID_COLOR }, border: { color: BORDER_COLOR }, beginAtZero: true },
        y: { grid: { display: false }, border: { color: BORDER_COLOR } }
      }
    }
  });
}

// ── Gender by Dept ────────────────────────────────────────────
function renderGenderDeptChart() {
  // Requires raw data — skip if not available
}

// ── Records Table ─────────────────────────────────────────────
function renderRecords() {
  const tbody = document.getElementById('recordsBody');
  const rows = appData.raw?.data || [];
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--muted);padding:40px">No data available (demo mode)</td></tr>';
    return;
  }
  tbody.innerHTML = rows.map(r => `
    <tr>
      <td style="white-space:nowrap">${r['Date'] ? new Date(r['Date']).toLocaleDateString('en-GB') : '—'}</td>
      <td style="max-width:220px;word-break:break-word">${r['Description of Incident']||'—'}</td>
      <td>${r['Nature of Incident']||'—'}</td>
      <td>${r['Type of Injury']||'—'}</td>
      <td>${r['Affected part']||'—'}</td>
      <td>${r['Gender']||'—'}</td>
      <td>${r['Name']||'—'}</td>
      <td>${r['Section']||'—'}</td>
      <td>${r['Dept']||'—'}</td>
    </tr>
  `).join('');
}

// ── Load cached prediction ────────────────────────────────────
async function loadPrediction() {
  if (APPS_SCRIPT_URL.includes('YOUR_SCRIPT_ID')) return;
  try {
    const result = await api('prediction');
    if (result.prediction) renderPrediction(result.prediction, result.cachedAt);
  } catch (e) { console.warn('Prediction load failed', e); }
}

// ── Trigger new prediction ────────────────────────────────────
async function triggerPrediction() {
  const btn = document.getElementById('genBtn');
  const loading = document.getElementById('predLoading');
  const content = document.getElementById('predContent');
  const empty = document.getElementById('predEmpty');

  btn.disabled = true;
  btn.textContent = 'Generating…';
  loading.style.display = 'flex';
  content.classList.remove('visible');
  empty.style.display = 'none';

  if (APPS_SCRIPT_URL.includes('YOUR_SCRIPT_ID')) {
    // Demo prediction
    await new Promise(r => setTimeout(r, 2000));
    renderPrediction(DEMO_PREDICTION, new Date().toISOString());
    loading.style.display = 'none';
    btn.disabled = false;
    btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> Generate Now';
    return;
  }

  try {
    const result = await api('trigger_prediction');
    if (result.prediction) {
      renderPrediction(result.prediction, result.cachedAt);
    } else {
      empty.textContent = result.error || 'Generation failed.';
      empty.style.display = 'block';
    }
  } catch (e) {
    empty.style.display = 'block';
    empty.textContent = 'Error: ' + e.message;
  } finally {
    loading.style.display = 'none';
    btn.disabled = false;
    btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> Generate Now';
  }
}

// ── Render prediction HTML ────────────────────────────────────
function renderPrediction(p, cachedAt) {
  const content = document.getElementById('predContent');
  const empty = document.getElementById('predEmpty');
  empty.style.display = 'none';

  const riskColors = { Low:'#31c48d', Medium:'#f0a429', High:'#e84b4b', Critical:'#e84b4b' };
  const riskBgs = { Low:'rgba(49,196,141,0.12)', Medium:'rgba(240,164,41,0.12)', High:'rgba(232,75,75,0.12)', Critical:'rgba(232,75,75,0.15)' };

  content.innerHTML = `
    <div class="pred-summary-card">
      <div class="month">Prediction for ${p.generatedFor || '—'}</div>
      <div class="summary-text">${p.summary || ''}</div>
      ${cachedAt ? `<div style="font-size:11px;color:rgba(79,142,247,0.6);margin-top:10px">Generated ${new Date(cachedAt).toLocaleString()}</div>` : ''}
    </div>

    <div class="pred-stats-row">
      <div class="kpi-card" style="border-top:2px solid ${riskColors[p.riskLevel]||'#4f8ef7'}">
        <div class="kpi-label">Risk Level</div>
        <div class="kpi-value" style="font-size:20px;color:${riskColors[p.riskLevel]||'#4f8ef7'}">${p.riskLevel||'—'}</div>
      </div>
      <div class="kpi-card blue">
        <div class="kpi-label">Predicted Incidents</div>
        <div class="kpi-value">${p.predictedIncidents||'—'}</div>
        <div class="kpi-sub">This month estimate</div>
      </div>
      <div class="kpi-card green">
        <div class="kpi-label">Confidence</div>
        <div class="kpi-value">${p.confidencePercent||'—'}%</div>
        <div class="kpi-sub">Model confidence</div>
      </div>
    </div>

    ${p.trendInsight ? `
    <div style="background:var(--card);border:1px solid var(--border);border-radius:8px;padding:14px;margin-bottom:18px;font-size:13px;color:var(--muted)">
      <span style="color:var(--accent);font-weight:600">Trend: </span>${p.trendInsight}
      ${p.seasonalFactors ? `<br><span style="color:var(--warning);font-weight:600">Seasonal: </span>${p.seasonalFactors}` : ''}
    </div>` : ''}

    ${(p.highRiskDepartments||[]).length ? `
    <div style="margin-bottom:18px">
      <div class="pred-title" style="font-size:13px;margin-bottom:10px">High-risk departments</div>
      <div class="high-risk-depts">${p.highRiskDepartments.map(d=>`<span class="dept-tag">${d}</span>`).join('')}</div>
    </div>` : ''}

    <div class="pred-risks">
      <h3>Top risk factors</h3>
      ${(p.topRisks||[]).map(r => `
        <div class="risk-item">
          <div class="risk-dot ${r.likelihood}"></div>
          <div>
            <div style="font-size:13px;font-weight:600;margin-bottom:2px">${r.risk}</div>
            <div style="font-size:11px;color:var(--muted);margin-bottom:4px">${r.detail}</div>
            <div style="display:flex;gap:8px">
              <span class="badge ${r.likelihood==='High'?'danger':r.likelihood==='Medium'?'warning':'live'}">Likelihood: ${r.likelihood}</span>
              <span class="badge neutral">Impact: ${r.impact}</span>
            </div>
          </div>
        </div>
      `).join('')}
    </div>

    <div class="pred-actions">
      <h3>Prevention actions</h3>
      ${(p.preventionActions||[]).map((a,i) => `
        <div class="action-item">
          <div class="action-num ${a.priority}">${i+1}</div>
          <div>
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:3px">
              <span style="font-size:13px;font-weight:600">${a.action}</span>
              <span class="badge ${a.priority==='Urgent'?'danger':a.priority==='High'?'warning':'neutral'}">${a.priority}</span>
            </div>
            <div style="font-size:12px;color:var(--muted)">${a.description}</div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
  content.classList.add('visible');
}

// ── Demo Prediction ───────────────────────────────────────────
const DEMO_PREDICTION = {
  generatedFor: "July 2026",
  riskLevel: "High",
  predictedIncidents: 26,
  confidencePercent: 74,
  summary: "Based on historical patterns from 2015–2026, July typically shows elevated incident rates due to increased production load and heat-related fatigue. Primary Production and Packing departments account for over 50% of incidents and warrant heightened monitoring this month.",
  topRisks: [
    { risk: "Hand/Finger contact injuries", likelihood: "High", impact: "High", detail: "Abrasion and cut injuries to hands consistently peak in production-heavy months." },
    { risk: "Eye foreign body exposure", likelihood: "High", impact: "Medium", detail: "CED and mechanical sections show recurring chemical and dust-related eye incidents." },
    { risk: "Slip and fall — canteen/wet floor", likelihood: "Medium", impact: "Medium", detail: "Administration areas including canteen see seasonal slip incidents in monsoon period." },
    { risk: "Chemical spill (spring-setting area)", likelihood: "Medium", impact: "High", detail: "Spring-setting section historically has 2–3 chemical incidents per quarter." }
  ],
  highRiskDepartments: ["Primary Production", "Packing", "Engineering"],
  preventionActions: [
    { action: "Hand protection audit", priority: "Urgent", description: "Conduct glove compliance check across all production lines before shift start daily." },
    { action: "Eye wash station inspection", priority: "High", description: "Verify all eye-wash stations in CED and Mechanical sections are operational and accessible." },
    { action: "Wet floor signage — canteen", priority: "High", description: "Deploy additional slip-warning signage in kitchen, canteen, and admin corridors during monsoon." },
    { action: "Chemical handling refresher", priority: "Medium", description: "Schedule a 30-minute toolbox talk on chemical spill SOP for spring-setting operators." }
  ],
  seasonalFactors: "July marks the monsoon onset in Kerala — wet floors, reduced visibility, and fatigue from humidity increase slip and chemical handling risks.",
  trendInsight: "Incident counts have shown a gradual upward trend of ~5% year-on-year since 2020, suggesting need for systemic intervention rather than reactive measures alone."
};

// ── Init ──────────────────────────────────────────────────────
loadAll();

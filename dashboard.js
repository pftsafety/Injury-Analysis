// ============================================================
// SHE INCIDENT REGISTER — Apps Script Backend
// Deploy as: Web App | Execute as: Me | Access: Anyone
// ============================================================

const SHEET_NAME = "Register"; // Your incident register tab
const GEMINI_API_KEY = PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY");

// ── Main Router ──────────────────────────────────────────────
function doGet(e) {
  const action = e.parameter.action || "stats";
  let result;

  try {
    switch (action) {
      case "stats":              result = getStats(); break;
      case "monthly":            result = getMonthlyBreakdown(); break;
      case "department":         result = getDepartmentStats(); break;
      case "injury":             result = getInjuryTypeStats(); break;
      case "prediction":         result = getLatestPrediction(); break;
      case "raw":                result = getRawData(e.parameter.limit || 100); break;
      case "trigger_prediction": result = generateMonthlyPrediction(); break;
      case "send_email":         result = sendReportEmail(e.parameter.to, e.parameter.cc || ""); break;
      case "save_email":         result = saveManagerEmail(e.parameter.to, e.parameter.cc || ""); break;
      case "get_email":          result = getManagerEmail(); break;
      case "debug":              result = getDebugInfo(); break;
      default:                   result = { error: "Unknown action" };
    }
  } catch (err) {
    result = { error: err.message };
  }

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── Read Sheet Data ──────────────────────────────────────────
function getSheetData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error("Sheet '" + SHEET_NAME + "' not found. Update SHEET_NAME in Code.gs.");
  const data = sheet.getDataRange().getValues();
  const headers = data[1]; // Row 2 is the header row (row 1 is the title)
  const rows = [];

  for (let i = 2; i < data.length; i++) {
    const row = data[i];
    if (!row[1]) continue; // skip blank rows (Date column B)
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = row[idx]; });
    rows.push(obj);
  }
  return rows;
}

// ── Debug: shows every tab name + row counts so you can verify SHEET_NAME ──
function getDebugInfo() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();

  const tabSummary = sheets.map(function(s) {
    const lastRow = s.getLastRow();
    let headerRow2 = [];
    try { headerRow2 = s.getRange(2, 1, 1, Math.min(s.getLastColumn(), 15)).getValues()[0]; } catch(e) {}
    return {
      name: s.getName(),
      totalRows: lastRow,
      likelyDataRows: Math.max(0, lastRow - 2), // minus title row + header row
      headerRowPreview: headerRow2
    };
  });

  let currentSheetCheck = { exists: false };
  const current = ss.getSheetByName(SHEET_NAME);
  if (current) {
    currentSheetCheck = {
      exists: true,
      totalRows: current.getLastRow(),
      likelyDataRows: Math.max(0, current.getLastRow() - 2)
    };
  }

  return {
    currentSHEET_NAME: SHEET_NAME,
    currentSheetStatus: currentSheetCheck,
    allTabsInThisSpreadsheet: tabSummary,
    instructions: "Find the tab above with the highest likelyDataRows and a headerRowPreview matching your incident register columns (Date, Description of Incident, etc). Set SHEET_NAME in Code.gs to that exact 'name' value."
  };
}

// ── Stats Summary ────────────────────────────────────────────
function getStats() {
  const rows = getSheetData();
  const total = rows.length;

  const genderMap = {};
  rows.forEach(r => {
    const g = (r["Gender"] || "Unknown").toString().trim();
    genderMap[g] = (genderMap[g] || 0) + 1;
  });

  const yearMap = {};
  rows.forEach(r => {
    if (!r["Date"]) return;
    const yr = new Date(r["Date"]).getFullYear();
    if (!isNaN(yr)) yearMap[yr] = (yearMap[yr] || 0) + 1;
  });

  const deptMap = {};
  rows.forEach(r => {
    const d = (r["Dept"] || "Unknown").toString().trim();
    deptMap[d] = (deptMap[d] || 0) + 1;
  });

  const sectionMap = {};
  rows.forEach(r => {
    const s = (r["Section"] || "Unknown").toString().trim();
    sectionMap[s] = (sectionMap[s] || 0) + 1;
  });

  const partMap = {};
  rows.forEach(r => {
    const p = (r["Affected part"] || "Unknown").toString().trim();
    partMap[p] = (partMap[p] || 0) + 1;
  });

  return {
    total,
    byGender: genderMap,
    byYear: yearMap,
    byDepartment: deptMap,
    bySection: sectionMap,
    byBodyPart: partMap,
    lastUpdated: new Date().toISOString()
  };
}

// ── Monthly Breakdown ────────────────────────────────────────
function getMonthlyBreakdown() {
  const rows = getSheetData();
  const monthMap = {};

  rows.forEach(r => {
    if (!r["Date"]) return;
    const d = new Date(r["Date"]);
    if (isNaN(d)) return;
    const key = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
    monthMap[key] = (monthMap[key] || 0) + 1;
  });

  const sorted = Object.entries(monthMap)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, count]) => ({ month, count }));

  return { monthly: sorted };
}

// ── Department Stats ─────────────────────────────────────────
function getDepartmentStats() {
  const rows = getSheetData();
  const map = {};

  rows.forEach(r => {
    const dept    = (r["Dept"]                || "Unknown").toString().trim();
    const section = (r["Section"]             || "Unknown").toString().trim();
    const nature  = (r["Nature of Incident"]  || "Unknown").toString().trim();

    if (!map[dept]) map[dept] = { total: 0, sections: {}, natures: {} };
    map[dept].total++;
    map[dept].sections[section] = (map[dept].sections[section] || 0) + 1;
    map[dept].natures[nature]   = (map[dept].natures[nature]   || 0) + 1;
  });

  return { departments: map };
}

// ── Injury Type Stats ────────────────────────────────────────
function getInjuryTypeStats() {
  const rows = getSheetData();
  const typeMap   = {};
  const natureMap = {};

  rows.forEach(r => {
    const t = (r["Type of Injury"]       || "Unknown").toString().trim();
    const n = (r["Nature of Incident"]   || "Unknown").toString().trim();
    typeMap[t]   = (typeMap[t]   || 0) + 1;
    natureMap[n] = (natureMap[n] || 0) + 1;
  });

  return { injuryTypes: typeMap, natures: natureMap };
}

// ── Raw Data ─────────────────────────────────────────────────
function getRawData(limit) {
  const rows = getSheetData();
  return {
    data: rows.slice(0, parseInt(limit)),
    total: rows.length
  };
}

// ── Latest Prediction from Cache ─────────────────────────────
function getLatestPrediction() {
  // Try fast cache first (6-hour)
  const cached = CacheService.getScriptCache().get("monthly_prediction");
  if (cached) return JSON.parse(cached);

  // Fall back to persistent storage (survives cache expiry)
  const stored = PropertiesService.getScriptProperties().getProperty("latest_prediction");
  if (stored) return JSON.parse(stored);

  return { prediction: null, message: "No prediction yet. Click Generate Now in the dashboard." };
}

// ── Gemini fetch with retry ───────────────────────────────────
function fetchGeminiWithRetry(url, options, retries) {
  retries = retries || 3;
  for (var i = 0; i < retries; i++) {
    var response = UrlFetchApp.fetch(url, options);
    var json = JSON.parse(response.getContentText());

    if (json.error) {
      var msg = json.error.message || "";
      // Quota / rate-limit error — wait and retry
      if (msg.toLowerCase().indexOf("quota") !== -1 || msg.indexOf("429") !== -1) {
        if (i < retries - 1) {
          Utilities.sleep(12000); // wait 12 seconds
          continue;
        }
      }
      // Any other error — return immediately
      return json;
    }
    return json;
  }
}

// ── AI Monthly Prediction (Gemini 2.0 Flash Lite) ────────────
// ── Previous month actuals (for the retrospective review) ─────
function getPreviousMonthSummary() {
  const rows = getSheetData();
  const now = new Date();
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevYear = prevMonthDate.getFullYear();
  const prevMonth = prevMonthDate.getMonth(); // 0-indexed
  const label = prevMonthDate.toLocaleString("default", { month: "long", year: "numeric" });

  const monthRows = rows.filter(function(r) {
    if (!r["Date"]) return false;
    const d = new Date(r["Date"]);
    if (isNaN(d)) return false;
    return d.getFullYear() === prevYear && d.getMonth() === prevMonth;
  });

  // Same calendar month, one year earlier — for year-over-year comparison
  const yearAgoRows = rows.filter(function(r) {
    if (!r["Date"]) return false;
    const d = new Date(r["Date"]);
    if (isNaN(d)) return false;
    return d.getFullYear() === (prevYear - 1) && d.getMonth() === prevMonth;
  });

  // Same calendar month across ALL prior years (excluding the month just reviewed) — seasonal benchmark
  const historicalSameMonthRows = rows.filter(function(r) {
    if (!r["Date"]) return false;
    const d = new Date(r["Date"]);
    if (isNaN(d)) return false;
    return d.getMonth() === prevMonth && d.getFullYear() < prevYear;
  });
  const historicalYearsCount = [...new Set(historicalSameMonthRows.map(function(r){ return new Date(r["Date"]).getFullYear(); }))].length;
  const historicalAvgForMonth = historicalYearsCount ? Math.round(historicalSameMonthRows.length / historicalYearsCount) : null;

  function tally(field, sourceRows) {
    const map = {};
    (sourceRows || monthRows).forEach(function(r) {
      const v = (r[field] || "Unknown").toString().trim();
      map[v] = (map[v] || 0) + 1;
    });
    return Object.entries(map).sort(function(a,b){ return b[1]-a[1]; });
  }

  return {
    label: label,
    count: monthRows.length,
    byDept: tally("Dept"),
    bySection: tally("Section"),
    byInjuryType: tally("Type of Injury"),
    byNature: tally("Nature of Incident"),
    byBodyPart: tally("Affected part"),
    byGender: tally("Gender"),
    yearAgoCount: yearAgoRows.length,
    historicalAvgForThisMonth: historicalAvgForMonth,
    historicalYearsSampled: historicalYearsCount,
    sampleDescriptions: monthRows.slice(0, 12).map(function(r) { return r["Description of Incident"] || ""; }).filter(Boolean)
  };
}

function generateMonthlyPrediction() {
  if (!GEMINI_API_KEY) {
    return { error: "GEMINI_API_KEY not set. Go to Apps Script → Project Settings → Script Properties and add GEMINI_API_KEY." };
  }

  const stats      = getStats();
  const monthly    = getMonthlyBreakdown();
  const injStats   = getInjuryTypeStats();
  const prevMonth  = getPreviousMonthSummary();
  const now        = new Date();
  const currentMonth = now.toLocaleString("default", { month: "long", year: "numeric" });
  const recent24   = monthly.monthly.slice(-24);

  // Year-over-year totals (for a multi-year trend line the AI can reason about)
  const yearTotals = Object.entries(stats.byYear).sort(function(a,b){ return a[0]-b[0]; });

  const prompt =
    "You are a senior workplace safety analyst for an industrial facility in Kerala, India. " +
    "Produce a DEEP, DATA-GROUNDED analysis with TWO parts: (1) a retrospective review of " + prevMonth.label + " based on what ACTUALLY happened, and (2) a forward-looking predictive forecast for " + currentMonth + ". " +
    "Go beyond surface-level department/injury-type counts — analyze demographic patterns (gender), body-part/ergonomic patterns, section-level (not just department-level) hotspots, severity trends, and year-over-year / seasonal benchmarking. Every claim must be traceable to the numbers provided below.\n\n" +

    "=== DATASET SUMMARY (all-time) ===\n" +
    "Total incidents recorded: " + stats.total + "\n" +
    "Time span: " + (monthly.monthly[0] ? monthly.monthly[0].month : "?") +
    " to " + (monthly.monthly[monthly.monthly.length - 1] ? monthly.monthly[monthly.monthly.length - 1].month : "?") + "\n\n" +

    "YEARLY TOTALS (all years on record)\n" +
    yearTotals.map(function(e){ return e[0] + ": " + e[1] + " incidents"; }).join("\n") + "\n\n" +

    "MONTHLY TREND — last 24 months\n" +
    recent24.map(function(m){ return m.month + ": " + m.count + " incidents"; }).join("\n") + "\n\n" +

    "GENDER DISTRIBUTION (all-time)\n" +
    Object.entries(stats.byGender).sort(function(a,b){ return b[1]-a[1]; })
      .map(function(e){ return e[0] + ": " + e[1]; }).join("\n") + "\n\n" +

    "TOP DEPARTMENTS BY INCIDENTS (all time)\n" +
    Object.entries(stats.byDepartment).sort(function(a,b){ return b[1]-a[1]; }).slice(0,8)
      .map(function(e){ return e[0] + ": " + e[1]; }).join("\n") + "\n\n" +

    "TOP SECTIONS BY INCIDENTS (all time — more granular than department)\n" +
    Object.entries(stats.bySection).sort(function(a,b){ return b[1]-a[1]; }).slice(0,10)
      .map(function(e){ return e[0] + ": " + e[1]; }).join("\n") + "\n\n" +

    "INJURY TYPES (all time)\n" +
    Object.entries(injStats.injuryTypes).sort(function(a,b){ return b[1]-a[1]; }).slice(0,10)
      .map(function(e){ return e[0] + ": " + e[1]; }).join("\n") + "\n\n" +

    "NATURE OF INCIDENTS (all time)\n" +
    Object.entries(injStats.natures).sort(function(a,b){ return b[1]-a[1]; }).slice(0,10)
      .map(function(e){ return e[0] + ": " + e[1]; }).join("\n") + "\n\n" +

    "MOST AFFECTED BODY PARTS (all time)\n" +
    Object.entries(stats.byBodyPart).sort(function(a,b){ return b[1]-a[1]; }).slice(0,10)
      .map(function(e){ return e[0] + ": " + e[1]; }).join("\n") + "\n\n" +

    "=== ACTUAL DATA FOR " + prevMonth.label.toUpperCase() + " (ground truth for the retrospective review) ===\n" +
    "Total incidents that month: " + prevMonth.count + "\n" +
    "Same calendar month, one year earlier: " + prevMonth.yearAgoCount + " incidents\n" +
    (prevMonth.historicalAvgForThisMonth !== null
      ? "Historical average for this calendar month (across " + prevMonth.historicalYearsSampled + " prior years): " + prevMonth.historicalAvgForThisMonth + " incidents\n\n"
      : "\n") +

    "By department:\n" +
    prevMonth.byDept.map(function(e){ return e[0] + ": " + e[1]; }).join("\n") + "\n\n" +
    "By section (granular):\n" +
    prevMonth.bySection.map(function(e){ return e[0] + ": " + e[1]; }).join("\n") + "\n\n" +
    "By gender:\n" +
    prevMonth.byGender.map(function(e){ return e[0] + ": " + e[1]; }).join("\n") + "\n\n" +
    "By injury type:\n" +
    prevMonth.byInjuryType.map(function(e){ return e[0] + ": " + e[1]; }).join("\n") + "\n\n" +
    "By nature of incident:\n" +
    prevMonth.byNature.map(function(e){ return e[0] + ": " + e[1]; }).join("\n") + "\n\n" +
    "By body part:\n" +
    prevMonth.byBodyPart.map(function(e){ return e[0] + ": " + e[1]; }).join("\n") + "\n\n" +
    "Sample incident descriptions from that month:\n" +
    (prevMonth.sampleDescriptions.length ? prevMonth.sampleDescriptions.map(function(d){ return "- " + d; }).join("\n") : "(no descriptions available)") + "\n\n" +

    "Respond ONLY with valid JSON — no markdown, no backticks, no explanation. Use this exact structure:\n" +
    "{\n" +
    '  "generatedAt": "' + now.toISOString() + '",\n' +
    '  "previousMonth": {\n' +
    '    "label": "' + prevMonth.label + '",\n' +
    '    "actualIncidents": ' + prevMonth.count + ',\n' +
    '    "summary": "<3-4 sentence narrative of what actually happened, referencing real numbers>",\n' +
    '    "topIncidentTypes": [ { "type": "<name>", "count": <number> } ],\n' +
    '    "mostAffectedDepartments": [ { "dept": "<name>", "count": <number> } ],\n' +
    '    "sectionHotspots": [ { "section": "<name>", "count": <number>, "note": "<why this section stands out, one short phrase>" } ],\n' +
    '    "genderAnalysis": { "maleCount": <number>, "femaleCount": <number>, "insight": "<1-2 sentence analysis of any gender-linked pattern in roles, injury type, or department — or state if no meaningful pattern exists>" },\n' +
    '    "bodyPartInsight": "<1-2 sentence analysis of which body parts were most affected and the likely ergonomic or procedural cause>",\n' +
    '    "severityAssessment": { "level": "Low or Moderate or Elevated or Severe", "rationale": "<1-2 sentences citing the injury-type mix that justifies this level>" },\n' +
    '    "yearOverYearComparison": { "sameMonthLastYear": ' + prevMonth.yearAgoCount + ', "changePercent": <number, calculate from actualIncidents vs sameMonthLastYear>, "insight": "<1 sentence interpreting the year-over-year change>" },\n' +
    '    "vsHistoricalAverage": "<1 sentence comparing actualIncidents to the historical average for this calendar month provided above, e.g. 12% above the 5-year average>",\n' +
    '    "rootCauseThemes": [ { "theme": "<short name>", "detail": "<one sentence explaining the pattern observed>" } ],\n' +
    '    "lessonsLearned": [ { "lesson": "<short title>", "detail": "<one sentence recommendation based on what happened>" } ]\n' +
    '  },\n' +
    '  "currentMonth": {\n' +
    '    "generatedFor": "' + currentMonth + '",\n' +
    '    "riskLevel": "Low or Medium or High or Critical",\n' +
    '    "predictedIncidents": <number>,\n' +
    '    "confidencePercent": <number 0-100>,\n' +
    '    "summary": "<2-3 sentence executive summary of the forecast, informed by last month and the multi-year trend>",\n' +
    '    "benchmarkComparison": "<1 sentence: how the predictedIncidents compares to the historical average for THIS forecast month, if the yearly/monthly data above lets you estimate it>",\n' +
    '    "departmentRiskRanking": [ { "dept": "<name>", "riskScore": "Low or Medium or High", "rationale": "<one short phrase citing why, e.g. sustained upward trend or highest section concentration>" } ],\n' +
    '    "topRisks": [\n' +
    '      { "risk": "<name>", "likelihood": "Low or Medium or High", "impact": "Low or Medium or High", "detail": "<one sentence>" }\n' +
    '    ],\n' +
    '    "highRiskDepartments": ["<dept1>", "<dept2>"],\n' +
    '    "preventionActions": [\n' +
    '      { "action": "<title>", "priority": "Urgent or High or Medium", "description": "<one sentence>" }\n' +
    '    ],\n' +
    '    "seasonalFactors": "<one sentence about Kerala seasonal or calendar factors>",\n' +
    '    "trendInsight": "<one sentence about the multi-month/multi-year trend direction, citing the yearly totals or 24-month trend above>"\n' +
    '  }\n' +
    "}";

  var url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=" + GEMINI_API_KEY;

  var payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 3500
    }
  };

  var options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  var json = fetchGeminiWithRetry(url, options, 3);

  if (!json) return { error: "No response from Gemini API." };
  if (json.error) return { error: json.error.message || JSON.stringify(json.error) };

  var text = "";
  try {
    text = json.candidates[0].content.parts[0].text;
  } catch(e) {
    return { error: "Unexpected Gemini response structure.", raw: JSON.stringify(json) };
  }

  var prediction;
  try {
    var clean = text.replace(/```json/g, "").replace(/```/g, "").trim();
    prediction = JSON.parse(clean);
  } catch(e) {
    var match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try { prediction = JSON.parse(match[0]); }
      catch(e2) { return { error: "JSON parse failed.", raw: text }; }
    } else {
      return { error: "Could not extract JSON from response.", raw: text };
    }
  }

  var result = { prediction: prediction, cachedAt: new Date().toISOString() };

  // Store in both cache (6 hrs) and persistent properties (permanent)
  CacheService.getScriptCache().put("monthly_prediction", JSON.stringify(result), 21600);
  PropertiesService.getScriptProperties().setProperty("latest_prediction", JSON.stringify(result));

  return result;
}

// ── Monthly Auto-trigger Setup ────────────────────────────────
// Run this function ONCE manually from the Apps Script editor
// to schedule automatic prediction on the 1st of each month at 8am
function setupMonthlyTrigger() {
  // Remove any existing triggers to avoid duplicates
  ScriptApp.getProjectTriggers().forEach(function(t) {
    ScriptApp.deleteTrigger(t);
  });

  ScriptApp.newTrigger("generateMonthlyPrediction")
    .timeBased()
    .onMonthDay(1)
    .atHour(8)
    .create();

  return { success: true, message: "Trigger set: generateMonthlyPrediction runs on 1st of each month at 8am." };
}

// ── Save / Get Manager Email ──────────────────────────────────
function saveManagerEmail(to, cc) {
  if (!to) return { error: "No recipient email provided." };
  PropertiesService.getScriptProperties().setProperty("MANAGER_EMAIL_TO", to);
  PropertiesService.getScriptProperties().setProperty("MANAGER_EMAIL_CC", cc || "");
  return { success: true, to: to, cc: cc || "" };
}

function getManagerEmail() {
  const props = PropertiesService.getScriptProperties();
  return {
    to: props.getProperty("MANAGER_EMAIL_TO") || "",
    cc: props.getProperty("MANAGER_EMAIL_CC") || ""
  };
}

// ── Send Report Email ─────────────────────────────────────────
function sendReportEmail(to, cc) {
  if (!to) return { error: "No recipient email address provided." };

  // Load latest prediction
  const stored = PropertiesService.getScriptProperties().getProperty("latest_prediction");
  if (!stored) return { error: "No prediction report found. Please generate a prediction first." };

  var result;
  try { result = JSON.parse(stored); } catch(e) { return { error: "Failed to parse stored prediction." }; }

  var p = result.prediction;
  if (!p) return { error: "Prediction data is empty." };

  var prev = p.previousMonth || null;
  var curr = p.currentMonth || p;
  var generatedAt = result.cachedAt ? new Date(result.cachedAt).toLocaleString() : new Date().toLocaleString();
  var now = new Date();
  var subjectMonth = curr.generatedFor || now.toLocaleString("default", { month: "long", year: "numeric" });

  // ── Build chart images (Apps Script native Charts service — no external API) ──
  var inlineImages = {};
  var chartImgTrend = "", chartImgDept = "", chartImgInjury = "", chartImgNature = "";

  try {
    var monthlyData = getMonthlyBreakdown();
    var recent12 = monthlyData.monthly.slice(-12);
    if (recent12.length > 1) {
      var monthShort = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      var trendTable = Charts.newDataTable()
        .addColumn(Charts.ColumnType.STRING, 'Month')
        .addColumn(Charts.ColumnType.NUMBER, 'Incidents');
      recent12.forEach(function(m) {
        var parts = m.month.split('-');
        trendTable.addRow([monthShort[parseInt(parts[1], 10) - 1] + " '" + parts[0].slice(2), m.count]);
      });
      var trendChart = Charts.newLineChart()
        .setDataTable(trendTable.build())
        .setTitle('Incident Trend — Last 12 Months')
        .setDimensions(580, 260)
        .setColors(['#2563eb'])
        .setBackgroundFill('#ffffff')
        .setPointStyle(Charts.PointStyle.MEDIUM)
        .setLegendPosition(Charts.Position.NONE)
        .build();
      inlineImages.trendChartImg = trendChart.getBlob().setName('trend.png');
      chartImgTrend = '<img src="cid:trendChartImg" width="580" style="width:100%;max-width:580px;display:block;margin:0 auto;border-radius:10px;border:1px solid #e2e8f0;" alt="Incident trend chart" />';
    }
  } catch(e) { /* chart generation is best-effort; email still sends without it */ }

  if (prev) {
    try {
      var prevActual = getPreviousMonthSummary();

      if (prevActual.byDept && prevActual.byDept.length) {
        var deptTable = Charts.newDataTable()
          .addColumn(Charts.ColumnType.STRING, 'Department')
          .addColumn(Charts.ColumnType.NUMBER, 'Incidents');
        prevActual.byDept.slice(0, 8).forEach(function(e) { deptTable.addRow([e[0], e[1]]); });
        var deptChart = Charts.newColumnChart()
          .setDataTable(deptTable.build())
          .setTitle('Incidents by Department — ' + prevActual.label)
          .setDimensions(580, 260)
          .setColors(['#2563eb'])
          .setBackgroundFill('#ffffff')
          .setLegendPosition(Charts.Position.NONE)
          .build();
        inlineImages.deptChartImg = deptChart.getBlob().setName('dept.png');
        chartImgDept = '<img src="cid:deptChartImg" width="580" style="width:100%;max-width:580px;display:block;margin:0 auto;border-radius:10px;border:1px solid #e2e8f0;" alt="Department breakdown chart" />';
      }

      if (prevActual.byInjuryType && prevActual.byInjuryType.length) {
        var injTable = Charts.newDataTable()
          .addColumn(Charts.ColumnType.STRING, 'Injury Type')
          .addColumn(Charts.ColumnType.NUMBER, 'Count');
        prevActual.byInjuryType.slice(0, 8).forEach(function(e) { injTable.addRow([e[0], e[1]]); });
        var injChart = Charts.newPieChart()
          .setDataTable(injTable.build())
          .setTitle('Injury Types — ' + prevActual.label)
          .setDimensions(580, 280)
          .setColors(['#2563eb','#7c3aed','#059669','#d97706','#dc2626','#0ea5e9','#db2777','#65a30d'])
          .setBackgroundFill('#ffffff')
          .build();
        inlineImages.injChartImg = injChart.getBlob().setName('injury.png');
        chartImgInjury = '<img src="cid:injChartImg" width="580" style="width:100%;max-width:580px;display:block;margin:0 auto;border-radius:10px;border:1px solid #e2e8f0;" alt="Injury type breakdown chart" />';
      }

      if (prevActual.byNature && prevActual.byNature.length) {
        var natTable = Charts.newDataTable()
          .addColumn(Charts.ColumnType.STRING, 'Nature')
          .addColumn(Charts.ColumnType.NUMBER, 'Count');
        prevActual.byNature.slice(0, 8).forEach(function(e) { natTable.addRow([e[0], e[1]]); });
        var natChart = Charts.newBarChart()
          .setDataTable(natTable.build())
          .setTitle('Nature of Incident — ' + prevActual.label)
          .setDimensions(580, 280)
          .setColors(['#059669'])
          .setBackgroundFill('#ffffff')
          .setLegendPosition(Charts.Position.NONE)
          .build();
        inlineImages.natChartImg = natChart.getBlob().setName('nature.png');
        chartImgNature = '<img src="cid:natChartImg" width="580" style="width:100%;max-width:580px;display:block;margin:0 auto;border-radius:10px;border:1px solid #e2e8f0;" alt="Nature of incident chart" />';
      }
    } catch(e) { /* chart generation is best-effort; email still sends without it */ }
  }

  // ── Build HTML email ─────────────────────────────────────────
  var riskBg = { Low:"#d1fae5", Medium:"#fef3c7", High:"#fee2e2", Critical:"#fee2e2" }[curr.riskLevel] || "#dbeafe";
  var riskFg = { Low:"#065f46", Medium:"#92400e", High:"#991b1b", Critical:"#7f1d1d" }[curr.riskLevel] || "#1e40af";

  function tableRow(label, value) {
    return '<tr><td style="padding:7px 12px;font-size:13px;color:#475569;border-bottom:1px solid #f1f5f9;">' + label + '</td>' +
           '<td style="padding:7px 12px;font-size:13px;font-weight:600;color:#0f172a;border-bottom:1px solid #f1f5f9;text-align:right;">' + value + '</td></tr>';
  }

  function sectionTitle(text) {
    return '<div style="font-family:sans-serif;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;margin:24px 0 10px;">' + text + '</div>';
  }

  function actionRow(num, action, priority, desc) {
    var bg = priority === "Urgent" ? "#fee2e2" : priority === "High" ? "#fef3c7" : "#f0f9ff";
    var fg = priority === "Urgent" ? "#991b1b" : priority === "High" ? "#92400e" : "#1e40af";
    return '<div style="display:flex;gap:12px;align-items:flex-start;padding:10px 0;border-bottom:1px solid #f1f5f9;">' +
      '<div style="width:22px;height:22px;border-radius:6px;background:' + bg + ';color:' + fg + ';font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-family:monospace;line-height:22px;text-align:center;">' + num + '</div>' +
      '<div><div style="font-size:13px;font-weight:600;color:#0f172a;">' + action +
      ' <span style="display:inline-block;font-size:10px;font-weight:700;padding:1px 7px;border-radius:20px;background:' + bg + ';color:' + fg + ';">' + priority + '</span></div>' +
      '<div style="font-size:12px;color:#64748b;margin-top:3px;line-height:1.5;">' + desc + '</div></div></div>';
  }

  function riskRow(risk, likelihood, impact, detail) {
    var dotColor = likelihood === "High" ? "#dc2626" : likelihood === "Medium" ? "#d97706" : "#059669";
    return '<div style="padding:10px 0;border-bottom:1px solid #f1f5f9;">' +
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:3px;">' +
      '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + dotColor + ';flex-shrink:0;"></span>' +
      '<span style="font-size:13px;font-weight:600;color:#0f172a;">' + risk + '</span></div>' +
      '<div style="font-size:12px;color:#64748b;margin-left:16px;line-height:1.5;">' + detail + '</div>' +
      '<div style="margin-left:16px;margin-top:5px;">' +
      '<span style="font-size:10px;font-weight:600;padding:1px 7px;border-radius:20px;background:' + (likelihood==="High"?"#fee2e2":likelihood==="Medium"?"#fef3c7":"#d1fae5") + ';color:' + dotColor + ';margin-right:5px;">Likelihood: ' + likelihood + '</span>' +
      '<span style="font-size:10px;font-weight:600;padding:1px 7px;border-radius:20px;background:#f1f5f9;color:#64748b;">Impact: ' + impact + '</span></div></div>';
  }

  function hotspotRow(name, count, note) {
    return '<tr><td style="padding:7px 12px;font-size:13px;color:#475569;border-bottom:1px solid #f1f5f9;">' + name +
           (note ? '<br><span style="font-size:10px;color:#94a3b8;">' + note + '</span>' : '') + '</td>' +
           '<td style="padding:7px 12px;font-size:13px;font-weight:600;color:#0f172a;border-bottom:1px solid #f1f5f9;text-align:right;vertical-align:top;">' + count + '</td></tr>';
  }

  function statBox(label, value, accentColor) {
    return '<td style="width:50%;padding:12px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;vertical-align:top;">' +
      '<div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:' + (accentColor||'#64748b') + ';margin-bottom:4px;">' + label + '</div>' +
      '<div style="font-size:12px;color:#0f172a;line-height:1.6;">' + (value || '—') + '</div></td>';
  }

  // Previous month review section
  var prevSection = "";
  if (prev) {
    var prevDeptRows = (prev.mostAffectedDepartments || []).map(function(d){ return tableRow(d.dept, d.count + " incidents"); }).join("");
    var prevTypeRows = (prev.topIncidentTypes || []).map(function(t){ return tableRow(t.type, t.count); }).join("");
    var sectionRows = (prev.sectionHotspots || []).map(function(s){ return hotspotRow(s.section, s.count, s.note); }).join("");

    var severityColors = {
      Low: { bg: "#d1fae5", fg: "#065f46" },
      Moderate: { bg: "#fef3c7", fg: "#92400e" },
      Elevated: { bg: "#fed7aa", fg: "#9a3412" },
      Severe: { bg: "#fee2e2", fg: "#991b1b" }
    };
    var sevLevel = (prev.severityAssessment && prev.severityAssessment.level) || "";
    var sevColor = severityColors[sevLevel] || { bg: "#f1f5f9", fg: "#64748b" };

    var rootCauses = (prev.rootCauseThemes || []).map(function(r){
      return '<div style="background:#f8fafc;border-left:3px solid #2563eb;border-radius:4px;padding:10px 14px;margin-bottom:8px;">' +
             '<div style="font-size:12px;font-weight:700;color:#0f172a;margin-bottom:3px;">' + r.theme + '</div>' +
             '<div style="font-size:12px;color:#64748b;line-height:1.5;">' + r.detail + '</div></div>';
    }).join("");
    var lessons = (prev.lessonsLearned || []).map(function(l, i){
      return '<div style="display:flex;gap:10px;padding:9px 0;border-bottom:1px solid #f1f5f9;">' +
             '<div style="width:20px;height:20px;border-radius:5px;background:#d1fae5;color:#065f46;font-size:10px;font-weight:700;text-align:center;line-height:20px;flex-shrink:0;font-family:monospace;">' + (i+1) + '</div>' +
             '<div><div style="font-size:12px;font-weight:700;color:#0f172a;">' + l.lesson + '</div>' +
             '<div style="font-size:11px;color:#64748b;margin-top:2px;line-height:1.5;">' + l.detail + '</div></div></div>';
    }).join("");

    prevSection =
      '<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:20px;margin-bottom:16px;">' +
        '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#059669;margin-bottom:6px;">Monthly Review</div>' +
        '<div style="font-family:sans-serif;font-size:28px;font-weight:700;color:#0f172a;line-height:1;">' + (prev.actualIncidents || 0) + '</div>' +
        '<div style="font-size:12px;color:#64748b;margin-bottom:10px;">Total incidents in ' + prev.label + '</div>' +
        (sevLevel ? '<span style="display:inline-block;padding:3px 11px;border-radius:20px;font-size:10px;font-weight:700;background:' + sevColor.bg + ';color:' + sevColor.fg + ';margin-bottom:12px;">Severity: ' + sevLevel + '</span>' : '') +
        '<div style="font-size:13px;color:#0f172a;line-height:1.75;">' + (prev.summary || '') + '</div>' +
      '</div>' +

      '<table style="width:100%;border-collapse:collapse;margin-bottom:16px;"><tr>' +
        statBox('Year-over-Year', (prev.yearOverYearComparison && prev.yearOverYearComparison.insight), '#2563eb') +
        '<td style="width:12px;"></td>' +
        statBox('vs Historical Average', prev.vsHistoricalAverage, '#7c3aed') +
      '</tr></table>' +

      '<table style="width:100%;border-collapse:collapse;margin-bottom:16px;">' +
        '<tr><td style="width:50%;padding-right:8px;vertical-align:top;">' +
          '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;margin-bottom:8px;">By Department</div>' +
          '<table style="width:100%;border-collapse:collapse;">' + prevDeptRows + '</table>' +
        '</td><td style="padding-left:8px;vertical-align:top;">' +
          '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;margin-bottom:8px;">By Injury Type</div>' +
          '<table style="width:100%;border-collapse:collapse;">' + prevTypeRows + '</table>' +
        '</td></tr>' +
      '</table>' +

      (sectionRows ? sectionTitle("Section-Level Hotspots") +
        '<table style="width:100%;border-collapse:collapse;margin-bottom:16px;">' + sectionRows + '</table>' : '') +

      (chartImgDept ? '<div style="margin-bottom:20px;">' + chartImgDept + '</div>' : '') +
      (chartImgInjury ? '<div style="margin-bottom:20px;">' + chartImgInjury + '</div>' : '') +
      (chartImgNature ? '<div style="margin-bottom:20px;">' + chartImgNature + '</div>' : '') +

      '<table style="width:100%;border-collapse:collapse;margin-bottom:16px;"><tr>' +
        statBox('Gender Pattern', prev.genderAnalysis && prev.genderAnalysis.insight, '#db2777') +
        '<td style="width:12px;"></td>' +
        statBox('Body Part Insight', prev.bodyPartInsight, '#059669') +
      '</tr></table>' +

      sectionTitle("Root Cause Themes") + rootCauses +
      sectionTitle("Lessons Learned") + lessons;
  }

  // Forecast section
  var deptTags = (curr.highRiskDepartments || []).map(function(d){
    return '<span style="display:inline-block;padding:4px 12px;border-radius:6px;background:#fee2e2;color:#991b1b;font-size:12px;font-weight:600;margin-right:6px;margin-bottom:6px;">' + d + '</span>';
  }).join("");

  var deptRiskRows = (curr.departmentRiskRanking || []).map(function(d){
    var rc = d.riskScore === "High" ? "#dc2626" : d.riskScore === "Medium" ? "#d97706" : "#059669";
    var rbg = d.riskScore === "High" ? "#fee2e2" : d.riskScore === "Medium" ? "#fef3c7" : "#d1fae5";
    return '<div style="display:flex;align-items:center;justify-content:space-between;padding:9px 12px;background:#f8fafc;border-radius:7px;border:1px solid #e2e8f0;margin-bottom:6px;">' +
      '<div><div style="font-size:12px;font-weight:700;color:#0f172a;">' + d.dept + '</div>' +
      '<div style="font-size:10px;color:#64748b;margin-top:1px;">' + d.rationale + '</div></div>' +
      '<span style="font-size:10px;font-weight:700;padding:2px 9px;border-radius:20px;background:' + rbg + ';color:' + rc + ';white-space:nowrap;margin-left:10px;">' + d.riskScore + '</span></div>';
  }).join("");

  var riskRows = (curr.topRisks || []).map(function(r){ return riskRow(r.risk, r.likelihood, r.impact, r.detail); }).join("");
  var actionRows = (curr.preventionActions || []).map(function(a, i){ return actionRow(i+1, a.action, a.priority, a.description); }).join("");

  var forecastSection =
    '<div style="background:' + riskBg + ';border:1px solid ' + riskFg + '33;border-radius:12px;padding:20px;margin-bottom:20px;">' +
      '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:' + riskFg + ';margin-bottom:6px;">Forecast — ' + subjectMonth + '</div>' +
      '<div style="font-size:13px;color:#0f172a;line-height:1.75;">' + (curr.summary || '') + '</div>' +
    '</div>' +
    '<table style="width:100%;border-collapse:collapse;margin-bottom:20px;">' +
      '<tr>' +
        '<td style="text-align:center;padding:14px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;">' +
          '<div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#64748b;margin-bottom:4px;">Risk Level</div>' +
          '<div style="font-size:22px;font-weight:700;color:' + riskFg + ';">' + (curr.riskLevel || '—') + '</div>' +
        '</td>' +
        '<td style="width:14px;"></td>' +
        '<td style="text-align:center;padding:14px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;">' +
          '<div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#64748b;margin-bottom:4px;">Predicted Incidents</div>' +
          '<div style="font-size:22px;font-weight:700;color:#1e40af;">' + (curr.predictedIncidents || '—') + '</div>' +
        '</td>' +
        '<td style="width:14px;"></td>' +
        '<td style="text-align:center;padding:14px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;">' +
          '<div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#64748b;margin-bottom:4px;">Confidence</div>' +
          '<div style="font-size:22px;font-weight:700;color:#065f46;">' + (curr.confidencePercent || '—') + '%</div>' +
        '</td>' +
      '</tr>' +
    '</table>' +
    (curr.trendInsight || curr.seasonalFactors || curr.benchmarkComparison ?
      '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 14px;margin-bottom:16px;font-size:12px;line-height:1.7;">' +
        (curr.trendInsight ? '<div><strong style="color:#2563eb;">Trend: </strong>' + curr.trendInsight + '</div>' : '') +
        (curr.benchmarkComparison ? '<div style="margin-top:4px;"><strong style="color:#7c3aed;">Benchmark: </strong>' + curr.benchmarkComparison + '</div>' : '') +
        (curr.seasonalFactors ? '<div style="margin-top:4px;"><strong style="color:#d97706;">Seasonal: </strong>' + curr.seasonalFactors + '</div>' : '') +
      '</div>' : '') +
    (deptTags ? sectionTitle("High-risk Departments") + '<div style="margin-bottom:16px;">' + deptTags + '</div>' : '') +
    (deptRiskRows ? sectionTitle("Department Risk Ranking") + deptRiskRows : '') +
    sectionTitle("Top Risk Factors") + riskRows +
    sectionTitle("Prevention Actions") + actionRows;

  // Full email HTML
  var html =
    '<!DOCTYPE html><html><head><meta charset="UTF-8"></head>' +
    '<body style="margin:0;padding:0;background:#f4f6fa;font-family:-apple-system,BlinkMacSystemFont,Inter,sans-serif;">' +
    '<div style="max-width:640px;margin:0 auto;padding:24px 16px;">' +

    // Header
    '<div style="background:linear-gradient(135deg,#2563eb,#7c3aed);border-radius:12px;padding:24px;margin-bottom:20px;color:#fff;">' +
      '<div style="font-size:22px;font-weight:700;margin-bottom:4px;">Monthly Work Injury Analysis Report</div>' +
      '<div style="font-size:13px;opacity:0.85;">' + subjectMonth + '</div>' +
      '<div style="font-size:11px;opacity:0.65;margin-top:8px;">Generated ' + generatedAt + ' · AI-powered analysis by Gemini</div>' +
    '</div>' +

    (chartImgTrend ?
      '<div style="background:#ffffff;border-radius:12px;padding:20px;border:1px solid #e2e8f0;margin-bottom:20px;">' +
        '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;margin-bottom:14px;">12-Month Trend Overview</div>' +
        chartImgTrend +
      '</div>' : '') +

    // Body card
    '<div style="background:#ffffff;border-radius:12px;padding:24px;border:1px solid #e2e8f0;">' +
      (prev ? '<div style="font-size:15px;font-weight:700;color:#0f172a;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid #f1f5f9;">Part 1 — ' + prev.label + ' Review</div>' + prevSection +
              '<div style="font-size:15px;font-weight:700;color:#0f172a;margin:24px 0 16px;padding-top:20px;border-top:2px solid #f1f5f9;">Part 2 — ' + subjectMonth + ' Forecast</div>' : '') +
      forecastSection +
    '</div>' +

    // Footer
    '<div style="text-align:center;padding:20px 0;font-size:11px;color:#94a3b8;">' +
      'This report was generated by SHE Injury Analytics · <a href="#" style="color:#2563eb;">View Dashboard</a>' +
    '</div>' +

    '</div></body></html>';

  // Plain text fallback
  var plain =
    "MONTHLY WORK INJURY ANALYSIS REPORT\n" +
    subjectMonth + " | Generated " + generatedAt + "\n\n" +
    (prev ? "=== " + prev.label.toUpperCase() + " REVIEW ===\nTotal incidents: " + prev.actualIncidents + "\n" + prev.summary + "\n\n" : "") +
    "=== " + subjectMonth.toUpperCase() + " FORECAST ===\n" +
    "Risk Level: " + (curr.riskLevel || "—") + "\n" +
    "Predicted Incidents: " + (curr.predictedIncidents || "—") + "\n" +
    "Confidence: " + (curr.confidencePercent || "—") + "%\n\n" +
    (curr.summary || "") + "\n\n" +
    "PREVENTION ACTIONS:\n" +
    (curr.preventionActions || []).map(function(a, i){ return (i+1) + ". [" + a.priority + "] " + a.action + " — " + a.description; }).join("\n");

  // Send email
  var mailOptions = {
    htmlBody: html,
    name: "SHE Injury Analytics",
    inlineImages: inlineImages
  };
  if (cc && cc.trim()) mailOptions.cc = cc.trim();

  MailApp.sendEmail(to.trim(), "Work Injury Analysis Report - " + subjectMonth, plain, mailOptions);

  return { success: true, message: "Report sent to " + to.trim() + (cc ? " (CC: " + cc + ")" : "") };
}

// ── One-time auth test: run this manually from the editor ────
// This forces the real "send email" AND "charts" permission prompts
// because it unconditionally reaches those lines (unlike
// sendReportEmail, which returns early if no "to" address is passed in).
function testMailAuth() {
  var myEmail = Session.getActiveUser().getEmail();
  if (!myEmail) {
    throw new Error("Could not detect your email via Session.getActiveUser(). Replace this line with MailApp.sendEmail('your-actual-email@gmail.com', ...) and run again.");
  }

  // Build a tiny sample chart to also verify Charts service authorization
  var table = Charts.newDataTable()
    .addColumn(Charts.ColumnType.STRING, 'Month')
    .addColumn(Charts.ColumnType.NUMBER, 'Sample');
  table.addRow(['Jan', 5]); table.addRow(['Feb', 8]); table.addRow(['Mar', 6]);
  var chart = Charts.newColumnChart()
    .setDataTable(table.build())
    .setTitle('Sample Chart')
    .setDimensions(400, 200)
    .setColors(['#2563eb'])
    .build();
  var blob = chart.getBlob().setName('sample.png');

  MailApp.sendEmail(myEmail, "SHE Dashboard — Mail & Chart Permission Test",
    "If you received this with a chart image below, mail sending AND chart generation are both authorized. You can redeploy and use Email Report from the dashboard.",
    {
      inlineImages: { sampleChart: blob },
      htmlBody: "<p>If you can see the bar chart below, everything is authorized correctly:</p><img src='cid:sampleChart' />"
    }
  );
  return { success: true, sentTo: myEmail };
}

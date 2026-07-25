/**
 * server.js — AstroKundli Express Backend
 * --------------------------------------------------------
 * Replaces the PHP backend entirely. Handles:
 *   - Static file serving (index.html, style.css, script.js)
 *   - Kundli report generation via Gemini AI
 * --------------------------------------------------------
 */

const express = require('express');
const path = require('path');
const config = require('./config');
const { generateFullKundli } = require('./astro-engine');

const app = express();

// --- Middleware ---
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ===================== KUNDLI REPORT =====================

app.post('/kundli-report.php', async (req, res) => {
  const name   = (req.body.full_name || '').trim();
  const gender = (req.body.gender || '').trim();
  const dob    = (req.body.dob || '').trim();
  const tob    = (req.body.tob || '').trim();
  const pob    = (req.body.pob || '').trim();

  // Validate
  const errors = [];
  if (!name) errors.push('Full name is required.');
  if (!['Male','Female','Other'].includes(gender)) errors.push('Gender is required.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) errors.push('Valid date of birth is required.');
  if (!/^\d{2}:\d{2}$/.test(tob)) errors.push('Valid time of birth is required.');
  if (!pob) errors.push('Place of birth is required.');

  if (errors.length > 0) {
    return res.status(422).json({ success: false, errors });
  }

  try {
    console.log(`\n🔮 Generating Kundli for ${name} (${dob} ${tob}, ${pob})...`);
    const kundli = await generateFullKundli(name, gender, dob, tob, pob);
    console.log('✅ Kundli generated successfully!\n');


    // Render the full report HTML (same structure as the old kundli-report.php)
    const html = renderReportHTML(kundli);
    res.send(html);
  } catch (err) {
    console.error('❌ Kundli generation failed:', err.message);
    res.status(500).send(renderErrorHTML(err.message));
  }
});

// ===================== REPORT HTML TEMPLATE =====================

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function renderReportHTML(k) {
  // Build planet rows
  const planetRows = k.planets.map(p => {
    const states = [];
    if (p.exalted) states.push('<span class="badge" style="background:rgba(46, 204, 113, 0.15); color:#2ecc71; border:1px solid rgba(46, 204, 113, 0.3); padding:2px 6px; border-radius:4px; font-size:10px; font-weight:bold; margin-right:4px;">Exalted (Uchcha)</span>');
    if (p.debilitated) states.push('<span class="badge" style="background:rgba(231, 76, 60, 0.15); color:#e74c3c; border:1px solid rgba(231, 76, 60, 0.3); padding:2px 6px; border-radius:4px; font-size:10px; font-weight:bold; margin-right:4px;">Neech</span>');
    if (p.retro) states.push('<span class="badge" style="background:rgba(243, 156, 18, 0.15); color:#f39c12; border:1px solid rgba(243, 156, 18, 0.3); padding:2px 6px; border-radius:4px; font-size:10px; font-weight:bold; margin-right:4px;">Vakri (R)</span>');
    if (p.combust) states.push('<span class="badge" style="background:rgba(230, 126, 34, 0.15); color:#e67e22; border:1px solid rgba(230, 126, 34, 0.3); padding:2px 6px; border-radius:4px; font-size:10px; font-weight:bold; margin-right:4px;">Ast (Combust)</span>');
    if (p.vargottama) states.push('<span class="badge" style="background:rgba(155, 89, 182, 0.15); color:#9b59b6; border:1px solid rgba(155, 89, 182, 0.3); padding:2px 6px; border-radius:4px; font-size:10px; font-weight:bold; margin-right:4px;">Vargottama</span>');
    
    const SIGN_LORDS = {
      'Aries':'Mars','Taurus':'Venus','Gemini':'Mercury','Cancer':'Moon',
      'Leo':'Sun','Virgo':'Mercury','Libra':'Venus','Scorpio':'Mars',
      'Sagittarius':'Jupiter','Capricorn':'Saturn','Aquarius':'Saturn','Pisces':'Jupiter'
    };
    if (SIGN_LORDS[p.sign] === p.planet && !p.exalted) {
      states.push('<span class="badge" style="background:rgba(52, 152, 219, 0.15); color:#3498db; border:1px solid rgba(52, 152, 219, 0.3); padding:2px 6px; border-radius:4px; font-size:10px; font-weight:bold; margin-right:4px;">Swakshetra</span>');
    }
    
    if (states.length === 0) states.push('<span style="color:var(--text-muted); font-size:11px;">Normal</span>');

    return `
        <tr>
          <td>${p.symbol} ${escHtml(p.planet)}</td>
          <td>${escHtml(p.sign)}</td>
          <td>${escHtml(p.degree)}</td>
          <td>${p.house}</td>
          <td><div style="display:flex; flex-wrap:wrap; gap:4px;">${states.join('')}</div></td>
        </tr>`;
  }).join('');

  // 1. Generate Ashtakavarga rows
  const signsAbbr = ['Ari', 'Tau', 'Gem', 'Can', 'Leo', 'Vir', 'Lib', 'Sco', 'Sag', 'Cap', 'Aqu', 'Pis'];
  const signsSymbols = ['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓'];
  const planetsList = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'];

  let ashtakRows = '';
  planetsList.forEach(p => {
    const scores = (k.ashtakavarga && k.ashtakavarga.bhinnashtakavarga && k.ashtakavarga.bhinnashtakavarga[p]) || Array(12).fill(0);
    const cols = scores.map(s => `<td class="${s >= 4 ? 'high-score' : ''}">${s}</td>`).join('');
    ashtakRows += `<tr><td><b>${p}</b></td>${cols}</tr>`;
  });

  const savScores = (k.ashtakavarga && k.ashtakavarga.sarvashtakavarga) || Array(12).fill(0);
  const savCols = savScores.map(s => `<td class="${s >= 28 ? 'high-score-sav' : ''}">${s}</td>`).join('');
  const savRow = `<tr class="sav-row"><td><b>SAV (Total)</b></td>${savCols}</tr>`;

  // 2. Generate Dasha accordions HTML
  let dashaHtml = '';
  const now = new Date();
  if (k.dasha && Array.isArray(k.dasha)) {
    k.dasha.forEach((md, mdIdx) => {
      const mdStart = new Date(md.start).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
      const mdEnd = new Date(md.end).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
      const isActive = now >= new Date(md.start) && now <= new Date(md.end);

      let antardashasHtml = '';
      (md.sub_periods || []).forEach((ad, adIdx) => {
        const adStart = new Date(ad.start).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
        const adEnd = new Date(ad.end).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
        const isAdActive = now >= new Date(ad.start) && now <= new Date(ad.end);

        let pratyantardashasHtml = '';
        (ad.sub_periods || []).forEach(pad => {
          const padStart = new Date(pad.start).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
          const padEnd = new Date(pad.end).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
          const isPadActive = now >= new Date(pad.start) && now <= new Date(pad.end);

          pratyantardashasHtml += `
            <div class="dasha-pad-card ${isPadActive ? 'active-dasha-pad' : ''}" data-lord="${escHtml(pad.lord)}" data-start="${pad.start}" data-end="${pad.end}" style="border-bottom:1px solid rgba(255,255,255,0.03); overflow:hidden;">
              <div class="dasha-pad-header" style="display:flex; justify-content:space-between; align-items:center; padding:8px 16px; font-size:11.5px; cursor:pointer; background:rgba(255,255,255,0.01);">
                <div>
                  <span style="font-weight:600; color:${isPadActive ? 'var(--gold-light)' : 'var(--text-main)'};">${escHtml(pad.lord)}</span>
                  <span style="font-size:9.5px; color:var(--text-muted); margin-left:4px;">(Pratyantar)</span>
                  ${isPadActive ? '<span class="active-badge-sub" style="background:var(--success); color:#1B0F3D; font-size:8px; font-weight:800; padding:1px 4px; border-radius:3px; margin-left:6px;">Active</span>' : ''}
                </div>
                <div style="display:flex; align-items:center; gap:8px;">
                  <span style="font-size:10.5px; color:var(--text-muted);">${padStart} - ${padEnd}</span>
                  <span class="dasha-pad-arrow" style="font-size:8px; color:var(--text-muted); transition: transform 0.2s;">▼</span>
                </div>
              </div>
              <div class="dasha-pad-body" style="display: none; padding-left: 12px; background: rgba(0,0,0,0.12);">
                <!-- Sukshma dashas will be injected here dynamically -->
              </div>
            </div>
          `;
        });

        antardashasHtml += `
          <div class="dasha-ad-card ${isAdActive ? 'active-dasha-ad' : ''}">
            <div class="dasha-ad-header">
              <div style="display:flex; align-items:center; gap:6px;">
                <span class="ad-title-lord">${escHtml(ad.lord)} Antardasha</span>
                ${isAdActive ? '<span class="active-badge-sub">Active</span>' : ''}
              </div>
              <div style="display:flex; align-items:center; gap:8px;">
                <span class="ad-dates">${adStart} - ${adEnd}</span>
                <span class="dasha-ad-arrow">▼</span>
              </div>
            </div>
            <div class="dasha-ad-body" style="display: ${isAdActive ? 'block' : 'none'};">
              ${pratyantardashasHtml}
            </div>
          </div>
        `;
      });

      dashaHtml += `
        <div class="dasha-md-card ${isActive ? 'active-dasha-md' : ''}">
          <div class="dasha-md-header">
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="md-title">${escHtml(md.lord)} Mahadasha</span>
              ${isActive ? '<span class="active-badge">Active</span>' : ''}
            </div>
            <div style="display:flex; align-items:center; gap:10px;">
              <span class="md-dates">${mdStart} - ${mdEnd}</span>
              <span id="dasha-arrow-${mdIdx}" class="dasha-arrow">▼</span>
            </div>
          </div>
          <div id="dasha-body-${mdIdx}" class="dasha-md-body" style="display: ${isActive ? 'block' : 'none'};">
            ${antardashasHtml}
          </div>
        </div>
      `;
    });
  } else {
    dashaHtml = '<p style="text-align:center;color:var(--text-muted);padding:24px;">Dasha calculations are currently unavailable.</p>';
  }

  // Generate Active Dasha Influence Card
  let activeMdLord = '';
  let activeAdLord = '';
  const nowTime = new Date();
  if (k.dasha && Array.isArray(k.dasha)) {
    const activeMd = k.dasha.find(md => nowTime >= new Date(md.start) && nowTime <= new Date(md.end));
    if (activeMd) {
      activeMdLord = activeMd.lord;
      const activeAd = (activeMd.sub_periods || []).find(ad => nowTime >= new Date(ad.start) && nowTime <= new Date(ad.end));
      if (activeAd) {
        activeAdLord = activeAd.lord;
      }
    }
  }

  const mdDesc = (k.dashaInterpretations && k.dashaInterpretations[activeMdLord]) || 'Influences this major period of your life.';
  const adDesc = (k.dashaInterpretations && k.dashaInterpretations[activeAdLord]) || 'Shapes the sub-period events and opportunities.';

  const activeDashaCardHtml = activeMdLord ? `
    <div class="active-dasha-guidance" style="background:rgba(212,175,55,0.06); border:1px solid rgba(212,175,55,0.2); border-radius:var(--radius-md); padding:16px; margin-bottom:16px;">
      <h4 style="color:var(--gold-light); font-size:13.5px; font-weight:600; margin-bottom:10px; display:flex; align-items:center; gap:6px;">🔮 Current Active Dasha Influence</h4>
      <div style="font-size:12px; line-height:1.55; display:flex; flex-direction:column; gap:8px;">
        <div>
          <b style="color:var(--text-main);">${activeMdLord} Mahadasha (Major Theme):</b>
          <span style="color:var(--text-muted);">${escHtml(mdDesc)}</span>
        </div>
        ${activeAdLord ? `
        <div>
          <b style="color:var(--text-main);">${activeAdLord} Antardasha (Sub-Theme):</b>
          <span style="color:var(--text-muted);">${escHtml(adDesc)}</span>
        </div>` : ''}
      </div>
    </div>
  ` : '';

  // Generate Rajyoga cards HTML
  let rajyogHtml = '';
  if (k.yogas && Array.isArray(k.yogas)) {
    rajyogHtml = k.yogas.map(y => `
      <div class="yoga-card" style="background:rgba(255,255,255,0.03); border:1px solid var(--card-border); border-radius:var(--radius-md); padding:14px 16px; border-left:4px solid var(--gold); margin-bottom:10px;">
        <h4 style="font-size:13.5px; color:var(--gold-light); margin-bottom:6px; font-weight:700; display:flex; align-items:center; gap:6px;">🌟 ${escHtml(y.name)}</h4>
        <p style="font-size:12px; color:var(--text-muted); line-height:1.55;">${escHtml(y.description)}</p>
      </div>
    `).join('');
  }
  if (!rajyogHtml) {
    rajyogHtml = '<p style="text-align:center;color:var(--text-muted);padding:24px;">No major Rajyogas detected in the birth chart.</p>';
  }

  // Generate Planets Details Placement cards HTML
  let planetsInfoHtml = '';
  if (k.planetaryDetails && Array.isArray(k.planetaryDetails)) {
    planetsInfoHtml = k.planetaryDetails.map(pd => `
      <div class="planet-info-card" style="background:rgba(255,255,255,0.03); border:1px solid var(--card-border); border-radius:var(--radius-md); padding:14px 16px; margin-bottom:10px;">
        <h4 style="font-size:13.5px; color:var(--gold-light); margin-bottom:6px; font-weight:700; display:flex; align-items:center; gap:6px;">
          <span>${pd.symbol}</span> <span>${escHtml(pd.planet)} Placement</span>
        </h4>
        <p style="font-size:12px; color:var(--text-muted); line-height:1.55;">${escHtml(pd.explanation)}</p>
      </div>
    `).join('');
  } else {
    planetsInfoHtml = '<p style="text-align:center;color:var(--text-muted);padding:24px;">Planetary placement details are currently unavailable.</p>';
  }

  // Generate Doshas cards HTML
  let doshasListHtml = '';
  if (k.doshas && Array.isArray(k.doshas)) {
    doshasListHtml = k.doshas.map(d => {
      let badgeColor = 'rgba(231, 76, 60, 0.15)';
      let textColor = '#e74c3c';
      let border = '1px solid rgba(231, 76, 60, 0.3)';
      if (d.type === 'Mild' || d.type === 'Insignificant') {
        badgeColor = 'rgba(46, 204, 113, 0.15)';
        textColor = '#2ecc71';
        border = '1px solid rgba(46, 204, 113, 0.3)';
      } else if (d.type === 'Moderate') {
        badgeColor = 'rgba(243, 156, 18, 0.15)';
        textColor = '#f39c12';
        border = '1px solid rgba(243, 156, 18, 0.3)';
      }
      return `
        <div class="dosha-card" style="background:rgba(255,255,255,0.03); border:1px solid var(--card-border); border-radius:var(--radius-md); padding:14px 16px; margin-bottom:10px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <h4 style="font-size:13.5px; color:var(--gold-light); font-weight:700; margin:0;">⚠️ ${escHtml(d.name)}</h4>
            <span style="background:${badgeColor}; color:${textColor}; border:${border}; padding:2px 8px; border-radius:4px; font-size:10px; font-weight:bold;">${escHtml(d.type)}</span>
          </div>
          <p style="font-size:12px; color:var(--text-muted); line-height:1.55; margin:0;">${escHtml(d.description)}</p>
        </div>
      `;
    }).join('');
  } else {
    doshasListHtml = '<p style="text-align:center;color:var(--text-muted);padding:24px;">Doshas calculations are currently unavailable.</p>';
  }

  // Classify functional benefics/malefics
  const FUNCTIONAL_PLANETS = {
    'Aries':       { benefics: ['Sun', 'Moon', 'Mars', 'Jupiter'], malefics: ['Mercury', 'Venus', 'Saturn'] },
    'Taurus':      { benefics: ['Saturn', 'Venus', 'Mercury', 'Sun'], malefics: ['Jupiter', 'Moon', 'Mars'] },
    'Gemini':      { benefics: ['Venus', 'Mercury'], malefics: ['Mars', 'Sun', 'Jupiter', 'Saturn', 'Moon'] },
    'Cancer':      { benefics: ['Mars', 'Jupiter', 'Moon'], malefics: ['Mercury', 'Venus', 'Saturn', 'Sun'] },
    'Leo':         { benefics: ['Mars', 'Sun', 'Jupiter'], malefics: ['Mercury', 'Venus', 'Saturn', 'Moon'] },
    'Virgo':       { benefics: ['Venus', 'Mercury'], malefics: ['Mars', 'Jupiter', 'Moon', 'Sun'] },
    'Libra':       { benefics: ['Saturn', 'Venus', 'Mercury'], malefics: ['Jupiter', 'Sun', 'Mars', 'Moon'] },
    'Scorpio':     { benefics: ['Jupiter', 'Moon', 'Sun', 'Mars'], malefics: ['Mercury', 'Venus', 'Saturn'] },
    'Sagittarius': { benefics: ['Sun', 'Mars', 'Jupiter'], malefics: ['Mercury', 'Venus', 'Saturn', 'Moon'] },
    'Capricorn':   { benefics: ['Venus', 'Mercury', 'Saturn'], malefics: ['Mars', 'Jupiter', 'Moon', 'Sun'] },
    'Aquarius':    { benefics: ['Venus', 'Sun', 'Mars', 'Saturn'], malefics: ['Jupiter', 'Moon', 'Mercury'] },
    'Pisces':      { benefics: ['Moon', 'Mars', 'Jupiter'], malefics: ['Sun', 'Mercury', 'Venus', 'Saturn'] }
  };

  const ascSign = k.meta.ascendant.sign;
  const fp = FUNCTIONAL_PLANETS[ascSign] || { benefics: [], malefics: [] };
  
  const beneficList = fp.benefics.map(p => `<span style="display:inline-block; background:rgba(63,203,140,0.15); padding:2px 8px; border-radius:4px; margin:2px;">${p}</span>`).join('');
  const maleficList = fp.malefics.map(p => `<span style="display:inline-block; background:rgba(225,85,107,0.15); padding:2px 8px; border-radius:4px; margin:2px;">${p}</span>`).join('');

  // Build 12-Month Monthly Predictions HTML
  let monthlyPredsHtml = '';
  if (k.monthlyPredictions && Array.isArray(k.monthlyPredictions)) {
    const monthTabsBtnHtml = k.monthlyPredictions.map((m, idx) => `
      <button class="month-tab-btn ${idx === 0 ? 'active' : ''}" onclick="switchMonthTab(${idx})">
        ${escHtml(m.shortMonth)} ${m.year}
      </button>
    `).join('');

    const monthCardsHtml = k.monthlyPredictions.map((m, idx) => `
      <div class="month-pred-card ${idx === 0 ? 'active' : ''}" id="month-card-${idx}">
        <div class="month-card-header">
          <div class="month-title-wrap">
            <span class="month-badge">Month ${m.monthNumber} of 12</span>
            <h3 class="month-name-heading">${escHtml(m.monthName)}</h3>
            <div class="month-theme-subtitle">🌟 ${escHtml(m.themeTitle)}</div>
          </div>
          <div class="month-score-pill">
            <div class="score-val">${m.luckScore}%</div>
            <div class="score-lbl">Favorable Energy</div>
          </div>
        </div>

        <div class="month-dasha-strip">
          <span class="dasha-icon">⏳</span>
          <span>Active Dasha Period: <b>${escHtml(m.activeDasha)}</b></span>
        </div>

        <div class="month-domain-grid">
          <div class="month-domain-card career">
            <div class="domain-header"><span class="domain-icon">💼</span> <b>Career & Business</b></div>
            <p>${escHtml(m.career)}</p>
          </div>

          <div class="month-domain-card love">
            <div class="domain-header"><span class="domain-icon">❤️</span> <b>Love & Relationships</b></div>
            <p>${escHtml(m.love)}</p>
          </div>

          <div class="month-domain-card health">
            <div class="domain-header"><span class="domain-icon">🧘</span> <b>Health & Vitality</b></div>
            <p>${escHtml(m.health)}</p>
          </div>

          <div class="month-domain-card remedy">
            <div class="domain-header"><span class="domain-icon">💡</span> <b>Monthly Remedy & Pro-Tip</b></div>
            <p style="margin-bottom:6px;"><b>Remedy:</b> ${escHtml(m.remedy)}</p>
            <div class="monthly-tip-badge">${escHtml(m.tip)}</div>
          </div>
        </div>
      </div>
    `).join('');

    monthlyPredsHtml = `
      <div class="monthly-predictions-wrapper">
        <div class="monthly-intro-box">
          <h3>📅 1-Year Detailed Monthly Forecast (12 Months)</h3>
          <p>Accurate month-by-month analysis calculated from your Lagna, Moon sign, and Vimshottari Dasha timeline.</p>
        </div>

        <!-- Month Navigation Bar -->
        <div class="month-tabs-bar">
          ${monthTabsBtnHtml}
        </div>

        <!-- Month Cards Container -->
        <div class="month-cards-container">
          ${monthCardsHtml}
        </div>
      </div>
    `;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<title>Kundli Report — ${escHtml(k.meta.name)}</title>
<link rel="stylesheet" href="style.css">
</head>
<body>
<script>
// Apply saved theme immediately before rendering body content
const savedTheme = localStorage.getItem('appTheme') || 'dark';
if (savedTheme === 'light') {
  document.body.classList.add('light-theme');
}
</script>
<div class="app">

  <div class="back-fab" onclick="window.history.back()">←</div>

  <div class="report-header">
    <h2>🪔 ${escHtml(k.meta.name)}'s Kundli</h2>
    <p>${escHtml(k.meta.dob)} · ${escHtml(k.meta.tob)} · ${escHtml(k.meta.pob)}</p>
    <p>Ascendant: <b style="color:var(--gold-light)">${k.meta.ascendant.symbol} ${escHtml(k.meta.ascendant.sign)}</b> &nbsp;|&nbsp; Moon Sign: <b style="color:var(--gold-light)">${escHtml(k.meta.moon_sign)}</b></p>
  </div>

  <!-- ALWAYS VISIBLE D1 LAGNA CHART & PLANETARY DETAILS -->
  <div class="core-d1-section" style="padding:16px 8px 12px; border-bottom:1px solid rgba(255,255,255,0.06); background:rgba(0,0,0,0.12); margin-bottom:8px;">
    <h3 style="font-size:14px; color:var(--gold-light); margin-bottom:12px; font-weight:600; text-align:center;">📊 D1 Rashi (Lagna Chart)</h3>
    <div class="chart-wrap" style="margin-bottom:14px;">
      <div class="kundli-chart" id="d1ChartContainer">
        <svg viewBox="0 0 300 300" preserveAspectRatio="none">
          <rect x="1" y="1" width="298" height="298" fill="none" stroke="#D4AF37" stroke-width="1.5"/>
          <line x1="0" y1="0" x2="300" y2="300" stroke="#D4AF37" stroke-width="1"/>
          <line x1="300" y1="0" x2="0" y2="300" stroke="#D4AF37" stroke-width="1"/>
          <line x1="150" y1="0" x2="0" y2="150" stroke="#D4AF37" stroke-width="1"/>
          <line x1="150" y1="0" x2="300" y2="150" stroke="#D4AF37" stroke-width="1"/>
          <line x1="0" y1="150" x2="150" y2="300" stroke="#D4AF37" stroke-width="1"/>
          <line x1="300" y1="150" x2="150" y2="300" stroke="#D4AF37" stroke-width="1"/>
        </svg>
        <div id="d1ChartOccupants"></div>
      </div>
    </div>
    
    <div style="padding:0 8px;">
      <table class="report-table">
        <thead>
          <tr><th>Planet</th><th>Sign</th><th>Degree</th><th>House</th><th>Status / Dignity</th></tr>
        </thead>
        <tbody>${planetRows}</tbody>
      </table>
    </div>

    <!-- Benefic/Malefic Card -->
    <div class="benefic-malefic-card" style="background:rgba(255,255,255,0.03); border:1px solid var(--card-border); border-radius:var(--radius-md); padding:16px; margin: 16px 8px 4px;">
      <h4 style="color:var(--gold-light); font-size:13px; text-align:center; margin-bottom:12px; font-weight:600;">🪐 Planetary Influences for ${escHtml(k.meta.ascendant.sign)} Lagna</h4>
      <div style="display:flex; gap:12px;">
        <div style="flex:1; background:rgba(63,203,140,0.08); border:1px solid rgba(63,203,140,0.2); border-radius:var(--radius-sm); padding:10px; text-align:center;">
          <div style="color:var(--success); font-weight:bold; font-size:11px; margin-bottom:6px;">📈 Benefic (Shubh)</div>
          <div style="font-size:11.5px; color:var(--text-main); font-weight:600; line-height:1.5;">${beneficList}</div>
        </div>
        <div style="flex:1; background:rgba(225,85,107,0.08); border:1px solid rgba(225,85,107,0.2); border-radius:var(--radius-sm); padding:10px; text-align:center;">
          <div style="color:var(--danger); font-weight:bold; font-size:11px; margin-bottom:6px;">📉 Malefic (Paap)</div>
          <div style="font-size:11.5px; color:var(--text-main); font-weight:600; line-height:1.5;">${maleficList}</div>
        </div>
      </div>
    </div>
  </div>

  <!-- Horizontal Scroll Tab Bar for other details -->
  <div class="tabs" style="display:flex; overflow-x:auto; gap:6px; padding:0 8px 8px; -webkit-overflow-scrolling:touch; background:rgba(9,12,36,0.95); position:sticky; top:0; z-index:40; border-bottom:1px solid rgba(255,255,255,0.08);">
    <button class="tab-btn active" data-tab="panchang" style="flex:0 0 auto;">Panchang 🪔</button>
    <button class="tab-btn" data-tab="planets_info" style="flex:0 0 auto;">Planets Info 🪐</button>
    <button class="tab-btn" data-tab="chart" style="flex:0 0 auto;">Vargas / Chalit 📊</button>
    <button class="tab-btn" data-tab="ashtakavarga" style="flex:0 0 auto;">Ashtakavarga 🔢</button>
    <button class="tab-btn" data-tab="dasha" style="flex:0 0 auto;">Dasha ⏳</button>
    <button class="tab-btn" data-tab="rajyoga" style="flex:0 0 auto;">Rajyoga 🌟</button>
    <button class="tab-btn" data-tab="doshas" style="flex:0 0 auto;">Doshas ⚠️</button>
    <button class="tab-btn" data-tab="predictions" style="flex:0 0 auto;">Predictions 🔮</button>
    <button class="tab-btn" data-tab="monthly_predictions" style="flex:0 0 auto;">12-Month Forecast 🗓️</button>
  </div>

  <!-- TAB 1: PANCHANG -->
  <div class="tab-panel active" id="panchang">
    <div id="reportMoonSignHoroscope" style="margin-bottom:16px;">
      <!-- Dynamically loaded on client side via script.js -->
    </div>

    <div class="info-grid">
      <div class="info-tile"><div class="k">Day</div><div class="v">${escHtml(k.panchang.day)}</div></div>
      <div class="info-tile"><div class="k">Tithi</div><div class="v">${escHtml(k.panchang.tithi)}</div></div>
      <div class="info-tile"><div class="k">Nakshatra</div><div class="v">${escHtml(k.panchang.nakshatra)}</div></div>
      <div class="info-tile"><div class="k">Yog</div><div class="v">${escHtml(k.panchang.yog)}</div></div>
      <div class="info-tile"><div class="k">Karan</div><div class="v">${escHtml(k.panchang.karan)}</div></div>
      <div class="info-tile"><div class="k">Paksha</div><div class="v">${escHtml(k.panchang.paksha)}</div></div>
      <div class="info-tile"><div class="k">Sunrise</div><div class="v">${escHtml(k.panchang.sunrise)}</div></div>
      <div class="info-tile"><div class="k">Sunset</div><div class="v">${escHtml(k.panchang.sunset)}</div></div>
      <div class="info-tile" style="grid-column:1/-1;"><div class="k">Vikram Samvat</div><div class="v">${escHtml(k.panchang.vikram_samvat)}</div></div>
    </div>
  </div>

  <!-- TAB: PLANETS INFO -->
  <div class="tab-panel" id="planets_info">
    <div style="padding:4px 0;">
      <h3 style="font-size:15px; color:var(--gold-light); margin-bottom:12px; font-weight:600; text-align:center;">🪐 Detailed Planetary Interpretations</h3>
      ${planetsInfoHtml}
    </div>
  </div>

  <!-- TAB 3: VARGA CHARTS -->
  <div class="tab-panel" id="chart">
    <div class="varga-selector-wrapper" style="text-align:center; margin-bottom:12px;">
      <select id="vargaSelect" class="field select" style="width:auto; padding:8px 24px; font-size:13.5px; display:inline-block; border-radius:var(--radius-sm); border:1px solid var(--card-border); background:rgba(255,255,255,0.05); color:var(--text-main); cursor:pointer;">
        <option value="D9" selected>D9 - Navamsa (Marriage & Spouse)</option>
        <option value="chalit">Bhava Chalit (Cusp Chart)</option>
        <option value="D1">D1 - Rashi (Lagna Chart)</option>
        <option value="D2">D2 - Hora (Wealth & Assets)</option>
        <option value="D3">D3 - Drekkana (Siblings & Initiative)</option>
        <option value="D4">D4 - Chaturthamsa (Properties & Luck)</option>
        <option value="D7">D7 - Saptamsa (Children & Progeny)</option>
        <option value="D10">D10 - Dasamsa (Career & Profession)</option>
        <option value="D12">D12 - Dwadasamsa (Parents & Lineage)</option>
        <option value="D16">D16 - Shodasamsa (Vehicles & Pleasures)</option>
        <option value="D20">D20 - Vimsamsa (Spirituality & Faith)</option>
        <option value="D24">D24 - Chaturvimsamsa (Education & Knowledge)</option>
        <option value="D27">D27 - Saptavimsamsa (Strengths & Vigor)</option>
        <option value="D30">D30 - Trimsamsa (Obstacles & Evils)</option>
        <option value="D40">D40 - Khavedamsa (Maternal Lineage)</option>
        <option value="D45">D45 - Akshavedamsa (Paternal Lineage)</option>
        <option value="D60">D60 - Shashtyamsa (Karma & Past Life)</option>
      </select>
    </div>
    <div class="chart-wrap">
      <div class="kundli-chart" id="vargaChartContainer">
        <svg viewBox="0 0 300 300" preserveAspectRatio="none">
          <rect x="1" y="1" width="298" height="298" fill="none" stroke="#D4AF37" stroke-width="1.5"/>
          <line x1="0" y1="0" x2="300" y2="300" stroke="#D4AF37" stroke-width="1"/>
          <line x1="300" y1="0" x2="0" y2="300" stroke="#D4AF37" stroke-width="1"/>
          <line x1="150" y1="0" x2="0" y2="150" stroke="#D4AF37" stroke-width="1"/>
          <line x1="150" y1="0" x2="300" y2="150" stroke="#D4AF37" stroke-width="1"/>
          <line x1="0" y1="150" x2="150" y2="300" stroke="#D4AF37" stroke-width="1"/>
          <line x1="300" y1="150" x2="150" y2="300" stroke="#D4AF37" stroke-width="1"/>
        </svg>
        <div id="vargaChartOccupants"></div>
      </div>
    </div>
    <p style="font-size:12px; color:var(--text-muted); text-align:center; padding:0 12px; margin-top:8px;">
      Divisional and cusp charts update based on the dropdown selector. D1 Rashi is kept at the top for constant reference.
    </p>
  </div>

  <!-- TAB 4: ASHTAKAVARGA -->
  <div class="tab-panel" id="ashtakavarga">
    <div style="overflow-x:auto; width:100%; border-radius:var(--radius-md); border:1px solid var(--card-border); background:rgba(0,0,0,0.25); margin-bottom:12px;">
      <table class="report-table ashtak-table" style="width:100%; min-width:600px; text-align:center; border-collapse:collapse; font-size:12.5px;">
        <thead>
          <tr style="background:rgba(255,255,255,0.03); border-bottom:1px solid rgba(255,255,255,0.08);">
            <th style="padding:10px; text-align:left;">Planet</th>
            ${signsSymbols.map((sym, idx) => `<th style="padding:10px;">${sym}<br><span style="font-size:9.5px; color:var(--text-muted);">${signsAbbr[idx]}</span></th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${ashtakRows}
          ${savRow}
        </tbody>
      </table>
    </div>
    <p style="font-size:11.5px; color:var(--text-muted); line-height:1.6; padding:0 8px; margin-top:8px;">
      💡 <b>Ashtakavarga Guide:</b> A score of <b>4 or more</b> in Bhinnashtakavarga (row score) represents a strong transit sign for that planet. For Sarvashtakavarga (SAV), a total score of <b>28 or more</b> indicates a strong, auspicious sign.
    </p>
  </div>

  <!-- TAB 5: VIMSHOTTARI DASHA -->
  <div class="tab-panel" id="dasha">
    ${activeDashaCardHtml}
    <div class="dasha-timeline" style="display:flex; flex-direction:column; gap:4px;">
      ${dashaHtml}
    </div>
    <p style="font-size:11.5px; color:var(--text-muted); line-height:1.6; padding:0 8px; margin-top:8px;">
      💡 <b>Dasha Guide:</b> Vimshottari Dasha calculates planetary periods based on your birth Nakshatra. The active Mahadasha (major period) and Antardasha (sub-period) define the current phase of your life events. Click on any Mahadasha to expand and check sub-periods.
    </p>
  </div>

  <!-- TAB: RAJYOGA -->
  <div class="tab-panel" id="rajyoga">
    <div style="padding:4px 0;">
      <h3 style="font-size:15px; color:var(--gold-light); margin-bottom:12px; font-weight:600; text-align:center;">✨ Auspicious Rajyogas in Your Chart</h3>
      ${rajyogHtml}
    </div>
  </div>

  <!-- TAB: DOSHAS -->
  <div class="tab-panel" id="doshas">
    <div style="padding:4px 0;">
      <h3 style="font-size:15px; color:var(--gold-light); margin-bottom:12px; font-weight:600; text-align:center;">⚠️ Kundli Dosha Assessment</h3>
      ${doshasListHtml}
    </div>
  </div>

  <!-- TAB 6: PREDICTIONS -->
  <div class="tab-panel" id="predictions">
    <div class="pred-block">
      <h4>🧘 Personal Nature</h4>
      <p>${escHtml(k.predictions.nature)}</p>
    </div>
    <div class="pred-block">
      <h4>💼 Career Horoscope</h4>
      <p>${escHtml(k.predictions.career)}</p>
    </div>
    <div class="pred-block">
      <h4>💞 Love & Marriage Life</h4>
      <p>${escHtml(k.predictions.love)}</p>
    </div>
    <div class="pred-block">
      <h4>🩺 Health Outlook</h4>
      <p>${escHtml(k.predictions.health)}</p>
    </div>
  </div>

  <!-- TAB 7: 12-MONTH MONTHLY PREDICTIONS -->
  <div class="tab-panel" id="monthly_predictions">
    ${monthlyPredsHtml}
  </div>

  <div class="ad-banner"><span>Advertisement</span></div>
</div>

<script>
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    const panel = document.getElementById(btn.dataset.tab);
    if (panel) panel.classList.add('active');
  });
});

function switchMonthTab(idx) {
  document.querySelectorAll('.month-tab-btn').forEach((btn, i) => {
    if (i === idx) btn.classList.add('active');
    else btn.classList.remove('active');
  });
  document.querySelectorAll('.month-pred-card').forEach((card, i) => {
    if (i === idx) card.classList.add('active');
    else card.classList.remove('active');
  });
}
</script>
<script id="kundli-data-json" type="application/json">${JSON.stringify(k)}</script>
</body>
</html>`;
}

function renderErrorHTML(message) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<title>Error — AstroKundli</title>
<link rel="stylesheet" href="style.css">
</head>
<body>
<div class="app">
  <div class="back-fab" onclick="window.history.back()">←</div>
  <div class="report-header">
    <h2>⚠️ Generation Failed</h2>
    <p style="color:#ff6b6b;">${escHtml(message)}</p>
    <p>Please try again.</p>
    <button class="btn btn-gold" onclick="window.history.back()" style="margin-top:16px;">← Go Back</button>
  </div>
</div>
</body>
</html>`;
}

// ===================== AI CHAT API =====================

app.post('/api/chat', async (req, res) => {
  const userMessage = req.body.message;
  const history = req.body.history || [];
  const kundliContext = req.body.kundliContext || null;

  if (!userMessage) {
    return res.status(400).json({ success: false, message: 'Message is required.' });
  }

  // Build System Instructions with Kundli Context if present
  let systemInstruction = "You are 'AstroGuru', an expert, wise, and warm Vedic Astrologer. " +
    "Help the user understand their destiny, career, love, health, and chart details. " +
    "Be encouraging and warm, but astrologically sound. " +
    "Keep your answers relatively brief (3-4 sentences max per response) unless explaining something complex.";

  if (kundliContext) {
    systemInstruction += `\n\nActive User Kundli Context:\n` +
      `- Name: ${kundliContext.name}\n` +
      `- Gender: ${kundliContext.gender}\n` +
      `- Birth details: ${kundliContext.dob} ${kundliContext.tob} at ${kundliContext.pob}\n` +
      `- Moon Sign: ${kundliContext.moonSign}\n` +
      `- Ascendant: ${kundliContext.ascendant}\n` +
      `- Planets positions:\n${JSON.stringify(kundliContext.planets, null, 2)}`;
  }

  const apiKey = config.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY_HERE') {
    return res.json({
      success: true,
      reply: "My apologies! My Gemini API Key is not configured in config.js, so I can't read your cosmic path right now. Please tell the administrator to set it!"
    });
  }

  try {
    const contents = [...history];
    contents.push({
      role: 'user',
      parts: [{ text: userMessage }]
    });

    const requestBody = {
      contents: contents,
      systemInstruction: {
        parts: [{ text: systemInstruction }]
      }
    };

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Gemini API error status:", response.status, errText);
      return res.json({
        success: true,
        reply: "I am having trouble connecting to the cosmic stars right now. Please try again in a moment!"
      });
    }

    const data = await response.json();

    if (!data.candidates || data.candidates.length === 0 || !data.candidates[0].content?.parts?.[0]?.text) {
      let replyMessage = "I am listening, but the stars are silent. Ask me another question.";
      if (data.promptFeedback?.blockReason) {
        replyMessage = `AstroGuru could not answer this because the query was blocked by Gemini safety filters (${data.promptFeedback.blockReason}). If using Hindi/Hinglish, please check your spelling (e.g. use 'chhodna' instead of 'chodna') or try asking in English. Your coin has been refunded!`;
      } else {
        replyMessage = "The stars are silent right now. Your coin has been refunded. Please try asking again or rephrasing your question!";
      }
      
      return res.json({
        success: true,
        reply: replyMessage
      });
    }

    const reply = data.candidates[0].content.parts[0].text;

    return res.json({
      success: true,
      reply: reply.trim()
    });
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    return res.json({
      success: true,
      reply: "The stellar channels are offline. Let's try again in a moment!"
    });
  }
});

// ===================== CITY SEARCH (autocomplete proxy) =====================

app.get('/api/city-search', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (q.length < 2) return res.json({ results: [] });

  const apiKey = config.FREE_ASTRO_API_KEY;
  if (!apiKey || apiKey === 'YOUR_FREE_ASTRO_API_KEY_HERE') {
    // Fallback mock results when API key is not set
    return res.json({ results: [
      { name: q, country: 'India' },
      { name: q + ' City', country: 'India' },
    ]});
  }

  try {
    const url = `${config.FREE_ASTRO_API_BASE}/api/v2/geo/search?q=${encodeURIComponent(q)}&limit=6`;
    const response = await fetch(url, { headers: { 'x-api-key': apiKey } });
    if (!response.ok) throw new Error(`Geo search failed: ${response.status}`);
    const data = await response.json();
    res.json({ results: data.results || [] });
  } catch (err) {
    console.error('City search error:', err.message);
    res.json({ results: [] });
  }
});

// ===================== DAILY HOROSCOPE =====================

app.post('/api/daily-horoscope', async (req, res) => {
  const { sign, date, mode } = req.body || {};
  const apiKey = config.GEMINI_API_KEY;

  if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY_HERE') {
    if (mode === 'cosmic_insight') {
      return res.json({ insight: '✦ Venus and Jupiter align beautifully today — embrace creativity, nurture your relationships, and trust the cosmic flow. Lucky color: <strong>Gold</strong>.' });
    }
    return res.json({ horoscope: {
      overall: `The stars shine favorably for ${sign || 'you'} today. Channel your natural strengths and embrace new opportunities with confidence.`,
      career: 'A productive day for work — focus on priorities and collaboration.',
      love: 'Warm connections await. Be open and expressive with those you care about.',
      health: 'Stay hydrated and take short breaks. A gentle walk will boost your energy.',
      lucky_color: 'Gold',
      lucky_number: 7,
    }});
  }

  try {
    let prompt;
    if (mode === 'cosmic_insight') {
      prompt = `Write a single inspiring cosmic insight for today (${date || new Date().toDateString()}). Mention one planet and one theme. End with a lucky color in this exact format: "Lucky color: Gold". 2 sentences max. Use <strong> tags for the planet name and lucky color only. Plain text otherwise.`;
    } else {
      prompt = `Generate a Vedic-inspired daily horoscope for ${sign} on ${date || new Date().toDateString()}.
Return ONLY a raw JSON object (no markdown, no code fences) with exactly these keys:
{
  "overall": "2-3 sentences about the overall day",
  "career": "1-2 sentences about work/career",
  "love": "1-2 sentences about relationships",
  "health": "1-2 sentences about health",
  "lucky_color": "one color name",
  "lucky_number": 7
}`;
    }

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }] }) }
    );
    const data = await geminiRes.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

    if (mode === 'cosmic_insight') return res.json({ insight: text });

    // Parse JSON for per-sign horoscope
    try {
      const clean = text.replace(/^```(?:json)?\n?|\n?```$/g, '').trim();
      return res.json({ horoscope: JSON.parse(clean) });
    } catch (_) {
      return res.json({ horoscope: { overall: text, lucky_color: 'Gold', lucky_number: 7 } });
    }
  } catch (err) {
    console.error('Daily horoscope error:', err.message);
    res.json({ horoscope: { overall: `${sign || 'Your'} energy is bright today. Stay focused and trust your instincts.`, lucky_color: 'Gold', lucky_number: 1 } });
  }
});

// ===================== KUNDLI COMPATIBILITY =====================

app.post('/api/compatibility', async (req, res) => {
  const { name1, dob1, pob1, name2, dob2, pob2 } = req.body || {};
  if (!name1 || !dob1 || !name2 || !dob2) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

  const apiKey = config.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY_HERE') {
    return res.json({ result: {
      score: 78,
      rating: '⭐ Great Match',
      overall: `${name1} and ${name2} share a wonderful cosmic connection. Their birth charts indicate strong compatibility in values and communication.`,
      strengths: 'Strong emotional understanding and complementary energies create a natural harmony.',
      challenges: 'Small differences in approach may require patience and open dialogue.',
      advice: 'Celebrate your differences — they make your bond uniquely powerful.',
    }});
  }

  try {
    const prompt = `Perform a Vedic astrology compatibility analysis for:
Person 1: ${name1}, born ${dob1}${pob1 ? ` in ${pob1}` : ''}
Person 2: ${name2}, born ${dob2}${pob2 ? ` in ${pob2}` : ''}

Return ONLY a raw JSON object (no markdown, no code fences) with exactly these keys:
{
  "score": 78,
  "rating": "⭐ Great Match",
  "overall": "2-3 sentences mentioning both names",
  "strengths": "1-2 sentences on relationship strengths",
  "challenges": "1-2 sentences on potential challenges",
  "advice": "1-2 sentences of astrological advice"
}
Score range: 40-95. Rating options: "✨ Excellent Match", "⭐ Great Match", "💫 Good Match", "🌙 Moderate Match".`;

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }] }) }
    );
    const data = await geminiRes.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

    try {
      const clean = text.replace(/^```(?:json)?\n?|\n?```$/g, '').trim();
      return res.json({ result: JSON.parse(clean) });
    } catch (_) {
      return res.json({ result: {
        score: 72, rating: '💫 Good Match',
        overall: text || `${name1} and ${name2} have complementary cosmic energies.`,
        strengths: 'Shared values and mutual respect form a solid foundation.',
        challenges: 'Patience and communication will smooth any rough edges.',
        advice: 'Trust your cosmic connection — it grows stronger with time.',
      }});
    }
  } catch (err) {
    console.error('Compatibility error:', err.message);
    res.status(500).json({ success: false, message: 'Compatibility check failed' });
  }
});

// ===================== STATIC FILES (after API routes) =====================
app.use(express.static(path.join(__dirname), {
  index: 'index.html',
  extensions: ['html']
}));

// ===================== START SERVER =====================

if (!process.env.VERCEL) {
  app.listen(config.PORT, () => {
    console.log(`\n🕉  AstroKundli server running at http://localhost:${config.PORT}`);
    console.log(`   DivineAPI: ${config.DIVINE_API_KEY ? '✅ Key configured' : '❌ NOT SET (update config.js!)'}`);
    console.log(`   FreeAstroAPI (Geo): ${config.FREE_ASTRO_API_KEY ? '✅ Key configured' : '❌ NOT SET (update config.js!)'}\n`);
  });
}

module.exports = app;

/**
 * astro-engine.js — Vedic Astrology Engine
 * --------------------------------------------------------
 * Uses FreeAstroAPI for real ephemeris data (planetary
 * positions, houses, panchang) and Google Gemini AI for
 * personalized predictions based on the actual chart.
 * --------------------------------------------------------
 */
const config = require('./config');

const SIGN_SYMBOLS = {
  'Aries':'♈','Taurus':'♉','Gemini':'♊','Cancer':'♋','Leo':'♌','Virgo':'♍',
  'Libra':'♎','Scorpio':'♏','Sagittarius':'♐','Capricorn':'♑','Aquarius':'♒','Pisces':'♓'
};
const PLANET_SYMBOLS = {
  'sun': 'Su', 'moon': 'Mo', 'mars': 'Ma', 'mercury': 'Me',
  'jupiter': 'Ju', 'venus': 'Ve', 'saturn': 'Sa',
  'rahu': 'Ra', 'ketu': 'Ke', 'ascendant': 'Asc'
};

// ===================== DIVINEAPI HELPERS =====================

const API_BASE = config.FREE_ASTRO_API_BASE;

function SIGN_IDS_MAP() {
  return {
    'Aries': 1, 'Taurus': 2, 'Gemini': 3, 'Cancer': 4, 'Leo': 5, 'Virgo': 6,
    'Libra': 7, 'Scorpio': 8, 'Sagittarius': 9, 'Capricorn': 10, 'Aquarius': 11, 'Pisces': 12
  };
}

function getSignId(signName) {
  if (!signName) return 1;
  const map = SIGN_IDS_MAP();
  return map[signName] || map[signName.charAt(0).toUpperCase() + signName.slice(1).toLowerCase()] || 1;
}

function getNakshatraPada(absoluteDegree) {
  const nakshatraLength = 360 / 27; // 13.333333
  const padaLength = nakshatraLength / 4; // 3.333333
  const currentNakshatraPos = absoluteDegree % nakshatraLength;
  return Math.floor(currentNakshatraPos / padaLength) + 1;
}

const NAKSHATRAS_LIST = [
  'Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra', 'Punarvasu', 'Pushya', 'Ashlesha',
  'Magha', 'Purva Phalguni', 'Uttara Phalguni', 'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha',
  'Mula', 'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishta', 'Shatabhisha', 'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati'
];

function getNakshatraInfo(absoluteDegree) {
  const nakshatraLength = 360 / 27; // 13.333333
  const index = Math.floor(absoluteDegree / nakshatraLength);
  const name = NAKSHATRAS_LIST[index] || 'Ashwini';
  const currentNakshatraPos = absoluteDegree % nakshatraLength;
  const padaLength = nakshatraLength / 4; // 3.333333
  const pada = Math.floor(currentNakshatraPos / padaLength) + 1;
  return { name, pada };
}

function getTimezoneOffset(timeZone, dateStr = '2020-05-15T12:00:00') {
  try {
    const date = new Date(dateStr);
    const tzString = date.toLocaleString("en-US", { timeZone });
    const localDate = new Date(tzString);
    const utcDate = new Date(date.toLocaleString("en-US", { timeZone: "UTC" }));
    return (localDate - utcDate) / 3600000;
  } catch (e) {
    return 5.5; // Fallback to Indian Standard Time if calculation fails
  }
}

/** Resolve a city name to lat/lng/timezone via FreeAstroAPI Geo Search (with mock fallback) */
async function resolveCity(cityName) {
  const apiKey = config.FREE_ASTRO_API_KEY;
  if (!apiKey || apiKey === 'YOUR_FREE_ASTRO_API_KEY_HERE' || apiKey === '') {
    return { name: cityName, country: 'India', lat: 28.6139, lng: 77.2090, timezone: 'Asia/Kolkata' };
  }

  try {
    const url = `${API_BASE}/api/v2/geo/search?q=${encodeURIComponent(cityName)}&limit=1`;
    const res = await fetch(url, { headers: { 'x-api-key': apiKey } });
    if (!res.ok) throw new Error(`Geo search failed: ${res.status}`);
    const data = await res.json();
    if (!data.results || data.results.length === 0) {
      return { name: cityName, country: 'India', lat: 28.6139, lng: 77.2090, timezone: 'Asia/Kolkata' };
    }
    return data.results[0]; // { name, country, lat, lng, timezone, ... }
  } catch (e) {
    return { name: cityName, country: 'India', lat: 28.6139, lng: 77.2090, timezone: 'Asia/Kolkata' };
  }
}

/** Build the standard request body for DivineAPI endpoints */
function buildDivineBody(name, gender, dob, tob, geo) {
  const [year, month, day] = dob.split('-').map(Number);
  const [hour, minute] = tob.split(':').map(Number);
  
  const datetime = `${dob}T${tob}:00`;
  const tzone = getTimezoneOffset(geo.timezone || 'Asia/Kolkata', datetime);
    return {
    api_key: config.DIVINE_API_KEY,
    day: String(day),
    month: String(month),
    year: String(year),
    hour: String(hour),
    min: String(minute),
    sec: '0',
    lat: String(geo.lat),
    lon: String(geo.lng),
    tzone: String(tzone),
    place: geo.name,
    name: name || 'User',
    full_name: name || 'User',
    gender: (gender || 'male').toLowerCase(),
    lan: 'en'
  };}

/** Fetch the Vedic Chart (planetary positions, houses, ascendant) via DivineAPI */
async function fetchVedicChart(name, gender, dob, tob, geo) {
  const body = buildDivineBody(name, gender, dob, tob, geo);
  console.log('  📡 Calling DivineAPI /planetary-positions ...');
  const res = await fetch(`https://astroapi-3.divineapi.com/indian-api/v2/planetary-positions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.DIVINE_API_TOKEN}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams(body).toString()
  });
  if (!res.ok) {
    const err = await res.text();
    console.error('  Vedic Chart API error:', res.status, err);
    throw new Error(`Vedic Chart API error: ${res.status}`);
  }
  
  const raw = await res.json();
  if (raw.success !== 1 && raw.success !== "1") {
    console.error('  DivineAPI /planetary-positions raw error response:', JSON.stringify(raw));
    throw new Error(`DivineAPI error: ${raw.message || 'Unknown error'}`);
  }

  // Parse planets and find Ascendant
  const rawPlanets = raw.data?.planets || {};
  let ascendantData = null;
  
  // Look for ascendant in planets list
  for (const k in rawPlanets) {
    if (k.toLowerCase().includes('ascendant') || k.toLowerCase().includes('lagna') || rawPlanets[k].name === 'Ascendant') {
      ascendantData = rawPlanets[k];
      break;
    }
  }
  // Fallback to data.ascendant
  if (!ascendantData && raw.data?.ascendant) {
    ascendantData = raw.data.ascendant;
  }
  
  // Default ascendant if not found
  if (!ascendantData) {
    ascendantData = { sign: 'Aries', full_degree: 0 };
  }

  const ascSign = ascendantData.sign || 'Aries';
  const ascSignId = getSignId(ascSign);
  const ascFullDegree = ascendantData.full_degree !== undefined ? Number(ascendantData.full_degree) : (ascendantData.fullDegree !== undefined ? Number(ascendantData.fullDegree) : 0);
  const ascDegree = ascFullDegree % 30;

  const ascendant = {
    sign: ascSign,
    sign_id: ascSignId,
    degree_in_sign: ascDegree,
    nakshatra: getNakshatraInfo(ascFullDegree)
  };

  const planets = [];
  for (const key in rawPlanets) {
    const p = rawPlanets[key];
    if (key.toLowerCase().includes('ascendant') || key.toLowerCase().includes('lagna') || p.name === 'Ascendant') {
      continue;
    }
    
    // Normalize name to Sun, Moon, etc.
    let pName = p.name || (key.charAt(0).toUpperCase() + key.slice(1));
    if (pName.toLowerCase() === 'sun') pName = 'Sun';
    if (pName.toLowerCase() === 'moon') pName = 'Moon';
    if (pName.toLowerCase() === 'mars') pName = 'Mars';
    if (pName.toLowerCase() === 'mercury') pName = 'Mercury';
    if (pName.toLowerCase() === 'jupiter') pName = 'Jupiter';
    if (pName.toLowerCase() === 'venus') pName = 'Venus';
    if (pName.toLowerCase() === 'saturn') pName = 'Saturn';
    if (pName.toLowerCase() === 'rahu') pName = 'Rahu';
    if (pName.toLowerCase() === 'ketu') pName = 'Ketu';

    const fullDegree = p.full_degree !== undefined ? Number(p.full_degree) : (p.fullDegree !== undefined ? Number(p.fullDegree) : 0);
    const normDegree = fullDegree % 30;
    const isRetro = p.is_retro === 'true' || p.is_retro === true || p.isRetro === 'true' || p.isRetro === true;
    
    planets.push({
      name: pName,
      sign: p.sign || 'Aries',
      sign_id: getSignId(p.sign),
      degree_in_sign: normDegree,
      absolute_degree: fullDegree,
      house: Number(p.house || 1),
      is_retrograde: isRetro,
      nakshatra: p.nakshatra || getNakshatraInfo(fullDegree).name,
      pada: p.nakshatra_pada !== undefined ? Number(p.nakshatra_pada) : (p.pada !== undefined ? Number(p.pada) : getNakshatraInfo(fullDegree).pada)
    });
  }

  const houses = [];
  for (let i = 1; i <= 12; i++) {
    const hSignId = (ascSignId + i - 2) % 12 + 1;
    const hSign = Object.keys(SIGN_IDS_MAP()).find(key => SIGN_IDS_MAP()[key] === hSignId);
    houses.push({
      house: i,
      sign: hSign,
      sign_id: hSignId,
      degree: 0
    });
  }

  return {
    ascendant,
    planets,
    houses
  };
}

/** Fetch Panchang data via DivineAPI */
async function fetchPanchang(name, gender, dob, tob, geo) {
  const body = buildDivineBody(name, gender, dob, tob, geo);
  console.log('  📡 Calling DivineAPI /find-panchang ...');
  const res = await fetch(`https://astroapi-1.divineapi.com/indian-api/v2/find-panchang`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.DIVINE_API_TOKEN}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams(body).toString()
  });
  if (!res.ok) {
    const err = await res.text();
    console.error('  Panchang API error:', res.status, err);
    throw new Error(`Panchang API error: ${res.status}`);
  }
  const raw = await res.json();
  if (raw.success !== 1 && raw.success !== "1") {
    throw new Error(`DivineAPI error: ${raw.message || 'Unknown error'}`);
  }

  const data = raw.data || {};
  const day = new Date(`${dob}T${tob}:00`).toLocaleDateString('en-US', { weekday: 'long' });
  
  let paksha = 'Shukla';
  const tithiStr = (data.tithi || '').toLowerCase();
  if (tithiStr.includes('krishna') || tithiStr.includes('dark')) {
    paksha = 'Krishna';
  }

  return {
    day: data.day || day,
    tithi: data.tithi || '',
    nakshatra: data.nakshatra || '',
    yog: data.yoga || '',
    karan: data.karana || '',
    paksha: paksha,
    sunrise: data.sunrise || '06:00 AM',
    sunset: data.sunset || '06:00 PM',
    vikram_samvat: data.vikram_samvat || '2083'
  };
}

/** Fetch Divisional Charts (Vargas D1 to D60) in parallel via DivineAPI */
async function fetchVargas(name, gender, dob, tob, geo) {
  const divisions = ['D1', 'D2', 'D3', 'D4', 'D7', 'D9', 'D10', 'D12', 'D16', 'D20', 'D24', 'D27', 'D30', 'D40', 'D45', 'D60'];
  const body = buildDivineBody(name, gender, dob, tob, geo);
  
  console.log('  📡 Calling DivineAPI /horoscope-chart for all divisions in parallel...');
  const vargas = {};
  
  await Promise.all(divisions.map(async (div) => {
    try {
      const res = await fetch(`https://astroapi-3.divineapi.com/indian-api/v1/horoscope-chart/${div}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.DIVINE_API_TOKEN}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams(body).toString()
      });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const raw = await res.json();
      if (raw.success === 1 || raw.success === "1") {
        const houseData = raw.data?.data || raw.data || {};
        const planets = [];
        let ascendantSignId = 1;
        const SIGNS_LIST = [
          'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
          'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'
        ];

        for (const hKey in houseData) {
          const houseNum = Number(hKey);
          if (isNaN(houseNum)) continue;
          
          const hObj = houseData[hKey] || {};
          const signId = Number(hObj.sign_no || 1);
          
          if (houseNum === 1) {
            ascendantSignId = signId;
          }
          
          const hPlanets = hObj.planet || [];
          hPlanets.forEach(p => {
            let pName = p.name || '';
            if (pName.toLowerCase().includes('ascendant') || pName.toLowerCase().includes('lagna') || pName === 'Ascendant') {
              return;
            }
            
            if (pName.toLowerCase() === 'sun') pName = 'Sun';
            if (pName.toLowerCase() === 'moon') pName = 'Moon';
            if (pName.toLowerCase() === 'mars') pName = 'Mars';
            if (pName.toLowerCase() === 'mercury') pName = 'Mercury';
            if (pName.toLowerCase() === 'jupiter') pName = 'Jupiter';
            if (pName.toLowerCase() === 'venus') pName = 'Venus';
            if (pName.toLowerCase() === 'saturn') pName = 'Saturn';
            if (pName.toLowerCase() === 'rahu') pName = 'Rahu';
            if (pName.toLowerCase() === 'ketu') pName = 'Ketu';

            const standardPlanets = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'];
            if (standardPlanets.includes(pName)) {
              const signName = SIGNS_LIST[signId - 1] || 'Aries';
              planets.push({
                name: pName,
                sign: signName,
                sign_id: signId,
                house: houseNum
              });
            }
          });
        }

        const ascSignName = SIGNS_LIST[ascendantSignId - 1] || 'Aries';
        vargas[div] = {
          ascendant: {
            sign: ascSignName,
            sign_id: ascendantSignId
          },
          planets
        };
      }
    } catch (e) {
      console.warn(`    ⚠️ Failed to fetch varga ${div}: ${e.message}`);
    }
  }));
  
  return { vargas };
}

const DASHA_LORDS = ['Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury', 'Ketu', 'Venus'];
const DASHA_YEARS = { 'Sun': 6, 'Moon': 10, 'Mars': 7, 'Rahu': 18, 'Jupiter': 16, 'Saturn': 19, 'Mercury': 17, 'Ketu': 7, 'Venus': 20 };

function subdivideDasha(startTimeStr, endTimeStr, startLord) {
  try {
    const startTime = new Date(startTimeStr).getTime();
    const endTime = new Date(endTimeStr).getTime();
    const totalDuration = endTime - startTime;
    if (isNaN(startTime) || isNaN(endTime) || totalDuration <= 0) return [];
    
    const idx = DASHA_LORDS.indexOf(startLord);
    if (idx === -1) return [];
    
    const seq = [];
    for (let i = 0; i < 9; i++) {
      seq.push(DASHA_LORDS[(idx + i) % 9]);
    }
    
    let currentStart = startTime;
    const subPeriods = [];
    
    seq.forEach(subLord => {
      const fraction = DASHA_YEARS[subLord] / 120;
      const duration = totalDuration * fraction;
      const currentEnd = currentStart + duration;
      
      subPeriods.push({
        lord: subLord,
        start: new Date(currentStart).toISOString(),
        end: new Date(Math.min(currentEnd, endTime)).toISOString()
      });
      currentStart = currentEnd;
    });
    return subPeriods;
  } catch (e) {
    return [];
  }
}

/** Fetch Vimshottari Dasha timeline via DivineAPI */
async function fetchDasha(name, gender, dob, tob, geo) {
  const body = buildDivineBody(name, gender, dob, tob, geo);
  body.dasha_type = 'antar-dasha';
  
  console.log('  📡 Calling DivineAPI /vimshottari-dasha ...');
  const res = await fetch(`https://astroapi-3.divineapi.com/indian-api/v1/vimshottari-dasha`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.DIVINE_API_TOKEN}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams(body).toString()
  });
  if (!res.ok) {
    const err = await res.text();
    console.error('  Dasha API error:', res.status, err);
    throw new Error(`Dasha API error: ${res.status}`);
  }
  const raw = await res.json();
  if (raw.success !== 1 && raw.success !== "1") {
    throw new Error(`DivineAPI error: ${raw.message || 'Unknown error'}`);
  }
  console.log('  DivineAPI /vimshottari-dasha raw response:', JSON.stringify(raw));
  const mahaDashaObj = raw.data?.maha_dasha || {};
  const timeline = [];
  
  for (const lord in mahaDashaObj) {
    const d = mahaDashaObj[lord];
    
    let startISO = '';
    let endISO = '';
    try {
      if (d.start_date && d.start_date !== '--') {
        startISO = new Date(d.start_date).toISOString();
      }
      if (d.end_date && d.end_date !== '--') {
        endISO = new Date(d.end_date).toISOString();
      }
    } catch (e) {}

    const sub_periods = [];
    const antarDashaObj = d.antar_dasha || {};
    for (const subLord in antarDashaObj) {
      const sp = antarDashaObj[subLord];
      let spStart = '';
      let spEnd = '';
      try {
        if (sp.start_time && sp.start_time !== '--') {
          spStart = new Date(sp.start_time).toISOString();
        } else {
          spStart = startISO;
        }
        if (sp.end_time && sp.end_time !== '--') {
          spEnd = new Date(sp.end_time).toISOString();
        } else {
          spEnd = endISO;
        }
      } catch (e) {}

      const pratyantars = subdivideDasha(spStart, spEnd, subLord);
      
      sub_periods.push({
        lord: subLord,
        start: spStart,
        end: spEnd,
        sub_periods: pratyantars
      });
    }

    sub_periods.sort((a, b) => new Date(a.start) - new Date(b.start));

    timeline.push({
      lord,
      start: startISO,
      end: endISO,
      sub_periods
    });
  }

  timeline.sort((a, b) => new Date(a.start) - new Date(b.start));

  return { timeline };
}

/** Fetch Planet Strength & Ashtakavarga via DivineAPI */
async function fetchStrength(name, gender, dob, tob, geo) {
  const body = buildDivineBody(name, gender, dob, tob, geo);
  console.log('  📡 Calling DivineAPI /sarvashtakavarga ...');
  
  const defaultAshtakavarga = {
    planets: {
      Sun: [4, 5, 3, 4, 6, 4, 3, 5, 4, 5, 3, 2],
      Moon: [5, 4, 4, 5, 5, 3, 4, 5, 4, 6, 3, 1],
      Mars: [3, 4, 2, 5, 4, 5, 2, 3, 4, 4, 2, 1],
      Mercury: [4, 6, 3, 5, 5, 4, 3, 6, 5, 4, 4, 5],
      Jupiter: [5, 5, 4, 5, 6, 4, 5, 5, 4, 6, 5, 2],
      Venus: [4, 5, 4, 4, 5, 3, 5, 6, 4, 5, 3, 4],
      Saturn: [3, 3, 2, 4, 5, 3, 2, 4, 3, 5, 2, 3]
    },
    sarvashtakavarga: [30, 29, 26, 31, 33, 30, 27, 25, 32, 28, 26, 22]
  };

  try {
    const res = await fetch(`https://astroapi-3.divineapi.com/indian-api/v1/bhinnashtakvarga/sarvashtakavarga/D1`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.DIVINE_API_TOKEN}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams(body).toString()
    });
    if (!res.ok) {
      console.warn(`    ⚠️ Failed to fetch strength: status ${res.status}`);
      return { ashtakavarga: defaultAshtakavarga };
    }
    const raw = await res.json();
    if (raw.success === 1 || raw.success === "1") {
      const tableData = raw.data?.table || raw.data || {};
      
      const planets = {};
      const planetKeys = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'];
      
      for (const pk of planetKeys) {
        const dataKey = Object.keys(tableData).find(k => k.toLowerCase() === pk.toLowerCase());
        if (dataKey) {
          const valObj = tableData[dataKey] || {};
          const scores = [];
          for (let i = 1; i <= 12; i++) {
            scores.push(Number(valObj[String(i)] !== undefined ? valObj[String(i)] : 0));
          }
          planets[pk] = scores;
        } else {
          planets[pk] = defaultAshtakavarga.planets[pk];
        }
      }
      
      let sarvashtakavarga = [];
      const savKey = Object.keys(tableData).find(k => k.toLowerCase() === 'total_bindoo' || k.toLowerCase().includes('sarvashtakavarga') || k.toLowerCase().includes('sav') || k.toLowerCase().includes('total'));
      if (savKey) {
        const valObj = tableData[savKey] || {};
        for (let i = 1; i <= 12; i++) {
          sarvashtakavarga.push(Number(valObj[String(i)] !== undefined ? valObj[String(i)] : 0));
        }
      } else {
        for (let i = 0; i < 12; i++) {
          let sum = 0;
          for (const pk of planetKeys) {
            sum += planets[pk][i] || 0;
          }
          sarvashtakavarga.push(sum);
        }
      }
      
      return {
        ashtakavarga: {
          planets,
          bhinnashtakavarga: planets,
          sarvashtakavarga: sarvashtakavarga.length === 12 ? sarvashtakavarga : defaultAshtakavarga.sarvashtakavarga
        }
      };
    }
  } catch (e) {
    console.warn(`    ⚠️ Strength API error: ${e.message}`);
  }
  
  return { ashtakavarga: defaultAshtakavarga };
}
// ===================== CHART-BASED PREDICTIONS =====================

// Sign lordships for Vedic astrology
const SIGN_LORDS = {
  'Aries':'Mars','Taurus':'Venus','Gemini':'Mercury','Cancer':'Moon',
  'Leo':'Sun','Virgo':'Mercury','Libra':'Venus','Scorpio':'Mars',
  'Sagittarius':'Jupiter','Capricorn':'Saturn','Aquarius':'Saturn','Pisces':'Jupiter'
};

// Exaltation signs
const EXALTED_IN = {
  'Sun':'Aries','Moon':'Taurus','Mars':'Capricorn','Mercury':'Virgo',
  'Jupiter':'Cancer','Venus':'Pisces','Saturn':'Libra','Rahu':'Taurus','Ketu':'Scorpio'
};

// Debilitation signs
const DEBILITATED_IN = {
  'Sun':'Libra','Moon':'Scorpio','Mars':'Cancer','Mercury':'Pisces',
  'Jupiter':'Capricorn','Venus':'Virgo','Saturn':'Aries','Rahu':'Scorpio','Ketu':'Taurus'
};

/** Check if planet is in its own sign */
function isOwnSign(planet, sign) { return SIGN_LORDS[sign] === planet; }

/** Get dignity description for a planet */
function getDignity(planetName, sign) {
  if (EXALTED_IN[planetName] === sign) return 'exalted';
  if (DEBILITATED_IN[planetName] === sign) return 'debilitated';
  if (isOwnSign(planetName, sign)) return 'in own sign';
  return null;
}

/** Generate detailed predictions from real chart data — no external AI needed */
function generatePredictions(chartData, panchangData) {
  const asc = chartData.ascendant;
  const moon = chartData.planets.find(p => p.name === 'Moon');
  const sun = chartData.planets.find(p => p.name === 'Sun');
  const venus = chartData.planets.find(p => p.name === 'Venus');
  const saturn = chartData.planets.find(p => p.name === 'Saturn');
  const jupiter = chartData.planets.find(p => p.name === 'Jupiter');
  const mars = chartData.planets.find(p => p.name === 'Mars');

  return {
    nature: `With ${asc.sign} Ascendant in ${asc.nakshatra.name} Nakshatra (Pada ${asc.nakshatra.pada}), you possess the core qualities of this rising sign. Your Moon is placed in ${moon.sign} in House ${moon.house} in ${moon.nakshatra} Nakshatra, which shapes your emotional nature and mental disposition. The Sun in ${sun.sign} (House ${sun.house}) defines your soul purpose and identity. ${jupiter.is_retrograde ? `Jupiter being retrograde in ${jupiter.sign} suggests internalized wisdom and unconventional philosophical views.` : `Jupiter in ${jupiter.sign} (House ${jupiter.house}) blesses you with ${jupiter.house === 1 || jupiter.house === 5 || jupiter.house === 9 ? 'strong spiritual inclination and good fortune.' : 'growth through effort and determination.'}`}`,

    career: `Your 10th house of career falls in ${chartData.houses?.[9]?.sign || 'the sign'} ruled by its lord. ${saturn.sign} Saturn in House ${saturn.house}${saturn.is_retrograde ? ' (Retrograde)' : ''} indicates ${saturn.house === 10 ? 'strong career discipline and leadership through persistence' : 'karmic lessons in your professional journey that build long-term success'}. Mars in ${mars.sign} (House ${mars.house}) provides ${mars.house === 10 ? 'tremendous drive and ambition in career matters' : 'energy and initiative that supports your professional goals'}. ${sun.house === 10 ? 'Sun in the 10th house gives natural authority and recognition in career.' : `The Sun's placement in House ${sun.house} channels your vitality toward ${sun.house === 1 ? 'self-development' : sun.house === 7 ? 'partnerships' : 'growth in that life area'}.`}`,

    love: `Venus, the planet of love, is placed in ${venus.sign} in House ${venus.house}${venus.is_retrograde ? ' (Retrograde)' : ''} in ${venus.nakshatra} Nakshatra. This indicates ${venus.house === 7 ? 'strong focus on partnerships and a naturally harmonious married life' : `that love and relationships are influenced by ${venus.sign} qualities`}. Your 7th house of marriage is in ${chartData.houses?.[6]?.sign || 'the sign'}, and Moon in ${moon.sign} shapes your emotional approach to relationships. ${mars.house === 7 ? 'Mars in the 7th house (Manglik placement) suggests passionate but potentially intense relationships — Manglik Dosha should be considered in match-making.' : `The overall planetary configuration suggests ${venus.house <= 6 ? 'a relationship that develops through daily interactions or work connections' : 'meaningful partnerships that grow with mutual understanding'}.`}`,

    health: `Your 6th house of health is in ${chartData.houses?.[5]?.sign || 'the sign'}, and the 8th house falls in ${chartData.houses?.[7]?.sign || 'the sign'}. ${saturn.sign} Saturn in House ${saturn.house} advises attention to ${saturn.sign === 'Capricorn' || saturn.sign === 'Aquarius' ? 'bones, joints, and the skeletal system' : saturn.sign === 'Virgo' ? 'digestive health' : saturn.sign === 'Cancer' ? 'stomach and emotional wellbeing' : 'the body areas governed by ' + saturn.sign}. ${mars.is_retrograde ? 'Retrograde Mars suggests managing anger and inflammation proactively.' : `Mars in ${mars.sign} indicates good physical vitality but watch for ${mars.sign === 'Aries' || mars.sign === 'Scorpio' ? 'head-related issues and fevers' : 'overexertion and heat-related conditions'}.`} Regular yoga and pranayama aligned with your Moon Nakshatra (${moon.nakshatra}) can strengthen overall vitality.`
  };
}

// ===================== PLANET HOUSE INTERPRETATIONS =====================

const PLANET_HOUSE_TEMPLATES = {
  'Sun': {
    1: 'gives strong leadership qualities, high self-esteem, and a dominant personality. You shine in independent endeavors but should watch out for pride.',
    2: 'focuses your energy on finance, family values, and resources. You speak with authority and seek financial self-sufficiency.',
    3: 'bestows courage, mental vitality, and expressive communication. You thrive in writing, media, or direct initiatives.',
    4: 'channels your energy into home, mother, and inner security. You value privacy and seek deep emotional foundations.',
    5: 'grants excellent creative intellect, interest in speculation, and joy in parenting. You are highly expressive and love arts.',
    6: 'indicates a strong drive to overcome obstacles, service-minded work, and high focus on daily health and hygiene.',
    7: 'brings focus to partnerships, relationships, and public life. You seek a partner who complements your ambition.',
    8: 'leads to interest in occult, deep research, and transformations. You gain strength through navigating life secrets.',
    9: 'inclines you towards higher wisdom, spirituality, philosophy, and long travels. You respect teachers and values.',
    10: 'blesses you with strong career ambition, public authority, and high fame. You make a great administrator or manager.',
    11: 'brings gains from social connections, friends, and elder siblings. Your desires are fulfilled through networking.',
    12: 'leads to introspection, high imagination, foreign connections, and spiritual retreat. You find strength in solitude.'
  },
  'Moon': {
    1: 'makes you highly intuitive, sensitive, and emotionally expressive. Your mood fluctuates, but you possess deep empathy.',
    2: 'indicates emotional attachments to wealth and family assets. Your speech is soft, and your savings may fluctuate.',
    3: 'gives an active mind, high imagination, and interest in writing or travel. You express emotions verbally.',
    4: 'blesses you with deep emotional peace, attachment to mother, and domestic happiness. You seek emotional safety.',
    5: 'grants a creative, intelligent, and highly romantic mind. You connect emotionally with children and speculative learning.',
    6: 'suggests that your emotions are tied to daily service and pets. Emotional stress might affect physical digestion.',
    7: 'focuses your emotional desires on relationships and marriage. You seek mutual nurturing and emotional compatibility.',
    8: 'leads to deep spiritual intuition, interest in mysteries, and intense, fluctuating emotional phases.',
    9: 'gives a philosophical, optimistic, and spiritual outlook. You love learning about different cultures and belief systems.',
    10: 'focuses your emotional identity on public reputation and career. You are well-liked by colleagues and the public.',
    11: 'brings emotional support from friends, groups, and social circles. You are socially popular and caring.',
    12: 'inclines you to a rich dream life, deep spirituality, and peaceful isolation. You love foreign travels or retreat.'
  },
  'Mars': {
    1: 'gives high physical energy, courage, and an athletic, dynamic personality. Watch out for impatience or head injuries.',
    2: 'drives you to work hard for financial gains. Your speech can be aggressive, and family discussions can be intense.',
    3: 'makes you extremely bold, initiating, and competitive. You excel in writing, technical fields, and sales.',
    4: 'directs your physical energy towards home and real estate. Can cause occasional friction in domestic life.',
    5: 'gives a passionate, highly competitive, and creative mind. You are active in sports, romance, or speculation.',
    6: 'makes you a fierce defender who conquers obstacles and enemies easily. You excel in demanding, energetic work.',
    7: 'brings intense passion and energy to relationships. You should handle marital differences with patience and care.',
    8: 'leads to a powerful interest in transformation, hidden assets, and research. Watch for sudden physical changes.',
    9: 'drives you to aggressively defend your beliefs and principles. You love travels and adventure.',
    10: 'gives massive professional drive, leadership skills, and executive power. You thrive in high-pressure careers.',
    11: 'helps you actively pursue your goals and gain from direct efforts. You lead group activities with vigor.',
    12: 'leads to high energy spent in foreign lands, dreams, or secret projects. Channel energy constructively to avoid sleep issues.'
  },
  'Mercury': {
    1: 'gives a sharp, youthful intellect, excellent speech, and a highly communicative, witty, and curious personality.',
    2: 'makes you a skilled talker who excels in finance, accounting, and business communication. You speak logically.',
    3: 'makes you exceptionally quick-witted, skilled in writing, digital tools, and local networking. You are a natural writer.',
    4: 'promotes logical and intellectual discussions at home. You have a good memory and a peaceful mind.',
    5: 'grants excellent analytical skills, writing talents, interest in puzzles, and clever investment decisions.',
    6: 'makes you detail-oriented, highly analytical in solving problems, and interested in medical or accounting fields.',
    7: 'focuses your intellect on business deals, contracts, and mutual communication with your spouse/partner.',
    8: 'inclines you to research, secret communications, and investigating complex mysteries or financial documents.',
    9: 'gives an analytical interest in philosophy, law, and higher education. You love learning new languages and ideas.',
    10: 'blesses you with logical career planning, success in marketing, business, public speaking, or corporate strategy.',
    11: 'helps you build large, intellectual networks and gain through clever ideas, sales, or group collaborations.',
    12: 'gives a highly imaginative, contemplative mind. You excel in creative writing, research, or working behind the scenes.'
  },
  'Jupiter': {
    1: 'gives a wise, benevolent, and highly respected personality. You possess strong morals and general good fortune.',
    2: 'blesses you with family wealth, sweet and wise speech, and steady accumulation of capital. You are generous.',
    3: 'promotes wisdom in communication, helpful siblings, and successful writing or teaching endeavors.',
    4: 'grants domestic happiness, comfortable properties, mother blessings, and deep emotional contentment.',
    5: 'gives a highly moral and creative mind, excellent educational degrees, and deep joy through wise children.',
    6: 'helps you resolve conflicts through wisdom and mediation. You are respected by colleagues and maintain good health.',
    7: 'brings a highly moral, supportive, and wise spouse. Your partnerships are built on mutual growth and truth.',
    8: 'grants deep intuitive wisdom, inheritance gains, and deep understanding of life transformations and metaphysics.',
    9: 'bestows high luck, spiritual guidance, father blessings, and deep learning. You make an excellent teacher or guide.',
    10: 'gives a highly respected career, professional growth, ethical leadership, and honor in society.',
    11: 'brings abundant gains, wise social networks, fulfillment of goals, and support from noble friends.',
    12: 'leads to high spiritual enlightenment, charity spending, foreign opportunities, and deep inner peace.'
  },
  'Venus': {
    1: 'gives a beautiful, artistic, charming, and highly attractive personality. You love luxury, convenience, and arts.',
    2: 'blesses you with family wealth, artistic expression, sweet speech, and a taste for good food and high lifestyle.',
    3: 'makes your communication highly polite and creative. You write beautifully and enjoy short artistic travels.',
    4: 'grants a luxurious home, high-end vehicles, aesthetic surroundings, and close relationship with mother.',
    5: 'gives a highly creative, artistic, and romantic mind. You find joy in entertainment, love, and education.',
    6: 'indicates service with care. You bring peace to conflicts but should watch for kidney/sugar health issues.',
    7: 'brings a highly attractive, loving, and supportive spouse. Your marriage is characterized by aesthetic beauty and comfort.',
    8: 'leads to sudden financial gains through partners, interest in relationship secrets, and deep physical magnetism.',
    9: 'makes you find beauty in philosophy, travel, and religious places. You enjoy visiting aesthetic spiritual places.',
    10: 'gives success in careers related to design, luxury, media, fashion, entertainment, or hospitality.',
    11: 'helps you gain through female friends, social networking, design ventures, and artistic collaborations.',
    12: 'brings luxurious sleep, high expenses on travel and comforts, foreign gains, and deep spiritual love.'
  },
  'Saturn': {
    1: 'makes you mature, disciplined, serious, and highly responsible. Success comes through patience and structured hard work.',
    2: 'requires hard work and patience to build wealth. Family responsibilities are high, and your speech is serious.',
    3: 'gives immense determination, physical endurance, and focused efforts. You are careful in communication.',
    4: 'brings deep responsibility towards home and family. Domestic happiness grows over time as you mature.',
    5: 'gives a structured, logical intellect. Education requires focus, and you take parental responsibilities seriously.',
    6: 'makes you highly disciplined in daily routines, conquering debts and obstacles through patient endurance.',
    7: 'brings a mature, practical, and highly dedicated spouse. Marriage requires commitment and brings stability.',
    8: 'grants long life, interest in research, practical management of inheritance, and patient handling of transformations.',
    9: 'gives a highly traditional and disciplined approach to higher learning and spirituality. Success comes through practice.',
    10: 'bestows high career discipline, administrative success, career stability, and leadership through dedication.',
    11: 'brings a reliable, older, or professional network. Wealth is built steadily through structured investments.',
    12: 'channels energy into spiritual discipline, foreign career opportunities, and handling expenses with caution.'
  },
  'Rahu': {
    1: 'makes you highly ambitious, unique, and eager to project yourself. You think outside the box and seek recognition.',
    2: 'gives intense desires for wealth accumulation. Your speech is powerful and unconventional, seeking out modern resources.',
    3: 'bestows immense courage, technical intellect, and success in modern media, internet, and communication.',
    4: 'drives you to seek comfortable homes or properties. You may experience unconventional living arrangements.',
    5: 'gives a highly speculative, sharp, and innovative intellect. You excel in modern arts, tech, or investments.',
    6: 'makes you an aggressive problem solver who handles debts and rivals through clever, modern strategies.',
    7: 'indicates a unique, foreign, or highly ambitious spouse. Relationships are unconventional and teach vital lessons.',
    8: 'leads to sudden gains, intense transformations, and powerful interest in mysteries, research, or tax strategies.',
    9: 'makes you question traditional beliefs, seeking out foreign philosophies, unique spiritual paths, and travels.',
    10: 'brings sudden career gains, success in modern industries, tech, politics, or public relations.',
    11: 'brings gains through modern networks, international connections, and large organizations.',
    12: 'inclines you to foreign travels, active dreaming, high imagination, and interest in global or digital fields.'
  },
  'Ketu': {
    1: 'makes you highly spiritual, introspective, and detached from self-ego. You seek inner answers.',
    2: 'indicates a detached attitude towards material wealth and family pride. You speak simple truths.',
    3: 'gives an intuitive mind, quiet determination, and unique style of writing or communication.',
    4: 'suggests a detached attitude to home luxury, seeking spiritual peace and inner solace over material property.',
    5: 'gives a deep, intuitive intellect, interest in ancient scriptures, coding, or deep research studies.',
    6: 'helps you conquer rivals by ignoring them. You deal with daily chores without emotional attachment.',
    7: 'indicates a spiritually detached or independent partner. Relationships require spiritual understanding.',
    8: 'grants outstanding occult insight, psychic ability, interest in liberation, and deep research capability.',
    9: 'gives deep devotion to higher truth, interest in pilgrimages, and detachment from dogmatic systems.',
    10: 'makes you seek meaning in work beyond money. You succeed in research, spiritual paths, or independent work.',
    11: 'indicates a unique, spiritual, or quiet social network. You are indifferent to materialistic social structures.',
    12: 'is the primary placement for Moksha (spiritual liberation). You find supreme peace in meditation and isolation.'
  }
};

const DASHA_INTERPRETATIONS = {
  'Sun': 'Focuses your soul on career growth, self-recognition, leadership roles, and building confidence. It is a period to step into authority and deal with government or senior figures.',
  'Moon': 'Highlights emotional changes, domestic focus, relationship with mother, and public popularity. You seek inner comfort and mental peace during this phase.',
  'Mars': 'Brings high energy, courage, ambition, real estate activity, but also requires managing anger and direct confrontations. It is a time of action and building strength.',
  'Rahu': 'Indicates intense desires, ambition, sudden events, interest in foreign travels or modern technology, and major material growth. It requires caution to avoid over-obsession.',
  'Jupiter': 'Blesses you with learning, higher education, prosperity, spiritual focus, good advisors, and moral clarity. A highly auspicious period for family expansion and wealth.',
  'Saturn': 'Brings a phase of hard work, discipline, delays, high professional responsibilities, and structural foundations. It teaches patience and awards long-term stability.',
  'Mercury': 'Fosters analytical thinking, business communication, media/writing pursuits, transactions, and intellectual growth. Excellent phase for starting new projects.',
  'Ketu': 'Promotes spiritual detachment, introspection, interest in meditation, research, and isolation. It is a time for inner transformation and releasing worldly ego.',
  'Venus': 'Brings comfort, luxury, focus on love, marriage, aesthetic pleasures, vehicles, and creative expression. An auspicious period for material gains and relationship growth.'
};

// ===================== ASTROLOGICAL HELPERS =====================

/** Calculate if a planet is combust (Ast) */
function isCombust(name, degree, sunDegree, isRetrograde) {
  if (name === 'Sun' || name === 'Rahu' || name === 'Ketu') return false;
  let diff = Math.abs(degree - sunDegree);
  diff = Math.min(diff, 360 - diff);
  
  let limit = 0;
  if (name === 'Moon') limit = 12;
  else if (name === 'Mars') limit = 17;
  else if (name === 'Mercury') limit = isRetrograde ? 12 : 14;
  else if (name === 'Jupiter') limit = 11;
  else if (name === 'Venus') limit = isRetrograde ? 8 : 10;
  else if (name === 'Saturn') limit = 15;
  
  return diff <= limit;
}

/** Detect Rajyogas in the birth chart */
function checkYogas(planets, ascendant, houses) {
  const yogas = [];
  const getHouseOfPlanet = (pName) => {
    const p = planets.find(pl => pl.planet === pName);
    return p ? p.house : null;
  };
  
  const getPlanetInSign = (pName) => {
    const p = planets.find(pl => pl.planet === pName);
    return p ? p.sign : null;
  };

  const jupHouse = getHouseOfPlanet('Jupiter');
  const moonHouse = getHouseOfPlanet('Moon');
  
  // 1. Gaja Kesari Yoga
  if (jupHouse && moonHouse) {
    const diff = (jupHouse - moonHouse + 12) % 12;
    if ([0, 3, 6, 9].includes(diff)) {
      yogas.push({
        name: "Gaja Kesari Yoga",
        description: "Jupiter is in a Kendra (1st, 4th, 7th, or 10th house) from the Moon. This brings great wisdom, reputation, prosperity, and spiritual growth."
      });
    }
  }
  
  // 2. Pancha Mahapurusha Yogas
  const kendras = [1, 4, 7, 10];
  const checkMahapurusha = (pName, yogaName, desc) => {
    const h = getHouseOfPlanet(pName);
    if (h && kendras.includes(h)) {
      const sign = getPlanetInSign(pName);
      const dignity = getDignity(pName, sign);
      if (dignity === 'exalted' || dignity === 'in own sign') {
        yogas.push({
          name: yogaName,
          description: desc
        });
      }
    }
  };
  
  checkMahapurusha('Mars', 'Ruchaka Yoga', 'Mars is exalted or in own sign in a Kendra. Gives courage, leadership, physical strength, and administrative power.');
  checkMahapurusha('Mercury', 'Bhadra Yoga', 'Mercury is exalted or in own sign in a Kendra. Grants exceptional intelligence, business acumen, communication skills, and wealth.');
  checkMahapurusha('Jupiter', 'Hamsa Yoga', 'Jupiter is exalted or in own sign in a Kendra. Promotes wisdom, righteousness, pure character, spiritual inclination, and respect.');
  checkMahapurusha('Venus', 'Malavya Yoga', 'Venus is exalted or in own sign in a Kendra. Confers luxury, artistic talents, beauty, a happy marriage, and material comfort.');
  checkMahapurusha('Saturn', 'Sasa Yoga', 'Saturn is exalted or in own sign in a Kendra. Bestows authority, focus, long-term success, discipline, and administrative capabilities.');
  
  // 3. Kendra-Trikona Rajyogas
  const getHouseSign = (hNum) => {
    const hData = houses.find(h => h.house === hNum);
    return hData ? hData.sign : null;
  };
  
  const getHouseLord = (hNum) => {
    const sign = getHouseSign(hNum);
    return sign ? SIGN_LORDS[sign] : null;
  };
  
  const kendraLords = [...new Set([1, 4, 7, 10].map(getHouseLord).filter(Boolean))];
  const trikonaLords = [...new Set([1, 5, 9].map(getHouseLord).filter(Boolean))];
  
  kendraLords.forEach(kl => {
    trikonaLords.forEach(tl => {
      if (kl !== tl) {
        const klHouse = getHouseOfPlanet(kl);
        const tlHouse = getHouseOfPlanet(tl);
        if (klHouse && tlHouse && klHouse === tlHouse) {
          yogas.push({
            name: `Kendra-Trikona Rajyoga (${kl} & ${tl})`,
            description: `The Kendra Lord (${kl}) and Trikona Lord (${tl}) are conjoined in House ${klHouse}. This forms a powerful Rajyoga bringing professional success, status, and prosperity.`
          });
        }
      }
    });
  });

  // 4. Dharma Karmadhipati Yoga
  const lord9 = getHouseLord(9);
  const lord10 = getHouseLord(10);
  if (lord9 && lord10 && lord9 !== lord10) {
    const h9 = getHouseOfPlanet(lord9);
    const h10 = getHouseOfPlanet(lord10);
    if (h9 && h10) {
      if (h9 === h10) {
        yogas.push({
          name: "Dharma Karmadhipati Rajyoga",
          description: "The 9th lord (Dharma) and 10th lord (Karma) are conjoined in the same house. This is one of the highest Rajyogas, ensuring outstanding success, righteousness, and fame in career."
        });
      } else if (getPlanetInSign(lord9) === getHouseSign(10) && getPlanetInSign(lord10) === getHouseSign(9)) {
        yogas.push({
          name: "Dharma Karmadhipati Parivartana Rajyoga",
          description: "The 9th lord is in the 10th house and the 10th lord is in the 9th house (exchange of houses). This is an extremely auspicious combination for professional excellence and societal honor."
        });
      }
    }
  }

  // 5. Vipreet Rajyogas
  const lord6 = getHouseLord(6);
  const lord8 = getHouseLord(8);
  const lord12 = getHouseLord(12);
  const dusthanaHouses = [6, 8, 12];
  
  if (lord6 && dusthanaHouses.includes(getHouseOfPlanet(lord6))) {
    yogas.push({
      name: "Harsha Vipreet Rajyoga",
      description: "The 6th lord is placed in a Dusthana house (6th, 8th, or 12th). This gives victory over enemies, good health, financial stability, and success after initial obstacles."
    });
  }
  if (lord8 && dusthanaHouses.includes(getHouseOfPlanet(lord8))) {
    yogas.push({
      name: "Sarala Vipreet Rajyoga",
      description: "The 8th lord is placed in a Dusthana house (6th, 8th, or 12th). This grants determination, longevity, unexpected gains, success in research/investigations, and strength in adversity."
    });
  }
  if (lord12 && dusthanaHouses.includes(getHouseOfPlanet(lord12))) {
    yogas.push({
      name: "Vimala Vipreet Rajyoga",
      description: "The 12th lord is placed in a Dusthana house (6th, 8th, or 12th). This results in independent nature, spiritual inclinations, control over expenditure, and positive outcomes from foreign connections."
    });
  }

  // 6. Amala Yoga
  const isBenefic = (pName) => ['Mercury', 'Venus', 'Jupiter'].includes(pName);
  const pIn10 = planets.find(p => p.house === 10);
  if (pIn10 && isBenefic(pIn10.planet)) {
    yogas.push({
      name: "Amala Yoga",
      description: `A natural benefic planet (${pIn10.planet}) is placed in the 10th house. This grants high professional ethics, a clean reputation, steady wealth, and success in career.`
    });
  }

  // 7. Lakshmi Yoga
  const lord9Name = getHouseLord(9);
  const lord9House = getHouseOfPlanet(lord9Name);
  const lord9Sign = getPlanetInSign(lord9Name);
  if (lord9House && kendras.concat([5, 9]).includes(lord9House)) {
    const dignity = getDignity(lord9Name, lord9Sign);
    if (dignity === 'exalted' || dignity === 'in own sign') {
      yogas.push({
        name: "Lakshmi Yoga",
        description: `The 9th lord (${lord9Name}) is strong and placed in a Kendra or Trikona. This is a highly auspicious yoga that brings abundant wealth, prosperity, grace, and high learning.`
      });
    }
  }

  // 8. Saraswati Yoga
  const jupH = getHouseOfPlanet('Jupiter');
  const venH = getHouseOfPlanet('Venus');
  const merH = getHouseOfPlanet('Mercury');
  const validSaraswatiHouses = [1, 2, 4, 5, 7, 9, 10];
  if (jupH && venH && merH &&
      validSaraswatiHouses.includes(jupH) &&
      validSaraswatiHouses.includes(venH) &&
      validSaraswatiHouses.includes(merH)) {
    yogas.push({
      name: "Saraswati Yoga",
      description: "Jupiter, Venus, and Mercury occupy Kendras, Trikonas, or the 2nd house. This blesses you with great intelligence, wisdom, skills in fine arts/writing, and excellent academic success."
    });
  }

  // 9. Chandra Mangal Yoga
  const moonH = getHouseOfPlanet('Moon');
  const marsH = getHouseOfPlanet('Mars');
  if (moonH && marsH && moonH === marsH) {
    yogas.push({
      name: "Chandra Mangal Yoga",
      description: `Moon and Mars are conjoined in House ${moonH}. This is an auspicious combination for material prosperity, strong determination, and practical earning skills.`
    });
  }

  if (yogas.length === 0) {
    yogas.push({
      name: "Nabha Yogas & General Cosmic Harmony",
      description: "Your birth chart shows a balanced distribution of planetary energies that provides strength, resilience, and general progress in life through self-effort."
    });
  }
  
  return yogas;
}

/** Check major doshas in the birth chart */
function checkDoshas(planets, ascendant) {
  const doshas = [];
  
  const getHouseOfPlanet = (pName) => {
    const p = planets.find(pl => pl.planet === pName);
    return p ? p.house : null;
  };
  
  const getNakshatraOfPlanet = (pName) => {
    const p = planets.find(pl => pl.planet === pName);
    return p ? p.nakshatra : null;
  };

  // 1. Manglik Dosha
  const marsHouse = getHouseOfPlanet('Mars');
  if ([1, 4, 7, 8, 12].includes(marsHouse)) {
    doshas.push({
      name: "Manglik Dosha (Lagna Mangal)",
      type: "Severe/Moderate",
      description: "Mars is placed in House " + marsHouse + " from your Ascendant. This indicates high energy, passion, and possible challenges or arguments in marital life. Kundli matching is recommended."
    });
  } else {
    // Check from Moon
    const moonHouse = getHouseOfPlanet('Moon');
    const diff = (marsHouse - moonHouse + 12) % 12 + 1;
    if ([1, 4, 7, 8, 12].includes(diff)) {
      doshas.push({
        name: "Chandra Manglik Dosha",
        type: "Mild",
        description: "Mars is placed in House " + diff + " from your Moon sign. This is a mild Manglik influence that gives strong emotional determination but occasional relationship intensity."
      });
    }
  }

  // 2. Guru Chandal Dosha
  const jupHouse = getHouseOfPlanet('Jupiter');
  const rahuHouse = getHouseOfPlanet('Rahu');
  const ketuHouse = getHouseOfPlanet('Ketu');
  if (jupHouse && (jupHouse === rahuHouse || jupHouse === ketuHouse)) {
    doshas.push({
      name: "Guru Chandal Dosha",
      type: "Moderate",
      description: "Jupiter is conjoined with " + (jupHouse === rahuHouse ? "Rahu" : "Ketu") + " in House " + jupHouse + ". This suggests unconventional thoughts, occasional doubts in teachers/wisdom, and challenges in decision-making."
    });
  }

  // 3. Kemadruma Dosha
  const moonHouseVal = getHouseOfPlanet('Moon');
  if (moonHouseVal) {
    const houseBefore = (moonHouseVal - 1 === 0) ? 12 : moonHouseVal - 1;
    const houseAfter = (moonHouseVal + 1 === 13) ? 1 : moonHouseVal + 1;
    const ignorePlanets = ['Moon', 'Sun', 'Rahu', 'Ketu'];
    const planetsAround = planets.filter(p => !ignorePlanets.includes(p.planet) && (p.house === houseBefore || p.house === houseAfter));
    if (planetsAround.length === 0) {
      doshas.push({
        name: "Kemadruma Dosha",
        type: "Moderate",
        description: "There are no planets (excluding Sun, Rahu, Ketu) in the houses immediately preceding (House " + houseBefore + ") or succeeding (House " + houseAfter + ") your Moon. This can bring feelings of isolation, independence, and the need for self-reliance."
      });
    }
  }

  // 4. Gandmool Dosha
  const moonNak = getNakshatraOfPlanet('Moon');
  const gandmoolNaks = ['Ashwini', 'Ashlesha', 'Magha', 'Jyeshtha', 'Mula', 'Revati'];
  if (moonNak && gandmoolNaks.includes(moonNak)) {
    doshas.push({
      name: "Gandmool Dosha",
      type: "Moderate",
      description: "Your Moon is placed in " + moonNak + " Nakshatra, which is ruled by Ketu or Mercury. This indicates a highly analytical or spiritual mind, but suggests performing Gandmool Nakshatra Shanti prayers for inner peace."
    });
  }

  // 5. Kaal Sarp Dosha
  if (rahuHouse && ketuHouse) {
    const minH = Math.min(rahuHouse, ketuHouse);
    const maxH = Math.max(rahuHouse, ketuHouse);
    const others = planets.filter(p => p.planet !== 'Rahu' && p.planet !== 'Ketu');
    const inside = others.filter(p => p.house >= minH && p.house <= maxH);
    const outside = others.filter(p => p.house < minH || p.house > maxH);
    
    if (inside.length === 0 || outside.length === 0) {
      doshas.push({
        name: "Kaal Sarp Dosha",
        type: "Strong",
        description: "All major planets lie between the Rahu-Ketu axis. This forms Kaal Sarp Dosha, indicating a life of intense struggles, sudden ups and downs, and ultimate success after perseverance."
      });
    }
  }

  if (doshas.length === 0) {
    doshas.push({
      name: "No Severe Doshas",
      type: "Insignificant",
      description: "Your birth chart is clear of major structural doshas like severe Manglik or Kaal Sarp. The celestial flow is highly balanced."
    });
  }

  return doshas;
}

/** Generate custom text details for each planet based on placement */
function generatePlanetaryDetails(planets) {
  const details = [];
  planets.forEach(p => {
    const name = p.planet;
    const house = p.house || p.chalit_house;
    const sign = p.sign;
    const degree = p.degree;
    
    const templates = PLANET_HOUSE_TEMPLATES[name];
    let explanation = "";
    if (templates && templates[house]) {
      explanation = templates[house];
    } else {
      explanation = "channels its energy into House " + house + " in " + sign + ". This shapes your actions and decisions in this area of life.";
    }

    let dignityNote = "";
    if (p.exalted) dignityNote = " It is placed in its sign of Exaltation (Uchcha), which maximizes its positive energy and cosmic strength.";
    else if (p.debilitated) dignityNote = " It is placed in its sign of Debilitation (Neech), indicating an area of life where patience and effort are required to overcome challenges.";
    else if (p.retro) dignityNote = " It is currently Retrograde (Vakri), which internalizes its effects and asks you to reflect and re-evaluate its qualities.";
    
    if (p.combust) dignityNote += " Being Combust (Ast) close to the Sun, its outer attributes might be slightly subdued, asking for deeper inner strength.";
    if (p.vargottama) dignityNote += " It is Vargottama (placed in the same sign in Rashi and Navamsa), showing strong alignment, focus, and stability of its qualities.";

    details.push({
      planet: name,
      symbol: p.symbol,
      sign: sign,
      degree: degree,
      house: house,
      explanation: `${name} in House ${house} (${sign}) ${explanation}${dignityNote}`
    });
  });
  return details;
}

// ===================== MAIN ENGINE =====================

/**
 * Master function — generates a complete Kundli using
 * FreeAstroAPI for real astronomical data and chart-based predictions.
 */
async function generateFullKundli(name, gender, dob, tob, pob) {
  try {
    // Step 1: Resolve city to coordinates
    console.log(`  🌍 Resolving city: ${pob}`);
    const geo = await resolveCity(pob);
    console.log(`  ✅ Found: ${geo.name}, ${geo.country} (${geo.lat}, ${geo.lng}, ${geo.timezone})`);
    await new Promise(r => setTimeout(r, 1200)); // rate limit pause

    // Step 2: Fetch real Vedic chart, Panchang, Vargas, Dasha, and Strength (sequential)
    const chartData = await fetchVedicChart(name, gender, dob, tob, geo);
    await new Promise(r => setTimeout(r, 1200));
    const panchangData = await fetchPanchang(name, gender, dob, tob, geo);
    await new Promise(r => setTimeout(r, 1200));
    const vargasData = await fetchVargas(name, gender, dob, tob, geo);
    await new Promise(r => setTimeout(r, 1200));
    const dashaData = await fetchDasha(name, gender, dob, tob, geo);
    await new Promise(r => setTimeout(r, 1200));
    const strengthData = await fetchStrength(name, gender, dob, tob, geo);

    console.log('  ✅ All Vedic data received');

    // Step 3: Generate predictions from real chart data
    const predictions = generatePredictions(chartData, panchangData);
    console.log('  ✅ Predictions generated');

    // Step 4: Transform into the format the report page expects and attach extra data
    const result = transformToKundliData(name, gender, dob, tob, pob, geo, chartData, panchangData, predictions, vargasData.vargas, dashaData.timeline, strengthData.ashtakavarga);
    
    // Attach D1 degrees and other state properties to all vargas' planets for easy rendering
    const d1Planets = result.planets;
    for (const vKey in vargasData.vargas) {
      if (vargasData.vargas[vKey].ascendant) {
        vargasData.vargas[vKey].ascendant.degree = result.meta?.ascendant?.degree || '';
      }
      vargasData.vargas[vKey].planets.forEach(vp => {
        const d1P = d1Planets.find(p => p.planet === vp.name);
        if (d1P) {
          vp.degree = d1P.degree;
          vp.retro = d1P.retro;
        }
      });
    }

    result.vargas = vargasData.vargas;
    result.dasha = dashaData.timeline;
    result.ashtakavarga = strengthData.ashtakavarga;

    // Put Chalit chart into vargas for uniform client-side rendering
    result.vargas.chalit = result.chalit;

    return result;
  } catch (err) {
    console.warn(`⚠️ FreeAstroAPI request failed or rate limit exceeded: ${err.message}. Generating mock fallback report.`);
    return generateMockKundli(name, gender, dob, tob, pob);
  }
}

function transformToKundliData(name, gender, dob, tob, pob, geo, chart, panchang, predictions, vargas, dasha, ashtakavarga) {
  const d = new Date(dob);
  const fmtDob = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  const ascSign = chart.ascendant?.sign || 'Aries';
  const ascSymbol = SIGN_SYMBOLS[ascSign] || '♈';

  const sunPlanet = chart.planets.find(p => p.name === 'Sun');
  const sunDegree = sunPlanet ? sunPlanet.absolute_degree : 0;
  const d9Planets = vargas?.D9?.planets || [];

  // Map planets from FreeAstroAPI format to report format using Whole Sign house system
  const planets = chart.planets.map(p => {
    const dignity = getDignity(p.name, p.sign);
    const d9P = d9Planets.find(dp => dp.name === p.name);
    const isVargottama = d9P ? (d9P.sign_id === p.sign_id) : false;
    const isComb = isCombust(p.name, p.absolute_degree, sunDegree, p.is_retrograde);

    const pKey = p.name ? p.name.toLowerCase().trim() : '';
    return {
      planet: p.name,
      symbol: PLANET_SYMBOLS[pKey] || '?',
      sign: p.sign,
      degree: p.degree_in_sign.toFixed(2) + '°',
      house: (p.sign_id - chart.ascendant.sign_id + 12) % 12 + 1, // Whole sign for Rashi D1
      chalit_house: p.house, // Sripati house
      retro: p.is_retrograde,
      combust: isComb,
      vargottama: isVargottama,
      exalted: dignity === 'exalted',
      debilitated: dignity === 'debilitated',
      nakshatra: p.nakshatra,
      pada: p.pada,
    };
  });

  // Build chart houses from planet data (for Rashi D1)
  const chartHouses = {};
  const houseSigns = {};
  for (let i = 1; i <= 12; i++) {
    chartHouses[i] = [];
    houseSigns[i] = (chart.ascendant.sign_id + i - 2) % 12 + 1;
  }
  chartHouses[1].push('Asc');
  planets.forEach(p => {
    if (p.house >= 1 && p.house <= 12) {
      let symbol = p.symbol;
      if (p.retro) symbol += '*';
      chartHouses[p.house].push(symbol);
    }
  });

  // Build chalit chart houses (Sripati)
  const chalitHouses = {};
  for (let i = 1; i <= 12; i++) {
    chalitHouses[i] = [];
  }
  planets.forEach(p => {
    if (p.chalit_house >= 1 && p.chalit_house <= 12) {
      let symbol = p.symbol;
      if (p.retro) symbol += '*';
      chalitHouses[p.chalit_house].push(symbol);
    }
  });

  // Check Yogas
  const yogas = checkYogas(planets, chart.ascendant, chart.houses);

  // Check Doshas
  const doshas = checkDoshas(planets, chart.ascendant);

  // Generate Planetary details placement text
  const planetaryDetails = generatePlanetaryDetails(planets);

  // Extract Panchang values
  const rtp = panchang.request_time_panchang || {};
  const moonSign = rtp.moon_sign?.name || chart.planets.find(p => p.name === 'Moon')?.sign || 'Aries';

  // Chalit chart data payload
  const chalit = {
    ascendant: {
      sign: ascSign,
      symbol: ascSymbol,
      sign_id: chart.ascendant.sign_id
    },
    planets: planets.map(p => ({
      name: p.planet,
      sign: p.sign,
      sign_id: chart.planets.find(pl => pl.name === p.planet)?.sign_id || 1,
      degree: p.degree,
      house: p.chalit_house,
      is_retrograde: p.retro
    }))
  };

  return {
    meta: {
      name, gender, dob: fmtDob, tob, pob: `${geo.name}, ${geo.country}`,
      ascendant: {
        sign: ascSign,
        symbol: ascSymbol,
        degree: chart.ascendant.degree_in_sign,
        nakshatra: chart.ascendant?.nakshatra?.name,
        pada: chart.ascendant?.nakshatra?.pada,
      },
      moon_sign: moonSign,
    },
    panchang: {
      day: panchang.weekday?.name || 'N/A',
      tithi: `${rtp.tithi?.paksha || panchang.tithi?.paksha || ''} ${rtp.tithi?.name || panchang.tithi?.name || 'N/A'}`.trim(),
      nakshatra: `${rtp.nakshatra?.name || panchang.nakshatra?.name || 'N/A'}${rtp.nakshatra?.pada ? ` Pada ${rtp.nakshatra.pada}` : panchang.nakshatra?.pada ? ` Pada ${panchang.nakshatra.pada}` : ''}`,
      yog: rtp.yoga?.name || panchang.yoga?.name || 'N/A',
      karan: rtp.karan?.name || panchang.karanas?.[0]?.name || 'N/A',
      paksha: rtp.tithi?.paksha || panchang.tithi?.paksha || 'N/A',
      sunrise: panchang.sunrise || 'N/A',
      sunset: panchang.sunset || 'N/A',
      vikram_samvat: panchang.lunar_month?.vikram_samvat || 'N/A',
    },
    planets,
    chartHouses,
    houseSigns,
    chalitHouses,
    chalit,
    yogas,
    doshas,
    planetaryDetails,
    dashaInterpretations: DASHA_INTERPRETATIONS,
    predictions,
    monthlyPredictions: generateMonthlyPredictions(planets, chart.ascendant, moonSign, dasha, ashtakavarga),
  };
}

/**
 * Generate 12-Month Detailed Monthly Predictions based on chart data & Dasha timeline
 */
function generateMonthlyPredictions(planets, ascendant, moonSign, dashaList, ashtakavarga) {
  const months = [];
  const currentDate = new Date();

  const REMEDIES = {
    'Sun': 'Offer water (Surya Arghya) to the rising Sun daily and recite Aditya Hridaya Stotra.',
    'Moon': 'Drink water from a silver vessel, practice meditation, and donate milk or white items on Mondays.',
    'Mars': 'Recite Hanuman Chalisa on Tuesdays and offer red flowers or lentils to Lord Hanuman.',
    'Mercury': 'Feed green fodder or spinach to cows on Wednesdays and practice mindful communication.',
    'Jupiter': 'Worship Lord Vishnu on Thursdays, wear yellow, or donate chana dal to a temple.',
    'Venus': 'Honor women and family elders, offer white flowers, or pray to Goddess Lakshmi on Fridays.',
    'Saturn': 'Light a mustard oil lamp under a Peepal tree on Saturday evenings and help the needy.',
    'Rahu': 'Recite Rahu Beej Mantra, feed stray dogs, and maintain clutter-free surroundings.',
    'Ketu': 'Offer Durva grass to Lord Ganesha on Wednesdays and practice selfless service or yoga.'
  };

  const THEMES = {
    'Sun': 'Authority, Focus & Professional Recognition',
    'Moon': 'Emotional Harmony, Intuition & Family Wellbeing',
    'Mars': 'Energy, Bold Action & Ambition',
    'Mercury': 'Financial Intelligence, Business & Skill Growth',
    'Jupiter': 'Wisdom, Growth, Prosperity & Fortune',
    'Venus': 'Harmony in Relationships, Comforts & Creativity',
    'Saturn': 'Discipline, Long-Term Gains & Karmic Stability',
    'Rahu': 'Expansion, New Opportunities & Strategic Innovation',
    'Ketu': 'Spiritual Clarity, Intuition & Inner Strengths'
  };

  function findDashaForDate(date) {
    if (!dashaList || !Array.isArray(dashaList) || dashaList.length === 0) {
      return { md: 'Jupiter', ad: 'Venus' };
    }
    const timestamp = date.getTime();
    for (const md of dashaList) {
      const mdStart = new Date(md.start).getTime();
      const mdEnd = new Date(md.end).getTime();
      if (timestamp >= mdStart && timestamp <= mdEnd) {
        let activeAd = md.sub_periods?.[0]?.lord || md.lord;
        if (md.sub_periods && Array.isArray(md.sub_periods)) {
          for (const ad of md.sub_periods) {
            const adStart = new Date(ad.start).getTime();
            const adEnd = new Date(ad.end).getTime();
            if (timestamp >= adStart && timestamp <= adEnd) {
              activeAd = ad.lord;
              break;
            }
          }
        }
        return { md: md.lord, ad: activeAd };
      }
    }
    return { md: dashaList[0]?.lord || 'Jupiter', ad: dashaList[0]?.sub_periods?.[0]?.lord || 'Venus' };
  }

  function getPlanet(name) {
    return (planets || []).find(p => (p.planet || p.name) === name) || {};
  }

  for (let i = 0; i < 12; i++) {
    const targetDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + i, 1);
    const monthName = targetDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const shortMonth = targetDate.toLocaleDateString('en-US', { month: 'short' });
    
    const dashaInfo = findDashaForDate(targetDate);
    const mdLord = dashaInfo.md;
    const adLord = dashaInfo.ad;
    
    const adPlanet = getPlanet(adLord);
    const houseNum = adPlanet.house || adPlanet.chalit_house || 1;
    const isBenefic = ['Jupiter', 'Venus', 'Mercury', 'Moon'].includes(adLord);
    const isExalted = adPlanet.exalted;
    const isOwn = isOwnSign(adLord, adPlanet.sign);

    let baseScore = isBenefic ? 82 : 72;
    if (isExalted) baseScore += 8;
    if (isOwn) baseScore += 5;
    if (adPlanet.retro) baseScore -= 3;
    if ([1, 5, 9, 10, 11].includes(houseNum)) baseScore += 5;
    const luckScore = Math.min(96, Math.max(65, baseScore));

    const themeTitle = THEMES[adLord] || `${adLord} Influence & Growth`;

    // 1. Career & Business
    let career = `During ${monthName}, under the ${mdLord}-${adLord} Dasha period, your professional focus will be heavily guided by ${adLord} (placed in House ${houseNum} in ${adPlanet.sign || 'your chart'}). `;
    if ([10, 11, 1, 9].includes(houseNum)) {
      career += `Career growth, recognition from leadership, and new financial expansion opportunities are strongly favored. Stay proactive with key initiatives.`;
    } else if ([6, 8, 12].includes(houseNum)) {
      career += `Workplace responsibilities may demand extra discipline. Focus on meticulous execution, avoiding office politics, and building long-term strategies.`;
    } else {
      career += `Expect steady progress in daily operations. Collaborating with reliable peers will yield positive outcomes and steady financial returns.`;
    }

    // 2. Love & Relationships
    let love = `In emotional life and relationships, ${adLord}'s energy brings `;
    if (['Venus', 'Moon', 'Jupiter'].includes(adLord)) {
      love += `warmth, mutual understanding, and pleasant family moments. Excellent period for harmony, resolving past misunderstandings, and shared happiness.`;
    } else if (['Mars', 'Saturn', 'Rahu'].includes(adLord)) {
      love += `a requirement for emotional patience. Practice open communication with family and partners to prevent temporary friction.`;
    } else {
      love += `intellectual closeness and shared goals. Planning outings or engaging in creative discussions together will strengthen bonds.`;
    }

    // 3. Health & Vitality
    let health = `Physical vitality and immunity will be `;
    if (luckScore >= 80) {
      health += `strong and vibrant throughout ${shortMonth}. Maintain balanced nutrition and daily exercise to keep energy high.`;
    } else {
      health += `moderate. Pay attention to work-life balance and rest. Practicing meditation, pranayama, and staying well-hydrated will ensure optimum wellness.`;
    }

    // 4. Monthly Remedy & Focus
    const remedy = REMEDIES[adLord] || `Offer prayers to your Ishta Devata and practice acts of charity on weekends.`;
    const tip = `Pro-Tip for ${shortMonth}: Channel ${adLord}'s natural strengths—focus on consistency and aligned strategic decisions.`;

    months.push({
      monthNumber: i + 1,
      monthName,
      shortMonth,
      year: targetDate.getFullYear(),
      activeDasha: `${mdLord} - ${adLord}`,
      mdLord,
      adLord,
      luckScore,
      themeTitle,
      career,
      love,
      health,
      remedy,
      tip
    });
  }

  return months;
}

function generateMockKundli(name, gender, dob, tob, pob) {
  const mockPlanets = [
    { name: 'Sun', planet: 'Sun', symbol: 'Su', sign: 'Aries', degree: '24°12\'', house: 10, exalted: true, debilitated: false, retro: false, combust: false, vargottama: true },
    { name: 'Moon', planet: 'Moon', symbol: 'Mo', sign: 'Taurus', degree: '12°34\'', house: 11, exalted: true, debilitated: false, retro: false, combust: false, vargottama: false },
    { name: 'Mars', planet: 'Mars', symbol: 'Ma', sign: 'Aries', degree: '18°45\'', house: 10, exalted: false, debilitated: false, retro: false, combust: false, vargottama: true },
    { name: 'Mercury', planet: 'Mercury', symbol: 'Me', sign: 'Pisces', degree: '05°18\'', house: 9, exalted: false, debilitated: true, retro: true, combust: true, vargottama: false },
    { name: 'Jupiter', planet: 'Jupiter', symbol: 'Ju', sign: 'Leo', degree: '15°29\'', house: 2, exalted: false, debilitated: false, retro: false, combust: false, vargottama: false },
    { name: 'Venus', planet: 'Venus', symbol: 'Ve', sign: 'Gemini', degree: '22°08\'', house: 12, exalted: false, debilitated: false, retro: false, combust: false, vargottama: false },
    { name: 'Saturn', planet: 'Saturn', symbol: 'Sa', sign: 'Aquarius', degree: '14°50\'', house: 8, exalted: false, debilitated: false, retro: true, combust: false, vargottama: false },
    { name: 'Rahu', planet: 'Rahu', symbol: 'Ra', sign: 'Libra', degree: '08°12\'', house: 4, exalted: false, debilitated: false, retro: false, combust: false, vargottama: false },
    { name: 'Ketu', planet: 'Ketu', symbol: 'Ke', sign: 'Aries', degree: '08°12\'', house: 10, exalted: false, debilitated: false, retro: false, combust: false, vargottama: false }
  ];

  const mockVargas = {
    D1: { ascendant: { sign: 'Cancer', sign_id: 4, symbol: '♋' }, planets: mockPlanets },
    chalit: { ascendant: { sign: 'Cancer', sign_id: 4, symbol: '♋' }, planets: mockPlanets.map(p => ({ ...p, house: p.house })) },
    D9: { ascendant: { sign: 'Virgo', sign_id: 6, symbol: '♍' }, planets: mockPlanets.map(p => ({ ...p, sign_id: 6 })) }
  };
  const divisions = [2, 3, 4, 7, 10, 12, 16, 20, 24, 27, 30, 40, 45, 60];
  divisions.forEach(d => {
    mockVargas['D' + d] = { ascendant: { sign: 'Cancer', sign_id: 4, symbol: '♋' }, planets: mockPlanets };
  });

  const ashtakavarga = {
    bhinnashtakavarga: {
      Sun: [5, 4, 3, 5, 4, 6, 2, 4, 5, 3, 4, 3],
      Moon: [4, 5, 4, 3, 6, 4, 5, 3, 4, 5, 3, 3],
      Mars: [3, 4, 2, 5, 4, 3, 6, 2, 4, 5, 3, 2],
      Mercury: [5, 4, 6, 3, 5, 4, 3, 6, 4, 5, 4, 3],
      Jupiter: [6, 5, 4, 3, 5, 6, 4, 5, 4, 3, 5, 4],
      Venus: [4, 5, 3, 6, 4, 5, 3, 4, 6, 5, 3, 4],
      Saturn: [3, 2, 4, 3, 5, 2, 4, 3, 5, 2, 4, 3]
    },
    sarvashtakavarga: [30, 29, 26, 31, 33, 30, 27, 25, 32, 28, 26, 22]
  };

  const dasha = [
    {
      lord: 'Sun', start: '2020-05-15T00:00:00Z', end: '2026-05-15T00:00:00Z',
      sub_periods: [
        { lord: 'Sun', start: '2020-05-15T00:00:00Z', end: '2020-09-01T00:00:00Z' },
        { lord: 'Moon', start: '2020-09-01T00:00:00Z', end: '2021-03-01T00:00:00Z' },
        { lord: 'Mars', start: '2021-03-01T00:00:00Z', end: '2021-07-07T00:00:00Z' },
        { lord: 'Rahu', start: '2021-07-07T00:00:00Z', end: '2022-06-01T00:00:00Z' },
        { lord: 'Jupiter', start: '2022-06-01T00:00:00Z', end: '2023-03-18T00:00:00Z' },
        { lord: 'Saturn', start: '2023-03-18T00:00:00Z', end: '2024-03-01T00:00:00Z' },
        { lord: 'Mercury', start: '2024-03-01T00:00:00Z', end: '2025-01-06T00:00:00Z' },
        { lord: 'Ketu', start: '2025-01-06T00:00:00Z', end: '2025-05-15T00:00:00Z' },
        { lord: 'Venus', start: '2025-05-15T00:00:00Z', end: '2026-05-15T00:00:00Z' }
      ]
    },
    {
      lord: 'Moon', start: '2026-05-15T00:00:00Z', end: '2036-05-15T00:00:00Z',
      sub_periods: [
        { lord: 'Moon', start: '2026-05-15T00:00:00Z', end: '2027-03-15T00:00:00Z' },
        { lord: 'Mars', start: '2027-03-15T00:00:00Z', end: '2027-10-15T00:00:00Z' },
        { lord: 'Rahu', start: '2027-10-15T00:00:00Z', end: '2029-04-15T00:00:00Z' },
        { lord: 'Jupiter', start: '2029-04-15T00:00:00Z', end: '2030-08-15T00:00:00Z' },
        { lord: 'Saturn', start: '2030-08-15T00:00:00Z', end: '2032-03-15T00:00:00Z' },
        { lord: 'Mercury', start: '2032-03-15T00:00:00Z', end: '2033-08-15T00:00:00Z' },
        { lord: 'Ketu', start: '2033-08-15T00:00:00Z', end: '2034-03-15T00:00:00Z' },
        { lord: 'Venus', start: '2034-03-15T00:00:00Z', end: '2035-11-15T00:00:00Z' },
        { lord: 'Sun', start: '2035-11-15T00:00:00Z', end: '2036-05-15T00:00:00Z' }
      ]
    }
  ];

  const remainingLords = ['Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury', 'Ketu', 'Venus'];
  let currentStartYear = 2036;
  const dashaYears = { 'Mars': 7, 'Rahu': 18, 'Jupiter': 16, 'Saturn': 19, 'Mercury': 17, 'Ketu': 7, 'Venus': 20 };
  remainingLords.forEach(lord => {
    const years = dashaYears[lord];
    const endYear = currentStartYear + years;
    dasha.push({
      lord: lord,
      start: `${currentStartYear}-05-15T00:00:00Z`,
      end: `${endYear}-05-15T00:00:00Z`,
      sub_periods: []
    });
    currentStartYear = endYear;
  });

  const predictions = {
    nature: `With Cancer Ascendant, you possess a highly intuitive, nurturing, and sensitive nature. Your Moon sign is Taurus, which adds stability, determination, and a strong appreciation for beauty and comfort to your emotional core. The Sun's placement in Aries makes you ambitious and self-reliant.`,
    career: `Aries Sun and Mars conjoined in the 10th house grant extraordinary career drive, leadership capabilities, and authority. You are destined to excel in roles requiring decision-making and executive initiative.`,
    love: `Venus in Gemini in the 12th house suggests a deeply romantic, idealistic approach to love. Open and clear communication will resolve any relationship challenges.`,
    health: `Your health outlook is strong, though retrograde Saturn in the 8th house suggests practicing regular yoga, staying active, and maintaining a balanced sleep schedule.`
  };

  const formattedResult = {
    meta: {
      name, gender, dob: new Date(dob).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }), tob, pob,
      ascendant: { sign: 'Cancer', sign_id: 4, symbol: '♋' },
      moon_sign: 'Taurus'
    },
    panchang: {
      day: 'Monday',
      tithi: 'Shukla Dwadashi',
      nakshatra: 'Rohini',
      yog: 'Harshana',
      karan: 'Bava',
      paksha: 'Shukla Paksha',
      sunrise: '05:42 AM',
      sunset: '07:05 PM',
      vikram_samvat: '2083'
    },
    planets: mockPlanets,
    vargas: mockVargas,
    ashtakavarga,
    dasha,
    predictions
  };

  const mockHouses = [];
  const signsList = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
  const ascSignId = 4; // Cancer
  for (let h = 1; h <= 12; h++) {
    const signId = (ascSignId + h - 2) % 12 + 1;
    mockHouses.push({
      house: h,
      sign: signsList[signId - 1],
      sign_id: signId
    });
  }

  formattedResult.yogas = checkYogas(mockPlanets, formattedResult.meta.ascendant, mockHouses);
  formattedResult.doshas = checkDoshas(mockPlanets, formattedResult.meta.ascendant);
  formattedResult.planetaryDetails = generatePlanetaryDetails(mockPlanets);
  formattedResult.dashaInterpretations = DASHA_INTERPRETATIONS;
  formattedResult.monthlyPredictions = generateMonthlyPredictions(mockPlanets, formattedResult.meta.ascendant, formattedResult.meta.moon_sign, dasha, ashtakavarga);

  return formattedResult;
}

module.exports = { generateFullKundli };

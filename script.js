/**
 * script.js — AstroKundli App Logic (Enhanced)
 * ------------------------------------------------------------------
 * Sections:
 *   1.  Star Canvas Animation
 *   2.  Navigation
 *   3.  Coin Wallet
 *   4.  Daily Check-in
 *   5.  Onboarding Modal
 *   6.  AdMob Rewarded Ad Bridge
 *   7.  Kundli Form & City Autocomplete
 *   8.  Generate Kundli Flow (SPA report rendering)
 *   9.  Kundli History (localStorage)
 *   10. In-App Report Screen
 *   11. Daily Horoscope Screen
 *   12. Kundli Compatibility Screen
 *   13. AI Chat
 *   14. Daily Cosmic Insight (home)
 *   15. Share / Refer Features
 *   16. Zodiac Sign Detection
 *   17. UI Helpers
 *   18. Init
 * ------------------------------------------------------------------
 */

const KUNDLI_COST   = 10;
const COMPAT_COST   = 15;
const CHAT_COST     = 1;
const COINS_API     = 'coins.php';
const REPORT_PAGE   = 'kundli-report.php';
const STARTER_COINS = 20;
const DAILY_CHECKIN_COINS = 5;

/* ===================== 1. STAR CANVAS ===================== */

function initStarCanvas() {
  const canvas = document.getElementById('starCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  const stars = Array.from({ length: 140 }, () => ({
    x:     Math.random() * window.innerWidth,
    y:     Math.random() * window.innerHeight,
    r:     Math.random() * 1.4 + 0.3,
    alpha: Math.random(),
    speed: Math.random() * 0.006 + 0.002,
    dir:   Math.random() > 0.5 ? 1 : -1,
  }));

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    stars.forEach(s => {
      s.alpha += s.speed * s.dir;
      if (s.alpha >= 1 || s.alpha <= 0.08) s.dir *= -1;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      const isLightTheme = document.body.classList.contains('light-theme');
      ctx.fillStyle = isLightTheme ? `rgba(122,75,255,${(s.alpha * 0.35).toFixed(2)})` : `rgba(255,255,255,${s.alpha.toFixed(2)})`;
      ctx.fill();
    });
    requestAnimationFrame(draw);
  }
  draw();
}

initStarCanvas();

/* ===================== 2. NAVIGATION ===================== */

const screens  = document.querySelectorAll('.screen');
const navItems = document.querySelectorAll('.nav-item');

function goToScreen(name) {
  screens.forEach(s  => s.classList.toggle('active', s.id === `screen-${name}`));
  navItems.forEach(n => n.classList.toggle('active', n.dataset.go === name));
  window.scrollTo({ top: 0, behavior: 'instant' });

  if (name === 'chat')      initChatScreen();
  if (name === 'reports')   loadReportsScreen();
  if (name === 'horoscope') initHoroscopeScreen();
  if (name === 'earn')      checkDailyCheckin();
}

// Wire all [data-go] elements
document.querySelectorAll('[data-go]').forEach(el => {
  el.addEventListener('click', (e) => {
    e.preventDefault();
    goToScreen(el.dataset.go);
  });
});

document.getElementById('homeGenerateBtn').addEventListener('click', () => goToScreen('generate'));

/* ===================== 3. FIREBASE AUTH & WALLET ===================== */

let walletState = { coins: 0, ads_watched: 0, kundlis_generated: 0 };
let currentUser = null;

// Listen to Auth State
if (typeof auth !== 'undefined') {
  auth.onAuthStateChanged(async (user) => {
    const mainApp = document.getElementById('mainApp');
    const authScreen = document.getElementById('screen-auth');
    if (user) {
      currentUser = user;
      authScreen.style.display = 'none';
      mainApp.style.display = 'block';
      await fetchWallet();
      
      // Update profile name
      const profileName = document.getElementById('profileName');
      const avatarInit = document.getElementById('avatarInitial');
      if (profileName) profileName.textContent = user.displayName || user.email || 'Astro User';
      if (avatarInit) avatarInit.textContent = (user.displayName || user.email || 'A')[0].toUpperCase();
    } else {
      currentUser = null;
      authScreen.style.display = 'flex';
      mainApp.style.display = 'none';
    }
  });
}

// Auth UI logic
const tabSignIn = document.getElementById('tabSignIn');
const tabSignUp = document.getElementById('tabSignUp');
const authSubmitBtn = document.getElementById('authSubmitBtn');
let isSignUpMode = false;

if (tabSignIn && tabSignUp) {
  tabSignIn.addEventListener('click', () => {
    isSignUpMode = false;
    tabSignIn.classList.add('active'); tabSignUp.classList.remove('active');
    authSubmitBtn.textContent = 'Sign In';
  });
  tabSignUp.addEventListener('click', () => {
    isSignUpMode = true;
    tabSignUp.classList.add('active'); tabSignIn.classList.remove('active');
    authSubmitBtn.textContent = 'Create Account';
  });
}

document.getElementById('authForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (typeof auth === 'undefined') return alert('Firebase is not configured yet! Please update firebase-config.js');
  const email = document.getElementById('authEmail').value;
  const pass = document.getElementById('authPassword').value;
  try {
    if (isSignUpMode) await auth.createUserWithEmailAndPassword(email, pass);
    else await auth.signInWithEmailAndPassword(email, pass);
  } catch (err) {
    alert(err.message);
  }
});

document.getElementById('googleSignInBtn')?.addEventListener('click', async () => {
  if (typeof auth === 'undefined') return alert('Firebase is not configured yet! Please update firebase-config.js');
  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    await auth.signInWithPopup(provider);
  } catch (err) {
    alert(err.message);
  }
});

document.getElementById('continueGuestBtn')?.addEventListener('click', async () => {
  if (typeof auth === 'undefined') {
    // Fallback if no firebase: just show the app
    document.getElementById('mainApp').style.display = 'block';
    document.getElementById('screen-auth').style.display = 'none';
    await fetchWallet();
    return;
  }
  try {
    await auth.signInAnonymously();
  } catch (err) {
    alert(err.message);
  }
});

// Logout handler (add to profile screen)
document.getElementById('resetWalletBtn')?.addEventListener('click', async () => {
  if (confirm("Do you want to log out?")) {
    await auth.signOut();
    goToScreen('home');
  }
});


function getGuestWallet() {
  const local = localStorage.getItem('astro_guest_wallet');
  if (local) {
    try {
      return JSON.parse(local);
    } catch (e) {
      console.error("Error parsing guest wallet:", e);
    }
  }
  const initGuest = { coins: 20, ads_watched: 0, kundlis_generated: 0, onboarded: false };
  localStorage.setItem('astro_guest_wallet', JSON.stringify(initGuest));
  return initGuest;
}

function saveGuestWallet(data) {
  localStorage.setItem('astro_guest_wallet', JSON.stringify(data));
}

async function fetchWallet() {
  if (!currentUser) {
    const data = getGuestWallet();
    updateWalletUI(data);
    return;
  }
  try {
    const data = await getUserProfile(currentUser.uid);
    updateWalletUI(data);
  } catch (e) {
    console.error("Wallet fetch error:", e);
  }
}

function animateCoinCount(from, to, element) {
  const duration = 600;
  const start = performance.now();
  function step(now) {
    const elapsed  = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased    = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    element.textContent = Math.round(from + (to - from) * eased);
    if (progress < 1) requestAnimationFrame(step);
    else element.textContent = to;
  }
  requestAnimationFrame(step);
}

function updateWalletUI(data) {
  const prevCoins   = walletState.coins ?? 0;
  walletState       = { ...walletState, ...data };
  const coinCountEl = document.getElementById('coinCount');

  if (data.coins !== prevCoins && prevCoins !== undefined) {
    animateCoinCount(prevCoins, data.coins, coinCountEl);
  } else {
    coinCountEl.textContent = data.coins;
  }

  const bigCoin = document.getElementById('bigCoinCount');
  if (bigCoin) bigCoin.textContent = data.coins;
  const sc = document.getElementById('statCoins');
  if (sc) sc.textContent = data.coins;
  const sa = document.getElementById('statAds');
  if (sa) sa.textContent = data.ads_watched;
  const sr = document.getElementById('statReports');
  if (sr) sr.textContent = data.kundlis_generated;

  updateHeroZodiac();
}

async function walletAction(action) {
  if (!currentUser) {
    const data = getGuestWallet();
    if (action === 'earn') {
      data.coins += 10;
      data.ads_watched += 1;
    }
    if (action === 'spend') {
      if (data.coins < KUNDLI_COST) return { success: false, ...data };
      data.coins -= KUNDLI_COST;
    }
    if (action === 'spend_chat') {
      if (data.coins < CHAT_COST) return { success: false, ...data };
      data.coins -= CHAT_COST;
    }
    if (action === 'refund_chat') {
      data.coins += CHAT_COST;
    }
    data.success = true;
    saveGuestWallet(data);
    updateWalletUI(data);
    return data;
  }
  let currentProfile = await getUserProfile(currentUser.uid);
  
  if (action === 'earn') {
    await adjustCoins(currentUser.uid, 10);
    await updateUserProfile(currentUser.uid, { ads_watched: firebase.firestore.FieldValue.increment(1) });
    currentProfile.coins += 10;
  }
  if (action === 'spend') {
    if (currentProfile.coins < KUNDLI_COST) return { success: false, ...currentProfile };
    await adjustCoins(currentUser.uid, -KUNDLI_COST);
    currentProfile.coins -= KUNDLI_COST;
  }
  if (action === 'spend_chat') {
    if (currentProfile.coins < CHAT_COST) return { success: false, ...currentProfile };
    await adjustCoins(currentUser.uid, -CHAT_COST);
    currentProfile.coins -= CHAT_COST;
  }
  if (action === 'refund_chat') {
    await adjustCoins(currentUser.uid, CHAT_COST);
    currentProfile.coins += CHAT_COST;
  }
  
  currentProfile.success = true;
  updateWalletUI(currentProfile);
  return currentProfile;
}

async function spendCoins(amount) {
  if (!currentUser) {
    const data = getGuestWallet();
    if (data.coins < amount) return { success: false };
    data.coins -= amount;
    data.success = true;
    saveGuestWallet(data);
    updateWalletUI(data);
    return data;
  }
  let currentProfile = await getUserProfile(currentUser.uid);
  if (currentProfile.coins < amount) return { success: false };
  
  await adjustCoins(currentUser.uid, -amount);
  currentProfile.coins -= amount;
  currentProfile.success = true;
  updateWalletUI(currentProfile);
  return currentProfile;
}

/* ===================== 4. DAILY CHECK-IN ===================== */

function checkDailyCheckin() {
  const today        = new Date().toDateString();
  const lastCheckin  = walletState.lastCheckin;
  const subtextEl    = document.getElementById('checkinSubtext');
  const rewardEl     = document.getElementById('checkinReward');
  if (!subtextEl || !rewardEl) return;

  if (lastCheckin === today) {
    subtextEl.textContent   = '✅ Already claimed today — come back tomorrow!';
    rewardEl.textContent    = 'Done';
    rewardEl.style.opacity  = '0.4';
  } else {
    subtextEl.textContent   = 'Open the app every day';
    rewardEl.textContent    = `+${DAILY_CHECKIN_COINS} 🪙`;
    rewardEl.style.opacity  = '1';
  }
}

async function performDailyCheckin() {
  const today       = new Date().toDateString();
  const lastCheckin = walletState.lastCheckin;
  if (lastCheckin === today) { showToast('Daily check-in already claimed today! 🌟'); return; }

  if (currentUser) {
    await adjustCoins(currentUser.uid, DAILY_CHECKIN_COINS);
    await updateUserProfile(currentUser.uid, { lastCheckin: today });
    walletState.coins += DAILY_CHECKIN_COINS;
    walletState.lastCheckin = today;
    updateWalletUI(walletState);
  } else {
    const data = getGuestWallet();
    data.coins += DAILY_CHECKIN_COINS;
    data.lastCheckin = today;
    saveGuestWallet(data);
    updateWalletUI(data);
  }
  checkDailyCheckin();
  showToast(`🎉 Daily check-in! +${DAILY_CHECKIN_COINS} coins added!`);
}

async function autoCheckin() {
  const today = new Date().toDateString();
  if (currentUser) {
    const currentProfile = await getUserProfile(currentUser.uid);
    if (currentProfile.lastCheckin === today) return;

    await adjustCoins(currentUser.uid, DAILY_CHECKIN_COINS);
    await updateUserProfile(currentUser.uid, { lastCheckin: today });
    walletState.coins = currentProfile.coins + DAILY_CHECKIN_COINS;
    walletState.lastCheckin = today;
    updateWalletUI(walletState);
  } else {
    const data = getGuestWallet();
    if (data.lastCheckin === today) return;

    data.coins += DAILY_CHECKIN_COINS;
    data.lastCheckin = today;
    saveGuestWallet(data);
    updateWalletUI(data);
  }
  setTimeout(() => showToast(`🌟 Daily check-in bonus! +${DAILY_CHECKIN_COINS} coins!`), 2200);
}

document.getElementById('dailyCheckinRow')?.addEventListener('click', performDailyCheckin);

/* ===================== 5. ONBOARDING MODAL ===================== */

async function checkOnboarding() {
  let onboarded = false;
  if (currentUser) {
    const currentProfile = await getUserProfile(currentUser.uid);
    onboarded = currentProfile ? currentProfile.onboarded : false;
  } else {
    const data = getGuestWallet();
    onboarded = data.onboarded;
  }
  if (onboarded) return;

  setTimeout(() => {
    document.getElementById('onboardingModal').classList.add('show');
  }, 900);
}

document.getElementById('onboardingCloseBtn')?.addEventListener('click', async () => {
  document.getElementById('onboardingModal').classList.remove('show');
  if (currentUser) {
    await updateUserProfile(currentUser.uid, { onboarded: true });
  } else {
    const data = getGuestWallet();
    data.onboarded = true;
    saveGuestWallet(data);
    updateWalletUI(data);
  }
  showToast('🎁 Free starter coins added to your wallet!');
});

/* ===================== 6. ADMOB REWARDED AD BRIDGE ===================== */

function requestRewardedAd() {
  if (window.AndroidAd && typeof window.AndroidAd.showRewardedAd === 'function') {
    showLoader('Loading ad...');
    window.AndroidAd.showRewardedAd();
  } else {
    simulateAdPlayback();
  }
}

function simulateAdPlayback() {
  showLoader('Playing ad... 30s');
  let secondsLeft = 30;
  const fastDevMode = true; // set false for real 30s
  const tickMs = fastDevMode ? 100 : 1000;

  const timer = setInterval(() => {
    secondsLeft -= 1;
    document.getElementById('loaderText').textContent = `Playing ad... ${secondsLeft}s`;
    if (secondsLeft <= 0) { clearInterval(timer); onRewardedAdComplete(); }
  }, tickMs);
}

window.onRewardedAdComplete = async function () {
  hideLoader();
  const result = await walletAction('earn');
  showToast(`🎉 You earned 10 coins! Balance: ${result.coins}`);
  closeInsufficientModal();
};

window.onRewardedAdFailed = function () {
  hideLoader();
  showToast('Ad could not be loaded. Please try again.');
};

document.getElementById('watchAdBtn').addEventListener('click', requestRewardedAd);
document.getElementById('modalWatchAdBtn').addEventListener('click', requestRewardedAd);

/* ===================== 7. KUNDLI FORM & CITY AUTOCOMPLETE ===================== */

// Fix hardcoded date max
const todayISO = new Date().toISOString().split('T')[0];
const dobInputEl = document.getElementById('dobInput');
if (dobInputEl) dobInputEl.setAttribute('max', todayISO);
document.querySelectorAll('.compatDobInput').forEach(el => el.setAttribute('max', todayISO));

const kundliForm  = document.getElementById('kundliForm');
const genderRow   = document.getElementById('genderRow');
const genderInput = document.getElementById('genderInput');

genderRow.querySelectorAll('.gender-opt').forEach(opt => {
  opt.addEventListener('click', () => {
    genderRow.querySelectorAll('.gender-opt').forEach(o => o.classList.remove('active'));
    opt.classList.add('active');
    genderInput.value = opt.dataset.val;
    clearFieldError('field-gender');
  });
});

function showFieldError(fieldId) { document.getElementById(fieldId)?.classList.add('invalid'); }
function clearFieldError(fieldId) { document.getElementById(fieldId)?.classList.remove('invalid'); }

function validateKundliForm(formData) {
  let valid = true;
  [
    ['field-name',   formData.get('full_name')?.trim()],
    ['field-gender', formData.get('gender')],
    ['field-dob',    formData.get('dob')],
    ['field-tob',    formData.get('tob')],
    ['field-pob',    formData.get('pob')?.trim()],
  ].forEach(([id, val]) => {
    if (!val) { showFieldError(id); valid = false; }
    else clearFieldError(id);
  });
  const dob = formData.get('dob');
  if (dob && new Date(dob) > new Date()) { showFieldError('field-dob'); valid = false; }
  return valid;
}

// City Autocomplete
let acTimeout  = null;
const pobInput   = document.getElementById('pobInput');
const pobDropdown = document.getElementById('pobDropdown');

pobInput.addEventListener('input', () => {
  const q = pobInput.value.trim();
  clearTimeout(acTimeout);
  if (q.length < 2) { pobDropdown.innerHTML = ''; pobDropdown.classList.remove('open'); return; }
  acTimeout = setTimeout(() => fetchCitySuggestions(q), 320);
});

pobInput.addEventListener('blur', () => {
  setTimeout(() => { pobDropdown.innerHTML = ''; pobDropdown.classList.remove('open'); }, 220);
});

async function fetchCitySuggestions(q) {
  try {
    const res  = await fetch(`/api/city-search?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    renderCityDropdown(data.results || []);
  } catch (e) {
    pobDropdown.innerHTML = ''; pobDropdown.classList.remove('open');
  }
}

function renderCityDropdown(results) {
  if (!results.length) { pobDropdown.innerHTML = ''; pobDropdown.classList.remove('open'); return; }
  pobDropdown.innerHTML = results.slice(0, 6).map(r =>
    `<div class="autocomplete-item" data-name="${escHtml(r.name)}, ${escHtml(r.country)}">📍 ${escHtml(r.name)}, ${escHtml(r.country)}</div>`
  ).join('');
  pobDropdown.classList.add('open');
  pobDropdown.querySelectorAll('.autocomplete-item').forEach(item => {
    item.addEventListener('mousedown', () => {
      pobInput.value = item.dataset.name;
      pobDropdown.innerHTML = ''; pobDropdown.classList.remove('open');
      clearFieldError('field-pob');
    });
  });
}

/* ===================== 8. GENERATE KUNDLI FLOW ===================== */

kundliForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData(kundliForm);

  if (!validateKundliForm(formData)) { showToast('Please fill all fields correctly'); return; }

  showLoader('Generating your Kundli...');

  try {
    const res = await fetch(REPORT_PAGE, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    new URLSearchParams(formData).toString(),
    });
    if (!res.ok) throw new Error('Report generation failed');
    const html = await res.text();
    hideLoader();

    // SPA: render in-app instead of document.write()
    renderInAppReport(html, {
      name:   formData.get('full_name'),
      gender: formData.get('gender'),
      dob:    formData.get('dob'),
      tob:    formData.get('tob'),
      pob:    formData.get('pob'),
    });

  } catch (err) {
    hideLoader();
    showToast('Something went wrong. Please try again.');
  }
});

/* ===================== 9. KUNDLI HISTORY ===================== */

async function saveKundliToHistory(meta) {
  const entry = {
    name:      meta.name,
    gender:    meta.gender,
    dob:       meta.dob,
    tob:       meta.tob,
    pob:       meta.pob,
    moonSign:  walletState.lastKundli?.moonSign  || '',
    ascendant: walletState.lastKundli?.ascendant || '',
    savedAt:   new Date().toISOString()
  };
  if (currentUser) {
    await saveKundliFirestore(currentUser.uid, entry);
    await incrementKundliCount(currentUser.uid);
    await updateUserProfile(currentUser.uid, { lastKundli: walletState.lastKundli });
  } else {
    const data = getGuestWallet();
    data.kundlis_generated += 1;
    data.lastKundli = walletState.lastKundli;
    saveGuestWallet(data);
    updateWalletUI(data);

    // Save in guest history array
    const history = JSON.parse(localStorage.getItem('astro_guest_history') || '[]');
    history.unshift(entry);
    localStorage.setItem('astro_guest_history', JSON.stringify(history.slice(0, 20)));
  }
}

async function loadReportsScreen() {
  const container = document.getElementById('reportsList');
  if (!container) return;
  
  let history = [];
  if (currentUser) {
    history = await loadKundliHistoryFirestore(currentUser.uid);
  } else {
    history = JSON.parse(localStorage.getItem('astro_guest_history') || '[]');
  }

  if (history.length === 0) {
    container.innerHTML = `
      <div style="text-align:center;padding:40px 20px;color:var(--text-muted);">
        <div style="font-size:48px;margin-bottom:12px;">📜</div>
        <p>No Kundli reports yet.<br>Generate your first one!</p>
        <button class="btn btn-gold" style="margin-top:16px;" onclick="goToScreen('generate')">Generate Kundli</button>
      </div>`;
    return;
  }

  container.innerHTML = history.map(entry => `
    <div class="report-history-card">
      <div class="rhc-avatar">${entry.name.charAt(0).toUpperCase()}</div>
      <div class="rhc-info">
        <div class="rhc-name">${escHtml(entry.name)}</div>
        <div class="rhc-meta">${entry.dob} · ${escHtml(entry.pob)}</div>
        ${entry.moonSign ? `<div class="rhc-signs">🌙 ${escHtml(entry.moonSign)} · ⬆ ${escHtml(entry.ascendant)}</div>` : ''}
      </div>
      <div class="rhc-date">${formatRelativeDate(entry.savedAt)}</div>
    </div>`).join('');
}

function formatRelativeDate(val) {
  let date;
  if (val && typeof val.toDate === 'function') {
    date = val.toDate();
  } else {
    date = new Date(val);
  }
  const diff = Math.floor((Date.now() - date) / 60000);
  if (isNaN(diff)) return '';
  if (diff < 1)    return 'Just now';
  if (diff < 60)   return `${diff}m ago`;
  if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
  return `${Math.floor(diff / 1440)}d ago`;
}

/* ===================== 10. IN-APP REPORT SCREEN ===================== */

function renderInAppReport(html, meta) {
  const parser      = new DOMParser();
  const doc         = parser.parseFromString(html, 'text/html');
  let kundliData    = null;

  // Dynamic Moon Sign daily horoscope loading widget
  async function loadReportHoroscope(sign, containerEl) {
    if (!containerEl) return;
    
    // Normalize Moon Sign (letters only)
    const normalizedSign = sign.replace(/[^a-zA-Z]/g, '');
    const validSigns = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
    if (!validSigns.includes(normalizedSign)) {
      containerEl.innerHTML = '';
      return;
    }
    
    containerEl.innerHTML = `
      <div style="text-align:center;padding:16px;background:rgba(255,255,255,0.02);border:1px solid var(--card-border);border-radius:var(--radius-md);">
        <div class="typing-indicator" style="display:inline-flex;margin:0 auto;">
          <span></span><span></span><span></span>
        </div>
        <p style="margin-top:8px;color:var(--text-muted);font-size:11.5px;">Reading today's stars for your Moon Sign (${normalizedSign})...</p>
      </div>`;

    const today = new Date().toDateString();
    const cacheKey = `astro_horoscope_${normalizedSign}_${today}`;
    const cached = localStorage.getItem(cacheKey);

    const drawWidget = (data) => {
      const sym = SIGN_SYMBOLS[normalizedSign] || '⭐';
      const dateStr = new Date().toLocaleDateString('en-IN', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
      containerEl.innerHTML = `
        <div class="horoscope-card-result" style="margin-bottom:12px; border:1px solid var(--gold); background:rgba(212,175,55,0.03);">
          <div class="horoscope-sign-header" style="padding:12px 16px; border-bottom:1px solid rgba(212,175,55,0.15); display:flex; align-items:center; gap:12px;">
            <span class="horoscope-symbol" style="font-size:32px;">${sym}</span>
            <div>
              <div class="horoscope-sign-name" style="font-size:14.5px; color:var(--gold-light); font-weight:700; line-height:1.2;">Today's Moon Sign Horoscope (${normalizedSign})</div>
              <div class="horoscope-date" style="font-size:9.5px; color:var(--text-muted);">${dateStr}</div>
            </div>
          </div>
          <div class="horoscope-body" style="padding:12px 16px; font-size:12px;">
            <p style="margin:0 0 10px 0; line-height:1.55; color:var(--text-main); font-weight:500;">${typeof data === 'string' ? data : (data.overall || '')}</p>
            ${data.career ? `<div class="horoscope-section" style="display:flex; gap:8px; margin-bottom:8px; align-items:flex-start;"><span style="font-size:14px; line-height:1;">💼</span><p style="margin:0; color:var(--text-muted);">${data.career}</p></div>` : ''}
            ${data.love ? `<div class="horoscope-section" style="display:flex; gap:8px; margin-bottom:8px; align-items:flex-start;"><span style="font-size:14px; line-height:1;">💞</span><p style="margin:0; color:var(--text-muted);">${data.love}</p></div>` : ''}
            ${data.health ? `<div class="horoscope-section" style="display:flex; gap:8px; margin-bottom:8px; align-items:flex-start;"><span style="font-size:14px; line-height:1;">🩺</span><p style="margin:0; color:var(--text-muted);">${data.health}</p></div>` : ''}
            ${data.lucky_color ? `
            <div class="horoscope-lucky" style="display:flex; gap:12px; margin-top:10px; font-size:11px; border-top:1px solid rgba(255,255,255,0.05); padding-top:10px;">
              <span>🎨 Color: <b>${data.lucky_color}</b></span>
              <span>🔢 Number: <b>${data.lucky_number || '?'}</b></span>
            </div>` : ''}
          </div>
        </div>
      `;
    };

    if (cached) {
      drawWidget(JSON.parse(cached));
      return;
    }

    try {
      const res = await fetch('/api/daily-horoscope', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sign: normalizedSign, date: today }),
      });
      const data = await res.json();
      if (data.horoscope) {
        localStorage.setItem(cacheKey, JSON.stringify(data.horoscope));
        drawWidget(data.horoscope);
      } else throw new Error('No data');
    } catch (err) {
      containerEl.innerHTML = `
        <div style="padding:12px; text-align:center; background:rgba(255,255,255,0.02); border:1px solid var(--card-border); border-radius:var(--radius-md); font-size:11.5px; color:var(--text-muted);">
          ⚠️ Could not load today's horoscope.
        </div>`;
    }
  }
  
  // Extract and parse embedded JSON details for AI chat context
  const scriptTag = doc.getElementById('kundli-data-json');
  if (scriptTag) {
    try {
      kundliData = JSON.parse(scriptTag.textContent);
      walletState.lastKundli = {
        name: kundliData.meta.name,
        gender: kundliData.meta.gender,
        dob: kundliData.meta.dob,
        tob: kundliData.meta.tob,
        pob: kundliData.meta.pob,
        moonSign: kundliData.meta.moon_sign,
        ascendant: kundliData.meta.ascendant.sign,
        planets: kundliData.planets
      };

      if (currentUser) {
        updateUserProfile(currentUser.uid, { lastKundli: walletState.lastKundli });
      } else {
        const data = getGuestWallet();
        data.lastKundli = walletState.lastKundli;
        saveGuestWallet(data);
      }
    } catch (e) {
      console.error("Error parsing embedded Kundli JSON:", e);
    }
    scriptTag.remove(); // Clean up script tag from DOM before rendering
  }

  const bodyHTML    = doc.body.innerHTML;
  const reportContent = document.getElementById('reportContent');

  reportContent.innerHTML = `
    <div class="report-action-bar">
      <button class="report-action-btn" id="reportBackBtn">← Back</button>
      <div style="display:flex;gap:8px;">
        <button class="report-action-btn" id="reportShareBtn">Share 📤</button>
        <button class="report-action-btn" onclick="window.print()">PDF 🖨</button>
      </div>
    </div>
    <div id="reportInner">${bodyHTML}</div>`;

  // Remove the back-fab from injected content (we have our own)
  const existingBackFab = reportContent.querySelector('.back-fab');
  if (existingBackFab) existingBackFab.remove();

  document.getElementById('reportBackBtn').addEventListener('click', () => goToScreen('home'));
  document.getElementById('reportShareBtn').addEventListener('click', () => shareReport(meta.name));

  // Re-wire tab buttons inside injected HTML
  reportContent.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      reportContent.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      reportContent.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const panel = reportContent.querySelector(`#${btn.dataset.tab}`);
      if (panel) panel.classList.add('active');
    });
  });

  // Re-wire section select dropdown inside injected HTML
  const sectionSelect = reportContent.querySelector('#reportSectionSelect');
  if (sectionSelect) {
    sectionSelect.addEventListener('change', (e) => {
      reportContent.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      const panel = reportContent.querySelector(`#${e.target.value}`);
      if (panel) panel.classList.add('active');
    });
  }

  // Wire dynamic Varga chart selection and drawing
  if (kundliData && kundliData.vargas) {
    const vargaSelect = reportContent.querySelector('#vargaSelect');
    
    const numCoords = {
      1:  {top:'41%', left:'50%'},
      2:  {top:'18%', left:'26%'},
      3:  {top:'26%', left:'18%'},
      4:  {top:'50%', left:'41%'},
      5:  {top:'74%', left:'18%'},
      6:  {top:'82%', left:'26%'},
      7:  {top:'59%', left:'50%'},
      8:  {top:'82%', left:'74%'},
      9:  {top:'74%', left:'82%'},
      10: {top:'50%', left:'59%'},
      11: {top:'26%', left:'82%'},
      12: {top:'18%', left:'74%'}
    };

    const planetCoords = {
      1:  {top:'23%', left:'50%'},
      2:  {top:'8%',  left:'23%'},
      3:  {top:'23%', left:'8%'},
      4:  {top:'50%', left:'23%'},
      5:  {top:'77%', left:'8%'},
      6:  {top:'92%', left:'23%'},
      7:  {top:'77%', left:'50%'},
      8:  {top:'92%', left:'77%'},
      9:  {top:'77%', left:'92%'},
      10: {top:'50%', left:'77%'},
      11: {top:'23%', left:'92%'},
      12: {top:'8%',  left:'77%'}
    };

    const PLANET_SHORT_NAMES = {
      en: { 'sun': 'Su', 'moon': 'Mo', 'mars': 'Ma', 'mercury': 'Me', 'jupiter': 'Ju', 'venus': 'Ve', 'saturn': 'Sa', 'rahu': 'Ra', 'ketu': 'Ke', 'ascendant': 'Asc' },
      hi: { 'sun': 'सू', 'moon': 'चं', 'mars': 'मं', 'mercury': 'बु', 'jupiter': 'गु', 'venus': 'शु', 'saturn': 'श', 'rahu': 'रा', 'ketu': 'के', 'ascendant': 'ल' }
    };

    function drawVarga(divKey, containerSelector = '#vargaChartOccupants') {
      const varga = kundliData.vargas[divKey];
      if (!varga) return;

      const ascSignId = varga.ascendant.sign_id;
      const occupants = {};
      for (let h = 1; h <= 12; h++) occupants[h] = [];

      const currentLang = localStorage.getItem('appLang') || 'en';
      const symbolsMap = PLANET_SHORT_NAMES[currentLang] || PLANET_SHORT_NAMES.en;

      // Draw Ascendant (Lagna) in the 1st house
      const ascSymbol = symbolsMap['ascendant'] || 'Asc';
      let ascDegree = varga.ascendant.degree || '';
      if (typeof ascDegree === 'number') {
        ascDegree = ascDegree.toFixed(2) + '°';
      }
      occupants[1].push({
        symbol: ascSymbol,
        degree: ascDegree
      });

      varga.planets.forEach(p => {
        const pKey = p.name ? p.name.toLowerCase().trim() : '';
        let symbol = symbolsMap[pKey] || (p.name ? p.name.slice(0, 2) : '');
        if (p.is_retrograde || p.retro) symbol += '*';
        
        let house;
        if (divKey === 'chalit') {
          house = p.house; // Precalculated Sripati house
        } else {
          house = (p.sign_id - ascSignId + 12) % 12 + 1; // Whole sign relative to Ascendant
        }
        
        if (house >= 1 && house <= 12) {
          let pDegree = p.degree || '';
          if (typeof pDegree === 'number') {
            pDegree = pDegree.toFixed(2) + '°';
          }
          occupants[house].push({
            symbol: symbol,
            degree: pDegree
          });
        }
      });

      let html = '';
      for (let h = 1; h <= 12; h++) {
        const signNum = (ascSignId + h - 2) % 12 + 1;
        const numPos = numCoords[h];
        const planetPos = planetCoords[h];
        const housePlanetsHtml = occupants[h].map(occ => `
          <div style="display:inline-flex; flex-direction:column; align-items:center; margin:1px 2px;">
            <span style="font-size:7px; color:var(--text-muted); line-height:1; font-weight:normal; margin-bottom:1px;">${occ.degree ? occ.degree.replace('°', '') + '°' : ''}</span>
            <span style="font-size:9.5px; font-weight:bold; color:#100B26; background:linear-gradient(135deg, #F4D67A 0%, #D4AF37 100%); border-radius:3px; padding:1px 3px; line-height:1; box-shadow:0 1px 3px rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.2);">${occ.symbol}</span>
          </div>
        `).join('');

        html += `
          <!-- Sign Number for House ${h} -->
          <div style="position:absolute; top:${numPos.top}; left:${numPos.left}; transform:translate(-50%, -50%); font-size:9px; color:var(--text-muted); font-weight:500; pointer-events:none;">
            ${signNum}
          </div>
          <!-- Planets for House ${h} -->
          ${housePlanetsHtml ? `
          <div style="position:absolute; top:${planetPos.top}; left:${planetPos.left}; transform:translate(-50%, -50%); display:flex; align-items:center; justify-content:center; pointer-events:none; white-space:nowrap; flex-wrap:wrap; max-width:65px;">
            ${housePlanetsHtml}
          </div>` : ''}
        `;
      }

      const occupantsContainer = reportContent.querySelector(containerSelector);
      if (occupantsContainer) occupantsContainer.innerHTML = html;
    }

    if (vargaSelect) {
      vargaSelect.addEventListener('change', (e) => {
        drawVarga(e.target.value, '#vargaChartOccupants');
      });
    }

    // Render static D1 Lagna Chart at the top
    drawVarga('D1', '#d1ChartOccupants');

    // Render default varga chart (D9 Navamsa) in the Vargas / Chalit tab panel
    drawVarga('D9', '#vargaChartOccupants');

    window.reDrawCharts = function(vargaKey = 'D9') {
      drawVarga('D1', '#d1ChartOccupants');
      drawVarga(vargaKey, '#vargaChartOccupants');
    };
  }

  // Helper for dasha subdivision sequence and years proportions
  const DASHA_LORDS = ['Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury', 'Ketu', 'Venus'];
  const DASHA_YEARS = { 'Sun': 6, 'Moon': 10, 'Mars': 7, 'Rahu': 18, 'Jupiter': 16, 'Saturn': 19, 'Mercury': 17, 'Ketu': 7, 'Venus': 20 };

  function getLordSequence(startLord) {
    const idx = DASHA_LORDS.indexOf(startLord);
    if (idx === -1) return DASHA_LORDS;
    const seq = [];
    for (let i = 0; i < 9; i++) {
      seq.push(DASHA_LORDS[(idx + i) % 9]);
    }
    return seq;
  }

  function subdivideDasha(start, end, lord) {
    const startTime = new Date(start).getTime();
    const endTime = new Date(end).getTime();
    const totalDuration = endTime - startTime;
    const sequence = getLordSequence(lord);
    const subPeriods = [];
    let currentStart = startTime;
    
    sequence.forEach(subLord => {
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
  }

  function wireSukshmaCards(parentEl) {
    parentEl.querySelectorAll('.dasha-sd-card').forEach(card => {
      const header = card.querySelector('.dasha-sd-header');
      const body = card.querySelector('.dasha-sd-body');
      const arrow = card.querySelector('.dasha-sd-arrow');
      const lord = card.dataset.lord;
      const start = card.dataset.start;
      const end = card.dataset.end;

      if (header && body && arrow) {
        header.addEventListener('click', (e) => {
          e.stopPropagation();
          if (body.style.display === 'none') {
            if (body.children.length === 0) {
              const pds = subdivideDasha(start, end, lord);
              const now = new Date();
              body.innerHTML = pds.map(pd => {
                const pdStart = new Date(pd.start).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
                const pdEnd = new Date(pd.end).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
                const isPdActive = now >= new Date(pd.start) && now <= new Date(pd.end);
                return `
                  <div class="dasha-pd-item ${isPdActive ? 'active-dasha-pd' : ''}" style="display:flex; justify-content:space-between; align-items:center; padding:6px 12px; border-bottom:1px solid rgba(255,255,255,0.01); font-size:10.5px;">
                    <div>
                      <span style="font-weight:600; color:${isPdActive ? 'var(--gold-light)' : 'var(--text-main)'};">${pd.lord}</span>
                      <span style="font-size:8.5px; color:var(--text-muted); margin-left:4px;">(Pran)</span>
                      ${isPdActive ? '<span class="active-badge-sub" style="background:var(--success); color:#1B0F3D; font-size:7px; font-weight:800; padding:1px 3px; border-radius:2px; margin-left:4px;">Active</span>' : ''}
                    </div>
                    <div style="font-size:9.5px; color:var(--text-muted);">${pdStart} - ${pdEnd}</div>
                  </div>
                `;
              }).join('');
            }
            body.style.display = 'block';
            arrow.style.transform = 'rotate(180deg)';
          } else {
            body.style.display = 'none';
            arrow.style.transform = 'rotate(0deg)';
          }
        });
      }
    });
  }

  // Wire Dasha Accordions toggles (Mahadasha, Antardasha, and Pratyantardasha levels)
  reportContent.querySelectorAll('.dasha-md-card').forEach((card, idx) => {
    const header = card.querySelector('.dasha-md-header');
    const body = card.querySelector('.dasha-md-body');
    const arrow = card.querySelector('.dasha-arrow');
    
    if (header && body && arrow) {
      if (card.classList.contains('active-dasha-md')) {
        arrow.style.transform = 'rotate(180deg)';
      }
      header.addEventListener('click', () => {
        if (body.style.display === 'none') {
          body.style.display = 'block';
          arrow.style.transform = 'rotate(180deg)';
        } else {
          body.style.display = 'none';
          arrow.style.transform = 'rotate(0deg)';
        }
      });
    }
  });

  reportContent.querySelectorAll('.dasha-ad-card').forEach((card, idx) => {
    const header = card.querySelector('.dasha-ad-header');
    const body = card.querySelector('.dasha-ad-body');
    const arrow = card.querySelector('.dasha-ad-arrow');
    
    if (header && body && arrow) {
      if (card.classList.contains('active-dasha-ad')) {
        arrow.style.transform = 'rotate(180deg)';
      }
      header.addEventListener('click', (e) => {
        e.stopPropagation();
        if (body.style.display === 'none') {
          body.style.display = 'block';
          arrow.style.transform = 'rotate(180deg)';
        } else {
          body.style.display = 'none';
          arrow.style.transform = 'rotate(0deg)';
        }
      });
    }
  });

  reportContent.querySelectorAll('.dasha-pad-card').forEach(card => {
    const header = card.querySelector('.dasha-pad-header');
    const body = card.querySelector('.dasha-pad-body');
    const arrow = card.querySelector('.dasha-pad-arrow');
    const lord = card.dataset.lord;
    const start = card.dataset.start;
    const end = card.dataset.end;

    if (header && body && arrow) {
      header.addEventListener('click', (e) => {
        e.stopPropagation();
        if (body.style.display === 'none') {
          if (body.children.length === 0) {
            const sds = subdivideDasha(start, end, lord);
            const now = new Date();
            body.innerHTML = sds.map(sd => {
              const sdStart = new Date(sd.start).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
              const sdEnd = new Date(sd.end).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
              const isSdActive = now >= new Date(sd.start) && now <= new Date(sd.end);
              return `
                <div class="dasha-sd-card ${isSdActive ? 'active-dasha-sd' : ''}" data-lord="${sd.lord}" data-start="${sd.start}" data-end="${sd.end}" style="border-bottom:1px solid rgba(255,255,255,0.02); overflow:hidden;">
                  <div class="dasha-sd-header" style="display:flex; justify-content:space-between; align-items:center; padding:7px 12px; font-size:11px; cursor:pointer;">
                    <div>
                      <span style="font-weight:600; color:${isSdActive ? 'var(--gold-light)' : 'var(--text-main)'};">${sd.lord}</span>
                      <span style="font-size:9px; color:var(--text-muted); margin-left:4px;">(Sukshma)</span>
                      ${isSdActive ? '<span class="active-badge-sub" style="background:var(--success); color:#1B0F3D; font-size:7px; font-weight:800; padding:1px 3px; border-radius:2px; margin-left:4px;">Active</span>' : ''}
                    </div>
                    <div style="display:flex; align-items:center; gap:6px;">
                      <span style="font-size:10px; color:var(--text-muted);">${sdStart} - ${sdEnd}</span>
                      <span class="dasha-sd-arrow" style="font-size:7px; color:var(--text-muted); transition: transform 0.2s;">▼</span>
                    </div>
                  </div>
                  <div class="dasha-sd-body" style="display: none; padding-left: 12px; background: rgba(0,0,0,0.08);">
                    <!-- Pran dashas will be injected here dynamically -->
                  </div>
                </div>
              `;
            }).join('');
            wireSukshmaCards(body);
          }
          body.style.display = 'block';
          arrow.style.transform = 'rotate(180deg)';
        } else {
          body.style.display = 'none';
          arrow.style.transform = 'rotate(0deg)';
        }
      });
    }
  });

  // Load Moon Sign daily horoscope widget
  if (kundliData && kundliData.meta && kundliData.meta.moon_sign) {
    const horoContainer = reportContent.querySelector('#reportMoonSignHoroscope');
    loadReportHoroscope(kundliData.meta.moon_sign, horoContainer);
  }

  saveKundliToHistory(meta);
  updateHeroZodiacFromDOB(meta.dob);
  goToScreen('report');
}

function shareReport(name) {
  const text = `Check out ${name}'s Vedic Kundli — generated by AstroKundli! 🕉✨\n\nVisit: https://kundliapp.vercel.app`;
  if (navigator.share) {
    navigator.share({ title: `${name}'s Kundli — AstroKundli`, text });
  } else {
    navigator.clipboard.writeText(text).then(() => showToast('Report details copied to clipboard!'));
  }
}

/* ===================== 11. DAILY HOROSCOPE SCREEN ===================== */

let selectedSign = null;

function initHoroscopeScreen() {
  // Auto-select moon sign from last Kundli if not already selected
  if (!selectedSign && walletState.lastKundli?.moonSign) {
    const chip = document.querySelector(`.zodiac-chip[data-sign="${walletState.lastKundli.moonSign}"]`);
    if (chip) chip.dispatchEvent(new MouseEvent('click'));
  }
}

document.querySelectorAll('.zodiac-chip').forEach(chip => {
  chip.addEventListener('click', async () => {
    document.querySelectorAll('.zodiac-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    selectedSign = chip.dataset.sign;
    await fetchDailyHoroscope(selectedSign);
  });
});

async function fetchDailyHoroscope(sign) {
  const resultEl = document.getElementById('horoscopeResult');
  resultEl.innerHTML = `
    <div style="text-align:center;padding:32px;">
      <div class="typing-indicator" style="display:inline-flex;margin:0 auto;">
        <span></span><span></span><span></span>
      </div>
      <p style="margin-top:14px;color:var(--text-muted);font-size:13px;">Reading the stars for ${sign}...</p>
    </div>`;

  const today    = new Date().toDateString();
  const cacheKey = `astro_horoscope_${sign}_${today}`;
  const cached   = localStorage.getItem(cacheKey);

  if (cached) { renderHoroscope(sign, JSON.parse(cached)); return; }

  try {
    const res  = await fetch('/api/daily-horoscope', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ sign, date: today }),
    });
    const data = await res.json();
    if (data.horoscope) {
      localStorage.setItem(cacheKey, JSON.stringify(data.horoscope));
      renderHoroscope(sign, data.horoscope);
    } else throw new Error('No data');
  } catch (err) {
    resultEl.innerHTML = `<div class="horoscope-empty"><p>Could not load horoscope. Please try again.</p></div>`;
  }
}

const SIGN_SYMBOLS = {
  'Aries':'♈','Taurus':'♉','Gemini':'♊','Cancer':'♋','Leo':'♌','Virgo':'♍',
  'Libra':'♎','Scorpio':'♏','Sagittarius':'♐','Capricorn':'♑','Aquarius':'♒','Pisces':'♓',
};

function renderHoroscope(sign, data) {
  const sym = SIGN_SYMBOLS[sign] || '⭐';
  const dateStr = new Date().toLocaleDateString('en-IN', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
  document.getElementById('horoscopeResult').innerHTML = `
    <div class="horoscope-card-result">
      <div class="horoscope-sign-header">
        <span class="horoscope-symbol">${sym}</span>
        <div>
          <div class="horoscope-sign-name">${sign}</div>
          <div class="horoscope-date">${dateStr}</div>
        </div>
      </div>
      <div class="horoscope-body">
        <p>${typeof data === 'string' ? data : escHtml(data.overall || '')}</p>
        ${data.career ? `<div class="horoscope-section"><span class="horoscope-section-icon">💼</span><p>${escHtml(data.career)}</p></div>` : ''}
        ${data.love   ? `<div class="horoscope-section"><span class="horoscope-section-icon">💞</span><p>${escHtml(data.love)}</p></div>`   : ''}
        ${data.health ? `<div class="horoscope-section"><span class="horoscope-section-icon">🩺</span><p>${escHtml(data.health)}</p></div>` : ''}
        ${data.lucky_color ? `
        <div class="horoscope-lucky">
          <span>🎨 Lucky Color: <b>${escHtml(data.lucky_color)}</b></span>
          <span>🔢 Lucky Number: <b>${data.lucky_number || '?'}</b></span>
        </div>` : ''}
      </div>
    </div>`;
}

/* ===================== 12. KUNDLI COMPATIBILITY ===================== */

const compatForm = document.getElementById('compatForm');

compatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(compatForm);
  const fields = [
    ['compat-field-name1', fd.get('name1')?.trim()],
    ['compat-field-dob1',  fd.get('dob1')],
    ['compat-field-pob1',  fd.get('pob1')?.trim()],
    ['compat-field-name2', fd.get('name2')?.trim()],
    ['compat-field-dob2',  fd.get('dob2')],
    ['compat-field-pob2',  fd.get('pob2')?.trim()],
  ];
  let valid = true;
  fields.forEach(([id, val]) => { if (!val) { showFieldError(id); valid = false; } else clearFieldError(id); });
  if (!valid) { showToast('Please fill all fields'); return; }

  showLoader('Analyzing compatibility...');

  try {
    const res  = await fetch('/api/compatibility', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        name1: fd.get('name1'), dob1: fd.get('dob1'), pob1: fd.get('pob1'),
        name2: fd.get('name2'), dob2: fd.get('dob2'), pob2: fd.get('pob2'),
      }),
    });
    const data = await res.json();
    hideLoader();
    if (data.result) renderCompatResult(data.result, fd.get('name1'), fd.get('name2'));
    else throw new Error('No result');
  } catch (err) {
    hideLoader();
    showToast('Compatibility check failed. Please try again.');
  }
});

function renderCompatResult(result, name1, name2) {
  const el = document.getElementById('compatResult');
  el.style.display = 'block';
  // Clamp score for conic-gradient percentage
  const score = Math.min(Math.max(parseInt(result.score) || 70, 0), 100);
  el.innerHTML = `
    <div class="compat-result-card">
      <div class="compat-score-ring" style="background:conic-gradient(var(--gold) 0% ${score}%, rgba(212,175,55,0.15) ${score}% 100%);">
        <div class="compat-score-inner">
          <div class="compat-score-number">${score}</div>
          <div class="compat-score-label">/ 100</div>
        </div>
      </div>
      <div class="compat-names">${escHtml(name1)} &amp; ${escHtml(name2)}</div>
      <div class="compat-rating">${escHtml(result.rating || '⭐ Good Match')}</div>
      <div class="compat-sections">
        ${result.overall    ? `<div class="compat-section-block"><h4>🌟 Overall</h4><p>${escHtml(result.overall)}</p></div>`    : ''}
        ${result.strengths  ? `<div class="compat-section-block"><h4>✅ Strengths</h4><p>${escHtml(result.strengths)}</p></div>`  : ''}
        ${result.challenges ? `<div class="compat-section-block"><h4>⚠️ Challenges</h4><p>${escHtml(result.challenges)}</p></div>`: ''}
        ${result.advice     ? `<div class="compat-section-block"><h4>💡 Advice</h4><p>${escHtml(result.advice)}</p></div>`        : ''}
      </div>
    </div>`;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ===================== 13. AI CHAT ===================== */

let chatHistory   = [];
const chatMessages = document.getElementById('chatMessages');
const chatInput    = document.getElementById('chatInput');
const sendChatBtn  = document.getElementById('sendChatBtn');

function initChatScreen() {
  if (chatHistory.length > 0) {
    const hasContext = chatHistory[0]?.parts?.[0]?.text?.includes('Lagna');
    if (walletState.lastKundli && !hasContext) chatHistory = [];
    else { chatMessages.scrollTop = chatMessages.scrollHeight; return; }
  }

  const lk = walletState.lastKundli;
  const welcome = lk
    ? `Namaste **${lk.name}**! 🔮 I have analyzed your birth chart.\n\nYour **Ascendant (Lagna)** is **${lk.ascendant}** and your **Moon Sign (Rashi)** is **${lk.moonSign}**.\n\nAsk me anything about your career, relationships, health, or planetary placements!`
    : `Namaste! 🔮 I am AstroGuru, your AI Vedic astrologer.\n\nI can answer general astrology questions, or generate your Kundli in the **Generate** tab for personalized readings!`;

  chatHistory.push({ role: 'model', parts: [{ text: welcome }] });
  renderChatMessages();
}

function formatMarkdown(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>');
}

function renderChatMessages() {
  chatMessages.innerHTML = '';
  chatHistory.forEach(msg => {
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${msg.role === 'user' ? 'user' : 'guru'}`;
    bubble.innerHTML  = formatMarkdown(msg.parts[0].text);
    chatMessages.appendChild(bubble);
  });
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function showChatTyping() {
  const el = document.createElement('div');
  el.id = 'chatTypingIndicator'; el.className = 'typing-indicator';
  el.innerHTML = '<span></span><span></span><span></span>';
  chatMessages.appendChild(el);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}
function removeChatTyping() { document.getElementById('chatTypingIndicator')?.remove(); }

async function sendChatMessage() {
  const text = chatInput.value.trim();
  if (!text) return;

  await fetchWallet();
  if (walletState.coins < CHAT_COST) { openInsufficientModal(); return; }

  chatInput.value = ''; chatInput.disabled = true; sendChatBtn.disabled = true;
  chatHistory.push({ role: 'user', parts: [{ text }] });
  renderChatMessages(); showChatTyping();

  try {
    const spendRes = await walletAction('spend_chat');
    if (!spendRes.success) {
      removeChatTyping(); showToast('Insufficient coins for chatting.');
      chatHistory.pop(); renderChatMessages();
      chatInput.disabled = false; sendChatBtn.disabled = false;
      chatInput.value = text; openInsufficientModal(); return;
    }

    const res  = await fetch('/api/chat', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ message: text, history: chatHistory.slice(0, -1), kundliContext: walletState.lastKundli }),
    });
    if (!res.ok) throw new Error('Chat failed');
    const data = await res.json();
    removeChatTyping();
    if (data.coins !== undefined) updateWalletUI(data);
    chatHistory.push({ role: 'model', parts: [{ text: data.reply }] });
    renderChatMessages();
  } catch (err) {
    removeChatTyping(); showToast('Failed to get a response. Coin refunded.');
    await fetch(COINS_API, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'action=refund_chat' });
    await fetchWallet(); chatHistory.pop(); renderChatMessages(); chatInput.value = text;
  } finally {
    chatInput.disabled = false; sendChatBtn.disabled = false; chatInput.focus();
  }
}

sendChatBtn.addEventListener('click', sendChatMessage);
chatInput.addEventListener('keydown', e => { if (e.key === 'Enter') sendChatMessage(); });

/* ===================== 14. DAILY COSMIC INSIGHT ===================== */

async function loadDailyInsight() {
  const today    = new Date().toDateString();
  const cacheKey = `astro_daily_insight_${today}`;
  const cached   = localStorage.getItem(cacheKey);
  const insightEl = document.getElementById('dailyInsightCard');
  if (!insightEl) return;

  if (cached) { renderDailyInsight(insightEl, cached); return; }

  try {
    const res  = await fetch('/api/daily-horoscope', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ sign: 'General', date: today, mode: 'cosmic_insight' }),
    });
    const data   = await res.json();
    const insight = data.insight || "✦ The cosmos align beautifully today — trust your intuition and embrace new opportunities with confidence.";
    localStorage.setItem(cacheKey, insight);
    renderDailyInsight(insightEl, insight);
  } catch (e) {
    renderDailyInsight(insightEl, "✦ <strong>Mercury</strong> is in a favorable position today, boosting communication and decision-making. Lucky color: <strong>Gold</strong>.");
  }
}

function renderDailyInsight(el, text) {
  el.innerHTML = `<div style="font-size:13px;color:var(--text-muted);line-height:1.65;">${text}</div>`;
}

/* ===================== 15. SHARE / REFER ===================== */

document.getElementById('referRow').addEventListener('click', () => {
  const text = `Join me on AstroKundli — the best AI Vedic astrology app! 🕉✨\n\nGet 20 free coins when you sign up: https://kundliapp.vercel.app`;
  if (navigator.share) {
    navigator.share({ title: 'AstroKundli Invite', text });
  } else {
    navigator.clipboard.writeText(text).then(() => showToast('Invite link copied to clipboard! 🎉'));
  }
});

/* ===================== 16. ZODIAC SIGN DETECTION ===================== */

function getSunSign(dob) {
  if (!dob) return null;
  const [, m, d] = dob.split('-').map(Number);
  const md = m * 100 + d;
  if (md >= 321 && md <= 419)   return 'Aries';
  if (md >= 420 && md <= 520)   return 'Taurus';
  if (md >= 521 && md <= 620)   return 'Gemini';
  if (md >= 621 && md <= 722)   return 'Cancer';
  if (md >= 723 && md <= 822)   return 'Leo';
  if (md >= 823 && md <= 922)   return 'Virgo';
  if (md >= 923 && md <= 1022)  return 'Libra';
  if (md >= 1023 && md <= 1121) return 'Scorpio';
  if (md >= 1122 && md <= 1221) return 'Sagittarius';
  if ((md >= 1222 && md <= 1231) || (md >= 101 && md <= 119)) return 'Capricorn';
  if (md >= 120 && md <= 218)   return 'Aquarius';
  if (md >= 219 && md <= 320)   return 'Pisces';
  return null;
}

async function updateHeroZodiacFromDOB(dob) {
  const sign = getSunSign(dob);
  if (sign) {
    if (currentUser) {
      await updateUserProfile(currentUser.uid, { sunSign: sign });
      walletState.sunSign = sign;
    }
    const heroEl = document.getElementById('heroZodiac');
    if (heroEl) heroEl.textContent = SIGN_SYMBOLS[sign] || '✨';
  }
}

function updateHeroZodiac() {
  const sign   = walletState.sunSign;
  const heroEl = document.getElementById('heroZodiac');
  if (sign && heroEl && SIGN_SYMBOLS[sign]) heroEl.textContent = SIGN_SYMBOLS[sign];
}

/* ===================== 17. UI HELPERS ===================== */

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function showToast(message, duration = 2800) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => toast.classList.remove('show'), duration);
}

function showLoader(text = 'Loading...') {
  document.getElementById('loaderText').textContent = text;
  document.getElementById('loaderOverlay').classList.add('show');
}
function hideLoader() { document.getElementById('loaderOverlay').classList.remove('show'); }

function openInsufficientModal()  { document.getElementById('insufficientModal').classList.add('show'); }
function closeInsufficientModal() { document.getElementById('insufficientModal').classList.remove('show'); }

document.getElementById('modalCloseBtn').addEventListener('click', closeInsufficientModal);
document.getElementById('insufficientModal').addEventListener('click', e => {
  if (e.target.id === 'insufficientModal') closeInsufficientModal();
});

/* ===================== 18. INIT & THEME / LANG TOGGLE ===================== */

function initThemeToggle() {
  const toggleBtn = document.getElementById('themeToggleBtn');
  if (!toggleBtn) return;

  const currentTheme = localStorage.getItem('appTheme') || 'dark';
  if (currentTheme === 'light') {
    document.body.classList.add('light-theme');
    toggleBtn.textContent = '☀️';
  } else {
    document.body.classList.remove('light-theme');
    toggleBtn.textContent = '🌙';
  }

  toggleBtn.addEventListener('click', () => {
    document.body.classList.toggle('light-theme');
    const isLight = document.body.classList.contains('light-theme');
    localStorage.setItem('appTheme', isLight ? 'light' : 'dark');
    toggleBtn.textContent = isLight ? '☀️' : '🌙';
  });
}

function initLangToggle() {
  const langBtn = document.getElementById('langToggleBtn');
  if (!langBtn) return;

  const currentLang = localStorage.getItem('appLang') || 'en';
  langBtn.textContent = currentLang === 'hi' ? '🌐 HI' : '🌐 EN';

  langBtn.addEventListener('click', () => {
    const activeLang = localStorage.getItem('appLang') || 'en';
    const nextLang = activeLang === 'en' ? 'hi' : 'en';
    localStorage.setItem('appLang', nextLang);
    langBtn.textContent = nextLang === 'hi' ? '🌐 HI' : '🌐 EN';
    showToast(nextLang === 'hi' ? 'भाषा बदल कर हिंदी कर दी गई है 🇮🇳' : 'Language set to English 🇬🇧');
    
    // Re-draw chart if report is active
    const reportContent = document.getElementById('reportContent');
    if (reportContent && reportContent.innerHTML.length > 50) {
      const vargaSelect = reportContent.querySelector('#vargaSelect');
      const currentDiv = vargaSelect ? vargaSelect.value : 'D9';
      if (typeof window.reDrawCharts === 'function') window.reDrawCharts(currentDiv);
    }
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  initThemeToggle();
  initLangToggle();

  if (typeof auth === 'undefined') {
    document.getElementById('screen-auth').style.display = 'flex';
    document.getElementById('mainApp').style.display = 'none';
    await fetchWallet();
  }
  
  checkDailyCheckin();
  checkOnboarding();
  autoCheckin();
  loadDailyInsight();
  updateHeroZodiac();
});

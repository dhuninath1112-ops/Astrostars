/**
 * ==========================================
 * ASTROKUNDLI FIREBASE CONFIGURATION
 * ==========================================
 * 
 * STEP 1: Go to https://console.firebase.google.com/
 * STEP 2: Click "Add Project", name it "AstroKundli", and disable Analytics.
 * STEP 3: Click the Web icon (</>) to add an app.
 * STEP 4: Copy the keys from the code block they give you and paste them below!
 * 
 * STEP 5: Go to "Build" -> "Authentication" -> "Get Started".
 * STEP 6: Enable "Email/Password" and "Google" in the Sign-in methods.
 * 
 * STEP 7: Go to "Build" -> "Firestore Database" -> "Create Database".
 * STEP 8: Start in "Test mode" (or change rules to allow read/write).
 */

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

let auth;
let db;

function isFirebaseConfigured() {
  return firebaseConfig.apiKey !== "YOUR_API_KEY" && firebaseConfig.apiKey !== "";
}

if (isFirebaseConfigured()) {
  firebase.initializeApp(firebaseConfig);
  auth = firebase.auth();
  db   = firebase.firestore();
} else {
  console.warn('⚠️  AstroKundli: Firebase not configured...');
}

/* ===================== FIRESTORE HELPERS ===================== */

async function getUserProfile(uid) {
  if (!db) return null;
  const docRef = db.collection('users').doc(uid);
  const snap = await docRef.get();
  if (!snap.exists) {
    const initData = { coins: 20, ads_watched: 0, kundlis_generated: 0, onboarded: false };
    await docRef.set(initData);
    return initData;
  }
  return snap.data();
}

async function updateUserProfile(uid, data) {
  if (!db) return;
  await db.collection('users').doc(uid).set(data, { merge: true });
}

async function adjustCoins(uid, amount) {
  if (!db) return;
  await db.collection('users').doc(uid).update({
    coins: firebase.firestore.FieldValue.increment(amount)
  });
}

async function saveKundliFirestore(uid, kundliData) {
  if (!db) return;
  kundliData.savedAt = firebase.firestore.FieldValue.serverTimestamp();
  await db.collection('users').doc(uid).collection('history').add(kundliData);
}

async function loadKundliHistoryFirestore(uid) {
  if (!db) return [];
  const snapshot = await db.collection('users').doc(uid).collection('history')
    .orderBy('savedAt', 'desc').limit(20).get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function incrementKundliCount(uid) {
  if (!db) return;
  await db.collection('users').doc(uid).update({
    kundlis_generated: firebase.firestore.FieldValue.increment(1)
  });
}

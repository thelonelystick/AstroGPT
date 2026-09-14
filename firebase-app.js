// AstroGPT Firebase Auth & Cloud Firestore Client Module
// Using Firebase JS SDK v10 (Modular ESM)

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signInAnonymously,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Default credentials provided for astrogpt-da2e2
const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyD1vyZyXapmfdOyqTgctbJob--s645NcrA",
  authDomain: "astrogpt-da2e2.firebaseapp.com",
  projectId: "astrogpt-da2e2",
  storageBucket: "astrogpt-da2e2.firebasestorage.app",
  messagingSenderId: "480223079656",
  appId: "1:480223079656:web:7367df27d43956b782ed5d",
  measurementId: "G-X3MCKV2FYY"
};

class AstroFirebaseManager {
  constructor() {
    this.app = null;
    this.auth = null;
    this.db = null;
    this.currentUser = null;
    this.isGuest = true;
    this.listeners = [];
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;

    let config = DEFAULT_FIREBASE_CONFIG;
    try {
      const res = await fetch("/api/firebase-config");
      if (res.ok) {
        const fetched = await res.json();
        if (fetched.apiKey) config = fetched;
      }
    } catch (e) {
      console.warn("Using default Firebase config");
    }

    try {
      this.app = initializeApp(config);
      this.auth = getAuth(this.app);
      this.db = getFirestore(this.app);

      onAuthStateChanged(this.auth, (user) => {
        if (user) {
          this.currentUser = user;
          this.isGuest = user.isAnonymous;
          console.log(`[Firebase Auth] Active user: ${user.displayName || (user.isAnonymous ? 'Guest User' : user.uid)}`);
        } else {
          this.currentUser = null;
          this.isGuest = true;
          // Auto-sign-in as guest if enabled
          this.ensureGuestSession();
        }
        this.notifyListeners();
      });

      this.isInitialized = true;
    } catch (err) {
      console.error("[Firebase] Initialization error:", err);
      // Fallback local guest session
      this.setupLocalFallbackSession();
    }
  }

  setupLocalFallbackSession() {
    const localGuestId = localStorage.getItem("astrogpt_local_uid") || `guest_${Date.now()}`;
    localStorage.setItem("astrogpt_local_uid", localGuestId);
    this.currentUser = {
      uid: localGuestId,
      isAnonymous: true,
      displayName: "Guest Explorer"
    };
    this.isGuest = true;
    this.notifyListeners();
  }

  async ensureGuestSession() {
    if (!this.auth) {
      this.setupLocalFallbackSession();
      return;
    }
    try {
      const cred = await signInAnonymously(this.auth);
      this.currentUser = cred.user;
      this.isGuest = true;
    } catch (err) {
      console.warn("[Firebase Auth] Anonymous sign-in note:", err.message);
      this.setupLocalFallbackSession();
    }
  }

  async signInWithGoogle() {
    if (!this.auth) throw new Error("Firebase Auth is not ready.");
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    const result = await signInWithPopup(this.auth, provider);
    this.currentUser = result.user;
    this.isGuest = false;
    this.notifyListeners();
    return result.user;
  }

  async signOut() {
    if (this.auth) {
      await signOut(this.auth);
    }
    this.setupLocalFallbackSession();
    this.notifyListeners();
  }

  onAuthChange(callback) {
    this.listeners.push(callback);
    callback(this.currentUser, this.isGuest);
  }

  notifyListeners() {
    for (const cb of this.listeners) {
      try {
        cb(this.currentUser, this.isGuest);
      } catch (e) {
        console.error("Auth listener error:", e);
      }
    }
  }

  // Save Horoscope to Firestore (or local backup)
  async saveHoroscope(horoscopeData) {
    const uid = this.currentUser ? this.currentUser.uid : "guest";
    const record = {
      ...horoscopeData,
      savedAt: new Date().toISOString(),
      userId: uid,
      isGuest: this.isGuest
    };

    // Save to LocalStorage as quick cache
    const key = `astrogpt_horoscopes_${uid}`;
    const existing = JSON.parse(localStorage.getItem(key) || "[]");
    existing.unshift(record);
    localStorage.setItem(key, JSON.stringify(existing.slice(0, 50)));

    // Save to Cloud Firestore
    if (this.db && uid) {
      try {
        const colRef = collection(this.db, "users", uid, "horoscopes");
        const docRef = await addDoc(colRef, {
          ...record,
          createdAt: serverTimestamp()
        });
        console.log(`[Firestore] Saved horoscope document: ${docRef.id}`);
        return { success: true, id: docRef.id, cloudSynced: true };
      } catch (err) {
        console.warn("[Firestore] Could not sync to cloud, stored locally:", err.message);
        return { success: true, cloudSynced: false, reason: err.message };
      }
    }
    return { success: true, cloudSynced: false };
  }

  // Fetch Horoscopes History
  async getHoroscopes() {
    const uid = this.currentUser ? this.currentUser.uid : "guest";
    const local = JSON.parse(localStorage.getItem(`astrogpt_horoscopes_${uid}`) || "[]");

    if (this.db && uid && !this.isGuest) {
      try {
        const colRef = collection(this.db, "users", uid, "horoscopes");
        const q = query(colRef, orderBy("createdAt", "desc"), limit(20));
        const snapshot = await getDocs(q);
        const cloudRecords = [];
        snapshot.forEach(doc => cloudRecords.push({ id: doc.id, ...doc.data() }));
        if (cloudRecords.length > 0) return cloudRecords;
      } catch (err) {
        console.warn("[Firestore] Failed to read cloud horoscopes, using local:", err.message);
      }
    }
    return local;
  }

  // Save "It's a Match" Session to Firestore
  async saveMatchSession(matchData) {
    const uid = this.currentUser ? this.currentUser.uid : "guest";
    const record = {
      ...matchData,
      savedAt: new Date().toISOString(),
      userId: uid,
      isGuest: this.isGuest
    };

    const key = `astrogpt_matches_${uid}`;
    const existing = JSON.parse(localStorage.getItem(key) || "[]");
    existing.unshift(record);
    localStorage.setItem(key, JSON.stringify(existing.slice(0, 50)));

    if (this.db && uid) {
      try {
        const colRef = collection(this.db, "users", uid, "matches");
        const docRef = await addDoc(colRef, {
          ...record,
          createdAt: serverTimestamp()
        });
        console.log(`[Firestore] Saved match session: ${docRef.id}`);
        return { success: true, id: docRef.id, cloudSynced: true };
      } catch (err) {
        console.warn("[Firestore] Stored match locally, cloud sync notice:", err.message);
        return { success: true, cloudSynced: false, reason: err.message };
      }
    }
    return { success: true, cloudSynced: false };
  }

  // Fetch Match Sessions History
  async getMatchSessions() {
    const uid = this.currentUser ? this.currentUser.uid : "guest";
    const local = JSON.parse(localStorage.getItem(`astrogpt_matches_${uid}`) || "[]");

    if (this.db && uid && !this.isGuest) {
      try {
        const colRef = collection(this.db, "users", uid, "matches");
        const q = query(colRef, orderBy("createdAt", "desc"), limit(20));
        const snapshot = await getDocs(q);
        const cloudRecords = [];
        snapshot.forEach(doc => cloudRecords.push({ id: doc.id, ...doc.data() }));
        if (cloudRecords.length > 0) return cloudRecords;
      } catch (err) {
        console.warn("[Firestore] Failed to read cloud matches, using local:", err.message);
      }
    }
    return local;
  }
}

// Global Singleton
export const astroFirebase = new AstroFirebaseManager();
astroFirebase.initialize();

// Helper to inject Auth Bar into any page navbar or container
export function setupAuthUI(containerElement) {
  if (!containerElement) return;

  function update() {
    const user = astroFirebase.currentUser;
    const isGuest = astroFirebase.isGuest || !user || user.isAnonymous;

    if (!isGuest && user) {
      containerElement.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px; background: rgba(30,16,56,.75); padding: 4px 10px 4px 5px; border-radius: 999px; border: 1px solid rgba(214,173,92,.35);">
          <img src="${user.photoURL || '/favicon.svg?v=2'}" alt="Avatar" style="width: 28px; height: 28px; border-radius: 50%; border: 1px solid #d6ad5c; object-fit: cover;" />
          <div style="display: flex; flex-direction: column; line-height: 1.1;">
            <span style="font-size: 11px; font-weight: 600; color: #fff8e7;">${user.displayName || 'Google User'}</span>
            <span style="font-size: 9px; color: #a855f7; display: flex; align-items: center; gap: 4px;">☁️ Cloud Synced</span>
          </div>
          <button id="authSignOutBtn" title="Sign Out" style="background: none; border: none; color: #c9b9d8; cursor: pointer; padding: 2px 6px; font-size: 12px; margin-left: 4px;">✕</button>
        </div>
      `;
      const signOutBtn = containerElement.querySelector("#authSignOutBtn");
      if (signOutBtn) {
        signOutBtn.onclick = () => astroFirebase.signOut();
      }
    } else {
      containerElement.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 11px; color: #c9b9d8; display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; border-radius: 999px; background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.1);">
            <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #4ade80;"></span> Guest Mode
          </span>
          <button id="authGoogleSignInBtn" style="display: inline-flex; align-items: center; gap: 6px; background: linear-gradient(135deg, rgba(214,173,92,.2), rgba(168,85,247,.2)); border: 1px solid rgba(214,173,92,.5); color: #f1d38b; padding: 6px 12px; border-radius: 999px; font-size: 11px; font-weight: 600; cursor: pointer; transition: 0.2s ease;">
            <svg width="12" height="12" viewBox="0 0 24 24"><path fill="#f1d38b" d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.761H12.545z"/></svg>
            Sign In with Google
          </button>
        </div>
      `;
      const signInBtn = containerElement.querySelector("#authGoogleSignInBtn");
      if (signInBtn) {
        signInBtn.onclick = async () => {
          try {
            signInBtn.disabled = true;
            signInBtn.textContent = "Connecting...";
            await astroFirebase.signInWithGoogle();
          } catch (err) {
            console.error(err);
            alert("Google Sign-In: " + err.message);
            update();
          }
        };
      }
    }
  }

  astroFirebase.onAuthChange(update);
}

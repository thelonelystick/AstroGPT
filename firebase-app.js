// AstroGPT Firebase Auth & Firestore Client Module
// Using Firebase JS SDK v10 (Modular ESM)

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signInAnonymously,
  signInWithRedirect,
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
  serverTimestamp,
  doc,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyD1vyZyXapmfdOyqTgctbJob--s645NcrA",
  authDomain: "astrogpt-da2e2.firebaseapp.com",
  projectId: "astrogpt-da2e2",
  storageBucket: "astrogpt-da2e2.firebasestorage.app",
  messagingSenderId: "480223079656",
  appId: "1:480223079656:web:7367df27d43956b782ed5d",
  measurementId: "G-X3MCKV2FYY"
};

function toPlain(value) {
  return JSON.parse(JSON.stringify(value ?? {}));
}

function withTimeout(promise, ms, label) {
  let timer;
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
    })
  ]);
}

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
        } else {
          this.currentUser = null;
          this.isGuest = true;
          this.ensureGuestSession();
        }
        this.notifyListeners();
      });

      this.isInitialized = true;
    } catch (err) {
      console.error("[Firebase] Initialization error:", err);
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
    if (!this.auth) {
      throw new Error("Google sign-in is temporarily unavailable. Please refresh and try again.");
    }

    // Start Firebase's popup while this click is still a user gesture. The old
    // flow first waited for a separate OAuth popup, then opened Firebase's
    // popup as a fallback, which browsers correctly treated as an unwanted popup.
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const popupResult = await signInWithPopup(this.auth, provider);
      this.currentUser = popupResult.user;
      this.isGuest = false;
      await this.saveUserProfile(popupResult.user);
      this.notifyListeners();
      return popupResult.user;
    } catch (error) {
      if (error.code === "auth/popup-blocked") {
        // A redirect is not a popup and remains a reliable option when a browser
        // or extension blocks popup windows.
        await signInWithRedirect(this.auth, new GoogleAuthProvider());
        return null;
      }
      throw error;
    }
  }

  async saveUserProfile(user) {
    if (!user) return;
    const profile = {
      uid: user.uid,
      displayName: user.displayName || user.name || "Google User",
      email: user.email || "",
      photoURL: user.photoURL || user.picture || "",
      isGuest: Boolean(user.isAnonymous),
      updatedAt: new Date().toISOString()
    };
    localStorage.setItem(`astrogpt_profile_${user.uid}`, JSON.stringify(profile));
    if (this.db && user.uid) {
      try {
        await withTimeout(setDoc(doc(this.db, "users", user.uid), {
          ...profile,
          updatedAt: serverTimestamp()
        }, { merge: true }), 8000, "Firebase profile");
      } catch (err) {
        console.warn("[Firestore] Profile save note:", err.message);
      }
    }
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

  uid() {
    return this.currentUser ? this.currentUser.uid : "guest";
  }

  async ready() {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  async saveCollectionItem(subcollection, data, localKeyPrefix) {
    await this.ready();
    const uid = this.uid();
    const record = {
      ...toPlain(data),
      savedAt: new Date().toISOString(),
      userId: uid,
      isGuest: this.isGuest
    };

    const key = `${localKeyPrefix}_${uid}`;
    const existing = JSON.parse(localStorage.getItem(key) || "[]");
    existing.unshift(record);
    localStorage.setItem(key, JSON.stringify(existing.slice(0, 50)));

    if (this.db && uid) {
      try {
        const colRef = collection(this.db, "users", uid, subcollection);
        const docRef = await withTimeout(addDoc(colRef, {
          ...record,
          createdAt: serverTimestamp()
        }), 8000, "Firebase write");
        return { success: true, id: docRef.id, saved: true };
      } catch (err) {
        console.warn(`[Firestore] Saved ${subcollection} locally:`, err.message);
        return { success: true, saved: false, reason: err.message };
      }
    }
    return { success: true, saved: false };
  }

  async getCollectionItems(subcollection, localKeyPrefix) {
    const uid = this.uid();
    const local = JSON.parse(localStorage.getItem(`${localKeyPrefix}_${uid}`) || "[]");

    if (this.db && uid) {
      try {
        const colRef = collection(this.db, "users", uid, subcollection);
        const q = query(colRef, orderBy("createdAt", "desc"), limit(20));
        const snapshot = await withTimeout(getDocs(q), 8000, "Firebase read");
        const records = [];
        snapshot.forEach((item) => records.push({ id: item.id, ...item.data() }));
        if (records.length > 0) return records;
      } catch (err) {
        console.warn(`[Firestore] Reading ${subcollection} from local store:`, err.message);
      }
    }
    return local;
  }

  saveHoroscope(horoscopeData) {
    return this.saveCollectionItem("horoscopes", horoscopeData, "astrogpt_horoscopes");
  }

  getHoroscopes() {
    return this.getCollectionItems("horoscopes", "astrogpt_horoscopes");
  }

  saveMatchSession(matchData) {
    return this.saveCollectionItem("matches", matchData, "astrogpt_matches");
  }

  getMatchSessions() {
    return this.getCollectionItems("matches", "astrogpt_matches");
  }

  saveSign(signData) {
    return this.saveCollectionItem("signs", signData, "astrogpt_signs");
  }

  getSigns() {
    return this.getCollectionItems("signs", "astrogpt_signs");
  }
}

export const astroFirebase = new AstroFirebaseManager();
astroFirebase.initialize();

export function setupAuthUI(containerElement) {
  if (!containerElement) return;

  function update() {
    const user = astroFirebase.currentUser;
    const isGuest = astroFirebase.isGuest || !user || user.isAnonymous;

    if (!isGuest && user) {
      containerElement.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px; background: rgba(30,16,56,.75); padding: 4px 10px 4px 5px; border-radius: 999px; border: 1px solid rgba(214,173,92,.35);">
          <img src="${user.photoURL || "/favicon.svg?v=2"}" alt="Avatar" style="width: 28px; height: 28px; border-radius: 50%; border: 1px solid #d6ad5c; object-fit: cover;" />
          <div style="display: flex; flex-direction: column; line-height: 1.1;">
            <span style="font-size: 11px; font-weight: 600; color: #fff8e7;">${user.displayName || "Google User"}</span>
            <span style="font-size: 9px; color: #a855f7;">Login · Google</span>
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
          <button id="authGoogleSignInBtn" title="Current login: Guest Mode. Sign in with Google." aria-label="Current login: Guest Mode. Sign in with Google." style="display: inline-flex; align-items: center; gap: 6px; background: linear-gradient(135deg, rgba(214,173,92,.2), rgba(168,85,247,.2)); border: 1px solid rgba(214,173,92,.5); color: #f1d38b; padding: 6px 12px; border-radius: 999px; font-size: 11px; font-weight: 600; cursor: pointer; transition: 0.2s ease;">
            <svg width="12" height="12" viewBox="0 0 24 24"><path fill="#f1d38b" d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.761H12.545z"/></svg>
            Login · Guest Mode
          </button>
        </div>
      `;
      const signInBtn = containerElement.querySelector("#authGoogleSignInBtn");
      if (signInBtn) {
        signInBtn.onclick = async () => {
          try {
            signInBtn.disabled = true;
            signInBtn.textContent = "Opening Google...";
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

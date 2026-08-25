// Loaded only when data/firebase-config.json holds a real web config (see scripts/build.mjs).
// Exposes exactly one object, window.casCloud; the main script listens for "cas-cloud-ready".
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, onAuthStateChanged, signOut, deleteUser } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const cfg = JSON.parse(document.getElementById("cas-firebase").textContent);
const app = initializeApp(cfg);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();
getRedirectResult(auth).catch(() => {});

window.casCloud = {
  async signIn() {
    try { await signInWithPopup(auth, provider); }
    catch (e) {
      if (e && e.code === "auth/popup-blocked") return signInWithRedirect(auth, provider);
      throw e;
    }
  },
  signOut() { return signOut(auth); },
  async load() {
    const u = auth.currentUser;
    if (!u) return null;
    const snap = await getDoc(doc(db, "users", u.uid));
    return snap.exists() ? snap.data() : null;
  },
  async save(s) {
    const u = auth.currentUser;
    if (!u) return;
    await setDoc(doc(db, "users", u.uid), {
      displayName: u.displayName || "", email: u.email || "", uid: u.uid,
      name: s.name || "", counts: s.counts || {}, ia: s.ia, sub: s.sub || {}, appr: s.appr || {}, notes: s.notes || {},
      updated: s.updated || 0, updatedAt: serverTimestamp(),
    });
  },
  async deleteMyData() {
    const u = auth.currentUser;
    if (!u) return;
    await deleteDoc(doc(db, "users", u.uid));
    try { await deleteUser(u); }
    catch (e) { try { await signOut(auth); } catch (_) {} throw e; }
  },
  onUser(cb) { onAuthStateChanged(auth, (u) => cb(u ? { uid: u.uid, displayName: u.displayName, email: u.email } : null)); },
};
window.dispatchEvent(new Event("cas-cloud-ready"));

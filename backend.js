// 接好料 ReMat：連接 Firebase（資料庫 + 登入）。一般不需要修改這個檔案。
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, doc, collection, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc,
  onSnapshot, query, where, orderBy, limit
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

function ready(api) {
  window.RematBackend = api;
  window.dispatchEvent(new Event("remat-backend"));
}

const cfg = window.REMAT_FIREBASE_CONFIG;
if (!cfg || !cfg.apiKey || /請貼上/.test(cfg.apiKey) || !cfg.projectId) {
  ready({ error: "config" });
} else {
  try {
    start(cfg);
  } catch (e) {
    console.error(e);
    ready({ error: "init" });
  }
}

function start(cfg) {
  const app = initializeApp(cfg);
  const fs = getFirestore(app);
  const auth = getAuth(app);
  auth.languageCode = "zh-TW";

  const CODES = {
    "permission-denied": "permission_denied",
    "unauthenticated": "permission_denied",
    "unavailable": "unavailable",
    "deadline-exceeded": "unavailable",
    "resource-exhausted": "resource_exhausted",
    "invalid-argument": "invalid_argument",
    "failed-precondition": "invalid_argument",
    "not-found": "not_found"
  };
  const mapErr = (e) => ({ code: CODES[e && e.code] || (e && e.code) || "unknown", message: (e && e.message) || "" });
  const guard = async (fn) => { try { return await fn(); } catch (e) { console.error(e); throw mapErr(e); } };

  const wrapDoc = (s) => ({ id: s.id, exists: s.exists(), data: () => s.data(), metadata: s.metadata });
  const wrapQuery = (s) => ({
    docs: s.docs.map((d) => ({ id: d.id, exists: true, data: () => d.data(), metadata: d.metadata })),
    size: s.size, empty: s.empty, metadata: s.metadata, docChanges: () => s.docChanges()
  });

  // update({a:{b:1}}) 只改 a.b，不會把整個 a 蓋掉
  const isPlain = (v) => v && typeof v === "object" && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
  function flatten(obj, prefix = "", out = {}) {
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      if (isPlain(v) && Object.keys(v).length) flatten(v, prefix + k + ".", out);
      else out[prefix + k] = v;
    }
    return out;
  }

  function D(ref) {
    return {
      id: ref.id,
      path: ref.path,
      get: () => guard(async () => wrapDoc(await getDoc(ref))),
      set: (d) => guard(() => setDoc(ref, d)),
      update: (d) => guard(() => updateDoc(ref, flatten(d))),
      delete: () => guard(() => deleteDoc(ref)),
      onSnapshot: (next, err) => onSnapshot(ref, (s) => next(wrapDoc(s)), (e) => { console.error(e); err && err(mapErr(e)); }),
      collection: (p) => C(collection(ref, p))
    };
  }
  function Q(q) {
    return {
      where: (f, op, v) => Q(query(q, where(f, op, v))),
      orderBy: (f, dir) => Q(query(q, orderBy(f, dir || "asc"))),
      limit: (n) => Q(query(q, limit(n))),
      get: () => guard(async () => wrapQuery(await getDocs(q))),
      onSnapshot: (next, err) => onSnapshot(q, (s) => next(wrapQuery(s)), (e) => { console.error(e); err && err(mapErr(e)); })
    };
  }
  function C(ref) {
    return Object.assign(Q(ref), {
      path: ref.path,
      doc: (id) => D(id ? doc(ref, id) : doc(ref)),
      add: (d) => guard(async () => D(await addDoc(ref, d)))
    });
  }
  const db = { doc: (p) => D(doc(fs, p)), collection: (p) => C(collection(fs, p)) };

  const AUTH_MSG = {
    "auth/invalid-credential": "Email 或密碼不對",
    "auth/wrong-password": "Email 或密碼不對",
    "auth/user-not-found": "這個 Email 還沒註冊，請按「註冊新帳號」",
    "auth/email-already-in-use": "這個 Email 已經註冊過了，請直接按「登入」",
    "auth/weak-password": "密碼至少要 6 個字",
    "auth/invalid-email": "Email 格式不對",
    "auth/missing-password": "請輸入密碼",
    "auth/popup-closed-by-user": "登入視窗被關掉了，請再試一次",
    "auth/cancelled-popup-request": "登入視窗被關掉了，請再試一次",
    "auth/popup-blocked": "瀏覽器擋住了登入視窗，請允許彈出視窗，或改用 Email 登入",
    "auth/unauthorized-domain": "這個網址還沒加進 Firebase 的「已授權網域」，請照上線教學設定",
    "auth/operation-not-allowed": "這種登入方式還沒在 Firebase 開啟，請照上線教學設定",
    "auth/too-many-requests": "嘗試太多次了，請稍等幾分鐘再試",
    "auth/network-request-failed": "網路連線失敗，請檢查網路"
  };
  const authGuard = async (fn) => {
    try { return await fn(); }
    catch (e) { console.error(e); throw { code: e && e.code, message: AUTH_MSG[e && e.code] || ("登入失敗（" + ((e && e.code) || "未知錯誤") + "）") }; }
  };

  ready({
    db,
    onAuth: (cb) => onAuthStateChanged(auth, (u) => cb(u ? { uid: u.uid, email: u.email || "", name: u.displayName || "" } : null)),
    isAdmin: async (uid) => { try { return (await getDoc(doc(fs, "admins", uid))).exists(); } catch (e) { return false; } },
    google: () => authGuard(() => signInWithPopup(auth, new GoogleAuthProvider())),
    emailIn: (email, pw) => authGuard(() => signInWithEmailAndPassword(auth, email, pw)),
    emailUp: (email, pw) => authGuard(() => createUserWithEmailAndPassword(auth, email, pw)),
    reset: (email) => authGuard(() => sendPasswordResetEmail(auth, email)),
    signOut: () => signOut(auth)
  });
}

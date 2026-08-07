import { firebaseCloudSaveConfig } from './firebase-config.js';
import { bindFirebaseAnalytics, GameAnalytics } from './analytics.js';

const FIREBASE_VERSION = '10.12.5';
const CLOUD_SAVE_COLLECTION = 'gameSaves';
const CLOUD_SAVE_DOC = 'default';

let firebaseReady = false;
let firebaseLoading = null;
let app = null;
let auth = null;
let db = null;
let analyticsBound = false;
let currentUser = null;
let queuedSave = null;
let syncTimer = null;
const authChangeCallbacks = [];
let lastError = '';
const CLOUD_RETRY_DELAYS = [400, 1200, 2500];

const state = {
  configured: !!firebaseCloudSaveConfig.enabled,
  ready: false,
  authResolved: false,
  signedIn: false,
  userId: '',
  email: '',
  displayName: '',
  photoURL: '',
  lastSyncAt: 0,
  lastError: ''
};

function hasFirebaseConfig() {
  const cfg = firebaseCloudSaveConfig.firebaseConfig || {};
  return !!(
    firebaseCloudSaveConfig.enabled &&
    cfg.apiKey &&
    cfg.authDomain &&
    cfg.projectId &&
    cfg.appId
  );
}

async function loadFirebaseModules() {
  if (firebaseLoading) return firebaseLoading;

  firebaseLoading = (async () => {
    const [appModule, authModule, firestoreModule] = await Promise.all([
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-auth.js`),
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-firestore.js`)
    ]);
    let analyticsModule = null;
    try {
      analyticsModule = await import(
        `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-analytics.js`
      );
    } catch (analyticsLoadError) {
      console.warn('[Analytics] firebase-analytics 載入失敗', analyticsLoadError);
    }
    return [appModule, authModule, firestoreModule, analyticsModule];
  })();

  return firebaseLoading;
}

async function initFirebaseAnalytics(analyticsModule) {
  if (analyticsBound) return;
  const measurementId = String(firebaseCloudSaveConfig.firebaseConfig?.measurementId || '').trim();
  if (!measurementId) {
    console.warn('[Analytics] measurementId 未設定，Firebase Analytics 已略過。');
    return;
  }
  if (!analyticsModule?.getAnalytics || !app) {
    console.warn('[Analytics] firebase-analytics SDK 未就緒。');
    return;
  }
  try {
    const supported = typeof analyticsModule.isSupported === 'function'
      ? await analyticsModule.isSupported()
      : true;
    if (!supported) {
      console.warn('[Analytics] 目前環境不支援 Firebase Analytics。');
      return;
    }
    const fbAnalytics = analyticsModule.getAnalytics(app);
    bindFirebaseAnalytics(fbAnalytics, analyticsModule);
    analyticsBound = true;
  } catch (error) {
    console.warn('[Analytics] 初始化失敗', error);
  }
}

async function createPersistentAuth(authModule) {
  const persistenceOptions = [
    authModule.indexedDBLocalPersistence,
    authModule.browserLocalPersistence
  ].filter(Boolean);

  const persistentAuth = authModule.getAuth(app);
  if (authModule.setPersistence) {
    for (const persistence of persistenceOptions) {
      try {
        await authModule.setPersistence(persistentAuth, persistence);
        break;
      } catch (persistenceError) {
        console.warn('Firebase auth persistence setup failed', persistenceError);
      }
    }
  }

  return persistentAuth;
}

function cloudDocRef(firestoreModule) {
  return firestoreModule.doc(
    db,
    'users',
    currentUser.uid,
    CLOUD_SAVE_COLLECTION,
    CLOUD_SAVE_DOC
  );
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function notifyAuthChange() {
  authChangeCallbacks.forEach(cb => cb(state));
}

async function ensureFreshAuthToken() {
  if (!currentUser || typeof currentUser.getIdToken !== 'function') return;
  try {
    await currentUser.getIdToken(true);
  } catch (tokenError) {
    console.warn('Firebase auth token refresh failed', tokenError);
  }
}

async function waitForSignedInUser(authModule, timeoutMs = 10000) {
  if (auth?.currentUser) return auth.currentUser;
  if (currentUser) return currentUser;

  return new Promise(resolve => {
    let settled = false;
    let unsubscribe = () => {};
    const finish = user => {
      if (settled) return;
      settled = true;
      unsubscribe();
      resolve(user || auth?.currentUser || currentUser || null);
    };

    unsubscribe = authModule.onAuthStateChanged(auth, user => {
      if (user) finish(user);
    });
    setTimeout(() => finish(null), timeoutMs);
  });
}

export function getCloudSaveState() {
  return { ...state, lastError };
}

function setCurrentCloudUser(user) {
  currentUser = user || null;
  state.signedIn = !!currentUser;
  state.userId = currentUser ? currentUser.uid : '';
  state.email = currentUser?.email || '';
  state.displayName = currentUser?.displayName || '';
  state.photoURL = currentUser?.photoURL || '';
  state.authResolved = true;
}

// 登錄狀態監聽：auth 狀態恢復後，通知外部更新 UI
export function onCloudAuthChange(callback) {
  authChangeCallbacks.push(callback);
}

export async function initCloudSave() {
  state.configured = hasFirebaseConfig();
  if (!state.configured) {
    state.authResolved = true;
    return state;
  }
  if (firebaseReady) return state;

  try {
    const [appModule, authModule, firestoreModule, analyticsModule] = await loadFirebaseModules();
    app = appModule.initializeApp(firebaseCloudSaveConfig.firebaseConfig);
    auth = await createPersistentAuth(authModule);
    db = firestoreModule.getFirestore(app);
    await initFirebaseAnalytics(analyticsModule);

    const initialAuthReady = new Promise(resolve => {
      const unsubscribe = authModule.onAuthStateChanged(auth, user => {
        unsubscribe();
        setCurrentCloudUser(user);
        resolve(user);
      });
    });

    authModule.onAuthStateChanged(auth, async user => {
      setCurrentCloudUser(user);
      GameAnalytics.identify(user ? user.uid : null);
      await ensureFreshAuthToken();
      // 通知所有已註冊的 UI 更新回呼
      notifyAuthChange();
    });

    authModule.getRedirectResult(auth)
      .then(result => {
        if (result && result.user) {
          console.log("Redirect sign-in successful", result.user);
        }
      })
      .catch(error => {
        console.warn("Redirect sign-in failed", error);
        lastError = error?.message || String(error);
        state.lastError = lastError;
      });

    if (firebaseCloudSaveConfig.autoAnonymousSignIn) {
      await authModule.signInAnonymously(auth);
    }

    await initialAuthReady;
    firebaseReady = true;
    state.ready = true;
    lastError = '';
    return state;
  } catch (error) {
    lastError = error?.message || String(error);
    state.lastError = lastError;
    state.authResolved = true;
    console.warn('Cloud save init failed', error);
    return state;
  }
}

export async function signInWithGoogle() {
  await initCloudSave();
  if (!state.configured || !auth) {
    throw new Error('Firebase cloud save is not configured.');
  }

  const [, authModule] = await loadFirebaseModules();

  // 若在原生 Android 環境，使用自訂的原生 Google 登入插件
  const isNative = typeof window !== 'undefined'
    && window.Capacitor
    && window.Capacitor.isNativePlatform
    && window.Capacitor.isNativePlatform();

  if (isNative && window.Capacitor?.Plugins?.NativeGoogleAuth) {
    const result = await window.Capacitor.Plugins.NativeGoogleAuth.signIn();
    const credential = authModule.GoogleAuthProvider.credential(result.idToken);
    const userCredential = await authModule.signInWithCredential(auth, credential);
    const stableUser = await waitForSignedInUser(authModule);
    setCurrentCloudUser(stableUser || userCredential.user);
    GameAnalytics.log('login', { method: 'google' });
    GameAnalytics.identify((stableUser || userCredential.user)?.uid || null);
    await ensureFreshAuthToken();
    notifyAuthChange();
    return getCloudSaveState();
  }

  // 網頁環境回退方案
  const provider = new authModule.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  // 建立一個 promise 來等待 onAuthStateChanged 確認登入狀態
  const waitForAuth = new Promise(resolve => {
    const unsubscribe = authModule.onAuthStateChanged(auth, user => {
      if (user) {
        unsubscribe();
        resolve(user);
      }
    });
    // 設定超時保護，避免永遠等待
    setTimeout(() => { unsubscribe(); resolve(null); }, 30000);
  });

  try {
    await authModule.signInWithPopup(auth, provider);
  } catch (popupError) {
    try {
      await authModule.signInWithRedirect(auth, provider);
    } catch (redirectError) {
      lastError = redirectError?.code || redirectError?.message || popupError?.code || popupError?.message || String(redirectError || popupError);
      state.lastError = lastError;
      throw redirectError;
    }
  }

  const signedInUser = await waitForAuth;
  if (signedInUser) {
    setCurrentCloudUser(signedInUser);
    GameAnalytics.log('login', { method: 'google' });
    GameAnalytics.identify(signedInUser.uid);
    await ensureFreshAuthToken();
    notifyAuthChange();
  }

  return getCloudSaveState();
}

export async function signOutCloudSave() {
  await initCloudSave();
  if (!auth) return getCloudSaveState();

  const [, authModule] = await loadFirebaseModules();
  await authModule.signOut(auth);
  if (typeof window !== 'undefined' && window.Capacitor?.Plugins?.NativeGoogleAuth) {
    try {
      await window.Capacitor.Plugins.NativeGoogleAuth.signOut();
    } catch (nativeErr) {
      console.warn('Native Google sign-out failed', nativeErr);
    }
  }
  setCurrentCloudUser(null);
  notifyAuthChange();
  return getCloudSaveState();
}

export async function loadCloudSave() {
  await initCloudSave();
  if (!state.configured || !currentUser || !db) return null;

  const [, , firestoreModule] = await loadFirebaseModules();
  for (let attempt = 0; attempt <= CLOUD_RETRY_DELAYS.length; attempt += 1) {
    try {
      await ensureFreshAuthToken();
      const snapshot = await firestoreModule.getDoc(cloudDocRef(firestoreModule));
      if (!snapshot.exists()) {
        lastError = '';
        state.lastError = '';
        return null;
      }
      lastError = '';
      state.lastError = '';
      return snapshot.data();
    } catch (error) {
      lastError = error?.message || String(error);
      state.lastError = lastError;
      if (attempt >= CLOUD_RETRY_DELAYS.length) {
        console.warn('Cloud save load failed', error);
        return null;
      }
      await delay(CLOUD_RETRY_DELAYS[attempt]);
    }
  }

  return null;
}

export async function uploadCloudSave(saveData) {
  await initCloudSave();
  if (!state.configured || !currentUser || !db || !saveData) return false;

  const [, , firestoreModule] = await loadFirebaseModules();
  for (let attempt = 0; attempt <= CLOUD_RETRY_DELAYS.length; attempt += 1) {
    try {
      await ensureFreshAuthToken();
      await firestoreModule.setDoc(cloudDocRef(firestoreModule), {
        ...saveData,
        cloudUpdatedAt: Date.now()
      }, { merge: true });
      state.lastSyncAt = Date.now();
      lastError = '';
      state.lastError = '';
      return true;
    } catch (error) {
      lastError = error?.message || String(error);
      state.lastError = lastError;
      if (attempt >= CLOUD_RETRY_DELAYS.length) {
        console.warn('Cloud save upload failed', error);
        return false;
      }
      await delay(CLOUD_RETRY_DELAYS[attempt]);
    }
  }

  return false;
}

export function queueCloudSave(saveData) {
  queuedSave = saveData;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    uploadCloudSave(queuedSave);
  }, 2500);
}

export async function flushCloudSave(saveData) {
  clearTimeout(syncTimer);
  queuedSave = saveData || queuedSave;
  return uploadCloudSave(queuedSave);
}

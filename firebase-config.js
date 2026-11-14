/**
 * ATELIER HIDE — Firebase Backend Configuration
 * Pure Vanilla JavaScript • Student-Friendly Architecture
 * 
 * This file configures the connection to Google Firebase services:
 * 1. Firebase App Initialization
 * 2. Firebase Authentication (User Registration, Login, Sessions)
 * 3. Cloud Firestore (Database for Products, Cart, Orders, Custom Designs)
 * 4. Firebase Storage (Static product assets, textures)
 * 
 * HOW TO CONNECT YOUR REAL FIREBASE PROJECT:
 * 1. Go to https://console.firebase.google.com/
 * 2. Create a project named "atelier-hide" (or select an existing one)
 * 3. Add a Web App (</>) and copy your `firebaseConfig` object below
 * 4. Enable Authentication (Email/Password) in the Firebase Console
 * 5. Enable Cloud Firestore in Production or Test mode
 */

// Central Firebase Project Configuration
const firebaseConfig = {
  apiKey: "AIzaSyCegHkQLTGDKRH7sLrJmIYkp4A4cm9iZ0w",
  authDomain: "katryx-ab8ac.firebaseapp.com",
  projectId: "katryx-ab8ac",
  storageBucket: "katryx-ab8ac.firebasestorage.app",
  messagingSenderId: "922336729340",
  appId: "1:922336729340:web:9cf9289c506f85e66edf79",
  measurementId: "G-H4PJB5GSYG"
};

// Toggle for Firebase Local Emulator Suite (set to true during local automated tests or emulator runs)
const USE_FIREBASE_EMULATORS = false;

// Global Firebase service instances
let firebaseApp = null;
let firebaseAuth = null;
let firestoreDb = null;
let firebaseStorage = null;

// Track whether live Firebase backend is active or local resilience mode is engaged
let isFirebaseLive = false;

/**
 * Initializes Firebase using official Firebase Web SDK (v9/v10 compat).
 * If the external SDK script is unreachable (e.g. offline examination or no internet in viva),
 * it gracefully switches to an in-memory/localStorage adapter so the application never breaks.
 */
function initFirebaseApp() {
  try {
    const configIsConfigured =
      firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith("PASTE_") &&
      firebaseConfig.projectId && firebaseConfig.projectId !== "YOUR_PROJECT_ID" &&
      firebaseConfig.appId && firebaseConfig.appId !== "YOUR_FIREBASE_APP_ID";

    if (!configIsConfigured) {
      console.warn("Firebase is not connected yet. Add your real Web App config in firebase-config.js.");
      return initLocalFallbackAdapter();
    }

    if (typeof firebase !== 'undefined' && firebase.initializeApp) {
      // Check if Firebase is already initialized
      if (!firebase.apps.length) {
        firebaseApp = firebase.initializeApp(firebaseConfig);
      } else {
        firebaseApp = firebase.app();
      }

      firebaseAuth = firebase.auth();
      firestoreDb = firebase.firestore();

      if (firebase.storage) {
        firebaseStorage = firebase.storage();
      }

      // Configure local emulators if enabled
      if (USE_FIREBASE_EMULATORS) {
        try {
          firebaseAuth.useEmulator('http://localhost:9099');
          firestoreDb.useEmulator('localhost', 8080);
        } catch (emErr) {
          console.info('Firebase emulators not connected:', emErr.message);
        }
      }

      isFirebaseLive = true;
      console.log('✓ Firebase successfully initialized: katryx-ab8ac');
      return { app: firebaseApp, auth: firebaseAuth, db: firestoreDb, storage: firebaseStorage, isLive: true };
    } else {
      console.info('Firebase CDN SDK not loaded in current environment. Engaging Atelier Hide Offline Resilience Adapter.');
      return initLocalFallbackAdapter();
    }
  } catch (err) {
    console.warn('Firebase initialization notice:', err.message);
    return initLocalFallbackAdapter();
  }
}

/**
 * High-reliability fallback adapter.
 * Emulates identical Firestore and Auth contracts for offline university demonstrations,
 * headless test runners, or environments without live cloud credentials.
 */
function initLocalFallbackAdapter() {
  isFirebaseLive = false;

  // Local state storage keys
  const STORAGE_USERS = 'atelier_fb_users';
  const STORAGE_CURRENT_USER = 'atelier_fb_current_user';
  const STORAGE_FIRESTORE = 'atelier_fb_firestore_data';

  // Read/write helpers
  const getStore = (key, fallback = {}) => {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : fallback;
    } catch {
      return fallback;
    }
  };

  const setStore = (key, val) => {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch (e) {
      console.warn('Fallback store error:', e);
    }
  };

  // Auth mock listeners
  const authListeners = [];

  const mockAuth = {
    currentUser: getStore(STORAGE_CURRENT_USER, null),
    onAuthStateChanged: (callback) => {
      authListeners.push(callback);
      // Immediately trigger with current state
      setTimeout(() => callback(mockAuth.currentUser), 50);
      return () => {
        const idx = authListeners.indexOf(callback);
        if (idx > -1) authListeners.splice(idx, 1);
      };
    },
    createUserWithEmailAndPassword: async (email, password) => {
      if (!email || !password) throw new Error('Email and password required.');
      if (password.length < 6) throw new Error('Password must be at least 6 characters.');
      const users = getStore(STORAGE_USERS, []);
      if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
        throw new Error('An account with this email already exists.');
      }
      const newUser = {
        uid: 'user_' + Date.now(),
        email: email.toLowerCase(),
        displayName: email.split('@')[0],
        createdAt: new Date().toISOString()
      };
      users.push({ ...newUser, password });
      setStore(STORAGE_USERS, users);
      mockAuth.currentUser = newUser;
      setStore(STORAGE_CURRENT_USER, newUser);
      authListeners.forEach(fn => fn(newUser));
      return { user: newUser };
    },
    signInWithEmailAndPassword: async (email, password) => {
      const users = getStore(STORAGE_USERS, []);
      const match = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
      if (!match) throw new Error('Invalid email or password.');
      const userObj = {
        uid: match.uid,
        email: match.email,
        displayName: match.displayName || match.email.split('@')[0],
        createdAt: match.createdAt
      };
      mockAuth.currentUser = userObj;
      setStore(STORAGE_CURRENT_USER, userObj);
      authListeners.forEach(fn => fn(userObj));
      return { user: userObj };
    },
    signOut: async () => {
      mockAuth.currentUser = null;
      localStorage.removeItem(STORAGE_CURRENT_USER);
      authListeners.forEach(fn => fn(null));
    }
  };

  // Firestore mock collection emulator
  const mockDb = {
    collection: (colName) => {
      return {
        doc: (docId) => {
          const autoId = docId || 'doc_' + Math.random().toString(36).substring(2, 10);
          return {
            id: autoId,
            get: async () => {
              const all = getStore(STORAGE_FIRESTORE, {});
              const col = all[colName] || {};
              const docData = col[autoId];
              return {
                exists: !!docData,
                id: autoId,
                data: () => docData ? JSON.parse(JSON.stringify(docData)) : undefined
              };
            },
            set: async (data, options = {}) => {
              const all = getStore(STORAGE_FIRESTORE, {});
              if (!all[colName]) all[colName] = {};
              if (options.merge && all[colName][autoId]) {
                all[colName][autoId] = { ...all[colName][autoId], ...data };
              } else {
                all[colName][autoId] = { ...data };
              }
              setStore(STORAGE_FIRESTORE, all);
              return true;
            },
            update: async (data) => {
              const all = getStore(STORAGE_FIRESTORE, {});
              if (!all[colName] || !all[colName][autoId]) {
                throw new Error(`Document ${autoId} does not exist.`);
              }
              all[colName][autoId] = { ...all[colName][autoId], ...data };
              setStore(STORAGE_FIRESTORE, all);
              return true;
            },
            delete: async () => {
              const all = getStore(STORAGE_FIRESTORE, {});
              if (all[colName] && all[colName][autoId]) {
                delete all[colName][autoId];
                setStore(STORAGE_FIRESTORE, all);
              }
              return true;
            }
          };
        },
        add: async (data) => {
          const autoId = 'doc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
          const all = getStore(STORAGE_FIRESTORE, {});
          if (!all[colName]) all[colName] = {};
          all[colName][autoId] = { ...data, id: autoId };
          setStore(STORAGE_FIRESTORE, all);
          return { id: autoId, get: async () => ({ id: autoId, data: () => all[colName][autoId] }) };
        },
        get: async () => {
          const all = getStore(STORAGE_FIRESTORE, {});
          const col = all[colName] || {};
          const docs = Object.keys(col).map(id => ({
            id,
            data: () => col[id]
          }));
          return {
            empty: docs.length === 0,
            size: docs.length,
            docs,
            forEach: (cb) => docs.forEach(cb)
          };
        },
        where: (field, op, val) => {
          return {
            get: async () => {
              const all = getStore(STORAGE_FIRESTORE, {});
              const col = all[colName] || {};
              const filtered = Object.keys(col)
                .map(id => ({ id, data: () => col[id] }))
                .filter(doc => {
                  const d = doc.data();
                  if (op === '==') return d[field] === val;
                  if (op === '!=') return d[field] !== val;
                  if (op === '>') return d[field] > val;
                  if (op === '<') return d[field] < val;
                  return false;
                });
              return {
                empty: filtered.length === 0,
                size: filtered.length,
                docs: filtered,
                forEach: (cb) => filtered.forEach(cb)
              };
            },
            orderBy: (orderField, direction = 'asc') => ({
              get: async () => {
                const all = getStore(STORAGE_FIRESTORE, {});
                const col = all[colName] || {};
                let filtered = Object.keys(col)
                  .map(id => ({ id, data: () => col[id] }))
                  .filter(doc => doc.data()[field] === val);
                filtered.sort((a, b) => {
                  const aVal = a.data()[orderField] || 0;
                  const bVal = b.data()[orderField] || 0;
                  return direction === 'desc' ? (bVal > aVal ? 1 : -1) : (aVal > bVal ? 1 : -1);
                });
                return {
                  empty: filtered.length === 0,
                  size: filtered.length,
                  docs: filtered,
                  forEach: (cb) => filtered.forEach(cb)
                };
              }
            })
          };
        },
        orderBy: (orderField, direction = 'asc') => ({
          get: async () => {
            const all = getStore(STORAGE_FIRESTORE, {});
            const col = all[colName] || {};
            const docs = Object.keys(col).map(id => ({ id, data: () => col[id] }));
            docs.sort((a, b) => {
              const aVal = a.data()[orderField] || 0;
              const bVal = b.data()[orderField] || 0;
              return direction === 'desc' ? (bVal > aVal ? 1 : -1) : (aVal > bVal ? 1 : -1);
            });
            return {
              empty: docs.length === 0,
              size: docs.length,
              docs,
              forEach: (cb) => docs.forEach(cb)
            };
          }
        })
      };
    }
  };

  firebaseAuth = mockAuth;
  firestoreDb = mockDb;

  return {
    app: { name: '[Atelier-Hide-Local-Adapter]' },
    auth: mockAuth,
    db: mockDb,
    storage: null,
    isLive: false
  };
}

// Export for Node.js test runners and ES environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    firebaseConfig,
    initFirebaseApp,
    initLocalFallbackAdapter
  };
}

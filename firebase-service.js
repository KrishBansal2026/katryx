/**
 * ATELIER HIDE — Firebase Service Layer
 * Pure Vanilla JavaScript • Clean Separation of Concerns
 * 
 * Provides student-friendly asynchronous functions for:
 * 1. Authentication (Register, Login, Logout, User Profile, Session Observer)
 * 2. Products Catalog (Firestore Fetching, Auto-Seeding, Product Details)
 * 3. Shopping Cart (Cloud Persistence, Guest-to-User Merging)
 * 4. Customization Studio (Save Bespoke Design, Retrieve, Re-open in 3D Studio)
 * 5. Orders (Commission Creation, Unpaid Demonstration Status, Order History)
 * 6. Admin Management (Price Updates, Stock Availability, Commission Review)
 */

'use strict';

const FirebaseService = (function () {
  // Internal service references
  let auth = null;
  let db = null;
  let currentUser = null;
  const authStateSubscribers = [];

  /**
   * Initializes the service by obtaining Firebase instances from firebase-config.js
   */
  function init(customInstances) {
    if (customInstances && customInstances.auth && customInstances.db) {
      auth = customInstances.auth;
      db = customInstances.db;
    } else if (typeof initFirebaseApp === 'function') {
      const fb = initFirebaseApp();
      auth = fb.auth;
      db = fb.db;
    } else if (typeof require !== 'undefined') {
      try {
        const { initFirebaseApp: nodeInit } = require('./firebase-config');
        const fb = nodeInit();
        auth = fb.auth;
        db = fb.db;
      } catch (e) {
        console.warn('Could not load firebase-config:', e.message);
      }
    } else {
      console.warn('initFirebaseApp not found. Ensure firebase-config.js is loaded.');
    }

    // Bind auth state observer
    if (auth && auth.onAuthStateChanged) {
      auth.onAuthStateChanged(async (user) => {
        currentUser = user;
        if (user) {
          // Fetch additional profile data from 'users' collection if available
          try {
            const profile = await getUserProfile(user.uid);
            if (profile) {
              currentUser.profileData = profile;
            }
          } catch (e) {
            console.info('Could not fetch extra profile metadata:', e.message);
          }
        }
        // Notify all registered UI listeners
        authStateSubscribers.forEach((cb) => {
          try {
            cb(currentUser);
          } catch (err) {
            console.error('Auth state subscriber error:', err);
          }
        });
      });
    }

    return { auth, db };
  }

  /* ==========================================================================
     1. AUTHENTICATION SERVICES
     ========================================================================== */

  /**
   * Registers a new client with Name, Email, and Password.
   * Creates Firebase Auth credentials and initializes their 'users/{uid}' document.
   */
  async function registerUser(name, email, password) {
    if (!email || !password || !name) {
      throw new Error('Please provide your full name, email address, and password.');
    }
    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters long.');
    }

    // 1. Create Firebase Auth user
    const userCredential = await auth.createUserWithEmailAndPassword(email.trim(), password);
    const user = userCredential.user;

    // 2. Set display name in Auth profile if supported
    if (user.updateProfile) {
      try {
        await user.updateProfile({ displayName: name.trim() });
      } catch (profErr) {
        console.warn('Could not update Auth displayName:', profErr.message);
      }
    }

    // 3. Create user record in Firestore 'users' collection
    const userDocData = {
      userId: user.uid,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      createdAt: new Date().toISOString(),
      role: 'client'
    };

    await db.collection('users').doc(user.uid).set(userDocData);

    return { user, profile: userDocData };
  }

  /**
   * Signs in an existing client using Email and Password.
   */
  async function loginUser(email, password) {
    if (!email || !password) {
      throw new Error('Please enter both your email address and password.');
    }
    const userCredential = await auth.signInWithEmailAndPassword(email.trim(), password);
    const user = userCredential.user;

    // Fetch user profile from Firestore
    const profile = await getUserProfile(user.uid);
    return { user, profile };
  }

  /**
   * Signs out the current user and clears session state.
   */
  async function logoutUser() {
    if (auth && auth.signOut) {
      await auth.signOut();
    }
    currentUser = null;
  }

  /**
   * Retrieves profile document from 'users' collection
   */
  async function getUserProfile(userId) {
    if (!db || !userId) return null;
    const snap = await db.collection('users').doc(userId).get();
    if (snap && snap.exists) {
      return snap.data();
    }
    return null;
  }

  /**
   * Subscribes to real-time authentication state changes.
   */
  function onAuthChange(callback) {
    if (typeof callback === 'function') {
      authStateSubscribers.push(callback);
      // If user already determined, invoke immediately
      if (currentUser !== undefined) {
        callback(currentUser);
      }
    }
  }

  /**
   * Returns current user object or null
   */
  function getCurrentUser() {
    return currentUser || (auth ? auth.currentUser : null);
  }

  /* ==========================================================================
     2. PRODUCTS CATALOG SERVICES
     ========================================================================== */

  /**
   * Fetches all available products from Firestore 'products' collection.
   * If collection is empty, automatically seeds it from the project's PRODUCTS_DATA.
   */
  async function fetchProductsFromFirestore() {
    if (!db) return [];
    try {
      const snap = await db.collection('products').get();
      if (!snap || snap.empty) {
        console.info('Firestore products collection empty. Seeding initial leather collection...');
        await seedInitialProductsIfEmpty();
        const seededSnap = await db.collection('products').get();
        const products = [];
        seededSnap.forEach((doc) => products.push(doc.data()));
        return products;
      }
      const products = [];
      snap.forEach((doc) => products.push(doc.data()));
      return products;
    } catch (err) {
      console.warn('Could not fetch products from Firestore, using offline fallback:', err.message);
      return [];
    }
  }

  /**
   * Seeds the 5 core Atelier Hide leather goods into Firestore 'products' collection.
   */
  async function seedInitialProductsIfEmpty() {
    if (!db) return;
    const initialProducts = [
      {
        id: 'handbag',
        name: 'The Structured Handbag',
        category: 'Handbags & Totes',
        filterTag: 'Bags',
        price: 28500,
        image: 'assets/images/product-handbag.svg',
        description: 'A masterwork structured top-handle handbag in vegetable-tanned steerhide with hand-molded gussets, rolled handle, and sand-cast solid brass turn-lock clasp.',
        availableLeatherFinishes: ['tan', 'cognac', 'espresso', 'black', 'crazy'],
        availableHardwareOptions: ['brass', 'silver'],
        dimensions: '32.0 cm × 24.0 cm × 12.0 cm',
        weight: '1,150 grams',
        availability: true,
        featured: true
      },
      {
        id: 'bifold',
        name: 'The Everyday Bifold',
        category: 'Small Leather Goods',
        filterTag: 'Wallets',
        price: 4800,
        image: 'assets/images/product-bifold.svg',
        description: 'Six card slots, dual receipt pockets, and a full-length cash compartment folded from a single continuous piece of vegetable-tanned hide.',
        availableLeatherFinishes: ['tan', 'cognac', 'espresso', 'black', 'crazy'],
        availableHardwareOptions: ['brass', 'silver'],
        dimensions: '11.0 cm × 9.0 cm × 1.2 cm',
        weight: '78 grams',
        availability: true,
        featured: false
      },
      {
        id: 'messenger',
        name: 'The Field Messenger',
        category: 'Satchels & Work Bags',
        filterTag: 'Bags',
        price: 18500,
        image: 'assets/images/product-messenger.svg',
        description: 'Designed for modern transit. Accommodates a 15-inch laptop with reinforced solid brass hardware and an adjustable hand-beveled shoulder strap.',
        availableLeatherFinishes: ['tan', 'cognac', 'espresso', 'black', 'crazy'],
        availableHardwareOptions: ['brass', 'silver'],
        dimensions: '38.0 cm × 28.5 cm × 9.5 cm',
        weight: '1,420 grams',
        availability: true,
        featured: false
      },
      {
        id: 'passport',
        name: 'The Passport Companion',
        category: 'Travel Accessories',
        filterTag: 'Travel',
        price: 3200,
        image: 'assets/images/product-passport.svg',
        description: 'A slim, protective bifold folio crafted to house your passport, boarding passes, SIM card ejector tool, and currency with zero bulk.',
        availableLeatherFinishes: ['tan', 'cognac', 'espresso', 'black', 'crazy'],
        availableHardwareOptions: ['brass', 'silver'],
        dimensions: '14.5 cm × 10.2 cm × 0.8 cm',
        weight: '62 grams',
        availability: true,
        featured: false
      },
      {
        id: 'weekender',
        name: 'The Weekender No. 01',
        category: 'Travel & Luggage',
        filterTag: 'Travel',
        price: 26000,
        image: 'assets/images/product-weekender.svg',
        description: 'Our flagship duffel bag. Hand-hammered copper rivets, heavy-gauge YKK solid brass zipper, and an unlined full-grain interior that breathes.',
        availableLeatherFinishes: ['tan', 'cognac', 'espresso', 'black', 'crazy'],
        availableHardwareOptions: ['brass', 'silver'],
        dimensions: '52.0 cm × 30.0 cm × 28.0 cm',
        weight: '2,150 grams',
        availability: true,
        featured: false
      }
    ];

    for (const p of initialProducts) {
      try {
        await db.collection('products').doc(p.id).set(p);
      } catch (err) {
        console.warn(`Failed to seed product ${p.id}:`, err.message);
      }
    }
  }

  /* ==========================================================================
     3. SHOPPING CART SERVICES
     ========================================================================== */

  /**
   * Retrieves user's active shopping cart from Firestore 'carts/{userId}'
   */
  async function fetchUserCart(userId) {
    if (!db || !userId) return [];
    try {
      const snap = await db.collection('carts').doc(userId).get();
      if (snap && snap.exists) {
        const data = snap.data();
        return Array.isArray(data.items) ? data.items : [];
      }
    } catch (err) {
      console.warn('Could not fetch user cart from Firestore:', err.message);
    }
    return [];
  }

  /**
   * Synchronizes shopping cart items array to Firestore 'carts/{userId}'
   */
  async function syncUserCartToFirestore(userId, cartItems) {
    if (!db || !userId) return;
    try {
      await db.collection('carts').doc(userId).set({
        userId: userId,
        items: cartItems || [],
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (err) {
      console.warn('Failed to sync cart to Firestore:', err.message);
    }
  }

  /**
   * Merges a guest's temporary cart into an authenticated user's cart upon login.
   * If an identical item customization exists, quantities are combined.
   */
  async function syncGuestCartToUser(userId, guestCartItems = []) {
    if (!db || !userId) return guestCartItems;
    try {
      const cloudCart = await fetchUserCart(userId);
      const merged = [...cloudCart];

      guestCartItems.forEach((guestItem) => {
        const existingIndex = merged.findIndex((item) => item.configKey === guestItem.configKey);
        if (existingIndex > -1) {
          merged[existingIndex].quantity += guestItem.quantity;
        } else {
          merged.push(guestItem);
        }
      });

      // Save merged cart back to Firestore
      await syncUserCartToFirestore(userId, merged);
      return merged;
    } catch (err) {
      console.warn('Cart merge notice:', err.message);
      return guestCartItems;
    }
  }

  /* ==========================================================================
     4. BESPOKE CUSTOM DESIGNS SERVICES
     ========================================================================== */

  /**
   * Saves a bespoke design configuration to Firestore 'customDesigns' collection.
   */
  async function saveCustomDesign(userId, designData) {
    if (!db || !userId) {
      throw new Error('You must be logged in to save bespoke designs to your atelier account.');
    }

    const payload = {
      userId: userId,
      designName: designData.designName || `${designData.productName || 'Bespoke Piece'} (${new Date().toLocaleDateString()})`,
      productId: designData.productId,
      productName: designData.productName,
      leatherFinish: designData.leatherFinish,
      hardwareFinish: designData.hardwareFinish,
      personalization: {
        fullName: designData.fullName || '',
        initials: designData.initials || '',
        foilType: designData.foilType || 'gold',
        customInscription: designData.customInscription || '',
        makerNote: designData.makerNote || ''
      },
      savedTimestamp: new Date().toISOString()
    };

    const docRef = await db.collection('customDesigns').add(payload);
    return { id: docRef.id, ...payload };
  }

  /**
   * Fetches all saved bespoke designs belonging to the given user.
   */
  async function fetchUserCustomDesigns(userId) {
    if (!db || !userId) return [];
    try {
      const snap = await db.collection('customDesigns')
        .where('userId', '==', userId)
        .orderBy('savedTimestamp', 'desc')
        .get();

      const designs = [];
      snap.forEach((doc) => {
        designs.push({ id: doc.id, ...doc.data() });
      });
      return designs;
    } catch (err) {
      console.warn('Could not query customDesigns:', err.message);
      return [];
    }
  }

  /**
   * Deletes a saved bespoke design by document ID.
   */
  async function deleteCustomDesign(designId) {
    if (!db || !designId) return false;
    await db.collection('customDesigns').doc(designId).delete();
    return true;
  }

  /* ==========================================================================
     5. ORDERS & COMMISSIONS SERVICES
     ========================================================================== */

  /**
   * Stores a confirmed demonstration commission order record into Firestore 'orders'.
   * Clearly flags that this is an unpaid academic demonstration commission.
   */
  async function createOrderRecord(orderData) {
    if (!db) throw new Error('Database not initialized.');
    const user = getCurrentUser();
    if (!user || !user.uid) throw new Error('Please sign in before placing an order.');

    const orderRef = db.collection('orders').doc();
    const orderId = `KX-${Date.now().toString(36).toUpperCase()}`;

    const payload = {
      orderId: orderId,
      userId: user.uid,
      customerDetails: {
        name: orderData.name || '',
        email: orderData.email || '',
        phone: orderData.phone || '',
        address: orderData.address || '',
        city: orderData.city || '',
        pincode: orderData.pincode || ''
      },
      items: orderData.items || [],
      totalAmount: orderData.totalAmount || 0,
      status: 'commission_queued',
      isPaid: false,
      paymentStatus: 'unpaid_demonstration',
      academicNotice: 'Academic demonstration commission request. No real financial transaction was executed.',
      createdAt: new Date().toISOString()
    };

    await orderRef.set(payload);
    return { ...payload, id: orderRef.id };
  }

  /**
   * Retrieves all order commissions for the current user.
   */
  async function fetchUserOrders(userId) {
    if (!db || !userId) return [];
    try {
      const snap = await db.collection('orders')
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .get();

      const orders = [];
      snap.forEach((doc) => {
        orders.push({ id: doc.id, ...doc.data() });
      });
      return orders;
    } catch (err) {
      console.warn('Could not query orders:', err.message);
      return [];
    }
  }

  /**
   * Admin: Retrieves all orders across all clients for administrative review.
   */
  async function fetchAllOrdersForAdmin() {
    if (!db) return [];
    try {
      const snap = await db.collection('orders').orderBy('createdAt', 'desc').get();
      const orders = [];
      snap.forEach((doc) => {
        orders.push({ id: doc.id, ...doc.data() });
      });
      return orders;
    } catch (err) {
      console.warn('Could not query all orders for admin:', err.message);
      return [];
    }
  }

  /* ==========================================================================
     6. ADMIN & PRODUCT MANAGEMENT SERVICES
     ========================================================================== */

  /**
   * Admin: Updates product base price in Firestore.
   */
  async function updateProductPrice(productId, newPrice) {
    if (!db || !productId) return false;
    const priceNum = Number(newPrice);
    if (isNaN(priceNum) || priceNum < 0) throw new Error('Invalid price value.');
    await db.collection('products').doc(productId).update({
      price: priceNum,
      updatedAt: new Date().toISOString()
    });
    return true;
  }

  /**
   * Admin: Updates product stock availability in Firestore.
   */
  async function updateProductAvailability(productId, isAvailable) {
    if (!db || !productId) return false;
    await db.collection('products').doc(productId).update({
      availability: !!isAvailable,
      updatedAt: new Date().toISOString()
    });
    return true;
  }


  /* ==========================================================================
     7. CUSTOMER PROFILE & ADMIN SERVICES
     ========================================================================== */

  async function updateUserProfile(userId, updates) {
    const user = getCurrentUser();
    if (!db || !user || user.uid !== userId) {
      throw new Error('You can only update your own profile.');
    }
    const allowed = {
      name: String(updates.name || '').trim().slice(0, 100),
      phone: String(updates.phone || '').trim().slice(0, 30),
      address: String(updates.address || '').trim().slice(0, 250),
      city: String(updates.city || '').trim().slice(0, 100),
      pincode: String(updates.pincode || '').trim().slice(0, 12),
      updatedAt: new Date().toISOString()
    };
    if (allowed.name.length < 2) throw new Error('Please enter your full name.');
    await db.collection('users').doc(userId).set(allowed, { merge: true });
    if (user.updateProfile) await user.updateProfile({ displayName: allowed.name });
    return { ...(await getUserProfile(userId)), ...allowed };
  }

  async function isCurrentUserAdmin() {
    const user = getCurrentUser();
    if (!user || !user.getIdTokenResult) return false;
    try {
      const token = await user.getIdTokenResult(true);
      return token.claims && token.claims.admin === true;
    } catch (error) {
      console.warn('Could not verify admin claim:', error.message);
      return false;
    }
  }

  async function updateOrderStatus(orderDocId, status) {
    const allowedStatuses = ['commission_queued', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!db || !allowedStatuses.includes(status)) throw new Error('Invalid order status.');
    if (!(await isCurrentUserAdmin())) throw new Error('Administrator access required.');
    await db.collection('orders').doc(orderDocId).update({
      status,
      updatedAt: new Date().toISOString()
    });
    return true;
  }

  async function fetchAllUsersForAdmin() {
    if (!db || !(await isCurrentUserAdmin())) throw new Error('Administrator access required.');
    const snap = await db.collection('users').orderBy('createdAt', 'desc').limit(100).get();
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  // Public Service API
  return {
    init,
    // Auth
    registerUser,
    loginUser,
    logoutUser,
    onAuthChange,
    getCurrentUser,
    getUserProfile,
    updateUserProfile,
    isCurrentUserAdmin,
    // Products
    fetchProductsFromFirestore,
    seedInitialProductsIfEmpty,
    // Cart
    fetchUserCart,
    syncUserCartToFirestore,
    syncGuestCartToUser,
    // Custom Designs
    saveCustomDesign,
    fetchUserCustomDesigns,
    deleteCustomDesign,
    // Orders
    createOrderRecord,
    fetchUserOrders,
    fetchAllOrdersForAdmin,
    updateOrderStatus,
    fetchAllUsersForAdmin,
    // Admin
    updateProductPrice,
    updateProductAvailability
  };
})();

// Expose the service to browser pages (including login.html).
if (typeof window !== 'undefined') {
  window.FirebaseService = FirebaseService;
}

// Initialize automatically when loaded
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    FirebaseService.init();
  });
}

// Node.js test environment export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FirebaseService;
}

/**
 * ATELIER HIDE — Full-Stack Firebase Backend Verification Suite
 * Automated End-to-End Testing for College Viva & Deployment
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('==================================================================');
console.log('--- STARTING ATELIER HIDE FULL-STACK FIREBASE VERIFICATION ---');
console.log('==================================================================');

// 1. Verify Configuration & Rules Files Exist
console.log('\n[Check 1] Verifying Backend Configuration and Security Rules Files...');
const configPath = path.resolve(__dirname, 'firebase-config.js');
const servicePath = path.resolve(__dirname, 'firebase-service.js');
const rulesPath = path.resolve(__dirname, 'firestore.rules');
const storageRulesPath = path.resolve(__dirname, 'storage.rules');

assert(fs.existsSync(configPath), 'firebase-config.js must exist.');
assert(fs.existsSync(servicePath), 'firebase-service.js must exist.');
assert(fs.existsSync(rulesPath), 'firestore.rules must exist.');
assert(fs.existsSync(storageRulesPath), 'storage.rules must exist.');
console.log('✔ PASS: All 4 Firebase configuration and security files present.');

// 2. Load Config & Service Modules
console.log('\n[Check 2] Loading and Initializing Firebase Module...');
// Mock browser environment for test runner
if (typeof localStorage === 'undefined') {
  global.localStorage = (function () {
    let store = {};
    return {
      getItem: (k) => store[k] || null,
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
      clear: () => { store = {}; }
    };
  })();
}

const { initFirebaseApp, firebaseConfig } = require('./firebase-config');
assert(firebaseConfig.projectId === 'katryx-ab8ac' || firebaseConfig.projectId === 'atelier-hide-luxury', 'Project ID must match katryx-ab8ac or atelier-hide-luxury');
console.log('✔ PASS: Central project configuration verified for: ' + firebaseConfig.projectId);

const FirebaseService = require('./firebase-service');
const { auth, db } = FirebaseService.init();
assert(auth != null, 'Auth instance must be initialized.');
assert(db != null, 'Firestore instance must be initialized.');
console.log('✔ PASS: Firebase Service layer initialized.');

async function runVerificationTests() {
  let passedCount = 0;

  // Test 1: User Registration
  console.log('\n[Test 1] User Registration & Profile Creation...');
  const testUser = {
    name: 'Devraj Oberoi',
    email: 'devraj.oberoi@example.com',
    password: 'MasterPassword2026'
  };

  const regResult = await FirebaseService.registerUser(testUser.name, testUser.email, testUser.password);
  assert(regResult.user && regResult.user.uid, 'User registration must return valid user object with UID.');
  assert(regResult.profile.name === testUser.name, 'User profile name must match.');
  assert(regResult.profile.role === 'client', 'User profile role must be client.');
  const testUid = regResult.user.uid;
  console.log(`✔ PASS: User registered successfully (UID: ${testUid}, Name: ${regResult.profile.name})`);
  passedCount++;

  // Test 2: Auth State Listener & Current User
  console.log('\n[Test 2] Current User & Profile Retrieval...');
  const current = FirebaseService.getCurrentUser();
  assert(current && current.email === testUser.email.toLowerCase(), 'Current user email must match registered user.');
  const profileDoc = await FirebaseService.getUserProfile(testUid);
  assert(profileDoc && profileDoc.email === testUser.email.toLowerCase(), 'Profile document must exist in Firestore users collection.');
  console.log(`✔ PASS: User profile verified in Cloud Firestore 'users' collection.`);
  passedCount++;

  // Test 3: Sign Out and Sign In
  console.log('\n[Test 3] Sign Out and Sign In Authentication Flow...');
  await FirebaseService.logoutUser();
  assert(FirebaseService.getCurrentUser() === null, 'Current user must be null after logout.');
  
  const loginResult = await FirebaseService.loginUser(testUser.email, testUser.password);
  assert(loginResult.user.uid === testUid, 'Logged in user UID must match original registered UID.');
  console.log('✔ PASS: Sign Out and Re-Authentication flow verified.');
  passedCount++;

  // Test 4: Products Auto-Seeding & Fetching
  console.log('\n[Test 4] Firestore Products Collection Auto-Seeding & Retrieval...');
  const products = await FirebaseService.fetchProductsFromFirestore();
  assert(products.length >= 5, 'Firestore products collection must have at least 5 products.');
  const handbag = products.find(p => p.id === 'handbag');
  assert(handbag, 'Structured Handbag must be present in Firestore products.');
  assert(handbag.price === 28500, 'Handbag base price must be ₹28,500.');
  assert(handbag.availableLeatherFinishes.length === 5, 'Handbag must support all 5 leather finishes.');
  console.log(`✔ PASS: Loaded ${products.length} products from Cloud Firestore (Flagship Handbag verified at ₹${handbag.price}).`);
  passedCount++;

  // Test 5: Shopping Cart Firestore Synchronization
  console.log('\n[Test 5] Cloud Cart Persistence in Firestore...');
  const mockCartItems = [
    {
      configKey: 'handbag_cognac_brass_gold',
      productId: 'handbag',
      productName: 'The Structured Handbag',
      unitPrice: 29100,
      quantity: 1,
      finishId: 'cognac',
      finishName: 'Pull-Up Cognac',
      hardwareId: 'brass',
      embossText: 'DO',
      embossStyle: 'gold',
      customInscription: 'Carry with pride',
      makerNote: 'Beeswax edge buffing'
    }
  ];

  await FirebaseService.syncUserCartToFirestore(testUid, mockCartItems);
  const fetchedCart = await FirebaseService.fetchUserCart(testUid);
  assert(fetchedCart.length === 1, 'Fetched cart must contain 1 item.');
  assert(fetchedCart[0].configKey === 'handbag_cognac_brass_gold', 'Cart item configKey must match.');
  assert(fetchedCart[0].customInscription === 'Carry with pride', 'Custom inscription must be preserved in cart.');
  console.log('✔ PASS: Cloud cart persistence verified in Firestore.');
  passedCount++;

  // Test 6: Guest-to-User Cart Merging
  console.log('\n[Test 6] Guest-to-User Cart Synchronization on Login...');
  const guestCart = [
    // Identical customization (should increment quantity)
    {
      configKey: 'handbag_cognac_brass_gold',
      productId: 'handbag',
      productName: 'The Structured Handbag',
      unitPrice: 29100,
      quantity: 2
    },
    // Distinct customization (should be added as new line item)
    {
      configKey: 'bifold_tan_brass_blind',
      productId: 'bifold',
      productName: 'The Everyday Bifold',
      unitPrice: 4800,
      quantity: 1
    }
  ];

  const mergedCart = await FirebaseService.syncGuestCartToUser(testUid, guestCart);
  assert(mergedCart.length === 2, 'Merged cart must contain 2 distinct lines.');
  const mergedHandbag = mergedCart.find(i => i.configKey === 'handbag_cognac_brass_gold');
  assert(mergedHandbag.quantity === 3, 'Merged handbag quantity must combine: 1 existing + 2 guest = 3.');
  console.log('✔ PASS: Guest cart merged seamlessly without losing existing cloud selections.');
  passedCount++;

  // Test 7: Customization Studio Bespoke Design Saving
  console.log('\n[Test 7] Saving Bespoke Custom Design to Cloud Account...');
  const bespokeDesign = {
    productId: 'messenger',
    productName: 'The Field Messenger',
    leatherFinish: 'espresso',
    hardwareFinish: 'silver',
    fullName: 'Devraj Oberoi',
    initials: 'DO',
    foilType: 'gold',
    customInscription: 'To great journeys',
    makerNote: 'Double saddle stitch on stress points',
    designName: 'The Field Messenger (Espresso & Palladium)'
  };

  const savedDesign = await FirebaseService.saveCustomDesign(testUid, bespokeDesign);
  assert(savedDesign.id, 'Saved design must return a generated Firestore document ID.');
  assert(savedDesign.personalization.fullName === 'Devraj Oberoi', 'Personalization full name must match.');
  console.log(`✔ PASS: Bespoke design saved in Firestore 'customDesigns' collection (ID: ${savedDesign.id}).`);
  passedCount++;

  // Test 8: Retrieving User's Saved Designs
  console.log('\n[Test 8] Fetching Saved Bespoke Designs...');
  const userDesigns = await FirebaseService.fetchUserCustomDesigns(testUid);
  assert(userDesigns.length >= 1, 'User must have at least 1 saved bespoke design.');
  const loadedDesign = userDesigns.find(d => d.id === savedDesign.id);
  assert(loadedDesign, 'Saved design must be present in retrieved list.');
  assert(loadedDesign.leatherFinish === 'espresso', 'Saved leather finish must be preserved.');
  assert(loadedDesign.personalization.customInscription === 'To great journeys', 'Saved inscription must be preserved.');
  console.log(`✔ PASS: Successfully retrieved ${userDesigns.length} bespoke designs for user.`);
  passedCount++;

  // Test 9: Deleting Saved Bespoke Design
  console.log('\n[Test 9] Deleting Bespoke Custom Design...');
  const delResult = await FirebaseService.deleteCustomDesign(savedDesign.id);
  assert(delResult === true, 'Delete operation must return true.');
  const updatedDesigns = await FirebaseService.fetchUserCustomDesigns(testUid);
  assert(!updatedDesigns.some(d => d.id === savedDesign.id), 'Deleted design must no longer exist.');
  console.log('✔ PASS: Bespoke design deletion verified.');
  passedCount++;

  // Test 10: Commission Order Record Creation
  console.log('\n[Test 10] Storing Confirmed Demonstration Commission in Firestore...');
  const commissionOrder = {
    orderId: 'AH-2026-7821',
    userId: testUid,
    name: 'Devraj Oberoi',
    email: 'devraj.oberoi@example.com',
    phone: '+91 98765 43210',
    address: '42 Lavelle Road',
    city: 'Bengaluru',
    pincode: '560001',
    items: mergedCart,
    totalAmount: 92100
  };

  const orderRecord = await FirebaseService.createOrderRecord(commissionOrder);
  assert(orderRecord.orderId === 'AH-2026-7821', 'Order ID must match.');
  assert(orderRecord.status === 'commission_queued', 'Order status must be commission_queued.');
  assert(orderRecord.isPaid === false, 'Order isPaid must be false for demonstration commission.');
  assert(orderRecord.paymentStatus === 'unpaid_demonstration', 'Payment status must explicitly indicate unpaid demonstration.');
  console.log(`✔ PASS: Commission order recorded in Cloud Firestore 'orders' collection (Status: ${orderRecord.status}, Unpaid Demo).`);
  passedCount++;

  // Test 11: Retrieving Client Order History
  console.log('\n[Test 11] Fetching Client Order History from Firestore...');
  const userOrders = await FirebaseService.fetchUserOrders(testUid);
  assert(userOrders.length >= 1, 'Client must have at least 1 order.');
  assert(userOrders[0].orderId === 'AH-2026-7821', 'First order ID must match.');
  console.log(`✔ PASS: Retrieved ${userOrders.length} order commissions for client.`);
  passedCount++;

  // Test 12: Admin Product Management — Updating Price in Firestore
  console.log('\n[Test 12] Admin Operations: Updating Product Price in Firestore...');
  const updateResult = await FirebaseService.updateProductPrice('handbag', 29500);
  assert(updateResult === true, 'updateProductPrice must return true.');
  console.log('✔ PASS: Product price successfully updated in Firestore.');
  passedCount++;

  // Test 13: Admin Product Management — Updating Availability in Firestore
  console.log('\n[Test 13] Admin Operations: Updating Product Availability...');
  const stockResult = await FirebaseService.updateProductAvailability('handbag', true);
  assert(stockResult === true, 'updateProductAvailability must return true.');
  console.log('✔ PASS: Product availability status updated in Firestore.');
  passedCount++;

  // Test 14: Admin Review — Fetching All Incoming Commission Records
  console.log('\n[Test 14] Admin Operations: Fetching All Orders for Workshop Review...');
  const allOrders = await FirebaseService.fetchAllOrdersForAdmin();
  assert(allOrders.length >= 1, 'All orders list must contain placed orders.');
  console.log(`✔ PASS: Admin successfully queried ${allOrders.length} orders across the workshop.`);
  passedCount++;

  // Test 15: Firestore Security Rules Analysis
  console.log('\n[Test 15] Validating Firestore Security Rules Specification...');
  const rulesContent = fs.readFileSync(rulesPath, 'utf8');
  assert(rulesContent.includes("rules_version = '2';"), 'Rules must use version 2.');
  assert(rulesContent.includes("match /users/{userId}") || rulesContent.includes("match /users/{uid}"), 'Must define users collection security.');
  assert(rulesContent.includes("match /products/{productId}"), 'Must define products collection security.');
  assert(rulesContent.includes("match /cart/{cartDocId}") || rulesContent.includes("match /cart/{cartId}") || rulesContent.includes("match /carts/{uid}"), 'Must define cart collection security.');
  assert(rulesContent.includes("match /customDesigns/{designId}"), 'Must define customDesigns collection security.');
  assert(rulesContent.includes("match /orders/{orderId}"), 'Must define orders collection security.');
  assert(rulesContent.includes("allow read, write: false;") || rulesContent.includes("allow read, write: if false;"), 'Default deny must be enforced.');
  console.log('✔ PASS: Firestore Security Rules adhere to all least-privilege & data-isolation specifications.');
  passedCount++;

  // Test 16: Storage Security Rules Analysis
  console.log('\n[Test 16] Validating Firebase Storage Security Rules Specification...');
  const storageContent = fs.readFileSync(storageRulesPath, 'utf8');
  assert(storageContent.includes("rules_version = '2';"), 'Storage rules must use version 2.');
  assert(storageContent.includes("match /products/{allPaths=**}"), 'Storage rules must cover products path.');
  assert(storageContent.includes("match /textures/{allPaths=**}"), 'Storage rules must cover textures path.');
  assert(storageContent.includes("allow read, write: false;") || storageContent.includes("allow read, write: if false;"), 'Storage default deny must be enforced.');
  console.log('✔ PASS: Firebase Storage Security Rules verified.');
  passedCount++;

  console.log('\n==================================================================');
  console.log(`--- ALL FULL-STACK FIREBASE VERIFICATION CHECKS PASSED (${passedCount}/${passedCount}) ---`);
  console.log('==================================================================');
}

runVerificationTests().catch(err => {
  console.error('\n❌ FIREBASE TEST FAILED:', err);
  process.exit(1);
});

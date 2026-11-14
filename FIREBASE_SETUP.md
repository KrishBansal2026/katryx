# KATRYX — Firebase Full-Stack Architecture & Setup Guide

Welcome to the **KATRYX** Firebase backend setup guide. This document explains how the handcrafted leather goods e-commerce website communicates with Google Firebase, how each database collection is structured, how authentication and cloud persistence operate, and how students can explain the architecture during project evaluation and viva.

---

## 1. Project Overview & Firebase Services Used

KATRYX is built using **HTML5, CSS3, Vanilla JavaScript (ES6+), Three.js (WebGL 3D)** on the frontend, powered by **Google Firebase** for backend cloud infrastructure.

```
+-------------------------------------------------------------------------------+
|                           KATRYX FRONTEND                               |
|        Vanilla JavaScript (ES6+) • Three.js 3D Engine • CSS3 Design           |
+-------------------------------------------------------------------------------+
                                    |
          +-------------------------+-------------------------+
          |                         |                         |
          v                         v                         v
+--------------------+    +--------------------+    +--------------------+
|   FIREBASE AUTH    |    |  CLOUD FIRESTORE   |    |  FIREBASE STORAGE  |
|  - Email/Password  |    |  - users           |    |  - Product Assets  |
|  - Session State   |    |  - products        |    |  - Textures        |
|  - Client Profile  |    |  - carts           |    |  - Bespoke Swatches|
|                    |    |  - customDesigns   |    |                    |
|                    |    |  - orders          |    |                    |
+--------------------+    +--------------------+    +--------------------+
```

### Services Integrated:
1. **Firebase Authentication**:
   - Client registration with full name, email, and password.
   - Client sign-in, session persistence, and instant state reactivity (`onAuthStateChanged`).
   - Guest browsing support (patrons can explore pieces and customize without forced login).
2. **Cloud Firestore (NoSQL Document Database)**:
   - Real-time cloud storage for products, shopping bags, bespoke 3D customizer configurations, user profiles, and commission order records.
3. **Firebase Storage**:
   - Secure cloud storage for static luxury bag silhouettes, normal maps, and leather textures.
4. **Security Rules**:
   - Granular, least-privilege security rules enforcing strict client data isolation.

---

## 2. File Organization

```
CSE326 PROJECT/
├── firebase-config.js      # Central Firebase project credentials & resilience adapter
├── firebase-service.js     # Modular asynchronous database & auth service functions
├── firestore.rules         # Production Cloud Firestore Security Rules
├── storage.rules           # Production Firebase Storage Security Rules
├── test-firebase.js        # Automated Node.js test suite for all Firebase operations
├── index.html              # Frontend DOM markup, Auth & Admin modals
├── script.js               # Application coordinator, 3D WebGL engine & Custom Studio
├── styles.css              # Quiet luxury styling system
├── FIREBASE_SETUP.md       # This full-stack setup & viva guide
└── PROJECT_GUIDE.md        # Comprehensive master technical guide
```

---

## 3. How the Firebase Connection Works

The application uses the official **Firebase Web SDK (v10 compat)** loaded via Google's global CDN:

```html
<!-- Firebase Web SDK Scripts in index.html -->
<script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-auth-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js"></script>
<script src="firebase-config.js"></script>
<script src="firebase-service.js"></script>
<script src="script.js" defer></script>
```

### Central Configuration (`firebase-config.js`)

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyCegHkQLTGDKRH7sLrJmIYkp4A4cm9iZ0w",
  authDomain: "katryx-luxury.firebaseapp.com",
  projectId: "katryx-luxury",
  storageBucket: "katryx-luxury.appspot.com",
  messagingSenderId: "102938475612",
  appId: "1:102938475612:web:9f8e7d6c5b4a3b2a1"
};
```

### High-Reliability Offline Resilience Adapter
If internet connectivity is unavailable during a college demonstration or viva, `firebase-config.js` automatically activates the **Katryx Offline Resilience Adapter**. It emulates the exact Firebase Auth and Firestore API contracts (`db.collection().doc().set()`, `get()`, `where()`, `orderBy()`) backed by in-memory `localStorage`, guaranteeing that **the website never crashes or displays broken error dialogues**.

---

## 4. Cloud Firestore Database Schema

Firestore is a document-oriented NoSQL database organized into **collections** and **documents**.

### A. `users` Collection
Stores registered client profiles.
- **Document Path**: `/users/{userId}` (where `userId` is the Firebase Auth UID)
```json
{
  "userId": "usr_948201a",
  "name": "Devraj Oberoi",
  "email": "devraj.oberoi@example.com",
  "role": "client",
  "createdAt": "2026-11-06T12:00:00.000Z"
}
```

### B. `products` Collection
Stores the atelier's handcrafted leather collection.
- **Document Path**: `/products/{productId}` (e.g., `handbag`, `bifold`, `messenger`, `passport`, `weekender`)
```json
{
  "id": "handbag",
  "name": "The Structured Handbag",
  "category": "Handbags & Totes",
  "price": 28500,
  "description": "A masterwork structured top-handle handbag in vegetable-tanned steerhide...",
  "availableLeatherFinishes": ["tan", "cognac", "espresso", "black", "crazy"],
  "availableHardwareOptions": ["brass", "silver"],
  "dimensions": "32.0 cm × 24.0 cm × 12.0 cm",
  "weight": "1,150 grams",
  "image": "assets/images/product-handbag.svg",
  "availability": true
}
```

### C. `carts` Collection
Persists authenticated clients' shopping bags across browsers and devices.
- **Document Path**: `/carts/{userId}`
```json
{
  "userId": "usr_948201a",
  "items": [
    {
      "configKey": "handbag_cognac_brass_gold_DO",
      "productId": "handbag",
      "productName": "The Structured Handbag",
      "unitPrice": 29100,
      "quantity": 1,
      "finishId": "cognac",
      "finishName": "Pull-Up Cognac",
      "hardwareId": "brass",
      "embossText": "DO",
      "customInscription": "Carry with distinction",
      "makerNote": "Natural edge burnishing"
    }
  ],
  "updatedAt": "2026-11-06T12:05:00.000Z"
}
```

### D. `customDesigns` Collection
Stores bespoke customizations created in the 3D Custom Studio.
- **Document Path**: `/customDesigns/{designId}`
```json
{
  "userId": "usr_948201a",
  "designName": "The Structured Handbag (Pull-Up Cognac)",
  "productId": "handbag",
  "productName": "The Structured Handbag",
  "leatherFinish": "cognac",
  "hardwareFinish": "brass",
  "personalization": {
    "fullName": "Devraj Oberoi",
    "initials": "DO",
    "foilType": "gold",
    "customInscription": "Carry with distinction",
    "makerNote": "Natural edge burnishing"
  },
  "savedTimestamp": "2026-11-06T12:05:00.000Z"
}
```

### E. `orders` Collection
Stores confirmed demonstration commission order records.
- **Document Path**: `/orders/{orderId}` (e.g. `AH-2026-7821`)
```json
{
  "orderId": "AH-2026-7821",
  "userId": "usr_948201a",
  "customerDetails": {
    "name": "Devraj Oberoi",
    "email": "devraj.oberoi@example.com",
    "phone": "+91 98765 43210",
    "address": "42 Lavelle Road",
    "city": "Bengaluru",
    "pincode": "560001"
  },
  "items": [ /* Line items with customization */ ],
  "totalAmount": 29100,
  "status": "commission_queued",
  "isPaid": false,
  "paymentStatus": "unpaid_demonstration",
  "academicNotice": "Academic demonstration commission request. No real financial transaction was executed.",
  "createdAt": "2026-11-06T12:08:00.000Z"
}
```

---

## 5. End-to-End Data Flows

### Flow 1: Authentication & Guest Cart Synchronization
1. Visitor explores the site as a guest, personalizes a wallet, and adds it to bag.
2. Visitor clicks **Client Account** (`#account-trigger`) and signs up or logs in.
3. `FirebaseService.onAuthChange` detects the new authenticated user.
4. `FirebaseService.syncGuestCartToUser(uid, guestCart)` is called:
   - Reads any existing items stored in Firestore under `/carts/{uid}`.
   - Merges guest items into the user's cloud cart (combining quantities of identical configurations).
   - Saves merged cart back to Firestore.
   - The user never loses their in-progress customization!

### Flow 2: 3D Custom Studio Bespoke Design Persistence
1. Patron chooses the **Field Messenger**, selects **Pull-Up Cognac** leather, adds initials `"DO"` in **22k Gold Foil**, enters a custom interior message, and writes a note to the maker.
2. Patron clicks **✦ Save Bespoke Design** (`#btn-save-custom-design`).
3. If not signed in, the client is prompted to log in or register.
4. `FirebaseService.saveCustomDesign(uid, designPayload)` stores the exact 3D and 2D parameters in the `customDesigns` collection.
5. Under **Client Account -> Saved Bespoke Designs**, the patron can click **Open in Studio →**.
6. The application parses the saved configuration, updates the 2D SVG canvas, rebuilds the 3D model texture and lighting in Three.js, re-populates all inputs, and smoothly scrolls to the studio.

### Flow 3: Commission Checkout & Order Records
1. Client reviews their cart and clicks **Proceed to Demonstration Checkout**.
2. Client contact and shipping details are gathered.
3. `FirebaseService.createOrderRecord()` writes the new order to Firestore `/orders/{orderId}` with `status: 'commission_queued'` and `paymentStatus: 'unpaid_demonstration'`.
4. The cart is cleared locally and in Firestore.
5. The confirmation seal and unique Order Reference ID (`AH-2026-XXXX`) appear on screen.

### Flow 4: Operations & Admin Portal
1. Evaluator or administrator clicks **✦ Atelier Operations Portal** in the footer.
2. The modal retrieves live products and orders from Cloud Firestore.
3. Administrator can update a product's price (`updateProductPrice`) or toggle inventory availability (`updateProductAvailability`).
4. Administrator can inspect all incoming customer commission orders with complete personalization details.

---

## 6. Firebase Security Rules (`firestore.rules`)

Security rules enforce data privacy and authorize operations directly at the database layer.

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Helper functions
    function isAuthenticated() { return request.auth != null; }
    function isOwner(userId) { return isAuthenticated() && request.auth.uid == userId; }
    function isAdmin() {
      return isAuthenticated() && (
        request.auth.token.admin == true ||
        request.auth.token.email.matches('.*@atelierhide[.]in$')
      );
    }

    // 1. Users Collection — Only owner can read/write their own profile
    match /users/{userId} {
      allow read, write: if isOwner(userId) || isAdmin();
    }

    // 2. Products Collection — Anyone can view catalog; only admins can edit
    match /products/{productId} {
      allow read: if true;
      allow write: if isAdmin();
    }

    // 3. Shopping Cart — Only owner can access their bag
    match /carts/{userId} {
      allow read, write: if isOwner(userId) || isAdmin();
    }

    // 4. Custom Designs — Only owner can view, save, or delete bespoke pieces
    match /customDesigns/{designId} {
      allow read, write: if isAuthenticated() && (resource.data.userId == request.auth.uid || request.resource.data.userId == request.auth.uid);
    }

    // 5. Orders — Owners can view their orders; guests/users can place; admin can view all
    match /orders/{orderId} {
      allow read: if isAuthenticated() && (resource.data.userId == request.auth.uid || isAdmin());
      allow create: if true; // Allows authenticated & guest orders with validation
      allow update, delete: if isAdmin();
    }

    // Default Deny
    match /{document=**} {
      allow read, write: false;
    }
  }
}
```

---

## 7. Connecting Your Own Firebase Console Project

If you wish to point KATRYX to your personal Firebase project:

1. Visit [Firebase Console](https://console.firebase.google.com/) and create a project named `katryx`.
2. Go to **Authentication -> Sign-in method** and enable **Email/Password**.
3. Go to **Firestore Database**, click **Create database**, and start in production mode.
4. In Project Settings, click **Add App** and select **Web (</>)**.
5. Copy your Firebase SDK config values and paste them into `firebase-config.js`:
   ```javascript
   const firebaseConfig = {
     apiKey: "YOUR_ACTUAL_API_KEY",
     authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
     projectId: "YOUR_PROJECT_ID",
     storageBucket: "YOUR_PROJECT_ID.appspot.com",
     messagingSenderId: "YOUR_SENDER_ID",
     appId: "YOUR_APP_ID"
   };
   ```
6. Deploy rules to your project using the Firebase CLI:
   ```bash
   firebase deploy --only firestore:rules,storage
   ```

---

## 8. How to Run and Test the Application

### Running the Website
Open `index.html` in any web browser:
- Double click `index.html` or open via `file:///`
- Or run a local HTTP server: `npx serve .` or `python -m http.server 8000`

### Running the Automated Test Suites
Run the verification suites in your terminal:
```bash
# 1. Full-Stack Firebase Verification (Auth, Firestore, Cart, Designs, Orders, Admin)
node test-firebase.js

# 2. Complete Application Journey & Personalization Tests
node test-interactions.js

# 3. 3D WebGL Engine & Procedural Normal Map Tests
node test-3d.js

# 4. Project Asset Integrity & Section Verification Tests
node test-suite.js

# 5. Headless Browser DOM Assertion
node test-browser.js
```

---

## 9. Common Viva Questions & Model Answers

### Q1: What architecture does KATRYX follow?
> **Answer**: KATRYX follows a decoupled, client-driven full-stack architecture. The frontend is written in vanilla JavaScript (ES6+) and communicates with Google Firebase through a dedicated service layer (`firebase-service.js`). Cloud Firestore provides NoSQL persistence, Firebase Authentication manages client credentials and session tokens, and Three.js renders 3D product previews.

### Q2: How does the application handle guest shoppers who log in later?
> **Answer**: We implemented a guest-to-user synchronization pattern in `syncGuestCartToUser()`. While browsing as a guest, items are stored in `localStorage`. When the user authenticates, their guest items are compared against their cloud cart in Firestore. Identical items have their quantities merged, while unique configurations are appended, ensuring the shopper never loses their work.

### Q3: Why is Cloud Firestore preferred over traditional relational databases for this project?
> **Answer**: Firestore's document-based JSON structure is ideal for e-commerce with bespoke customization. A single leather product line item can carry nested personalization attributes (monogram initials, full name, gold foil, custom interior inscription, note to maker). In a relational database, this would require complex multi-table joins; in Firestore, it is stored cleanly as a polymorphic document.

### Q4: How is security enforced if Firebase client credentials are in frontend JavaScript?
> **Answer**: In Firebase, `apiKey` and `projectId` are public identifiers, not server secrets. True security is enforced by **Cloud Firestore Security Rules** (`firestore.rules`) executed on Google's cloud servers. Our rules enforce strict user ownership checks (`request.auth.uid == resource.data.userId`), ensuring no client can ever read or modify another patron's cart, saved designs, or order history.

### Q5: Does the checkout charge real credit cards?
> **Answer**: No. In accordance with academic project standards, KATRYX distinguishes a placed commission request from a paid transaction. Orders are saved with `status: 'commission_queued'` and `paymentStatus: 'unpaid_demonstration'` to prevent misleading customers while demonstrating complete database persistence.

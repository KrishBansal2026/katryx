# KATRYX backend setup

## Included
- Firebase Authentication email/password (existing login/register)
- Firestore customer profiles (`users/{uid}`)
- Account cart sync (`carts/{uid}`)
- Custom designs (`customDesigns`)
- Authenticated order creation and customer order history (`orders`)
- Customer account page (`profile.html`)
- Admin dashboard (`admin.html`) with order status and customer list
- Firestore and Storage security rules

## Publish rules
Firebase Console → Firestore Database → Rules → paste `firestore.rules` → Publish.
If using Storage, publish `storage.rules` in Storage → Rules.

## Admin access
The dashboard requires a Firebase Auth custom claim: `admin: true`.
Set this ONLY from a trusted server using Firebase Admin SDK (Cloud Functions or a secure admin script), never from browser code. Example server-side Node snippet:

```js
await getAuth().setCustomUserClaims('FIREBASE_AUTH_UID', { admin: true });
```

Then sign out and sign back in (or refresh the ID token). An email address alone does not grant admin access.

## Important payment limitation
Checkout creates an unpaid order request (`isPaid: false`). It does not take payment. Before real sales, implement a trusted backend/payment provider (e.g. Razorpay/Stripe) with server-side payment verification. Never mark an order paid from frontend code.

## Test checklist
1. Register a new customer.
2. Check Authentication → Users and Firestore → users/{uid}.
3. Add products to cart while signed in; check carts/{uid}.
4. Place an order; check orders collection.
5. Open profile.html and confirm profile/order history.
6. Set admin custom claim server-side, sign in as that admin, open admin.html.

## Open the owner dashboard
1. Publish the `firestore.rules` file included in this project.
2. Grant the owner's Firebase Authentication UID the `admin: true` custom claim using Firebase Admin SDK from a trusted local/server environment (never from the website frontend).
3. Sign out and back in with that owner account.
4. Open `admin.html` on the website. The dashboard shows orders, customer details, order items, payment-demo state, and lets the owner update order status.

The dashboard is not protected by hiding its URL: both the page and Firestore rules check the verified Firebase custom claim. Do not deploy with permissive Firestore rules.

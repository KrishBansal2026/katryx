/**
 * KATRYX Atelier Hide - Admin Role Provisioning Utility
 * Zero-dependency edition: Runs with pure built-in Node.js (no npm install required!)
 *
 * Usage:
 *   node set-admin.js your-email@domain.com
 *   OR
 *   node set-admin.js <FIREBASE_UID>
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');

// 1. Locate the Service Account Key file
function findServiceAccountKey() {
  const rootDir = __dirname;
  const standardKey = path.join(rootDir, 'serviceAccountKey.json');
  if (fs.existsSync(standardKey)) return standardKey;

  const files = fs.readdirSync(rootDir);
  const match = files.find(file =>
    file.endsWith('.json') &&
    (file.includes('firebase-adminsdk') || file.includes('adminsdk') || file.includes('service-account'))
  );

  if (match) return path.join(rootDir, match);
  return null;
}

const keyPath = findServiceAccountKey();
if (!keyPath) {
  console.error('\n\x1b[31m[ERROR] No service account key file found in folder.\x1b[0m');
  console.error('Please ensure your downloaded Firebase JSON key is placed in this folder.\n');
  process.exit(1);
}

const keyFileName = path.basename(keyPath);
console.log(`\x1b[32m✔ Located Key:\x1b[0m ${keyFileName}`);

const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
const projectId = serviceAccount.project_id;
const clientEmail = serviceAccount.client_email;
const privateKey = serviceAccount.private_key;

if (!clientEmail || !privateKey) {
  console.error('\n\x1b[31m[ERROR] Invalid service account key structure.\x1b[0m\n');
  process.exit(1);
}

// 2. Process user argument
const identifier = process.argv[2];
if (!identifier) {
  console.log('\n\x1b[33mKATRYX Admin Role Setup\x1b[0m');
  console.log('Usage:');
  console.log('  node set-admin.js <your-email@example.com>');
  console.log('  node set-admin.js <firebase-user-uid>\n');
  process.exit(1);
}

// Helper: Base64Url encoding
function base64Url(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

// Helper: HTTP Request Promise
function requestJson(urlStr, options, postData) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const reqOptions = {
      method: options.method || 'GET',
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      headers: options.headers || {}
    };

    const req = https.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            const msg = parsed.error ? (parsed.error.message || JSON.stringify(parsed.error)) : data;
            reject(new Error(`HTTP ${res.statusCode}: ${msg}`));
          }
        } catch (e) {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        }
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

// 3. Create Signed Google OAuth2 JWT and Exchange for Access Token
async function getGoogleAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: clientEmail,
    sub: clientEmail,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/identitytoolkit'
  };

  const headerB64 = base64Url(JSON.stringify(header));
  const payloadB64 = base64Url(JSON.stringify(payload));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsignedToken);
  const signature = signer.sign(privateKey);
  const signatureB64 = signature
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const jwt = `${unsignedToken}.${signatureB64}`;

  const postBody = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: jwt
  }).toString();

  const tokenResp = await requestJson('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(postBody)
    }
  }, postBody);

  return tokenResp.access_token;
}

// 4. Look up user and update custom claims
async function main() {
  try {
    console.log('Authenticating with Google Cloud Identity Toolkit...');
    const accessToken = await getGoogleAccessToken();
    console.log('\x1b[32m✔ Authenticated with Google Cloud\x1b[0m');

    let lookupPayload = {};
    if (identifier.includes('@')) {
      console.log(`Searching for user with email: ${identifier.trim().toLowerCase()}...`);
      lookupPayload = { email: [identifier.trim().toLowerCase()] };
    } else {
      console.log(`Searching for user with UID: ${identifier.trim()}...`);
      lookupPayload = { localId: [identifier.trim()] };
    }

    const lookupUrl = `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:lookup`;
    const lookupBody = JSON.stringify(lookupPayload);
    const lookupResp = await requestJson(lookupUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(lookupBody)
      }
    }, lookupBody);

    const user = lookupResp.users && lookupResp.users[0];
    if (!user) {
      throw new Error(`User not found in Firebase project '${projectId}'. Please register this account on index.html first.`);
    }

    console.log(`✔ Found account: ${user.displayName || 'Client'} (${user.email}) [UID: ${user.localId}]`);

    // Merge or set customAttributes with admin: true
    let claims = {};
    if (user.customAttributes) {
      try { claims = JSON.parse(user.customAttributes); } catch (e) {}
    }
    claims.admin = true;

    const updateUrl = `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:update`;
    const updateBody = JSON.stringify({
      localId: user.localId,
      customAttributes: JSON.stringify(claims)
    });

    await requestJson(updateUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(updateBody)
      }
    }, updateBody);

    console.log('\n\x1b[32m========================================================\x1b[0m');
    console.log(`\x1b[32m✔ SUCCESS: Admin permissions granted to ${user.email}!\x1b[0m`);
    console.log('\x1b[32m========================================================\x1b[0m');
    console.log('\x1b[36mNext steps:\x1b[0m');
    console.log('1. On the KATRYX website (index.html), sign out and sign back in.');
    console.log('2. Navigate to /admin.html in your browser.\n');
  } catch (err) {
    console.error('\n\x1b[31m[ERROR]\x1b[0m', err.message || err);
    process.exit(1);
  }
}

main();

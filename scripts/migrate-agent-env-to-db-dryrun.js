#!/usr/bin/env node
/*
 scripts/migrate-agent-env-to-db-dryrun.js

 Dry-run preview of migrating AGENTn environment variables into the DB.
 Does NOT connect to any database or write anything. Shows what documents
 would be created/upserted, including normalizedPhone and displayName.

 Usage:
   # Optionally provide encryption key to preview encryptedPassword
   CREDENTIALS_ENCRYPTION_KEY="..." node scripts/migrate-agent-env-to-db-dryrun.js
   # Or rely on JWT_SECRET (fallback) if set:
   JWT_SECRET="..." node scripts/migrate-agent-env-to-db-dryrun.js

 Notes:
 - The script mirrors the normalization and encryption logic used by
   scripts/migrate-agent-env-to-db.js and server.encryptCredential()/decryptCredential().
 - No database actions are performed.
*/

const crypto = require('crypto');

const CRED_ALGO = 'aes-256-gcm';

function getEncryptionKeyMaybe() {
  const key = process.env.CREDENTIALS_ENCRYPTION_KEY;
  if (key) {
    let buf = null;
    try {
      buf = Buffer.from(key, 'base64');
      if (buf.length !== 32) buf = Buffer.from(key);
    } catch (e) {
      buf = Buffer.from(key);
    }
    if (buf.length !== 32) {
      console.error('Provided CREDENTIALS_ENCRYPTION_KEY is not 32 bytes; encryption preview will be disabled.');
      return null;
    }
    return buf;
  }

  if (process.env.JWT_SECRET) {
    // fallback derivation (same as server)
    return crypto.createHash('sha256').update(String(process.env.JWT_SECRET), 'utf8').digest();
  }

  return null; // no key available
}

function encryptPreview(plaintext, key) {
  if (!key) return null;
  try {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(CRED_ALGO, key, iv);
    const ciphertext = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, ciphertext]).toString('base64');
  } catch (e) {
    return null;
  }
}

function normalizePhoneVal(p) {
  if (!p) return '';
  let s = String(p).replace(/[^0-9]/g, '');
  if (s.startsWith('880')) s = s.slice(3);
  else if (s.startsWith('88')) s = s.slice(2);
  if (s.length === 10 && s.startsWith('1')) s = '0' + s;
  if (!s.startsWith('0') && s.length === 11) s = '0' + s.slice(s.length - 10);
  return s;
}

(async function dryrun() {
  const key = getEncryptionKeyMaybe();
  const canEncrypt = Boolean(key);

  console.log('Migration dry-run (no DB writes)');
  console.log('=====================================================');
  console.log('Encryption preview available:', canEncrypt ? 'YES' : 'NO (set CREDENTIALS_ENCRYPTION_KEY or JWT_SECRET to enable)');
  console.log('');

  let index = 1;
  const found = [];
  while (true) {
    const username = process.env[`AGENT${index}_USERNAME`];
    const password = process.env[`AGENT${index}_PASSWORD`];
    if (!username || !password) break;

    const display = process.env[`AGENT${index}_DISPLAY`] || `Agent ${index}`;
    const active = process.env[`AGENT${index}_ACTIVE`] !== 'false';
    const clientId = process.env.PATHAO_CLIENT_ID || '1';
    const clientSecret = process.env.PATHAO_CLIENT_SECRET || '';

    const normalizedPhone = normalizePhoneVal(username);
    const encryptedPasswordPreview = canEncrypt ? encryptPreview(password, key) : null;
    const encryptedClientSecretPreview = canEncrypt && clientSecret ? encryptPreview(clientSecret, key) : null;

    found.push({
      envIndex: index,
      username,
      display,
      active,
      clientId,
      clientSecretPresent: !!clientSecret,
      normalizedPhone,
      wouldUpsertQuery: { $or: [{ username }, { normalizedPhone }] },
      doc: {
        username,
        phone: username,
        normalizedPhone,
        displayName: display,
        encryptedPassword: encryptedPasswordPreview ? '<ENCRYPTED_PREVIEW>' : '<ENCRYPTION_KEY_MISSING>',
        encryptedClientSecret: encryptedClientSecretPreview ? '<ENCRYPTED_PREVIEW>' : (clientSecret ? '<ENCRYPTION_KEY_MISSING>' : ''),
        clientId,
        source: 'env-migration',
        notes: `Migrated from environment variable AGENT${index}`,
        active: !!active
      },
      encryptedPasswordPreview
    });

    index += 1;
  }

  if (found.length === 0) {
    console.log('No AGENTn environment variables detected (AGENT1_USERNAME/AGENT1_PASSWORD, etc.). Nothing to preview.');
    process.exit(0);
  }

  for (const entry of found) {
    console.log(`AGENT${entry.envIndex}: ${entry.display} (${entry.username})`);
    console.log('  Active:', entry.active);
    console.log('  Client ID:', entry.clientId);
    console.log('  Normalized Phone:', entry.normalizedPhone);
    console.log('  Upsert query example:', JSON.stringify(entry.wouldUpsertQuery));
    if (canEncrypt) {
      console.log('  Encrypted password (base64 preview):', entry.encryptedPasswordPreview ? entry.encryptedPasswordPreview.slice(0, 24) + '...' : '<encryption failed>');
      if (entry.encryptedClientSecretPreview) console.log('  Encrypted client secret (base64 preview):', entry.encryptedClientSecretPreview.slice(0, 24) + '...');
    } else {
      console.log('  Encrypted password: <encryption key not provided>');
      if (entry.doc.clientSecretPresent) console.log('  Encrypted client secret: <encryption key not provided>');
    }
    console.log('  Document preview (sanitized):');
    const copy = Object.assign({}, entry.doc);
    // Do not print full encrypted value even in dry-run unless user provided key; keep sanitized
    if (canEncrypt) copy.encryptedPassword = entry.encryptedPasswordPreview || '<encrypt-failed>';
    else copy.encryptedPassword = '<encryption-key-missing>';
    if (canEncrypt && entry.encryptedClientSecretPreview) copy.encryptedClientSecret = entry.encryptedClientSecretPreview;
    else if (!entry.doc.encryptedClientSecret) copy.encryptedClientSecret = '';
    else copy.encryptedClientSecret = '<encryption-key-missing>';
    console.log('    ', JSON.stringify(copy, null, 2));
    console.log('');
  }

  console.log('Summary:');
  console.log(`  Found ${found.length} AGENTn entries. No DB writes performed.`);
  if (!canEncrypt) console.log('  To preview actual encrypted values, set CREDENTIALS_ENCRYPTION_KEY (32-byte raw or base64) or JWT_SECRET and rerun.');
  process.exit(0);
})();

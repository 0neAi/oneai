/*
 scripts/migrate-agent-env-to-db.js

 Purpose: Migrate AGENTn environment variables into the MongoDB AgentCredential collection.

 Usage (run on a safe environment with access to your production DB):
   MONGODB_URI="..." CREDENTIALS_ENCRYPTION_KEY="..." node scripts/migrate-agent-env-to-db.js

 Notes:
 - The script uses the same AES-256-GCM encryption format as server.getEncryptionKey()/encryptCredential().
 - Do NOT place plaintext credentials in source control. Run this on the server where env vars are present (Render Console, CI secret runner, etc.).
 - The script upserts AgentCredential documents by username to avoid duplicates.
*/

const mongoose = require('mongoose');
const crypto = require('crypto');
const path = require('path');

// Adjust require path relative to this script
const AgentCredential = require(path.join(__dirname, '..', 'models', 'AgentCredential'));

const CRED_ALGO = 'aes-256-gcm';

function getEncryptionKey() {
  const key = process.env.CREDENTIALS_ENCRYPTION_KEY;
  if (key) {
    let buf = null;
    try {
      buf = Buffer.from(key, 'base64');
      if (buf.length !== 32) buf = Buffer.from(key);
    } catch (e) {
      buf = Buffer.from(key);
    }
    if (buf.length !== 32) throw new Error('CREDENTIALS_ENCRYPTION_KEY must be 32 bytes (raw or base64)');
    return buf;
  }
  if (!process.env.JWT_SECRET) throw new Error('CREDENTIALS_ENCRYPTION_KEY is not set and JWT_SECRET is not set. Provide one to enable credential encryption.');
  return crypto.createHash('sha256').update(String(process.env.JWT_SECRET), 'utf8').digest();
}

function encryptCredential(plaintext) {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12); // 96-bit iv for GCM
  const cipher = crypto.createCipheriv(CRED_ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString('base64');
}

async function migrate() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('Error: MONGODB_URI must be set.');
    process.exit(1);
  }

  console.log('Connecting to MongoDB...');
  await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });

  try {
    let index = 1;
    const migrated = [];

    while (true) {
      const username = process.env[`AGENT${index}_USERNAME`];
      const password = process.env[`AGENT${index}_PASSWORD`];
      if (!username || !password) break;

      const display = process.env[`AGENT${index}_DISPLAY`] || `Agent ${index}`;
      const active = process.env[`AGENT${index}_ACTIVE`] !== 'false';
      const clientId = process.env.PATHAO_CLIENT_ID || '1';
      const clientSecret = process.env.PATHAO_CLIENT_SECRET || '';

      console.log(`Preparing migration for AGENT${index}: ${display} (${username})`);

      const encryptedPassword = encryptCredential(password);
      const encryptedClientSecret = clientSecret ? encryptCredential(clientSecret) : '';

      const doc = {
        username: username,
        phone: username,
        encryptedPassword: encryptedPassword,
        encryptedClientSecret: encryptedClientSecret,
        clientId: clientId,
        source: 'env-migration',
        notes: `Migrated from environment variable AGENT${index}`,
        active: !!active
      };

      // Upsert by username
      await AgentCredential.findOneAndUpdate(
        { username: username },
        { $set: doc },
        { upsert: true, new: true }
      );

      migrated.push(username);
      index += 1;
    }

    if (migrated.length === 0) {
      console.log('No AGENTn env vars found to migrate. Nothing to do.');
    } else {
      console.log(`Successfully migrated ${migrated.length} agents:`, migrated.join(', '));
    }
  } catch (err) {
    console.error('Migration failed:', err);
    process.exitCode = 2;
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
}

migrate().catch(err => {
  console.error('Unhandled migration error:', err);
  process.exit(1);
});

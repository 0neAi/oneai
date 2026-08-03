// Example Express + Mongo snippet for storing broker config (including agentFetchingEnabled)
// Drop into your server code (adapt to your existing DB connection and auth middleware)

const express = require('express');
const router = express.Router();
const { MongoClient, ObjectId } = require('mongodb');

// Replace with your own DB reference or use the existing one from your app
// Example uses a collection named 'settings' with documents like { _id: 'broker', value: { ... } }

// Middleware placeholder: ensure only admins can access these routes
function requireAdmin(req, res, next) {
  // Implement authentication & authorization check here
  // e.g., if (req.user && req.user.isAdmin) return next(); else res.status(403).json({ message: 'Forbidden' });
  if (req.user && req.user.isAdmin) return next();
  return res.status(403).json({ message: 'Forbidden' });
}

// Helper: get settings collection from your app's mongo client
// If your app uses global `db` or `req.app.locals.db`, adapt accordingly
async function getSettingsCollection() {
  // Example: use process.env.MONGO_URL or the app's client
  const client = new MongoClient(process.env.MONGO_URL || 'mongodb://localhost:27017');
  await client.connect();
  const db = client.db(process.env.MONGO_DB || 'oneai');
  return { coll: db.collection('settings'), client };
}

// GET /admin/broker/config
router.get('/admin/broker/config', requireAdmin, async (req, res) => {
  let client;
  try {
    const { coll, client: c } = await getSettingsCollection();
    client = c;
    const doc = await coll.findOne({ _id: 'broker' });
    if (!doc || !doc.value) return res.json({ walletAddress: process.env.BROKER_TRC20_ADDRESS || '', agentFetchingEnabled: true });
    return res.json(doc.value);
  } catch (e) {
    console.error('Failed to get broker config:', e);
    return res.status(500).json({ message: 'Failed to load config' });
  } finally {
    if (client) await client.close();
  }
});

// PUT /admin/broker/config
// body: partial config fields to set, e.g., { walletAddress: '...', agentFetchingEnabled: true }
router.put('/admin/broker/config', requireAdmin, express.json(), async (req, res) => {
  const update = req.body || {};
  let client;
  try {
    const { coll, client: c } = await getSettingsCollection();
    client = c;

    // Merge with existing document
    const existing = await coll.findOne({ _id: 'broker' });
    const newVal = Object.assign({}, existing && existing.value ? existing.value : {}, update);
    await coll.updateOne({ _id: 'broker' }, { $set: { value: newVal } }, { upsert: true });

    return res.json({ success: true, value: newVal });
  } catch (e) {
    console.error('Failed to save broker config:', e);
    return res.status(500).json({ message: 'Failed to save config' });
  } finally {
    if (client) await client.close();
  }
});

module.exports = router;

/*
Instructions:
- Mount this router in your main Express app, e.g.:
    const brokerConfigRoutes = require('./server-broker-config-example');
    app.use(brokerConfigRoutes);
- Replace getSettingsCollection logic with your existing Mongo connection.
- Ensure requireAdmin uses your real admin-check middleware.
- This stores the broker config in the 'settings' collection with _id: 'broker'.
- Your workers and endpoints should read the config document before performing automated agent logins and skip actions when agentFetchingEnabled === false.
*/
const DEFAULT_TIMEOUT_MS = 30000;

function timeoutFetch(url, options = {}, timeout = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  const signal = controller.signal;
  return fetch(url, { ...options, signal })
    .finally(() => clearTimeout(timer));
}

const crypto = require('crypto');

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
    if (buf.length !== 32) {
      throw new Error('CREDENTIALS_ENCRYPTION_KEY must be 32 bytes (raw or base64)');
    }
    return buf;
  }

  if (!process.env.JWT_SECRET) {
    throw new Error('CREDENTIALS_ENCRYPTION_KEY is not set and JWT_SECRET is not set. Set one to enable credential encryption.');
  }

  const fallbackKey = crypto.createHash('sha256').update(String(process.env.JWT_SECRET), 'utf8').digest();
  console.warn('⚠️ CREDENTIALS_ENCRYPTION_KEY is not set. Using a SHA-256 derived key from JWT_SECRET as a fallback. For best security, set CREDENTIALS_ENCRYPTION_KEY to a dedicated 32-byte key.');
  return fallbackKey;
}

function decryptCredential(ciphertextBase64) {
  if (!ciphertextBase64) return '';
  const key = getEncryptionKey();
  const input = Buffer.from(ciphertextBase64, 'base64');
  const iv = input.slice(0, 12);
  const authTag = input.slice(12, 28);
  const ciphertext = input.slice(28);
  const decipher = crypto.createDecipheriv(CRED_ALGO, key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  return plaintext;
}

class PathaoApiClient {
  constructor() {
    this.baseUrl = process.env.PATHAO_BASE_URL || 'https://api-hermes.pathao.com';
    this.clientId = process.env.PATHAO_CLIENT_ID || '1';
    this.clientSecret = process.env.PATHAO_CLIENT_SECRET || '';
    this.appVersion = process.env.PATHAO_APP_VERSION || '7.1.2';
    this.tokens = {};
  }

  getDefaultHeaders() {
    return {
      Accept: 'application/json',
      'X-Country-Id': '1',
      'App-Version': this.appVersion,
      'User-Agent': 'okhttp/4.9.2'
    };
  }

  async _fetchJson(url, options = {}) {
    const response = await timeoutFetch(url, options, DEFAULT_TIMEOUT_MS);
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${text}`);
    }
    try {
      return JSON.parse(text);
    } catch (error) {
      throw new Error(`Invalid JSON from Pathao API: ${error.message}`);
    }
  }

  async loginAgent(agent) {
    console.log(`  🔐 Logging in as ${agent.displayName}...`);
    const url = `${this.baseUrl}/talaria/api/v1/issue-token`;
    try {
      // Determine credentials, prefer DB-encrypted values when provided
      let username = agent.username;
      let password = agent.password || '';
      let clientId = agent.clientId || this.clientId;
      let clientSecret = agent.clientSecret || this.clientSecret;

      if (agent.passwordEncrypted) {
        try {
          password = decryptCredential(agent.passwordEncrypted);
        } catch (e) {
          console.warn('Failed to decrypt agent password for', agent.username, e.message || e);
        }
      }
      if (agent.clientSecretEncrypted) {
        try {
          clientSecret = decryptCredential(agent.clientSecretEncrypted);
        } catch (e) {
          console.warn('Failed to decrypt client secret for', agent.username, e.message || e);
        }
      }

      const data = await this._fetchJson(url, {
        method: 'POST',
        headers: {
          ...this.getDefaultHeaders(),
          'Content-Type': 'application/json;charset=utf-8'
        },
        body: JSON.stringify({
          username,
          password,
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: 'password'
        })
      });

      const token = data?.data?.access_token || data?.data?.token || data?.access_token || data?.token;
      if (!token) {
        console.error(`  ❌ No token returned for ${agent.displayName}`);
        return null;
      }

      this.tokens[agent.id] = {
        token,
        expiresAt: new Date(Date.now() + 23 * 60 * 60 * 1000)
      };

      console.log(`  ✅ ${agent.displayName} logged in successfully`);
      return token;
    } catch (error) {
      console.error(`  ❌ Login failed for ${agent.displayName}:`, error.message || error);
      return null;
    }
  }

  async getToken(agent) {
    const tokenInfo = this.tokens[agent.id];
    if (tokenInfo && new Date(tokenInfo.expiresAt) > new Date(Date.now() + 5 * 60 * 1000)) {
      return tokenInfo.token;
    }
    return this.loginAgent(agent);
  }

  async fetchAgentOrders(agent) {
    const token = await this.getToken(agent);
    if (!token) {
      console.warn(`  ⚠️ Skipping ${agent.displayName} because login failed`);
      return [];
    }

    const url = `${this.baseUrl}/talaria/api/v1/user/delivery?page=1&limit=1000`;
    try {
      const data = await this._fetchJson(url, {
        method: 'GET',
        headers: {
          ...this.getDefaultHeaders(),
          Authorization: `Bearer ${token}`
        

      const orders = this._extractOrders(data);
      console.log(`  📦 ${agent.displayName}: fetched ${orders.length} orders`);
      return orders.map((order) => ({
        ...order,
        agentId: agent.id,
        agentDisplayName: agent.displayName
      }));
    } catch (error) {
      console.error(`  ❌ Fetch failed for ${agent.displayName}:`, error.message || error);
      return [];
    }
  }

  _extractOrders(response) {
    if (!response) return [];

    const orders =
      response?.data?.orders?.data ||
      response?.data?.orders ||
      response?.orders ||
      response?.data?.data ||
      response?.data ||
      response?.items ||
      response?.deliveries ||
      response?.data?.deliveries ||
      [];

    if (!Array.isArray(orders)) {
      return [];
    }

    return orders.map((order) => ({
      orderId: order.order_id || order.id || order.orderId || '',
      consignmentId: order.consignment_id || order.consignmentId || order.consignment || '',
      merchantName: order.merchant_name || order.merchantName || order.pageName || order.page || '',
      productDescription: order.order_desc || order.productDescription || order.description || '',
      price: parseFloat(order.amount || order.price || order.bdtPrice || 0) || 0,
      deliveryInstruction:
        order.delivery_instruction || order.deliveryInstruction || order.instructions || order.note || '',
      recipientName: order.recipient_name || order.recipientName || order.recipient || '',
      recipientPhone: order.recipient_phone || order.recipientPhone || order.recipientMobile || order.phone || '',
      recipientAddress:
        order.recipient_address || order.recipientAddress || order.location || order.deliveryAddress || '',
      merchantPhone: order.merchant_phone || order.merchantPhone || order.shopPhone || '',
      failedReason: order.failed_reason || order.failedReason || order.failedMessage || '',
      paymentLink: order.payment_link || order.paymentLink || order.paymentUrl || '',
      quantity: parseInt(order.quantity || order.qty || order.count || 1, 10) || 1,
      status: order.status || 'PENDING'
    }));
  }

  async getActiveAgents() {
    const agents = [];

    // First, load credentials stored in DB (AgentCredential) if available
    try {
      const AgentCredential = require('../models/AgentCredential');
      const creds = await AgentCredential.find({ active: true }).lean();
      for (const [i, cred] of creds.entries()) {
        agents.push({
          id: `db_agent_${String(i + 1).padStart(3, '0')}`,
          displayName: cred.username || cred.phone || `Agent ${i + 1}`,
          username: cred.username || cred.phone,
          passwordEncrypted: cred.encryptedPassword,
          clientId: cred.clientId || this.clientId,
          clientSecretEncrypted: cred.encryptedClientSecret || '',
          source: 'db',
          isActive: !!cred.active
        });
      }
    } catch (error) {
      console.warn('  ⚠️ Could not load agent credentials from DB:', error.message || error);
    }

    // Fallback to environment configured agents if none in DB
    if (agents.length === 0) {
      let index = 1;
      while (true) {
        const username = process.env[`AGENT${index}_USERNAME`];
        const password = process.env[`AGENT${index}_PASSWORD`];
        if (!username || !password) {
          if (index === 1) {
            console.warn('  ⚠️ No Pathao agent credentials found in environment. Set AGENT1_USERNAME and AGENT1_PASSWORD.');
          } else {
            console.warn(`  ⚠️ Stopped scanning Pathao agents after AGENT${index - 1} because AGENT${index}_USERNAME or AGENT${index}_PASSWORD is missing.`);
          }
          break;
        }

        const displayName = process.env[`AGENT${index}_DISPLAY`] || `Agent ${index}`;
        const isActive = process.env[`AGENT${index}_ACTIVE`] !== 'false';

        agents.push({
          id: `agent_${String(index).padStart(3, '0')}`,
          displayName,
          username,
          password,
          isActive
        });
        index += 1;
      }
    }

    const activeAgents = agents.filter((agent) => agent.isActive);
    console.log(`  ℹ️ Pathao agent scan complete. Configured: ${agents.length}, active: ${activeAgents.length}`);
    return activeAgents;
  }

  async fetchAllPendingOrders() {
    const agents = await this.getActiveAgents();
    if (!agents.length) {
      console.warn('⚠️ No configured Pathao agents found');
      return [];
    }

    const uniqueOrders = new Map();
    for (const agent of agents) {
      const agentOrders = await this.fetchAgentOrders(agent);
      const pendingOrders = agentOrders.filter((order) => order.status === 'PENDING' || order.status === 'pickup' || order.status === 'HOLD');
      for (const order of pendingOrders) {
        const key = String(order.orderId || order.consignmentId || `${order.agentId}-${order.recipientPhone}`).trim();
        if (!key) continue;
        if (!uniqueOrders.has(key)) {
          uniqueOrders.set(key, order);
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    const result = Array.from(uniqueOrders.values());
    result.sort((a, b) => String(a.merchantName || '').localeCompare(String(b.merchantName || '')));
    return result;
  }
}

module.exports = PathaoApiClient;

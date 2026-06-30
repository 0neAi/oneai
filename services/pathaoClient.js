const DEFAULT_TIMEOUT_MS = 30000;

function timeoutFetch(url, options = {}, timeout = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  const signal = controller.signal;
  return fetch(url, { ...options, signal })
    .finally(() => clearTimeout(timer));
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
      const data = await this._fetchJson(url, {
        method: 'POST',
        headers: {
          ...this.getDefaultHeaders(),
          'Content-Type': 'application/json;charset=utf-8'
        },
        body: JSON.stringify({
          username: agent.username,
          password: agent.password,
          client_id: this.clientId,
          client_secret: this.clientSecret,
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
        }
      });

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

  getActiveAgents() {
    const agents = [];
    let index = 1;

    while (true) {
      const username = process.env[`AGENT${index}_USERNAME`];
      const password = process.env[`AGENT${index}_PASSWORD`];
      if (!username || !password) break;

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

    return agents.filter((agent) => agent.isActive);
  }

  async fetchAllPendingOrders() {
    const agents = this.getActiveAgents();
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

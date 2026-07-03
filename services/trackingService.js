const DEFAULT_TRACKING_TIMEOUT_MS = 15000;

function normalizeStatus(rawStatus) {
  const status = String(rawStatus || '').trim().toLowerCase();

  if (!status) return 'PENDING';
  if (['delivered', 'delivery completed', 'complete', 'completed'].includes(status)) return 'DELIVERED';
  if (['return', 'returned', 'returned by customer', 'return requested', 'returned to sender'].includes(status)) return 'RETURNED';
  if (['hold', 'on hold', 'holding', 'holded'].includes(status)) return 'HOLD';
  if (['cancelled', 'canceled', 'cancel'].includes(status)) return 'CANCELLED';
  if (['failed', 'failure', 'failed to deliver'].includes(status)) return 'FAILED';
  if (['pickup', 'picked up', 'on pickup', 'in pickup'].includes(status)) return 'PICKUP';
  return 'PENDING';
}

function normalizePhone(phone) {
  const raw = String(phone || '').trim();
  if (!raw) return '';
  const digits = raw.replace(/\D+/g, '');
  return digits.length >= 7 ? digits : '';
}

function collectTrackingTextEntries(trackingData) {
  const entries = [];
  if (!trackingData) return entries;

  const addEntry = value => {
    if (!value) return;
    if (typeof value === 'string') {
      entries.push(value.trim());
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(item => addEntry(item));
      return;
    }
    if (typeof value === 'object') {
      Object.values(value).forEach(val => addEntry(val));
      return;
    }
    entries.push(String(value).trim());
  };

  addEntry(trackingData.history || trackingData.log || trackingData.tracking_details || trackingData.trackingDetails);
  addEntry(trackingData.order || trackingData.delivery || trackingData.data || trackingData);
  addEntry(trackingData.raw);

  return entries.filter(entry => typeof entry === 'string' && entry.length > 0);
}

function extractAgentLines(entries) {
  const agentLines = [];
  const normalizedPhones = new Set();

  const patterns = [
    /assigned to\s*([^()\n]+?)\s*\(\s*([0-9+\-\s()]{7,})\s*\)/i,
    /(?:agent|driver|courier|delivery person)\s*[:\-]?\s*([^()\n]+?)\s*\(\s*([0-9+\-\s()]{7,})\s*\)/i,
    /([^()\n]+?)\s*\(\s*([0-9+\-\s()]{7,})\s*\)/i
  ];

  entries.forEach(entry => {
    for (const pattern of patterns) {
      const match = entry.match(pattern);
      if (!match) continue;

      let name = String(match[1] || '').trim();
      let phone = normalizePhone(match[2] || '');
      if (!phone) continue;

      if (name.toLowerCase().includes('assigned to')) {
        name = name.replace(/assigned to\s*/i, '').trim();
      }

      if (!name) {
        name = 'Unknown Agent';
      }

      if (!normalizedPhones.has(phone)) {
        normalizedPhones.add(phone);
        agentLines.push({ name, phone, rawLine: entry });
      }
      break;
    }
  });

  return agentLines;
}

function parseAssignedAgentsFromTracking(trackingData) {
  const entries = collectTrackingTextEntries(trackingData);
  return extractAgentLines(entries);
}

function extractTrackingData(payload) {
  const root = payload?.data || payload;
  const order = root?.order || root?.delivery || root?.data || root;
  const history = root?.log || root?.history || root?.tracking_details || root?.trackingDetails || [];
  const status = order?.transfer_status || order?.transferStatus || order?.status || root?.status || root?.state || 'PENDING';
  const holdReason = order?.hold_reason || order?.holdReason || root?.hold_reason || root?.holdReason || root?.reason || root?.message || '';

  return {
    status: normalizeStatus(status),
    holdReason: String(holdReason || '').trim(),
    order: order || {},
    history,
    raw: payload
  };
}

async function trackOrder(consignmentId, phone) {
  if (!consignmentId || !phone) {
    return { success: false, error: 'consignmentId and phone are required' };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TRACKING_TIMEOUT_MS);
    let response;

    try {
      response = await fetch('https://merchant.pathao.com/api/v1/user/tracking', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
          Origin: 'https://merchant.pathao.com',
          Referer: `https://merchant.pathao.com/tracking?consignment_id=${encodeURIComponent(consignmentId)}&phone=${encodeURIComponent(phone)}`,
          Accept: 'application/json, text/plain, */*'
        },
        body: JSON.stringify({
          phone_no: phone,
          consignment_id: consignmentId
        }),
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeoutId);
    }

    const text = await response.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch (error) {
      data = { message: text };
    }

    if (!response.ok || data?.code !== 200) {
      return {
        success: false,
        error: data?.message || `Tracking failed with status ${response.status}`
      };
    }

    const trackingData = extractTrackingData(data?.data || data);
    return {
      success: true,
      data: trackingData,
      status: trackingData.status
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Tracking request failed'
    };
  }
}

async function trackOrderByLink(paymentLink, fallbackPhone, fallbackConsignmentId) {
  const url = new URL(paymentLink);
  const consignmentId = url.searchParams.get('consignment_id') || url.searchParams.get('consignmentId') || fallbackConsignmentId;
  const phone = url.searchParams.get('phone') || url.searchParams.get('phone_no') || fallbackPhone;

  if (!consignmentId || !phone) {
    return { success: false, error: 'Unable to resolve consignmentId and phone from the provided link' };
  }

  return trackOrder(consignmentId, phone);
}

module.exports = { trackOrder, trackOrderByLink, parseAssignedAgentsFromTracking };

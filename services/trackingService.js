const DEFAULT_TRACKING_TIMEOUT_MS = 15000;

function normalizeStatus(rawStatus) {
  const status = String(rawStatus || '').trim().toLowerCase().replace(/[_\s]+/g, ' ');

  if (!status) return 'PENDING';
  if (['delivered', 'delivery completed', 'complete', 'completed'].includes(status)) return 'DELIVERED';
  if (['partial delivery', 'partially delivered', 'partial', 'partially delivered.', 'partial delivery.'].includes(status) || /partial(?:ly)?\s*delivery/.test(status)) return 'DELIVERED';
  if (['return', 'returned', 'returned by customer', 'return requested', 'returned to sender', 'paid return', 'paid return.', 'paid-return', 'paid_return'].includes(status)) return 'RETURNED';
  if (status.includes('paid return') || status.includes('paid-return') || status.includes('paid_return')) return 'RETURNED';
  if (['hold', 'on hold', 'holding', 'holded'].includes(status)) return 'HOLD';
  if (['exchange', 'exchanged', 'exchange completed', 'exchanged successfully'].some(keyword => status.includes(keyword))) return 'DELIVERED';
  if (['cancelled', 'canceled', 'cancel'].includes(status)) return 'CANCELLED';
  if (['failed', 'failure', 'failed to deliver'].includes(status)) return 'FAILED';
  if (['pickup', 'picked up', 'on pickup', 'in pickup'].includes(status)) return 'PICKUP';
  return 'PENDING';
}

/**
 * Centralized phone normalization for Bangladesh numbers.
 * Converts various formats (+880XXXXXXXXXX, 880XXXXXXXXXX, 01XXXXXXXXXX, 1XXXXXXXXXX)
 * to canonical 11-digit format (01XXXXXXXXXX).
 * @param {string} phone - Raw phone number
 * @returns {string} - 11-digit normalized phone or empty string if invalid
 */
function normalizePhoneForDB(phone) {
  const raw = String(phone || '').trim();
  if (!raw) return '';
  
  // Extract only digits
  let digits = raw.replace(/\D+/g, '');
  if (digits.length < 7) return '';
  
  // Bangladesh local number heuristic
  // If 13 digits and starts with 880, remove leading 880 and keep local 11-digit
  if (digits.length === 13 && digits.startsWith('880')) {
    // +880XXXXXXXXXX → 01XXXXXXXXXX
    digits = '0' + digits.slice(3);
  } else if (digits.length === 12 && digits.startsWith('880')) {
    // 880XXXXXXXXXX → 01XXXXXXXXXX
    digits = '0' + digits.slice(3);
  } else if (digits.length === 11 && /^0[1-9]/.test(digits)) {
    // Already 01XXXXXXXXXX format
  } else if (digits.length === 10 && /^[1-9]/.test(digits)) {
    // Possibly missing leading 0, assume local 01XXXXXXXXX
    digits = '0' + digits;
  }
  
  // Return canonical 11-digit format if matches Bangladesh pattern (01XXXXXXXXX)
  return /^0[1-9]\d{9}$/.test(digits) ? digits : '';
}

// Legacy alias for backward compatibility
function normalizePhone(phone) {
  return normalizePhoneForDB(phone);
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
    /([a-zA-Z\s]+)\s*[-–—]\s*([0-9+\-\s()]{7,})/i,
    /([0-9+\-\s()]{7,})\s*[-–—]\s*([a-zA-Z\s]+)/i,
    /([^()\n]+?)\s*\(\s*([0-9+\-\s()]{7,})\s*\)/i
  ];

  entries.forEach(entry => {
    for (const pattern of patterns) {
      const match = entry.match(pattern);
      if (!match) continue;

      let name = String(match[1] || '').trim();
      let phone = String(match[2] || '').trim();
      
      // Swap if phone appears first (for NAME - PHONE vs PHONE - NAME patterns)
      if (/^[0-9+\-\s()]{7,}$/.test(name)) {
        [name, phone] = [phone, name];
      }
      
      phone = normalizePhoneForDB(phone);
      if (!phone) continue;

      if (name.toLowerCase().includes('assigned to')) {
        name = name.replace(/assigned to\s*/i, '').trim();
      }

      if (!name || name.length < 2) {
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

module.exports = { trackOrder, trackOrderByLink, parseAssignedAgentsFromTracking, normalizePhoneForDB };

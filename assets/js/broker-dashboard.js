const DEFAULT_API_BASE_URL = 'https://oneai-wjox.onrender.com';
const isLocalhost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
const API_BASE_URL = window.API_BASE_URL || (isLocalhost
    ? 'http://localhost:10000'
    : (window.location.hostname === '0neai.github.io' ? DEFAULT_API_BASE_URL : window.location.origin));

const BROKER_TRC20_ADDRESS = 'TKbAYXQPYeU9BbW41h2h4Lao63iyMXMdJ5';
const FALLBACK_BROKER_PACKAGES = [
    { id: 'pkg_1200', credits: 1200, price: 35, currency: 'USDT' },
    { id: 'pkg_2500', credits: 2500, price: 75, currency: 'USDT' },
    { id: 'pkg_5000', credits: 5000, price: 130, currency: 'USDT' }
];

const brokerState = {
    orders: [],
    agents: [],
    credits: 0,
    active: 0,
    completed: 0,
    subscriptionTier: 'free',
    subscriptionExpiresAt: null,
    selectedPackage: null,
    paymentMethod: 'USDT',
    paymentTxId: '',
    currentFilter: {},
    search: '',
    statusFilter: '',
    sortBy: 'recent',
    // Caching properties
    lastFetchTime: null,
    cacheExpiry: 5 * 60 * 1000, // 5 minutes cache
    isInitialLoad: true
};

// ============================================
// SIDE PANEL CONTROL FUNCTIONS
// ============================================

function openBrokerDetailPanel() {
    const panel = document.getElementById('broker-detail-panel');
    const overlay = document.getElementById('broker-modal-overlay');
    panel.classList.add('active');
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeBrokerDetailPanel() {
    const panel = document.getElementById('broker-detail-panel');
    const overlay = document.getElementById('broker-modal-overlay');
    panel.classList.remove('active');
    overlay.classList.remove('active');
    document.body.style.overflow = '';
}

// Close panel when overlay is clicked
document.addEventListener('DOMContentLoaded', function() {
    const overlay = document.getElementById('broker-modal-overlay');
    if (overlay) {
        overlay.addEventListener('click', closeBrokerDetailPanel);
    }
});

function toggleOrderForm() {
    const orderForm = document.getElementById('broker-order-form');
    const creditForm = document.getElementById('broker-credit-form');
    orderForm.style.display = orderForm.style.display === 'block' ? 'none' : 'block';
    creditForm.style.display = 'none';
    
    // Load agents when form is opened
    if (orderForm.style.display === 'block') {
        loadBrokerAgents();
    }
}

function toggleCreditForm() {
    const creditForm = document.getElementById('broker-credit-form');
    const orderForm = document.getElementById('broker-order-form');
    creditForm.style.display = creditForm.style.display === 'block' ? 'none' : 'block';
    orderForm.style.display = 'none';
    if (creditForm.style.display === 'block') {
        loadBrokerCreditPackages();
    }
}

function showBrokerCreditRequiredNotice() {
    const notice = document.getElementById('broker-credit-warning');
    if (notice) {
        notice.style.display = 'block';
    }
}

function hideBrokerCreditRequiredNotice() {
    const notice = document.getElementById('broker-credit-warning');
    if (notice) {
        notice.style.display = 'none';
    }
}

function clearBrokerOrdersForCredit() {
    document.getElementById('broker-results-summary').textContent = 'Order view disabled until credits are purchased';
    const activeTbody = document.getElementById('broker-order-list');
    const deliveredTbody = document.getElementById('broker-delivered-order-list');
    const archivedTbody = document.getElementById('broker-archived-order-list');
    const message = '<tr><td colspan="6" class="text-center">You need broker credits to load orders. Purchase credits via TRX/USDT to view data.</td></tr>';
    if (activeTbody) activeTbody.innerHTML = message;
    if (deliveredTbody) deliveredTbody.innerHTML = message;
    if (archivedTbody) archivedTbody.innerHTML = message;
}

function applyBrokerSearch(value) {
    brokerState.search = value.trim().toLowerCase();
    renderBrokerOrders();
}

function formatBrokerPrice(value) {
    if (value === null || value === undefined || value === '') return '—';
    const num = Number(value);
    return Number.isFinite(num) ? `৳${num.toFixed(2)}` : String(value);
}

function extractBrokerQuantity(order) {
    if (order.quantity) return order.quantity;
    const description = order.productDescription || order.description || '';
    const match = description.match(/qty\s*[:#-]?\s*(\d+)/i);
    return match ? match[1] : '—';
}

function extractBrokerPrice(order) {
    if (order.price || order.amount || order.totalAmount || order.bdtPrice) {
        return formatBrokerPrice(order.price || order.amount || order.totalAmount || order.bdtPrice);
    }
    const description = order.productDescription || order.description || '';
    const match = description.match(/price\s*[:#-]?\s*(\d+(?:\.\d+)?)/i);
    return match ? formatBrokerPrice(match[1]) : '—';
}

function buildBrokerOrderDetailItems(order) {
    const merchantName = order.merchantName || order.pageName || order.page || '—';
    const productDescription = order.productDescription || order.description || 'No description provided';
    const recipientAddress = order.recipientAddress || order.location || order.deliveryAddress || '—';
    const deliveryInstruction = order.deliveryInstruction || order.instructions || order.note || '—';
    const paymentLink = order.paymentLink || order.paymentUrl || '—';
    const merchantPhone = order.merchantPhone || order.shopPhone || '—';
    const consignmentId = order.consignmentId || order.consignmentID || order.consignment || '—';
    const failedReason = order.failedReason || order.failedMessage || 'None';

    return [
        { label: 'Merchant / Page', value: merchantName },
        { label: 'Order ID', value: order.orderId || order._id || '—' },
        { label: 'Product', value: productDescription },
        { label: 'Price', value: extractBrokerPrice(order) },
        { label: 'Quantity', value: extractBrokerQuantity(order) },
        { label: 'Recipient', value: `${order.recipientName || '—'} (${order.recipientPhone || '—'})` },
        { label: 'Location', value: recipientAddress },
        { label: 'Delivery Instruction', value: deliveryInstruction },
        { label: 'Agent', value: order.agentDisplayName || order.agentName || '—' },
        { label: 'Merchant Phone', value: merchantPhone },
        { label: 'Consignment ID', value: consignmentId },
        { label: 'Payment Link', value: paymentLink, isLink: true },
        { label: 'Failed Reason', value: failedReason }
    ];
}

function showBrokerOrderDetails(orderId) {
    const order = brokerState.orders.find(o => o._id === orderId);
    if (!order) return;

    const content = document.getElementById('broker-order-details-content');
    const items = buildBrokerOrderDetailItems(order);
    content.innerHTML = `
        ${items.map(item => `
            <div class="broker-detail-item">
                <strong>${item.label}</strong>
                ${item.isLink && item.value !== '—'
                    ? `<a href="${item.value}" target="_blank" rel="noopener noreferrer" title="Click to open in new tab">📎 ${item.value}</a>`
                    : `<span>${item.value}</span>`}
            </div>
        `).join('')}
    `;
    openBrokerDetailPanel();
}

// Alias for backward compatibility
function closeBrokerOrderDetailsModal() {
    closeBrokerDetailPanel();
}

function applyBrokerStatusFilter(value) {
    brokerState.statusFilter = value;
    const filterLabel = document.getElementById('broker-results-summary');
    filterLabel.textContent = value ? `Showing ${value.toLowerCase()} orders` : `Showing ${brokerState.orders.length} orders`;
    renderBrokerOrders();
}

function applyBrokerSort(value) {
    brokerState.sortBy = value || 'recent';
    renderBrokerOrders();
}

function setBrokerFilter(mode) {
    brokerState.search = '';
    brokerState.statusFilter = '';
    document.getElementById('broker-search').value = '';
    document.getElementById('broker-status-filter').value = '';

    if (mode === 'hold') {
        brokerState.statusFilter = 'HOLD';
        document.getElementById('broker-status-filter').value = 'HOLD';
        loadBrokerData({ status: 'HOLD' });
    } else if (mode === 'unassigned') {
        brokerState.statusFilter = 'UNASSIGNED';
        document.getElementById('broker-status-filter').value = '';
        loadBrokerData({ assigned: false });
    } else {
        loadBrokerData({});
    }
}

async function loadBrokerData(filter = {}, forceRefresh = false) {
    const authToken = localStorage.getItem('authToken');
    const userID = localStorage.getItem('userID');
    const headers = {
        'Authorization': `Bearer ${authToken}`,
        'X-User-ID': userID
    };

    // Check cache validity
    const now = Date.now();
    const isCacheValid = !forceRefresh && 
                       brokerState.lastFetchTime && 
                       (now - brokerState.lastFetchTime) < brokerState.cacheExpiry &&
                       JSON.stringify(brokerState.currentFilter) === JSON.stringify(filter);

    if (isCacheValid && brokerState.orders.length > 0 && !brokerState.isInitialLoad) {
        console.log('✓ Using cached broker data (5 min cache)');
        renderBrokerOrders();
        return;
    }

    const query = new URLSearchParams({ mine: 'false' });
    if (filter.status) query.set('status', filter.status);
    if (filter.assigned === false) query.set('assigned', 'false');
    if (filter.assigned === true) query.set('assigned', 'true');

    try {
        const creditsRes = await fetch(`${API_BASE_URL}/broker/credits`, { headers });
        if (!creditsRes.ok) throw new Error('Failed to load broker credits');

        const creditsData = await creditsRes.json();
        brokerState.credits = creditsData.credits || 0;
        brokerState.subscriptionTier = creditsData.subscriptionTier || 'free';
        brokerState.subscriptionExpiresAt = creditsData.subscriptionExpiresAt ? new Date(creditsData.subscriptionExpiresAt) : null;
        brokerState.currentFilter = filter;
        brokerState.lastFetchTime = now;
        brokerState.isInitialLoad = false;

        document.getElementById('broker-credits').textContent = brokerState.credits;
        document.getElementById('broker-subscription-tier').textContent = brokerState.subscriptionTier || 'Free';
        document.getElementById('broker-subscription-expires').textContent = brokerState.subscriptionExpiresAt ? `Expires: ${brokerState.subscriptionExpiresAt.toLocaleDateString()}` : 'No active plan';

        if (brokerState.credits < 1) {
            brokerState.orders = [];
            brokerState.active = 0;
            brokerState.completed = 0;
            document.getElementById('broker-active-orders').textContent = '0';
            document.getElementById('broker-completed-orders').textContent = '0';
            showBrokerCreditRequiredNotice();
            clearBrokerOrdersForCredit();
            return;
        }

        hideBrokerCreditRequiredNotice();

        const ordersRes = await fetch(`${API_BASE_URL}/broker/orders/user?${query.toString()}`, { headers });
        if (!ordersRes.ok) throw new Error('Failed to load broker orders');

        const ordersData = await ordersRes.json();
        brokerState.orders = ordersData.orders || [];
        brokerState.credits = typeof ordersData.credits === 'number' ? ordersData.credits : brokerState.credits;
        brokerState.active = brokerState.orders.filter(o => ['PENDING', 'PICKUP', 'HOLD'].includes(o.status)).length;
        brokerState.completed = brokerState.orders.filter(o => o.status === 'DELIVERED').length;

        document.getElementById('broker-credits').textContent = brokerState.credits;
        document.getElementById('broker-active-orders').textContent = brokerState.active;
        document.getElementById('broker-completed-orders').textContent = brokerState.completed;

        renderBrokerOrders();
    } catch (error) {
        console.error('Broker load error:', error);
        showError(error.message || 'Failed to load broker data');
        if (error.message && error.message.toLowerCase().includes('credit')) {
            showBrokerCreditRequiredNotice();
            clearBrokerOrdersForCredit();
        }
    }
}

function renderBrokerOrders() {
    const activeTbody = document.getElementById('broker-order-list');
    const deliveredTbody = document.getElementById('broker-delivered-order-list');
    const archivedTbody = document.getElementById('broker-archived-order-list');
    activeTbody.innerHTML = '';
    deliveredTbody.innerHTML = '';
    archivedTbody.innerHTML = '';

    const filteredOrders = filterBrokerOrders(brokerState.orders);
    const activeOrders = sortBrokerOrders(filteredOrders.filter(o => ['PENDING', 'PICKUP', 'HOLD'].includes(o.status)));
    const deliveredOrders = sortBrokerOrders(filteredOrders.filter(o => o.status === 'DELIVERED'));
    const archivedOrders = sortBrokerOrders(filteredOrders.filter(o => !['PENDING', 'PICKUP', 'DELIVERED'].includes(o.status)));

    document.getElementById('broker-results-summary').textContent = `Showing ${filteredOrders.length} order${filteredOrders.length === 1 ? '' : 's'}`;

    if (!activeOrders.length) {
        activeTbody.innerHTML = '<tr><td colspan="3" class="text-center">No active or hold orders match the current filters.</td></tr>';
    } else {
        activeOrders.forEach(order => renderBrokerOrder(order, activeTbody, true));
    }

    if (!deliveredOrders.length) {
        deliveredTbody.innerHTML = '<tr><td colspan="3" class="text-center">No completed orders match the current filters.</td></tr>';
    } else {
        deliveredOrders.forEach(order => renderBrokerOrder(order, deliveredTbody, false));
    }

    if (!archivedOrders.length) {
        archivedTbody.innerHTML = '<tr><td colspan="3" class="text-center">No archived orders match the current filters.</td></tr>';
    } else {
        archivedOrders.forEach(order => renderBrokerOrder(order, archivedTbody, false));
    }
}

function filterBrokerOrders(orders) {
    const search = brokerState.search || '';

    return orders.filter(order => {
        const isUnassignedFilter = brokerState.statusFilter === 'UNASSIGNED';
        const statusMatch = isUnassignedFilter
            ? order.assigned === false
            : !brokerState.statusFilter || order.status === brokerState.statusFilter;

        if (!statusMatch) {
            return false;
        }

        if (!search) {
            return true;
        }

        const combined = [
            order.orderId,
            order.merchantName,
            order.productDescription,
            order.recipientName,
            order.recipientPhone,
            order.recipientAddress,
            order.agentDisplayName,
            order.agentName,
            order.status
        ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();

        return combined.includes(search);
    });
}

function sortBrokerOrders(orders) {
    return [...orders].sort((a, b) => {
        if (brokerState.sortBy === 'holdDays') {
            const aHold = parseInt(a.holdCount || 0, 10);
            const bHold = parseInt(b.holdCount || 0, 10);
            return bHold - aHold;
        }

        if (brokerState.sortBy === 'agent') {
            return String(a.agentDisplayName || a.agentName || '').localeCompare(String(b.agentDisplayName || b.agentName || ''));
        }

        if (brokerState.sortBy === 'price-high') {
            const aPrice = Number(a.price || a.amount || a.totalAmount || a.bdtPrice || 0);
            const bPrice = Number(b.price || b.amount || b.totalAmount || b.bdtPrice || 0);
            return bPrice - aPrice;
        }

        if (brokerState.sortBy === 'price-low') {
            const aPrice = Number(a.price || a.amount || a.totalAmount || a.bdtPrice || 0);
            const bPrice = Number(b.price || b.amount || b.totalAmount || b.bdtPrice || 0);
            return aPrice - bPrice;
        }

        if (brokerState.sortBy === 'alphabetical') {
            const aName = String(a.merchantName || a.orderId || a.productDescription || '').toLowerCase();
            const bName = String(b.merchantName || b.orderId || b.productDescription || '').toLowerCase();
            return aName.localeCompare(bName);
        }

        const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return bTime - aTime;
    });
}

function renderBrokerOrder(order, tbody, showActions) {
    const row = document.createElement('tr');
    row.className = 'broker-order-clickable';
    row.onclick = () => showBrokerOrderDetails(order._id);

    const actions = [];
    if (showActions && ['PENDING', 'PICKUP', 'HOLD'].includes(order.status)) {
        actions.push(`<button class="action-btn small" onclick="event.stopPropagation(); trackBrokerOrder('${order._id}')">Track</button>`);
        actions.push(`<button class="action-btn small cancel-btn" onclick="event.stopPropagation(); hideBrokerOrder('${order._id}')">Cancel</button>`);
    }

    const deliveredAt = order.updatedAt ? new Date(order.updatedAt).toLocaleString() : '—';
    const holdDaysBadge = order.status === 'HOLD' && order.holdCount ? `<span class="meta-pill hold-pill">Hold ${order.holdCount} day${order.holdCount === 1 ? '' : 's'}</span>` : '';
    const recipientInfo = `<div class="broker-order-summary"><strong>${order.recipientName || 'Unknown recipient'}</strong><small>${[order.recipientPhone, order.recipientAddress].filter(Boolean).join(' • ')}</small></div>`;
    const priceInfo = order.price || order.amount || order.totalAmount || order.bdtPrice ? `<div class="broker-order-meta">Price: ${formatBrokerPrice(order.price || order.amount || order.totalAmount || order.bdtPrice)}</div>` : '';
    const quantityInfo = extractBrokerQuantity(order) !== '—' ? `<div class="broker-order-meta">Qty: ${extractBrokerQuantity(order)}</div>` : '';
    const actionContent = showActions
        ? `${actions.join(' ') || '<span class="text-muted">No actions</span>'}`
        : `<span class="text-muted">${deliveredAt}</span>`;

    row.innerHTML = `
        <td>
            <div class="broker-order-summary"><strong>${order.merchantName || order.orderId || 'Unnamed order'}</strong><small>${order.productDescription || 'No description'}</small>${priceInfo}${quantityInfo}</div>
        </td>
        <td>${recipientInfo}</td>
        <td class="broker-actions-cell">
            <div class="broker-action-stack">
                ${actionContent}
                <div class="broker-status-stack">
                    ${getStatusButtonHtml(order.status)}
                    ${holdDaysBadge}
                </div>
            </div>
        </td>
    `;

    tbody.appendChild(row);
}

// Remove/hide an order locally from the UI (does not delete server-side)
function hideBrokerOrder(orderId) {
    // Remove from state
    const idx = brokerState.orders.findIndex(o => o._id === orderId);
    if (idx !== -1) {
        brokerState.orders.splice(idx, 1);
        renderBrokerOrders();
        showSuccess && showSuccess('Order hidden from the list.');
    } else {
        showError && showError('Order not found.');
    }
}

function getStatusButtonHtml(status) {
    if (!status) return '';
    const s = String(status).toUpperCase();
    const map = {
        'PENDING': { cls: 'status pending', label: 'PENDING' },
        'PICKUP': { cls: 'status pickup', label: 'PICKUP' },
        'HOLD': { cls: 'status hold', label: 'HOLD' },
        'DELIVERED': { cls: 'status delivered', label: 'DELIVERED' },
        'CANCELLED': { cls: 'status cancelled', label: 'CANCELLED' },
        'FAILED': { cls: 'status failed', label: 'FAILED' },
        'RETURNED': { cls: 'status returned', label: 'RETURNED' }
    };
    const info = map[s] || { cls: 'status', label: s };
    // Render as a button-like badge
    return `<button class="status-button ${info.cls.toLowerCase()}" onclick="event.stopPropagation();">${info.label}</button>`;
}

// ============================================
// AGENT FUNCTIONS - Load and manage agents
// ============================================

async function loadBrokerAgents() {
  const authToken = localStorage.getItem('authToken');
  const userID = localStorage.getItem('userID');
  
  if (!authToken || !userID) {
    console.warn('No auth token or user ID found');
    brokerState.agents = [];
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}/broker/agents`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'X-User-ID': userID,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (data.success && Array.isArray(data.agents)) {
      brokerState.agents = data.agents;
      console.log('✅ Loaded agents:', data.agents.map(a => a.displayName).join(', '));
    } else {
      console.warn('Failed to load agents');
      brokerState.agents = [];
    }
    
    renderAgentSelector();
  } catch (error) {
    console.error('❌ Failed to load agents:', error);
    brokerState.agents = [];
    renderAgentSelector();
  }
}

function renderAgentSelector() {
  const agentSelect = document.getElementById('broker-agent');
  
  if (!agentSelect) {
    console.warn('Agent selector element not found');
    return;
  }
  
  // Clear existing options
  agentSelect.innerHTML = '';
  
  // Add default option
  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = '-- Select Agent --';
  agentSelect.appendChild(defaultOption);
  
  // Add agent options
  if (brokerState.agents && brokerState.agents.length > 0) {
    brokerState.agents.forEach(agent => {
      const option = document.createElement('option');
      option.value = agent.displayName;
      option.textContent = agent.displayName;
      agentSelect.appendChild(option);
    });
  }
  
  console.log('✅ Agent selector rendered with', (agentSelect.options.length - 1), 'agents');
}

function getSelectedAgentName() {
  const agentSelect = document.getElementById('broker-agent');
  
  if (!agentSelect || !agentSelect.value) {
    return '';
  }
  
  return agentSelect.value;
}

async function createBrokerOrder() {
    const authToken = localStorage.getItem('authToken');
    const userID = localStorage.getItem('userID');
    
    const selectedAgentName = getSelectedAgentName();
    
    const payload = {
        merchantName: document.getElementById('broker-merchant-name').value.trim(),
        productDescription: document.getElementById('broker-product-description').value.trim(),
        recipientName: document.getElementById('broker-recipient-name').value.trim(),
        recipientPhone: document.getElementById('broker-recipient-phone').value.trim(),
        recipientAddress: document.getElementById('broker-recipient-address').value.trim(),
        agentName: selectedAgentName
    };

    if (!payload.merchantName || !payload.recipientName || !payload.recipientPhone || !payload.recipientAddress) {
        showError('Please fill in merchant, recipient name, phone, and address.');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/broker/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`,
                'X-User-ID': userID
            },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Failed to create broker order');

        brokerState.credits = data.brokerCredits;
        document.getElementById('broker-credits').textContent = brokerState.credits;
        brokerState.orders.unshift(data.order);
        brokerState.active += 1;
        renderBrokerOrders();
        showSuccess('Broker order created successfully.');
        document.getElementById('broker-order-form').style.display = 'none';
    } catch (error) {
        console.error('Create broker order error:', error);
        showError(error.message || 'Unable to create broker order.');
    }
}

async function loadBrokerCreditPackages() {
    const authToken = localStorage.getItem('authToken');
    const userID = localStorage.getItem('userID');
    const headers = {
        'Authorization': `Bearer ${authToken}`,
        'X-User-ID': userID
    };
    const packagesContainer = document.getElementById('broker-packages-list');

    if (!packagesContainer) return;

    packagesContainer.innerHTML = '<div style="grid-column: 1 / -1; color: #9fb4ff;">Loading packages…</div>';

    try {
        const response = await fetch(`${API_BASE_URL}/broker/credit-packages`, { headers });
        const data = await response.json();
        if (!response.ok) throw new Error(data?.message || 'Failed to load credit packages');

        const packages = Array.isArray(data?.packages) && data.packages.length ? data.packages : FALLBACK_BROKER_PACKAGES;
        packagesContainer.innerHTML = '';

        packages.forEach(pkg => {
            const pricePerCredit = (pkg.price / pkg.credits).toFixed(3);
            const card = document.createElement('button');
            card.type = 'button';
            card.className = 'broker-package-card';
            card.innerHTML = `
                <div style="font-weight: 800; font-size: 1.4rem; color: #4ade80; margin-bottom: 8px;">${Number(pkg.credits).toLocaleString()}</div>
                <div style="font-size: 0.95rem; color: #b8bee5; margin-bottom: 8px;">Credits</div>
                <div style="font-weight: 700; color: #facc15; margin-bottom: 6px;">${pkg.price} ${pkg.currency}</div>
                <div style="font-size: 0.85rem; color: #95a3d2;">$${pricePerCredit}/credit</div>
            `;
            card.onclick = () => setBrokerPackageSelection(pkg, card);
            card.onkeydown = (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setBrokerPackageSelection(pkg, card);
                }
            };
            packagesContainer.appendChild(card);
        });

        if (brokerState.selectedPackage) {
            const activeCard = Array.from(packagesContainer.querySelectorAll('.broker-package-card')).find((element) => element.dataset.packageId === brokerState.selectedPackage.id);
            if (activeCard) {
                activeCard.classList.add('active');
            }
        }
    } catch (error) {
        console.error('Load packages error:', error);
        packagesContainer.innerHTML = '';
        FALLBACK_BROKER_PACKAGES.forEach(pkg => {
            const pricePerCredit = (pkg.price / pkg.credits).toFixed(3);
            const card = document.createElement('button');
            card.type = 'button';
            card.className = 'broker-package-card';
            card.innerHTML = `
                <div style="font-weight: 800; font-size: 1.4rem; color: #4ade80; margin-bottom: 8px;">${Number(pkg.credits).toLocaleString()}</div>
                <div style="font-size: 0.95rem; color: #b8bee5; margin-bottom: 8px;">Credits</div>
                <div style="font-weight: 700; color: #facc15; margin-bottom: 6px;">${pkg.price} ${pkg.currency}</div>
                <div style="font-size: 0.85rem; color: #95a3d2;">$${pricePerCredit}/credit</div>
            `;
            card.onclick = () => setBrokerPackageSelection(pkg, card);
            packagesContainer.appendChild(card);
        });
        showError(error.message || 'Failed to load credit packages');
    }
}

function setBrokerPackageSelection(pkg, selectedCard) {
    brokerState.selectedPackage = pkg;
    const selectedDiv = document.getElementById('broker-selected-package');
    const packagesContainer = document.getElementById('broker-packages-list');

    if (selectedDiv) {
        selectedDiv.innerHTML = `<strong>${Number(pkg.credits).toLocaleString()} credits</strong> for <strong>${pkg.price} ${pkg.currency}</strong>`;
    }

    if (packagesContainer) {
        packagesContainer.querySelectorAll('.broker-package-card').forEach((card) => card.classList.remove('active'));
        if (selectedCard) {
            selectedCard.classList.add('active');
        }
    }
}

function setBrokerPaymentMethod(value) {
    brokerState.paymentMethod = value;
}

function setBrokerPaymentTxId(value) {
    brokerState.paymentTxId = value.trim();
}

async function purchaseBrokerCredits() {
    const authToken = localStorage.getItem('authToken');
    const userID = localStorage.getItem('userID');

    if (!brokerState.selectedPackage) {
        showError('Please select a credit package first.');
        return;
    }

    const paymentMethod = document.getElementById('broker-payment-method')?.value || brokerState.paymentMethod;
    const paymentTxId = document.getElementById('broker-payment-txid')?.value.trim() || brokerState.paymentTxId.trim();

    if (!paymentMethod) {
        showError('Please select a payment method (TRX or USDT).');
        return;
    }

    if (!paymentTxId) {
        showError('Please enter your TRX/USDT transaction reference.');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/broker/credits/purchase`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`,
                'X-User-ID': userID
            },
            body: JSON.stringify({
                packageId: brokerState.selectedPackage.id,
                paymentMethod,
                trxid: paymentTxId,
                paymentTxId
            })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Broker credit purchase failed');

        brokerState.credits = data.brokerCredits ?? brokerState.credits;
        document.getElementById('broker-credits').textContent = brokerState.credits;
        const successMessage = data.message || `✅ ${data.package?.credits?.toLocaleString() || brokerState.selectedPackage?.credits?.toLocaleString() || 'Credits'} purchased successfully!`;
        showSuccess(successMessage);
        document.getElementById('broker-credit-form').style.display = 'none';
        brokerState.selectedPackage = null;
        brokerState.paymentTxId = '';
        if (document.getElementById('broker-selected-package')) {
            document.getElementById('broker-selected-package').innerHTML = '<span style="color: #999;">No package selected</span>';
        }
        if (document.getElementById('broker-payment-txid')) {
            document.getElementById('broker-payment-txid').value = '';
        }
        if (document.getElementById('broker-payment-method')) {
            document.getElementById('broker-payment-method').value = 'USDT';
        }
        hideBrokerCreditRequiredNotice();
        await loadBrokerData(brokerState.currentFilter);
        window.fetchGlobalTrxBalance?.();
    } catch (error) {
        console.error('Purchase broker credits error:', error);
        showError(error.message || 'Unable to purchase broker credits.');
    }
}

function copyBrokerPaymentAddress() {
    if (!navigator.clipboard) {
        showError('Clipboard support is not available in this browser.');
        return;
    }

    navigator.clipboard.writeText(BROKER_TRC20_ADDRESS)
        .then(() => showSuccess('TRC20 payment address copied to clipboard.'))
        .catch(() => showError('Failed to copy the TRC20 address.'));
}

async function trackBrokerOrder(orderId) {
    const authToken = localStorage.getItem('authToken');
    const userID = localStorage.getItem('userID');
    const order = brokerState.orders.find(o => o._id === orderId);
    const paymentLink = order?.paymentLink || order?.paymentUrl || order?.payment_link || order?.link;

    if (paymentLink) {
        window.open(paymentLink, '_blank');
    }

    try {
        const payload = { paymentLink };
        if (order?.recipientPhone) payload.phone = order.recipientPhone;
        if (order?.consignmentId) payload.consignmentId = order.consignmentId;

        const response = await fetch(`${API_BASE_URL}/broker/orders/${orderId}/track`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`,
                'X-User-ID': userID
            },
            body: JSON.stringify(payload)
        });
        const data = await response.json();

        if (!response.ok) {
            if (response.status === 404 && paymentLink) {
                showSuccess('Opened payment link and tracking will continue from that page.');
                return;
            }
            throw new Error(data.message || 'Failed to track order');
        }

        const index = brokerState.orders.findIndex(o => o._id === orderId);
        if (index !== -1) {
            brokerState.orders[index] = data.order;
            brokerState.active = brokerState.orders.filter(o => ['PENDING', 'PICKUP', 'HOLD'].includes(o.status)).length;
            brokerState.completed = brokerState.orders.filter(o => o.status === 'DELIVERED').length;
            document.getElementById('broker-active-orders').textContent = brokerState.active;
            document.getElementById('broker-completed-orders').textContent = brokerState.completed;
            renderBrokerOrders();
        }

        showSuccess('Order tracking refreshed successfully.');
    } catch (error) {
        console.error('Track broker order error:', error);
        if (paymentLink && error.message?.toLowerCase().includes('broker order not found')) {
            showSuccess('Opened payment link and could not refresh tracking due to backend order lookup.');
            return;
        }
        showError(error.message || 'Unable to track broker order.');
    }
}

async function updateBrokerOrderStatus(orderId, status) {
    const authToken = localStorage.getItem('authToken');
    const userID = localStorage.getItem('userID');

    try {
        const response = await fetch(`${API_BASE_URL}/broker/orders/${orderId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`,
                'X-User-ID': userID
            },
            body: JSON.stringify({ status })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Failed to update order status');

        const index = brokerState.orders.findIndex(o => o._id === orderId);
        if (index !== -1) {
            brokerState.orders[index] = data.order;
            brokerState.active = brokerState.orders.filter(o => o.status === 'PENDING' || o.status === 'PICKUP').length;
            brokerState.completed = brokerState.orders.filter(o => o.status === 'DELIVERED').length;
            document.getElementById('broker-active-orders').textContent = brokerState.active;
            document.getElementById('broker-completed-orders').textContent = brokerState.completed;
            renderBrokerOrders();
        }

        showSuccess('Order status updated successfully.');
    } catch (error) {
        console.error('Update broker order status error:', error);
        showError(error.message || 'Unable to update broker order status.');
    }
}

window.toggleOrderForm = toggleOrderForm;
window.toggleCreditForm = toggleCreditForm;
window.loadBrokerData = loadBrokerData;
window.loadBrokerAgents = loadBrokerAgents;
window.applyBrokerSearch = applyBrokerSearch;
window.applyBrokerStatusFilter = applyBrokerStatusFilter;
window.applyBrokerSort = applyBrokerSort;
window.createBrokerOrder = createBrokerOrder;
window.purchaseBrokerCredits = purchaseBrokerCredits;
window.setBrokerPaymentMethod = setBrokerPaymentMethod;
window.setBrokerPaymentTxId = setBrokerPaymentTxId;
window.trackBrokerOrder = trackBrokerOrder;
window.updateBrokerOrderStatus = updateBrokerOrderStatus;
window.showBrokerOrderDetails = showBrokerOrderDetails;
window.closeBrokerOrderDetailsModal = closeBrokerOrderDetailsModal;
window.openBrokerDetailPanel = openBrokerDetailPanel;
window.closeBrokerDetailPanel = closeBrokerDetailPanel;
window.setBrokerFilter = setBrokerFilter;
window.copyBrokerPaymentAddress = copyBrokerPaymentAddress;
window.loadBrokerCreditPackages = loadBrokerCreditPackages;
window.selectBrokerPackage = selectBrokerPackage;

window.addEventListener('DOMContentLoaded', () => {
    loadBrokerAgents();
    loadBrokerData();
    
    // Add event listener to refresh button for force refresh
    const refreshBtn = document.querySelector('.refresh-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', function(e) {
            e.preventDefault();
            loadBrokerData({}, true); // Force refresh by bypassing cache
        });
    }
});

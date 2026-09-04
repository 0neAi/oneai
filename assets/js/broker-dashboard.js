const DEFAULT_API_BASE_URL = 'https://oneai-wjox.onrender.com';
const isLocalhost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
const API_BASE_URL = window.API_BASE_URL || (isLocalhost
    ? 'http://localhost:10000'
    : (window.location.hostname === '0neai.github.io' ? DEFAULT_API_BASE_URL : window.location.origin));

const BROKER_TRC20_ADDRESS = 'TKbAYXQPYeU9BbW41h2h4Lao63iyMXMdJ5';
const BROKER_ACTIVE_STATUSES = ['PENDING', 'PICKUP', 'HOLD'];
const FALLBACK_BROKER_PACKAGES = [
    { id: 'pkg_1200', credits: 1200, price: 35, currency: 'USDT' },
    { id: 'pkg_2500', credits: 2500, price: 75, currency: 'USDT' },
    { id: 'pkg_5000', credits: 5000, price: 130, currency: 'USDT' }
];

const brokerState = {
    orders: [],
    smartOrders: [],
    smartFilterName: '',
    smartFilterCost: 0,
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
    lastScrollTop: 0,
    lastScrollLeft: 0,
    // Caching properties
    lastFetchTime: null,
    cacheExpiry: 5 * 60 * 1000, // 5 minutes cache
    isInitialLoad: true
};

function saveBrokerScrollPosition() {
    const scroller = document.scrollingElement || document.documentElement || document.body;
    if (!scroller) return;
    brokerState.lastScrollTop = window.scrollY || scroller.scrollTop || 0;
    brokerState.lastScrollLeft = window.scrollX || scroller.scrollLeft || 0;
}

function restoreBrokerScrollPosition() {
    const scroller = document.scrollingElement || document.documentElement || document.body;
    if (!scroller) return;
    const restoreTop = brokerState.lastScrollTop || 0;
    const restoreLeft = brokerState.lastScrollLeft || 0;
    window.requestAnimationFrame(() => {
        window.scrollTo({
            top: restoreTop,
            left: restoreLeft,
            behavior: 'auto'
        });
    });
}

// Lightweight auth headers helper — defined here defensively so this script can run in
// pages that don't load the full global utilities bundle.
function buildBrokerAuthHeaders() {
    const headers = {};
    try {
        const token = localStorage.getItem('authToken') || '';
        const userID = localStorage.getItem('userID') || '';
        if (token) headers['Authorization'] = `Bearer ${token}`;
        if (userID) headers['X-User-ID'] = String(userID);
    } catch (e) {
        // In environments where localStorage is restricted, return empty headers
    }
    return headers;
}


// Ensure global helper exists early to avoid ReferenceError in older pages or different build orders
if (typeof window !== 'undefined') {
    if (typeof window.selectBrokerPackage === 'undefined') {
        // provide a safe no-op that logs — real implementation will overwrite this later in the same file
        window.selectBrokerPackage = function(pkgOrId) {
            try {
                console.warn('selectBrokerPackage called before broker script fully initialized.');
                // attempt to find a packages container and select if possible (best-effort)
                const packagesContainer = document.getElementById('broker-packages-list');
                if (!packagesContainer) return;
                const pkgId = typeof pkgOrId === 'object' ? String(pkgOrId.id || pkgOrId.packageId || '') : String(pkgOrId || '');
                if (!pkgId) return;
                const card = packagesContainer.querySelector(`.broker-package-card[data-package-id="${pkgId}"]`);
                if (card && card.__pkg && typeof window.setBrokerPackageSelection === 'function') {
                    window.setBrokerPackageSelection(card.__pkg, card);
                }
            } catch (e) {
                console.warn('Early selectBrokerPackage no-op failed:', e && e.message);
            }
        };
    }
}

// ============================================
// SIDE PANEL CONTROL FUNCTIONS
// ============================================

function openBrokerDetailPanel() {
    saveBrokerScrollPosition();
    const panel = document.getElementById('broker-detail-panel');
    const overlay = document.getElementById('broker-modal-overlay');
    if (!panel || !overlay) return;
    panel.classList.add('active');
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeBrokerDetailPanel() {
    const panel = document.getElementById('broker-detail-panel');
    const overlay = document.getElementById('broker-modal-overlay');
    if (panel) panel.classList.remove('active');
    if (overlay) overlay.classList.remove('active');
    document.body.style.overflow = '';
    document.body.classList.remove('broker-detail-open');
    restoreBrokerScrollPosition();
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
    if (!orderForm) {
        // This page doesn't include the broker order form; nothing to toggle
        console.warn('toggleOrderForm: broker-order-form not found in DOM');
        return;
    }
    if (!creditForm) {
        orderForm.style.display = orderForm.style.display === 'block' ? 'none' : 'block';
    } else {
        orderForm.style.display = orderForm.style.display === 'block' ? 'none' : 'block';
        creditForm.style.display = 'none';
    }
    
    // Load agents when form is opened
    if (orderForm.style.display === 'block') {
        loadBrokerAgents();
    }
}

function toggleCreditForm() {
    const creditForm = document.getElementById('broker-credit-form');
    const orderForm = document.getElementById('broker-order-form');
    if (!creditForm) {
        console.warn('toggleCreditForm: broker-credit-form not found in DOM');
        return;
    }
    creditForm.style.display = creditForm.style.display === 'block' ? 'none' : 'block';
    if (orderForm) {
        orderForm.style.display = 'none';
    }
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
    const message = '<tr><td colspan="3" class="text-center">You need broker credits to load orders. Purchase credits via TRX/USDT to view data.</td></tr>';
    if (activeTbody) activeTbody.innerHTML = message;
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

    saveBrokerScrollPosition();
    document.body.classList.add('broker-detail-open');

    const content = document.getElementById('broker-order-details-content');
    if (!content) return;
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
    const headers = buildBrokerAuthHeaders();

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
            const completedEl = document.getElementById('broker-completed-orders');
            if (completedEl) completedEl.textContent = '0';
            showBrokerCreditRequiredNotice();
            clearBrokerOrdersForCredit();
            return;
        }
 
        hideBrokerCreditRequiredNotice();

        console.log('Fetching broker orders', { url: `${API_BASE_URL}/broker/orders/user?${query.toString()}`, headers });
        const ordersRes = await fetch(`${API_BASE_URL}/broker/orders/user?${query.toString()}`, { headers });
        if (!ordersRes.ok) {
            // Try to capture server-provided error details for debugging
            let errBody = null;
            try {
                // attempt to parse JSON first
                errBody = await ordersRes.json();
            } catch (_) {
                try { errBody = await ordersRes.text(); } catch (__) { errBody = null; }
            }
            console.error('Failed to load broker orders', ordersRes.status, errBody);
            throw new Error((errBody && (errBody.message || JSON.stringify(errBody))) || `Failed to load broker orders (status ${ordersRes.status})`);
        }

        const ordersData = await ordersRes.json().catch(() => ({}));
        const dashboardOrders = (ordersData.orders || []).filter(order => BROKER_ACTIVE_STATUSES.includes(order.status));
        brokerState.orders = dashboardOrders;
        brokerState.credits = typeof ordersData.credits === 'number' ? ordersData.credits : brokerState.credits;
        brokerState.active = brokerState.orders.length;
        brokerState.completed = 0;
  
        document.getElementById('broker-credits').textContent = brokerState.credits;
        document.getElementById('broker-active-orders').textContent = brokerState.active;
        const completedEl = document.getElementById('broker-completed-orders');
        if (completedEl) completedEl.textContent = brokerState.completed;
 
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
    if (!activeTbody) return;

    const currentScroll = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
    const restoreAfterRender = currentScroll > 0 && !document.body.classList.contains('broker-detail-open');
    saveBrokerScrollPosition();
    activeTbody.innerHTML = '';
  
    const activeOrders = sortBrokerOrders(filterBrokerOrders(brokerState.orders));
  
    const summaryEl = document.getElementById('broker-results-summary');
    if (summaryEl) {
        summaryEl.textContent = `Showing ${activeOrders.length} order${activeOrders.length === 1 ? '' : 's'}`;
    }
  
    if (!activeOrders.length) {
        activeTbody.innerHTML = '<tr><td colspan="3" class="text-center">No active or hold orders match the current filters.</td></tr>';
    } else {
        activeOrders.forEach(order => renderBrokerOrder(order, activeTbody, true));
    }

    if (restoreAfterRender) {
        requestAnimationFrame(() => {
            window.scrollTo({ top: currentScroll, left: 0, behavior: 'auto' });
        });
    }
}

function renderSmartFilterOrders(filterName, cost) {
    const resultsEl = document.getElementById('broker-smart-filter-results');
    if (!resultsEl) return;
    if (filterName !== undefined) brokerState.smartFilterName = filterName || 'Smart Filter';
    if (cost !== undefined) brokerState.smartFilterCost = cost || 0;

    resultsEl.style.display = 'block';
    resultsEl.innerHTML = `
        <div class="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
            <h4 style="margin:0; color:#f8fafc;">${escapeHtml(String(brokerState.smartFilterName || 'Smart Filter'))} results</h4>
            <span class="broker-smart-filter-chip">Charged: ${Number(brokerState.smartFilterCost || 0)} credits</span>
        </div>
        <div class="table-responsive broker-table-wrapper">
            <table class="table table-sm mb-0 text-white">
                <thead>
                    <tr><th>Order</th><th>Recipient</th><th>Actions</th></tr>
                </thead>
                <tbody id="broker-smart-filter-order-list"></tbody>
            </table>
        </div>
    `;

    const tbody = document.getElementById('broker-smart-filter-order-list');
    if (!tbody) return;
    if (!brokerState.smartOrders.length) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">No matching active orders were found for this filter.</td></tr>';
        return;
    }
    brokerState.smartOrders.forEach((order) => renderBrokerOrder(order, tbody, true));
}

async function loadBrokerSmartFilters() {
    const container = document.getElementById('broker-smart-filter-list');
    const resultsEl = document.getElementById('broker-smart-filter-results');
    if (!container) return;
    brokerState.smartOrders = [];
    brokerState.smartFilterName = '';
    brokerState.smartFilterCost = 0;
    if (resultsEl) {
        resultsEl.style.display = 'none';
        resultsEl.innerHTML = '';
    }

    try {
        const response = await fetch(`${API_BASE_URL}/broker/smart-filter-config`, {
            headers: buildBrokerAuthHeaders()
        });
        if (!response.ok) {
            throw new Error('Failed to load smart filters');
        }

        const data = await response.json();
        // Accept both { success: true, filters: [...] } and { filters: [...], enabled, userRate }
        if (!Array.isArray(data.filters)) {
            container.innerHTML = '<div class="text-muted">No approved smart filters available right now.</div>';
            if (resultsEl) {
                resultsEl.style.display = 'none';
            }
            return;
        }

        if (!data.filters.length) {
            container.innerHTML = '<div class="text-muted">No approved smart filters are available yet. Admin approval is required.</div>';
            if (resultsEl) {
                resultsEl.style.display = 'none';
            }
            return;
        }

        const cards = data.filters.map(filter => {
            const pageNames = (filter.pageNames || []).slice(0, 5).map(name => `<span class="broker-smart-filter-chip">${escapeHtml(String(name))}</span>`).join('');
            const keywords = (filter.keywords || []).slice(0, 6).map(keyword => `<span class="broker-smart-filter-chip">${escapeHtml(String(keyword))}</span>`).join('');
            const cost = Number(filter.cost ?? data.userRate ?? data.defaultCost ?? 20);
            return `
                <div class="broker-smart-filter-card">
                    <h4>${escapeHtml(String(filter.name || 'Smart Filter'))}</h4>
                    <p>${escapeHtml(String(filter.description || 'Approved page and keyword filter.'))}</p>
                    <div class="broker-smart-filter-meta">
                        ${pageNames || '<span class="broker-smart-filter-chip">No page names</span>'}
                    </div>
                    <div class="broker-smart-filter-meta">
                        ${keywords || '<span class="broker-smart-filter-chip">No keywords</span>'}
                    </div>
                    <div class="d-flex align-items-center justify-content-between gap-2 mt-2">
                        <strong style="color:#f8fafc;">${cost} credits</strong>
                        <button type="button" class="action-btn small" onclick="activateBrokerSmartFilter('${filter._id || filter.id}')">Use Filter</button>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = cards;
    } catch (error) {
        container.innerHTML = '<div class="text-danger">Unable to load smart filters right now.</div>';
        console.error('loadBrokerSmartFilters error:', error);
    }
}

async function activateBrokerSmartFilter(filterId) {
    if (!filterId) return;
    try {
        const response = await fetch(`${API_BASE_URL}/broker/smart-filter/activate`, {
            method: 'POST',
            headers: Object.assign({}, buildBrokerAuthHeaders(), { 'Content-Type': 'application/json' }),
            body: JSON.stringify({ filterId })
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(data.message || 'Failed to activate smart filter');
        }

        const resultsEl = document.getElementById('broker-smart-filter-results');
        if (!resultsEl) return;

        brokerState.smartOrders = (data.orders || []).map((order) => ({
            ...order,
            smartOrder: true
        }));
        renderSmartFilterOrders(data.filter?.name, data.cost);
        showSuccess(data.message || 'Smart filter activated successfully.');
        document.getElementById('broker-credits').textContent = data.credits ?? document.getElementById('broker-credits').textContent;
        loadBrokerData(brokerState.currentFilter || {}, true);
    } catch (error) {
        console.error('activateBrokerSmartFilter error:', error);
        showError(error.message || 'Unable to activate smart filter.');
    }
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function filterBrokerOrders(orders) {
    const search = brokerState.search || '';
 
    return orders.filter(order => {
        if (!BROKER_ACTIVE_STATUSES.includes(order.status)) {
            return false;
        }
 
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
    row.addEventListener('click', (event) => {
        if (event.target && event.target.closest('button')) {
            return;
        }
        if (event.defaultPrevented) return;
        event.preventDefault();
        saveBrokerScrollPosition();
        showBrokerOrderDetails(order._id);
    });

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
    const idx = brokerState.orders.findIndex(o => o._id === orderId);
    const smartIdx = brokerState.smartOrders.findIndex(o => o._id === orderId);
    if (idx !== -1 || smartIdx !== -1) {
        if (idx !== -1) brokerState.orders.splice(idx, 1);
        if (smartIdx !== -1) brokerState.smartOrders.splice(smartIdx, 1);
        renderBrokerOrders();
        renderSmartFilterOrders();
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
  // Respect admin toggle for agent fetching
  if (brokerState.agentFetchingEnabled === false) {
    console.log('Skipping loadBrokerAgents: agent fetching disabled by admin.');
    brokerState.agents = [];
    renderAgentSelector();
    return;
  }

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
      headers: Object.assign({}, buildBrokerAuthHeaders(), { 'Content-Type': 'application/json' })
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
      // Use a stable identifier for the option value: prefer username/phone/id, fallback to displayName
      option.value = agent.username || agent.phone || agent.id || agent.displayName || '';
      option.textContent = agent.displayName || agent.username || agent.phone || '';
      agentSelect.appendChild(option);
    });
  }
  
  console.log('✅ Agent selector rendered with', (agentSelect.options.length - 1), 'agents');
}

// ============================================
// ADMIN: Combined Agent Management Tab
// ============================================
// This section provides a single manageable tab that shows:
//  - Configured broker agents
//  - Captured tracking agents
//  - Saved agent credentials (with password hidden by default and reveal toggle)
// It operates defensively if the expected container elements or endpoints are missing.

async function loadAdminAgentManagement() {
    const container = document.getElementById('broker-admin-tab');
    if (!container) {
        // Page does not include the admin tab container — nothing to do
        return;
    }

    container.innerHTML = '<div class="loading">Loading agent configuration…</div>';

    const headers = buildBrokerAuthHeaders();

    try {
        // Parallel fetches where available
        const agentsReq = fetch(`${API_BASE_URL}/admin/agents`, { headers }).catch(() => null);
        const capturedReq = fetch(`${API_BASE_URL}/admin/captured-agents`, { headers }).catch(() => null);
        const credsReq = fetch(`${API_BASE_URL}/admin/agent-credentials`, { headers }).catch(() => null);

        const [agentsRes, capturedRes, credsRes] = await Promise.all([agentsReq, capturedReq, credsReq]);

        const agents = agentsRes && agentsRes.ok ? (await agentsRes.json()).agents || [] : brokerState.agents || [];
        const captured = capturedRes && capturedRes.ok ? (await capturedRes.json()).agents || [] : [];
        const creds = credsRes && credsRes.ok ? (await credsRes.json()).credentials || [] : [];

        // Build UI
        container.innerHTML = `
            <div class="card">
                <div class="card-body">
                    <ul class="nav nav-tabs" role="tablist">
                        <li class="nav-item"><a class="nav-link active" data-bs-toggle="tab" href="#admin-configured-tab" role="tab">Configured Agents</a></li>
                        <li class="nav-item"><a class="nav-link" data-bs-toggle="tab" href="#admin-captured-tab" role="tab">Captured Agents</a></li>
                        <li class="nav-item"><a class="nav-link" data-bs-toggle="tab" href="#admin-credentials-tab" role="tab">Saved Credentials</a></li>
                        <li class="nav-item"><a class="nav-link" data-bs-toggle="tab" href="#admin-appversion-tab" role="tab">App Version</a></li>
                    </ul>

                    <div class="tab-content mt-3">
                        <div class="tab-pane fade show active" id="admin-configured-tab" role="tabpanel">
                            <div id="admin-configured-agents" class="admin-section"></div>
                        </div>
                        <div class="tab-pane fade" id="admin-captured-tab" role="tabpanel">
                            <div id="admin-captured-agents" class="admin-section"></div>
                        </div>
                        <div class="tab-pane fade" id="admin-credentials-tab" role="tabpanel">
                            <div id="admin-saved-credentials" class="admin-section"></div>
                        </div>
                        <div class="tab-pane fade" id="admin-appversion-tab" role="tabpanel">
                            <div id="admin-app-version" class="admin-section"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        renderAdminConfiguredAgents(agents);
        renderAdminCapturedAgents(captured);
        renderAdminSavedCredentials(creds);
        renderAdminAppVersion();

    } catch (error) {
        console.error('Failed to load admin agent management:', error);
        container.innerHTML = `<div class="error">Failed to load admin agent configuration. ${error.message || ''}</div>`;
    }
}

function renderAdminConfiguredAgents(agents) {
    const el = document.getElementById('admin-configured-agents');
    if (!el) return;
    if (!agents || !agents.length) {
        el.innerHTML = '<div class="muted">No configured agents found.</div>';
        return;
    }

    el.innerHTML = agents.map(a => `
        <div class="agent-card">
            <div class="agent-header">
                <strong>${escapeHtml(a.displayName || a.name || 'Unnamed')}</strong>
                <span class="agent-status">${escapeHtml(a.active ? 'Active' : 'Inactive')}</span>
            </div>
            <div class="agent-meta">ID: ${escapeHtml(a.id || a._id || '—')}</div>
        </div>
    `).join('');
}

function renderAdminCapturedAgents(captured) {
    const el = document.getElementById('admin-captured-agents');
    if (!el) return;
    if (!captured || !captured.length) {
        el.innerHTML = '<div class="muted">No captured agents found.</div>';
        return;
    }

    el.innerHTML = `
        <table class="admin-table">
            <thead><tr><th>Name</th><th>Phone</th><th>Seen</th><th>First Seen</th><th>Actions</th></tr></thead>
            <tbody>
                ${captured.map(c => `
                    <tr>
                        <td>${escapeHtml(c.name)}</td>
                        <td>${escapeHtml(c.phone)}</td>
                        <td>${escapeHtml(c.lastSeen || '—')}</td>
                        <td>${escapeHtml(c.firstSeen || '—')}</td>
                        <td><button type="button" onclick="event.stopPropagation(); checkAgentLogin('${escapeAttr(c.phone)}')">Check</button></td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function renderAdminSavedCredentials(creds) {
    const el = document.getElementById('admin-saved-credentials');
    if (!el) return;
    if (!creds || !creds.length) {
        el.innerHTML = '<div class="muted">No saved credentials found.</div>';
        return;
    }

    el.innerHTML = `
        <table class="admin-table">
            <thead><tr><th>Username</th><th>Phone</th><th>Client ID</th><th>Last Valid</th><th>Active</th><th>Password</th><th>Actions</th></tr></thead>
            <tbody>
                ${creds.map(c => {
                    const pid = `cred-${Math.random().toString(36).slice(2,9)}`;
                    return `
                    <tr>
                        <td>${escapeHtml(c.username || c.user || '')}</td>
                        <td>${escapeHtml(c.phone || '')}</td>
                        <td>${escapeHtml(c.clientId || c.clientID || '')}</td>
                        <td>${escapeHtml(c.lastValid || '')}</td>
                        <td>${c.active ? 'Active' : 'Inactive'}</td>
                        <td>
                            <input id="${pid}" type="password" value="${escapeAttr(c.plainPassword || c.password || '')}" readonly class="cred-password" />
                            <button type="button" aria-label="Reveal password" onclick="togglePasswordReveal('${pid}', this)">👁️</button>
                        </td>
                        <td>
                            <button type="button" onclick="event.stopPropagation(); saveAgentCredential('${escapeAttr(c.id || c._id || '')}', '${escapeAttr(c.username || '')}', document.getElementById('${pid}').value)">Save</button>
                            <button type="button" onclick="event.stopPropagation(); deleteAgentCredential('${escapeAttr(c.id || c._id || '')}')">Delete</button>
                        </td>
                    </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;
}

function renderAdminAppVersion() {
    const el = document.getElementById('admin-app-version');
    if (!el) return;

    el.innerHTML = `
        <div class="app-version-row mb-3">
            <span id="current-app-version">Detecting…</span>
            <button type="button" class="btn btn-sm btn-outline-primary ms-2" onclick="checkAppVersion()">Check</button>
            <button type="button" class="btn btn-sm btn-outline-secondary ms-2" onclick="editAppVersion()">Edit</button>
        </div>
        <div id="app-version-editor" style="display:none; margin-top:8px;">
            <input id="app-version-input" placeholder="Enter new version" class="form-control form-control-sm" style="display:inline-block; width:auto;" />
            <button class="btn btn-sm btn-primary ms-2" onclick="saveAppVersion()">Save</button>
            <button class="btn btn-sm btn-secondary ms-1" onclick="document.getElementById('app-version-editor').style.display='none'">Cancel</button>
        </div>

        <hr />
        <div id="admin-broker-config" class="mt-3"></div>
    `;

    // Attempt to detect current app version
    checkAppVersion();
    // Load broker admin config (wallet address, packages) into the new area
    loadAdminBrokerConfig();
}

async function checkAppVersion() {
    const el = document.getElementById('current-app-version');
    if (!el) return;
    el.textContent = 'Detecting...';
    try {
        const res = await fetch(`${API_BASE_URL}/admin/app-version`, { headers: buildBrokerAuthHeaders() });
        if (!res.ok) throw new Error('Not found');
        const data = await res.json();
        el.textContent = data.version || 'Unknown';
    } catch (e) {
        el.textContent = 'Unable to detect';
    }
}

// Admin: Load broker wallet and packages management UI
async function loadAdminBrokerConfig() {
    const el = document.getElementById('admin-broker-config');
    if (!el) return;
    el.innerHTML = '<div class="muted">Loading broker configuration…</div>';
    try {
        const headers = buildBrokerAuthHeaders();
        const cfgReq = fetch(`${API_BASE_URL}/admin/broker/config`, { headers }).catch(() => null);
        const pkgsReq = fetch(`${API_BASE_URL}/admin/broker/credit-packages`, { headers }).catch(() => null);
        const [cfgRes, pkgsRes] = await Promise.all([cfgReq, pkgsReq]);
        const cfg = cfgRes && cfgRes.ok ? await cfgRes.json() : { walletAddress: BROKER_TRC20_ADDRESS, agentFetchingEnabled: true };
        const pkgsData = pkgsRes && pkgsRes.ok ? await pkgsRes.json() : { packages: FALLBACK_BROKER_PACKAGES };
        const packages = Array.isArray(pkgsData.packages) && pkgsData.packages.length ? pkgsData.packages : FALLBACK_BROKER_PACKAGES;

        // Set front-end state from config
        brokerState.agentFetchingEnabled = (cfg && typeof cfg.agentFetchingEnabled === 'boolean') ? cfg.agentFetchingEnabled : true;

        renderAdminBrokerConfig(el, cfg, packages);
    } catch (e) {
        console.error('Failed to load broker config:', e);
        el.innerHTML = '<div class="error">Unable to load broker configuration.</div>';
    }
}

function renderAdminBrokerConfig(containerEl, cfg, packages) {
    containerEl.innerHTML = `
        <div class="mb-3">
            <label class="form-label">Broker TRC20 Wallet Address</label>
            <div class="input-group">
                <input id="admin-broker-wallet" class="form-control form-control-sm" value="${escapeAttr((cfg && cfg.walletAddress) || BROKER_TRC20_ADDRESS)}" />
                <button class="btn btn-sm btn-primary" type="button" onclick="saveAdminBrokerWallet()">Save</button>
            </div>
            <small class="text-muted d-block mt-1">Manage the wallet address used on the Buy Broker Credits page.</small>
        </div>

        <div class="form-check form-switch mb-3">
            <input class="form-check-input" type="checkbox" id="admin-agent-fetching-toggle" ${cfg && cfg.agentFetchingEnabled === false ? '' : 'checked'} onchange="saveAdminBrokerAgentFetchingToggle()">
            <label class="form-check-label" for="admin-agent-fetching-toggle">Enable agent fetching / automated logins</label>
            <small class="text-muted d-block mt-1">When disabled, automated agent login and credential checks are paused to avoid logging out active agents.</small>
        </div>

        <div class="mb-3">
            <label class="form-label">Credit Packages</label>
            <div id="admin-broker-packages-list" class="mb-2"></div>
            <div class="input-group">
                <input id="admin-new-package-credits" class="form-control form-control-sm" placeholder="Credits (e.g., 1200)" />
                <input id="admin-new-package-price" class="form-control form-control-sm" placeholder="Price (e.g., 35)" />
                <button class="btn btn-sm btn-success" type="button" onclick="addAdminBrokerPackage()">Add Package</button>
            </div>
            <small class="text-muted d-block mt-1">Packages appear in the Buy Broker Credits UI.</small>
        </div>
    `;

    const listEl = document.getElementById('admin-broker-packages-list');
    if (!listEl) return;
    listEl.innerHTML = '';
    packages.forEach(pkg => {
        const row = document.createElement('div');
        row.className = 'd-flex align-items-center mb-2';
        row.innerHTML = `
            <div style="flex:1">${escapeHtml(String(pkg.credits))} credits — <strong>${escapeHtml(String(pkg.price))} ${escapeHtml(pkg.currency || 'USDT')}</strong></div>
            <div>
                <button class="btn btn-sm btn-outline-primary me-1" onclick="editAdminBrokerPackage('${escapeAttr(String(pkg.id || ''))}')">Edit</button>
                <button class="btn btn-sm btn-outline-danger" onclick="deleteAdminBrokerPackage('${escapeAttr(String(pkg.id || ''))}')">Delete</button>
            </div>
        `;
        listEl.appendChild(row);
    });
}

async function saveAdminBrokerWallet() {
    const val = document.getElementById('admin-broker-wallet')?.value?.trim();
    if (!val) return showError('Please enter a wallet address');
    try {
        const res = await fetch(`${API_BASE_URL}/admin/broker/config`, {
            method: 'PUT',
            headers: Object.assign({}, buildBrokerAuthHeaders(), { 'Content-Type': 'application/json' }),
            body: JSON.stringify({ walletAddress: val })
        });
        if (!res.ok) throw new Error('Failed to save');
        showSuccess('Wallet address saved.');
        // update local constant for immediate UI use
        try { window.BROKER_TRC20_ADDRESS = val; } catch(e) {}
        // attempt to refresh broker credit packages UI in client
        await loadBrokerCreditPackages();
    } catch (e) {
        console.error('Save wallet failed:', e);
        showError(e.message || 'Failed to save wallet address');
    }
}

// Save agent-fetching toggle to server config
async function saveAdminBrokerAgentFetchingToggle() {
    const checkbox = document.getElementById('admin-agent-fetching-toggle');
    if (!checkbox) return;
    const enabled = !!checkbox.checked;
    try {
        const res = await fetch(`${API_BASE_URL}/admin/broker/config`, {
            method: 'PUT',
            headers: Object.assign({}, buildBrokerAuthHeaders(), { 'Content-Type': 'application/json' }),
            body: JSON.stringify({ agentFetchingEnabled: enabled })
        });
        if (!res.ok) throw new Error('Failed to save agent fetching setting');
        showSuccess(enabled ? 'Agent fetching enabled.' : 'Agent fetching disabled.');
        brokerState.agentFetchingEnabled = enabled;
    } catch (e) {
        console.error('Failed to save agent fetching toggle:', e);
        showError(e.message || 'Failed to save agent fetching setting');
        // reload config to restore UI
        loadAdminBrokerConfig();
    }
}

async function addAdminBrokerPackage() {
    const credits = Number(document.getElementById('admin-new-package-credits')?.value || 0);
    const price = Number(document.getElementById('admin-new-package-price')?.value || 0);
    if (!credits || !price) return showError('Please enter valid credits and price');
    try {
        const res = await fetch(`${API_BASE_URL}/admin/broker/credit-packages`, {
            method: 'POST',
            headers: Object.assign({}, buildBrokerAuthHeaders(), { 'Content-Type': 'application/json' }),
            body: JSON.stringify({ credits, price, currency: 'USDT' })
        });
        if (!res.ok) throw new Error('Failed to add package');
        showSuccess('Package added.');
        loadAdminBrokerConfig();
    } catch (e) {
        console.error('Add package failed:', e);
        showError(e.message || 'Failed to add package');
    }
}

async function deleteAdminBrokerPackage(pkgId) {
    if (!pkgId) return;
    try {
        const res = await fetch(`${API_BASE_URL}/admin/broker/credit-packages/${encodeURIComponent(pkgId)}`, {
            method: 'DELETE',
            headers: buildBrokerAuthHeaders()
        });
        if (!res.ok) throw new Error('Failed to delete package');
        showSuccess('Package deleted.');
        loadAdminBrokerConfig();
    } catch (e) {
        console.error('Delete package failed:', e);
        showError(e.message || 'Failed to delete package');
    }
}

function editAppVersion() {
    const editor = document.getElementById('app-version-editor');
    if (editor) editor.style.display = 'block';
}

async function saveAppVersion() {
    const v = document.getElementById('app-version-input')?.value?.trim();
    if (!v) return showError('Please enter a version.');
    try {
        const res = await fetch(`${API_BASE_URL}/admin/app-version`, {
            method: 'PUT',
            headers: Object.assign({}, buildBrokerAuthHeaders(), { 'Content-Type': 'application/json' }),
            body: JSON.stringify({ version: v })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || 'Failed to save');
        showSuccess('App version saved.');
        document.getElementById('app-version-editor').style.display = 'none';
        checkAppVersion();
    } catch (e) {
        console.error('Save app version error:', e);
        showError(e.message || 'Failed to save app version');
    }
}

function togglePasswordReveal(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;
    if (input.type === 'password') {
        input.type = 'text';
        btn.textContent = '🙈';
    } else {
        input.type = 'password';
        btn.textContent = '👁️';
    }
}

async function saveAgentCredential(id, username, password) {
    try {
        const res = await fetch(`${API_BASE_URL}/admin/agent-credentials`, {
            method: 'POST',
            headers: Object.assign({}, buildBrokerAuthHeaders(), { 'Content-Type': 'application/json' }),
            body: JSON.stringify({ id, username, password })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || 'Failed to save credential');
        showSuccess('Credential saved.');
        // refresh list
        loadAdminAgentManagement();
    } catch (e) {
        console.error('Save credential failed:', e);
        showError(e.message || 'Failed to save credential');
    }
}

async function deleteAgentCredential(id) {
    if (!id) return showError('No credential id provided');
    try {
        const res = await fetch(`${API_BASE_URL}/admin/agent-credentials/${encodeURIComponent(id)}`, {
            method: 'DELETE',
            headers: buildBrokerAuthHeaders()
        });
        if (!res.ok) throw new Error('Delete failed');
        showSuccess('Credential deleted.');
        loadAdminAgentManagement();
    } catch (e) {
        console.error('Delete credential failed:', e);
        showError(e.message || 'Failed to delete credential');
    }
}

// Helper to call existing server-side Pathao credential checker endpoint for a phone
async function checkAgentLogin(phone) {
    // Respect admin toggle for agent fetching
    if (brokerState.agentFetchingEnabled === false) {
        console.log('Skipping checkAgentLogin: agent fetching disabled by admin.');
        showError && showError('Agent login/checking is disabled by admin.');
        return;
    }

    try {
        const res = await fetch(`${API_BASE_URL}/admin/pathao/check-agent-login`, {
            method: 'POST',
            headers: Object.assign({}, buildBrokerAuthHeaders(), { 'Content-Type': 'application/json' }),
            body: JSON.stringify({ phone })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || 'Check failed');
        // Show full server response in a modal or console for admin
        console.log('Agent login response:', data);
        showSuccess('Agent login checked — see console for full response.');
        // Optionally refresh list of captured agents or saved credentials
        loadAdminAgentManagement();
    } catch (e) {
        console.error('Agent login check failed:', e);
        showError(e.message || 'Agent login check failed');
    }
}

// Small escaping helpers for safe HTML insertion
function escapeHtml(s) {
    if (s === null || s === undefined) return '';
    return String(s).replace(/[&<>\"']/g, function (c) { return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]); });
}
function escapeAttr(s) { return escapeHtml(s).replace(/\n/g, ''); }

// Auto-load admin tab if present
document.addEventListener('DOMContentLoaded', () => {
    try { loadAdminAgentManagement(); } catch (e) {}
});

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
            headers: Object.assign({}, buildBrokerAuthHeaders(), { 'Content-Type': 'application/json' }),
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
    const headers = buildBrokerAuthHeaders();
    const packagesContainer = document.getElementById('broker-packages-list');

    if (!packagesContainer) return;

    packagesContainer.innerHTML = '<div style="grid-column: 1 / -1; color: #9fb4ff;">Loading packages…</div>';

    try {
        const response = await fetch(`${API_BASE_URL}/broker/credit-packages`, { headers });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            console.warn('broker credit-packages endpoint returned', response.status, data);
        }

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
            // store package id and object on the element for selection helpers
            card.dataset.packageId = String(pkg.id || '');
            card.__pkg = pkg;
            packagesContainer.appendChild(card);
        });

        if (brokerState.selectedPackage) {
            const activeCard = Array.from(packagesContainer.querySelectorAll('.broker-package-card')).find((element) => element.dataset.packageId === String(brokerState.selectedPackage.id || brokerState.selectedPackage.packageId || ''));
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
            // store package id and object on the element for selection helpers
            card.dataset.packageId = String(pkg.id || '');
            card.__pkg = pkg;
            packagesContainer.appendChild(card);
        });
        showError(error.message || 'Failed to load credit packages');
    }
}

// ==========================
// Broker deposits summary (realtime-ish)
// ==========================
let brokerDepositSummaryInterval = null;
async function loadBrokerDepositSummary() {
    const elUsdtCount = document.getElementById('broker-usdt-deposits-count');
    const elTrxCount = document.getElementById('broker-trx-deposits-count');
    const elTrxTotal = document.getElementById('broker-deposits-trx-total');
    if (!elUsdtCount && !elTrxCount && !elTrxTotal) return;

    try {
        const headers = buildBrokerAuthHeaders();
        const res = await fetch(`${API_BASE_URL}/broker/deposits/summary`, { headers });
        if (!res.ok) {
            // backend may not have the endpoint; silently ignore
            console.warn('Broker deposits summary not available', res.status);
            return;
        }
        const data = await res.json().catch(() => ({}));
        // expected shape: { trx: { count, total }, usdt: { count, total, totalInTrx }, usdtToTrxRate }
        const trxCount = Number(data?.trx?.count || 0);
        const usdtCount = Number(data?.usdt?.count || 0);
        // prefer server-provided TRX equivalents; otherwise use rate
        let trxTotal = null;
        if (data?.trx?.total) trxTotal = Number(data.trx.total);
        else if (data?.usdt?.totalInTrx) trxTotal = Number(data.usdt.totalInTrx);
        else if (data?.usdt?.total && data?.usdtToTrxRate) trxTotal = Number(data.usdt.total) * Number(data.usdtToTrxRate);

        // Round to whole TRX as requested
        const trxTotalRounded = trxTotal !== null && Number.isFinite(trxTotal) ? Math.round(trxTotal) : 'N/A';

        if (elUsdtCount) elUsdtCount.textContent = usdtCount;
        if (elTrxCount) elTrxCount.textContent = trxCount;
        if (elTrxTotal) elTrxTotal.textContent = (trxTotalRounded === 'N/A') ? 'N/A' : `${trxTotalRounded} TRX`;
    } catch (e) {
        console.error('Failed to load broker deposit summary:', e);
    }
}

function startBrokerDepositSummaryPolling(intervalMs = 15000) {
    // run immediately and then poll
    loadBrokerDepositSummary();
    if (brokerDepositSummaryInterval) clearInterval(brokerDepositSummaryInterval);
    brokerDepositSummaryInterval = setInterval(loadBrokerDepositSummary, intervalMs);
}

// Start polling when DOM is ready/initial loads happen
document.addEventListener('DOMContentLoaded', function() {
    // start deposit polling if relevant elements exist
    try { startBrokerDepositSummaryPolling(); } catch (e) {}
});


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

// Convenience function used by older templates: select a package by id (string) or pass the package object.
// It looks up the card element and calls the same selection helper used for click events.
function selectBrokerPackage(pkgOrId) {
    if (!pkgOrId) return;
    const packagesContainer = document.getElementById('broker-packages-list');
    if (!packagesContainer) return;

    // If an object was passed, try to find the matching card by reference or id
    if (typeof pkgOrId === 'object') {
        // find a card with the same pkg reference
        const card = Array.from(packagesContainer.querySelectorAll('.broker-package-card')).find(c => c.__pkg === pkgOrId || c.__pkg?.id === pkgOrId.id);
        if (card) {
            setBrokerPackageSelection(card.__pkg, card);
            return;
        }
        // fallback: directly set
        setBrokerPackageSelection(pkgOrId, null);
        return;
    }

    const pkgId = String(pkgOrId);
    const card = packagesContainer.querySelector(`.broker-package-card[data-package-id="${pkgId}"]`);
    if (card && card.__pkg) {
        setBrokerPackageSelection(card.__pkg, card);
    }
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
            headers: Object.assign({}, buildBrokerAuthHeaders(), { 'Content-Type': 'application/json' }),
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
    const order = brokerState.orders.find(o => o._id === orderId)
        || brokerState.smartOrders.find(o => o._id === orderId);
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
            headers: Object.assign({}, buildBrokerAuthHeaders(), { 'Content-Type': 'application/json' }),
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            // If backend can't find the order but a payment link exists, treat as opened link case
            if (response.status === 404 && paymentLink) {
                showSuccess('Opened payment link and tracking will continue from that page.');
                return;
            }
            const errBody = await response.json().catch(() => ({}));
            throw new Error(errBody.message || 'Failed to track order');
        }

        const data = await response.json().catch(() => ({}));

        const state = brokerState.orders.some(o => o._id === orderId) ? brokerState.orders : brokerState.smartOrders;
        const index = state.findIndex(o => o._id === orderId);
        if (index !== -1) {
            state[index] = data.order || state[index];
            brokerState.active = brokerState.orders.filter(o => BROKER_ACTIVE_STATUSES.includes(o.status)).length;
            brokerState.completed = 0;
            const activeEl = document.getElementById('broker-active-orders');
            const completedEl = document.getElementById('broker-completed-orders');
            if (activeEl) activeEl.textContent = brokerState.active;
            if (completedEl) completedEl.textContent = brokerState.completed;
            renderBrokerOrders();
            renderSmartFilterOrders();
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
            headers: Object.assign({}, buildBrokerAuthHeaders(), { 'Content-Type': 'application/json' }),
            body: JSON.stringify({ status }),
        });

        if (!response.ok) {
            const errBody = await response.json().catch(() => ({}));
            throw new Error(errBody.message || 'Failed to update order status');
        }

        const data = await response.json().catch(() => ({}));

        const state = brokerState.orders.some(o => o._id === orderId) ? brokerState.orders : brokerState.smartOrders;
        const index = state.findIndex(o => o._id === orderId);
        if (index !== -1) {
            state[index] = data.order || state[index];
            brokerState.active = brokerState.orders.filter(o => BROKER_ACTIVE_STATUSES.includes(o.status)).length;
            brokerState.completed = 0;
            const activeEl = document.getElementById('broker-active-orders');
            const completedEl = document.getElementById('broker-completed-orders');
            if (activeEl) activeEl.textContent = brokerState.active;
            if (completedEl) completedEl.textContent = brokerState.completed;
            renderBrokerOrders();
            renderSmartFilterOrders();
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
window.loadBrokerSmartFilters = loadBrokerSmartFilters;
window.activateBrokerSmartFilter = activateBrokerSmartFilter;
window.showBrokerOrderDetails = showBrokerOrderDetails;
window.closeBrokerOrderDetailsModal = closeBrokerOrderDetailsModal;
window.openBrokerDetailPanel = openBrokerDetailPanel;
window.closeBrokerDetailPanel = closeBrokerDetailPanel;
window.setBrokerFilter = setBrokerFilter;
window.copyBrokerPaymentAddress = copyBrokerPaymentAddress;
window.loadBrokerCreditPackages = loadBrokerCreditPackages;
// Assign selectBrokerPackage defensively to avoid ReferenceError on pages where the function may be missing in older deployments.
window.selectBrokerPackage = (typeof selectBrokerPackage !== 'undefined') ? selectBrokerPackage : function(pkgOrId) {
    console.warn('selectBrokerPackage is not defined in this build.');
};

// Defensive override: ensure buildBrokerAuthHeaders is valid even if the earlier definition was corrupted during build/sanitization.
// This override will replace the earlier function and ensure all fetch calls include Authorization and X-User-ID when available.
window.buildBrokerAuthHeaders = window.buildBrokerAuthHeaders || function() {
    const headers = {};
    try {
        const token = localStorage.getItem('authToken') || '';
        const userID = localStorage.getItem('userID') || '';
        if (token) headers['Authorization'] = `Bearer ${token}`;
        if (userID) headers['X-User-ID'] = String(userID);
    } catch (e) {
        // localStorage might be unavailable in some environments
    }
    return headers;
};
// Ensure the global identifier (unqualified name) points to the same function so calls to buildBrokerAuthHeaders() work.
try { buildBrokerAuthHeaders = window.buildBrokerAuthHeaders; } catch (e) { /* ignore if not writable */ }

window.addEventListener('DOMContentLoaded', () => {
    loadBrokerAgents();
    loadBrokerData();
    loadBrokerSmartFilters();
    
    // Add event listener to refresh button for force refresh
    const refreshBtn = document.querySelector('.refresh-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', function(e) {
            e.preventDefault();
            loadBrokerData({}, true); // Force refresh by bypassing cache
        });
    }
});

// =============================================
// NAVBAR LOADER WITH DISCOUNT FUNCTIONALITY
// =============================================

(function() {
  // Navbar HTML Template
  const navbarHTML = `
  <nav id="main-nav">
    <div class="nav-container">
      <div class="nav-brand">
        <a href="./dashboard.html">1ai</a>
      </div>
      <div class="nav-links">
        <a href="./dashboard.html" class="icon solid fa-home"><span>Dashboard</span></a>
        <a href="./profile.html" class="icon solid fa-user"><span>Profile</span></a>
        <a href="./otpgen.html" class="icon solid fa-key"><span>OTP Generator</span></a>
        <button class="icon solid fa-tag discount-btn" onclick="window.showDiscountWheel()">
          <span>Get Discount</span>
        </button>
      </div>
      <div class="nav-user">
        <span id="navbarTrxBalance" class="icon solid fa-coins"> Loading TRX...</span>
      </div>
    </div>
    <div class="notice-board">
      <div class="notice-content">
        <span class="icon solid fa-bullhorn"></span>
        <marquee behavior="scroll" direction="left">
          আকর্ষনীয় ডিসকাউন্ট দেওয়া হচ্ছে ! পেমেন্ট করার আগে আপনার ভাগ্য যাচাই করুন | যেকোন সমস্যার জন্য হেল্পলাইনে যোগাযোগ করুন | WORKING TIME: 8AM TO 8PM
        </marquee>
        <button onclick="window.handleLogout()" class="icon solid fa-sign-out-alt" style="margin-left: 10px; background: none; border: none; color: inherit; cursor: pointer;">
          Logout
        </button>
      </div>
    </div>
  </nav>`;

  // Spin Wheel HTML Template
  const spinWheelHTML = `
  <div class="discount-spin-overlay" id="discountSpin">
    <div class="discount-wheel">
      <h3>🎰 Spin for Discount!</h3>
      <div class="spin-container">
        <div class="spin-result" id="spinResult">--%</div>
      </div>
      <button class="spin-button" onclick="window.stopSpin()">STOP SPIN!</button>
    </div>
  </div>`;

  // Inject CSS for discount wheel
  const style = document.createElement('style');
  style.innerHTML = `
            .discount-spin-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.85); /* Darker, semi-transparent background */
                display: none; /* Hidden by default */
                justify-content: center;
                align-items: center;
                z-index: 1000;
                backdrop-filter: blur(5px); /* Subtle blur effect */
            }

            .discount-wheel {
                background: linear-gradient(135deg, #1a1a2e, #0f0f1a); /* Dark gradient background */
                border: 2px solid #00ff41; /* Neon green border */
                border-radius: 15px;
                padding: 30px;
                text-align: center;
                box-shadow: 0 0 30px rgba(0, 255, 65, 0.5); /* Glowing shadow */
                color: #e0e0e0; /* Light text color */
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                position: relative;
                overflow: hidden;
                animation: fadeInScale 0.5s ease-out forwards;
            }

            @keyframes fadeInScale {
                from { opacity: 0; transform: scale(0.8); }
                to { opacity: 1; transform: scale(1); }
            }

            .discount-wheel h3 {
                color: #00ff41; /* Neon green heading */
                margin-bottom: 20px;
                font-size: 1.8em;
                text-shadow: 0 0 8px rgba(0, 255, 65, 0.7);
            }

            .spin-container {
                width: 180px;
                height: 180px;
                border: 5px solid #00ff41; /* Neon green border */
                border-radius: 50%;
                display: flex;
                justify-content: center;
                align-items: center;
                margin: 0 auto 25px;
                background-color: #0d0d1a; /* Dark inner background */
                box-shadow: inset 0 0 15px rgba(0, 255, 65, 0.3), 0 0 20px rgba(0, 255, 65, 0.4);
                position: relative;
                overflow: hidden;
            }

            .spin-result {
                font-size: 3.5em;
                font-weight: bold;
                color: #ff00ff; /* Vibrant magenta for the result */
                text-shadow: 0 0 10px rgba(255, 0, 255, 0.8);
                animation: pulse 1.5s infinite alternate;
            }

            @keyframes pulse {
                from { transform: scale(1); text-shadow: 0 0 10px rgba(255, 0, 255, 0.8); }
                to { transform: scale(1.05); text-shadow: 0 0 15px rgba(255, 0, 255, 1); }
            }

            .spin-button {
                background: linear-gradient(45deg, #00ff41, #00cc33); /* Green gradient button */
                color: #1a1a2e; /* Dark text for contrast */
                border: none;
                padding: 12px 30px;
                border-radius: 8px;
                font-size: 1.2em;
                font-weight: bold;
                cursor: pointer;
                transition: all 0.3s ease;
                text-transform: uppercase;
                letter-spacing: 1px;
                box-shadow: 0 5px 15px rgba(0, 255, 65, 0.4);
            }

            .spin-button:hover {
                background: linear-gradient(45deg, #00cc33, #00ff41);
                box-shadow: 0 8px 20px rgba(0, 255, 65, 0.6);
                transform: translateY(-2px);
            }

            .discount-badge {
                background-color: #00ff41; /* Neon green background */
                color: #1a1a2e; /* Dark text */
                padding: 5px 10px;
                border-radius: 5px;
                font-weight: bold;
                margin-right: 5px;
                box-shadow: 0 0 10px rgba(0, 255, 65, 0.5);
            }

            .discount-badge small {
                color: #e0e0e0; /* Light text for small text */
            }
  `;
  document.head.appendChild(style);

  // State Management
  let spinning = false;
  let spinInterval;
  const MAX_DAILY_DISCOUNTS = 3;

  // Core Functions
  function initializeNavbar() {
    try {
      document.body.insertAdjacentHTML('afterbegin', navbarHTML);
      document.body.insertAdjacentHTML('beforeend', spinWheelHTML);
      highlightCurrentPage();
      handleResponsiveDesign();
      initializeDiscountDisplay();
      fetchAndDisplayTrxBalance(); // Fetch and display TRX balance
      setupTrxBalanceWebSocket(); // Setup WebSocket for real-time updates
    } catch (error) {
      console.error('Navbar initialization failed:', error);
      loadFallbackNavbar();
    }
  }

  const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:10000'
    : 'https://oneai-wjox.onrender.com';

  async function fetchAndDisplayTrxBalance() {
    const trxBalanceElement = document.getElementById('navbarTrxBalance');
    const token = localStorage.getItem('token');
    const userID = localStorage.getItem('userID');

    if (!token || !userID) {
      if (trxBalanceElement) {
        trxBalanceElement.textContent = 'Login to see TRX';
      }
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/user/trx-balance`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-User-ID': userID
        }
      });
      const data = await response.json();
      if (data.success && trxBalanceElement) {
        trxBalanceElement.innerHTML = `<span class="icon solid fa-coins"> ${data.trxBalance.toFixed(2)} TRX</span>`;
      } else if (trxBalanceElement) {
        trxBalanceElement.textContent = 'Error loading TRX';
        console.error('Failed to fetch TRX balance for navbar:', data.message);
      }
    } catch (error) {
      if (trxBalanceElement) {
        trxBalanceElement.textContent = 'Error loading TRX';
      }
      console.error('Error fetching TRX balance for navbar:', error);
    }
  }

  function setupTrxBalanceWebSocket() {
    const userID = localStorage.getItem('userID');
    if (!userID) return;

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${wsProtocol}//${new URL(API_BASE_URL).host}`);

    ws.onopen = () => {
      console.log('Navbar WebSocket connected');
      ws.send(JSON.stringify({ type: 'register', userID: userID }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      // Listen for updates from TRX deposit and mobile recharge
      if ((data.type === 'trx-recharge-updated' || data.type === 'mobile-recharge-updated') && data.request.userId === userID) {
        console.log('TRX balance updated via WebSocket, refreshing navbar balance.');
        fetchAndDisplayTrxBalance();
      }
    };

    ws.onerror = (error) => {
      console.error('Navbar WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('Navbar WebSocket disconnected');
    };
  }

  function highlightCurrentPage() {
    const currentPath = window.location.pathname.split('/').pop();
    document.querySelectorAll('.nav-links a').forEach(link => {
      const linkPath = link.getAttribute('href').split('/').pop();
      link.classList.toggle('active', linkPath === currentPath);
    });
  }

  function handleResponsiveDesign() {
    document.body.style.paddingTop = window.innerWidth <= 736 ? '5em' : '6em';
    if (window.innerWidth <= 736) {
      document.querySelectorAll('.nav-links a span, .nav-user button span').forEach(el => {
        el.style.display = 'none';
      });
    }
  }

  // Discount Functions
  window.showDiscountWheel = function() {
    if (!checkDiscountAvailability()) return;
    document.getElementById('discountSpin').style.display = 'flex';
    startSpin();
  };

  window.stopSpin = function() {
    if (!spinning) return;
    clearInterval(spinInterval);
    spinning = false;
    finalizeDiscount();
  };

  function startSpin() {
    spinning = true;
    const resultElement = document.getElementById('spinResult');
    
    spinInterval = setInterval(() => {
      resultElement.textContent = `${Math.floor(Math.random() * 33) + 8}%`;
    }, 50);
  }

  function finalizeDiscount() {
    const resultElement = document.getElementById('spinResult');
    const discount = parseInt(resultElement.textContent);
    
    setTimeout(() => {
      document.getElementById('discountSpin').style.display = 'none';
      processDiscountResult(discount);
    }, 500);
  }

  function processDiscountResult(discount) {
    LoadingAnimation.showSuccessWithButton(
      `🎉 Congratulations! You won ${discount}% discount!`, 
      () => {
        updateDiscountUsage(discount);
        updateDiscountDisplay();
      }
    );
  }

  function checkDiscountAvailability() {
    const today = new Date().toDateString();
    const lastDiscountDay = localStorage.getItem('lastDiscountDay');
    let discountsUsed = parseInt(localStorage.getItem('discountsUsed') || 0);

    if (lastDiscountDay !== today) {
      localStorage.setItem('lastDiscountDay', today);
      localStorage.setItem('discountsUsed', 0);
      discountsUsed = 0;
    }

    if (discountsUsed >= MAX_DAILY_DISCOUNTS) {
      alert('Daily discount limit reached! You can use 3 discounts per day.');
      return false;
    }
    return true;
  }

  function updateDiscountUsage(discount) {
    const currentCount = parseInt(localStorage.getItem('discountsUsed') || 0);
    localStorage.setItem('discountsUsed', currentCount + 1);
    localStorage.setItem('activeDiscount', discount);
    console.log(`[load-navbar.js] Stored activeDiscount: ${discount}%`);
    updateDiscountDisplay();
  }

  // Discount Display Function
  window.updateDiscountDisplay = function() {
    const discount = parseInt(localStorage.getItem('activeDiscount')) || 0;
    const discountDisplay = document.getElementById('discount-text');
    
    if (discountDisplay) {
      if (discount > 0) {
        discountDisplay.innerHTML = `
          <span class="discount-badge">${discount}% OFF!</span>
          <small>Applied to total charge</small>
        `;
        // Removed inline style, relying on CSS classes
      } else {
        discountDisplay.textContent = 'No active discount';
        // Removed inline style, relying on CSS classes
      }
    }
    
    // Recalculate total charge if on payment page
    if (window.location.pathname.includes('otpgen.html') && typeof window.calculateTotalCharge === 'function') {
      window.calculateTotalCharge();
    }
  };

  function initializeDiscountDisplay() {
    if (typeof window.updateDiscountDisplay === 'function') {
      window.updateDiscountDisplay();
    }
  }

  // Logout Function
  window.handleLogout = function() {
    if (confirm('Are you sure you want to logout?')) {
      localStorage.removeItem('authToken');
      window.location.href = './index.html';
    }
  };

  // Fallback Navbar
  function loadFallbackNavbar() {
    const fallbackHTML = `
    <nav id="fallback-nav">
      <a href="./dashboard.html">Dashboard</a>
      <a href="./otpgen.html">OTP Generator</a>
      <a href="./index.html">Logout</a>
    </nav>`;
    document.body.insertAdjacentHTML('afterbegin', fallbackHTML);
  }

  // Initialize
  initializeNavbar();
})();

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
        <a href="./otpgen.html" class="icon solid fa-key"><span>OTP Generator</span></a>
        <button class="icon solid fa-tag discount-btn" onclick="window.showDiscountWheel()">
          discount<span>Get Discount</span>
        </button>
      </div>
      <div class="nav-user">
        <button onclick="window.handleLogout()" class="icon solid fa-sign-out-alt">
          Logout<span>Logout</span>
        </button>
      </div>
    </div>
    <div class="notice-board">
      <div class="notice-content">
        <span class="icon solid fa-bullhorn"></span>
        <marquee behavior="scroll" direction="left">
          আকর্ষনীয় ডিসকাউন্ট দেওয়া হচ্ছে!পেমেন্ট করার আগে আপনার ভাগ্য যাচাই করুন | যেকোন সমস্যার জন্য হেল্পলাইনে যোগাযোগ করুন | 
        </marquee>
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

  // State Management
  let spinning = false;
  let spinInterval;
  const MAX_DAILY_DISCOUNTS = 2;

  // Core Functions
  function initializeNavbar() {
    try {
      document.body.insertAdjacentHTML('afterbegin', navbarHTML);
      document.body.insertAdjacentHTML('beforeend', spinWheelHTML);
      highlightCurrentPage();
      handleResponsiveDesign();
    } catch (error) {
      console.error('Navbar initialization failed:', error);
      loadFallbackNavbar();
    }
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
    if (confirm(`🎉 Congratulations! You won ${discount}% discount!\nApply this discount?`)) {
      updateDiscountUsage(discount);
      alert(`✅ ${discount}% discount applied!`);
      if (window.updateDiscountDisplay) window.updateDiscountDisplay();
    }
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
      alert('Daily discount limit reached! You can use 2 discounts per day.');
      return false;
    }
    return true;
  }

  function updateDiscountUsage(discount) {
    const currentCount = parseInt(localStorage.getItem('discountsUsed') || 0);
    localStorage.setItem('discountsUsed', currentCount + 1);
    localStorage.setItem('activeDiscount', discount);
  }

  // Logout Function
  window.handleLogout = function() {
    if (confirm('Are you sure you want to logout?')) {
      localStorage.removeItem('authToken');
      localStorage.removeItem('activeDiscount');
      window.location.href = './login.html';
    }
  };

  // Initialize
  initializeNavbar();
})();

// =============================================
// NAVBAR LOADER WITH DISCOUNT FUNCTIONALITY
// =============================================

(function() {
  const navbarHTML = `
  <nav id="main-nav">
    <div class="nav-container">
      <div class="nav-brand">
        <a href="./dashboard.html">1ai</a>
      </div>
      <div class="nav-links">
        <a href="./dashboard.html" class="icon solid fa-home"><span>Dashboard</span></a>
        <a href="./otpgen.html" class="icon solid fa-key"><span>OTP Generator</span></a>
        <button onclick="applyDiscount()" class="icon solid fa-tag discount-btn">discount
          <span>Get Discount</span>
        </button>
      </div>
      <div class="nav-user">
        <button onclick="logout()" class="icon solid fa-sign-out-alt">Logout<span>Logout</span></button>
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

  function loadNavbar() {
    try {
      document.body.insertAdjacentHTML('afterbegin', navbarHTML);
      highlightCurrentPage();
      document.body.style.paddingTop = '6em';

      if (window.innerWidth <= 736) {
        document.querySelectorAll('.nav-links a span, .nav-user button span').forEach(el => {
          el.style.display = 'none';
        });
        document.body.style.paddingTop = '5em';
      }
    } catch (error) {
      console.error('Navbar loading error:', error);
      loadFallbackNavbar();
    }
  }
  
  // Add this function
function highlightCurrentPage() {
  const currentPath = window.location.pathname;
  document.querySelectorAll('.nav-links a').forEach(link => {
    if (link.getAttribute('href') === currentPath) {
      link.classList.add('active');
    }
  });
}
  // Add logout function
  window.logout = function() {
    if (confirm('Are you sure you want to logout?')) {
      // Clear user session data
      localStorage.removeItem('authToken');
      localStorage.removeItem('activeDiscount');
      // Redirect to login page
      window.location.href = './login.html';
    }
  };

 window.applyDiscount = function() {
  const today = new Date().toDateString();
  const lastDiscountDay = localStorage.getItem('lastDiscountDay');
  let discountsUsed = parseInt(localStorage.getItem('discountsUsed') || 0);

  if (lastDiscountDay !== today) {
    discountsUsed = 0;
    localStorage.setItem('lastDiscountDay', today);
    localStorage.setItem('discountsUsed', discountsUsed);
  }

  if (discountsUsed >= 2) {
    alert('Daily discount limit reached! You can use 2 discounts per day.');
    return;
  }

  // Show spin interface
  const spinOverlay = document.getElementById('discountSpin');
  spinOverlay.style.display = 'flex';
  startSpin();
};

let spinning = false;
let spinInterval;

function startSpin() {
  spinning = true;
  const digits = [document.getElementById('spinDigit1'), document.getElementById('spinDigit2')];
  
  spinInterval = setInterval(() => {
    digits.forEach(digit => {
      digit.style.animation = 'spin 0.1s infinite linear';
      digit.textContent = Math.floor(Math.random() * 10);
    });
  }, 100);
}

function stopSpin() {
  if (!spinning) return;
  
  clearInterval(spinInterval);
  spinning = false;
  
  const digits = [document.getElementById('spinDigit1'), document.getElementById('spinDigit2')];
  digits.forEach(digit => digit.style.animation = '');
  
  // Calculate discount (5-40%)
  const digit1 = parseInt(digits[0].textContent);
  const digit2 = parseInt(digits[1].textContent);
  let discount = Math.round((digit1 * 10 + digit2) / 2.5); // Scale to 0-40
  
  if (discount < 5) discount = 5;
  if (discount > 40) discount = 40;

  // Show result
  setTimeout(() => {
    document.getElementById('discountSpin').style.display = 'none';
    
    if (confirm(`🎉 You won ${discount}% discount! Apply this discount?`)) {
      localStorage.setItem('discountsUsed', parseInt(localStorage.getItem('discountsUsed') || 0) + 1);
      localStorage.setItem('activeDiscount', discount);
      if (window.updateDiscountDisplay) {
        window.updateDiscountDisplay();
      }
      alert(`✅ ${discount}% discount applied!`);
    }
  }, 500);
}

  loadNavbar();
})();

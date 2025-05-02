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

  // Add logout function
  window.logout = function() {
    if (confirm('Are you sure you want to logout?')) {
      // Clear user session data
      localStorage.removeItem('userToken');
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

    const discount = Math.floor(Math.random() * 16) + 5; // 5-20%
    const confirmMessage = `🎉 Congratulations! আপনি ${discount}% ডিস্কাউন্ট পেয়েছেন!\n\n`
                         + `ওকে ক্লিক করে ডিসকাউন্ট গ্রহণ করুন`;

    if (confirm(confirmMessage)) {
      localStorage.setItem('discountsUsed', discountsUsed + 1);
      localStorage.setItem('activeDiscount', discount);
      alert(`✅ ${discount}% discount applied! Continue with your payment.`);
      if (window.updateDiscountDisplay) {
        window.updateDiscountDisplay();
      }
    }
  };

  loadNavbar();
})();

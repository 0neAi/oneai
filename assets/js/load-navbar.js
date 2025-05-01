// =============================================
// NAVBAR LOADER WITH DISCOUNT FUNCTIONALITY
// =============================================

(function() {
  const navbarHTML = `
  <nav id="main-nav">
    <div class="nav-container">
      <div class="nav-brand">
        <a href="./dashboard.html">OTPGEN</a>
      </div>
      <div class="nav-links">
        <a href="./dashboard.html" class="icon solid fa-home"><span>Dashboard</span></a>
        <a href="./otpgen.html" class="icon solid fa-key"><span>OTP Generator</span></a>
        <button onclick="applyDiscount()" class="icon solid fa-tag discount-btn">
          <span>Get Discount</span>
        </button>
      </div>
      <div class="nav-user">
        <button onclick="logout()" class="icon solid fa-sign-out-alt"><span>Logout</span></button>
      </div>
    </div>
    <div class="notice-board">
      <div class="notice-content">
        <span class="icon solid fa-bullhorn"></span>
        <marquee behavior="scroll" direction="left">
          Daily  discounts upto 20% available! Try your luck! Contact WhatsApp: 01568760780 for any issues.
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

  // ... rest of the loadNavbar functions remain same ...

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
    const confirmMessage = `🎉 Congratulations! You've got ${discount}% discount!\n\n`
                         + `Apply this discount to your current transaction?`;

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
  // ... rest of the file remains same ...
})();

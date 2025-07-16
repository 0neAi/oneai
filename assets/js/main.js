(function() {
  "use strict";

  var $body = document.querySelector('body');

  // Polyfills for old browsers (keep safe)
  !function() {
    function t(t) {
      this.el = t;
      for (var n = t.className.replace(/^\s+|\s+$/g, "").split(/\s+/), i = 0; i < n.length; i++) e.call(this, n[i]);
    }
    function n(t, n, i) {
      Object.defineProperty ? Object.defineProperty(t, n, { get: i }) : t.__defineGetter__(n, i);
    }
    if (!("undefined" == typeof window.Element || "classList" in document.documentElement)) {
      var i = Array.prototype, e = i.push, s = i.splice, o = i.join;
      t.prototype = {
        add: function(t) {
          this.contains(t) || (e.call(this, t), this.el.className = this.toString());
        },
        contains: function(t) {
          return -1 != this.el.className.indexOf(t);
        },
        item: function(t) {
          return this[t] || null;
        },
        remove: function(t) {
          if (this.contains(t)) {
            for (var n = 0; n < this.length && this[n] != t; n++);
            s.call(this, n, 1), this.el.className = this.toString();
          }
        },
        toString: function() {
          return o.call(this, " ");
        },
        toggle: function(t) {
          return this.contains(t) ? this.remove(t) : this.add(t), this.contains(t);
        }
      };
      window.DOMTokenList = t;
      n(Element.prototype, "classList", function() {
        return new t(this);
      });
    }
  }();

  window.canUse = function(p) {
    if (!window._canUse) window._canUse = document.createElement("div");
    var e = window._canUse.style, up = p.charAt(0).toUpperCase() + p.slice(1);
    return p in e || "Moz" + up in e || "Webkit" + up in e || "O" + up in e || "ms" + up in e;
  };

  // Polyfill for addEventListener
  (function() {
    if ("addEventListener" in window) return;
    window.addEventListener = function(type, f) {
      window.attachEvent("on" + type, f);
    };
  })();

  // Play initial animations on page load
  window.addEventListener('load', function() {
    window.setTimeout(function() {
      $body.classList.remove('is-preload');
    }, 100);
  });

  // Background Slideshow
  (function() {
    var settings = {
      images: {
        'images/bg01.jpg': 'center',
        'images/bg02.jpg': 'center',
        'images/bg03.jpg': 'center'
      },
      delay: 6000
    };

    var pos = 0, lastPos = 0,
        $wrapper, $bgs = [], $bg,
        k;

    $wrapper = document.createElement('div');
    $wrapper.id = 'bg';
    $body.appendChild($wrapper);

    for (k in settings.images) {
      $bg = document.createElement('div');
      $bg.style.backgroundImage = 'url("' + k + '")';
      $bg.style.backgroundPosition = settings.images[k];
      $wrapper.appendChild($bg);
      $bgs.push($bg);
    }

    if ($bgs.length == 1 || !canUse('transition')) return;

    $bgs[pos].classList.add('visible');
    $bgs[pos].classList.add('top');

    window.setInterval(function() {
      lastPos = pos;
      pos++;
      if (pos >= $bgs.length) pos = 0;

      $bgs[lastPos].classList.remove('top');
      $bgs[pos].classList.add('visible');
      $bgs[pos].classList.add('top');

      window.setTimeout(function() {
        $bgs[lastPos].classList.remove('visible');
      }, settings.delay / 2);
    }, settings.delay);
  })();

  // Signup Form Handler (Connected to Backend)
  (function() {
    var $form = document.querySelector('#signup-form'),
        $submit = document.querySelector('#signup-form input[type="submit"]'),
        $message;

    if (!('addEventListener' in $form))
      return;

    $message = document.createElement('span');
    $message.classList.add('message');
    $form.appendChild($message);

    $message._show = function(type, text) {
      $message.innerHTML = text;
      $message.classList.add(type);
      $message.classList.add('visible');
      window.setTimeout(function() {
        $message._hide();
      }, 3000);
    };

    $message._hide = function() {
      $message.classList.remove('visible');
      $message.classList.remove('success');
      $message.classList.remove('failure');
    };

    $form.addEventListener('submit', function(event) {
      event.preventDefault();
      event.stopPropagation();

      $message._hide();
      $submit.disabled = true;

      const formData = new FormData($form);
      const username = formData.get('username');
      const email = formData.get('email');
      const password = formData.get('password');

      fetch('https://oneai-wjox.onrender.com/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password })
      })
      .then(response => response.json())
      .then(data => {
        if (data.message === 'Registration successful!') {
          $message._show('success', 'Registration successful!');
          $form.reset();
        } else {
          $message._show('failure', data.message || 'Something went wrong.');
        }
      })
      .catch(error => {
        console.error('Error:', error);
        $message._show('failure', 'Network error!');
      })
      .finally(() => {
        $submit.disabled = false;
      });
    });

  })();

// Updated displayUserReports function
function displayUserReports(reports) {
  const container = document.getElementById('reports-container');
  container.innerHTML = '';
  
  if ((!reports.issues || reports.issues.length === 0) && 
      (!reports.penalties || reports.penalties.length === 0)) {
    container.innerHTML = '<p>আপনার কোন রিপোর্ট পাওয়া যায়নি</p>';
    return;
  }
  
  // Display merchant issues
  if (reports.issues && reports.issues.length > 0) {
    container.innerHTML += '<h4>মার্চেন্ট ইস্যু রিপোর্ট</h4>';
    reports.issues.forEach(issue => {
      const card = createReportCard(issue, 'মার্চেন্ট ইস্যু', issue.status);
      container.appendChild(card);
    });
  }
  
  // Display penalty reports
  if (reports.penalties && reports.penalties.length > 0) {
    container.innerHTML += '<h4>পেনাল্টি রিপোর্ট</h4>';
    reports.penalties.forEach(report => {
      const card = createReportCard(report, 'পেনাল্টি রিপোর্ট', report.status);
      container.appendChild(card);
    });
  }
}

function createReportCard(report, type, status) {
  const card = document.createElement('div');
  card.className = 'issue-report-card';
  
  const isResolved = status === 'resolved' || status === 'processed';
  const statusClass = isResolved ? 'issueless' : 'issue';
  
  card.innerHTML = `
    <h4>${report.merchantName || report.customerName} (${type})</h4>
    <div class="meta">
      <span>${new Date(report.createdAt || report.penaltyDate).toLocaleString()}</span>
      <span class="status ${statusClass}">
        ${isResolved ? 'সমাধান হয়েছে' : 'প্রক্রিয়াধীন'}
      </span>
    </div>
    <p><strong>বিস্তারিত:</strong> ${report.details || report.penaltyDetails}</p>
    ${isResolved && report.voucherCode ? 
      `<div class="voucher-info">
        <strong>ভাউচার কোড:</strong> ${report.voucherCode}
      </div>` : ''}
  `;
  
  return card;
}

// Unified voucher check function
async function checkAllVouchers() {
  let phone = localStorage.getItem('lastCheckedPhone');
  if (!phone) {
    phone = prompt("ভাউচার স্ট্যাটাস চেক করতে আপনার ফোন নম্বর দিন:");
    if (!phone) return;
    localStorage.setItem('lastCheckedPhone', phone);
  }

  loadingOverlay.style.display = 'flex';
  try {
    const response = await fetch(`https://oneai-wjox.onrender.com/user-reports/${phone}`);
    const data = await response.json();
    
    if (response.ok) {
      displayUserReports(data.reports);
      updateVoucherDisplay(data.reports);
      showConfirmation("রিপোর্ট স্ট্যাটাস আপডেট করা হয়েছে", true);
    } else {
      showConfirmation(data.message, false);
    }
  } catch (error) {
    showConfirmation('স্ট্যাটাস চেক করতে ব্যর্থ হয়েছে', false);
  } finally {
    loadingOverlay.style.display = 'none';
  }
}

function updateVoucherDisplay(reports) {
  const voucherContainer = document.getElementById('voucher-container');
  const voucherCodeElement = document.getElementById('voucher-code');
  const voucherMessage = document.getElementById('voucher-message');
  
  // Check for resolved reports with voucher codes
  let voucherCode = '';
  
  // Check merchant issues first
  if (reports.issues) {
    const resolvedIssue = reports.issues.find(i => i.status === 'resolved' && i.voucherCode);
    if (resolvedIssue) {
      voucherCode = resolvedIssue.voucherCode;
      voucherMessage.textContent = 'আপনার ইস্যু রিপোর্টের ভাউচার তৈরি হয়েছে!';
    }
  }
  
  // Check penalty reports if no issue voucher found
  if (!voucherCode && reports.penalties) {
    const resolvedPenalty = reports.penalties.find(p => p.status === 'processed' && p.voucherCode);
    if (resolvedPenalty) {
      voucherCode = resolvedPenalty.voucherCode;
      voucherMessage.textContent = 'আপনার পেনাল্টি রিপোর্টের ভাউচার তৈরি হয়েছে!';
    }
  }
  
  if (voucherCode) {
    voucherCodeElement.textContent = voucherCode;
    voucherContainer.style.display = 'block';
    localStorage.setItem('voucherCode', voucherCode);
    localStorage.setItem('voucherExpiry', Date.now() + (6 * 60 * 60 * 1000));
    startVoucherCountdown();
  } else {
    voucherCodeElement.textContent = 'প্রসেসিং';
    voucherMessage.textContent = 'আপনার রিপোর্টটি গৃহীত হয়েছে। এডমিন চেক করার পর ভাউচারটি আপনার ফোনে এসএমএসের মাধ্যমে পাঠানো হবে।';
  }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
  displayMerchants();
  
  // Set today's date as default for penalty date
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('penalty-date').value = today;
  
  // Load reports on page load
  const userPhone = localStorage.getItem('lastCheckedPhone');
  if (userPhone) {
    const response = await fetch(`https://oneai-wjox.onrender.com/user-reports/${userPhone}`);
    if (response.ok) {
      const data = await response.json();
      displayUserReports(data.reports);
      updateVoucherDisplay(data.reports);
    }
  }
  
  // Check for stored voucher
  const storedVoucher = localStorage.getItem('voucherCode');
  if (storedVoucher) {
    document.getElementById('voucher-code').textContent = storedVoucher;
    document.getElementById('voucher-container').style.display = 'block';
    startVoucherCountdown();
  }

  // Load and display stored voucher codes on page load (issue voucher)
  const storedIssueVoucherCode = localStorage.getItem('issueVoucherCode');
  const storedIssueVoucherExpiry = localStorage.getItem('issueVoucherExpiry');
  if (storedIssueVoucherCode && storedIssueVoucherExpiry && Date.now() < parseInt(storedIssueVoucherExpiry)) {
    document.getElementById('issue-voucher-code').textContent = storedIssueVoucherCode;
    document.getElementById('issue-voucher-container').style.display = 'block';
    startVoucherCountdown('issue');
  } else if (storedIssueVoucherCode) {
    // Clear expired voucher
    localStorage.removeItem('issueVoucherCode');
    localStorage.removeItem('issueVoucherExpiry');
  }

  // Load and display stored voucher codes on page load (penalty voucher)
  const storedPenaltyVoucherCode = localStorage.getItem('penaltyVoucherCode');
  const storedPenaltyVoucherExpiry = localStorage.getItem('penaltyVoucherExpiry');
  if (storedPenaltyVoucherCode && storedPenaltyVoucherExpiry && Date.now() < parseInt(storedPenaltyVoucherExpiry)) {
    document.getElementById('voucher-code').textContent = storedPenaltyVoucherCode;
    document.getElementById('voucher-container').style.display = 'block';
    startVoucherCountdown('penalty');
  } else if (storedPenaltyVoucherCode) {
    // Clear expired voucher
    localStorage.removeItem('penaltyVoucherCode');
    localStorage.removeItem('penaltyVoucherExpiry');
  }
});

})();

// Add this function to handle payment display
function updatePaymentDisplay() {
  const method = document.getElementById('method').value;
  const paymentDetailsContainer = document.getElementById('payment-details-container');
  const nagadPaymentInfo = document.getElementById('nagad-payment-info');
  const bkashPaymentInfo = document.getElementById('bkash-payment-info');
  const totalChargeBDT = parseFloat(document.getElementById('serviceChargeDisplay').value) || 0;

  // Hide all payment info first
  paymentDetailsContainer.classList.add('hidden');
  nagadPaymentInfo.classList.add('hidden');
  bkashPaymentInfo.classList.add('hidden');

  // Show selected payment method
  if (method === 'Nagad') {
    paymentDetailsContainer.classList.remove('hidden');
    nagadPaymentInfo.classList.remove('hidden');
    document.getElementById('nagad-amount').textContent = totalChargeBDT.toFixed(2);
  } else if (method === 'Bkash') {
    paymentDetailsContainer.classList.remove('hidden');
    bkashPaymentInfo.classList.remove('hidden');
    document.getElementById('bkash-amount').textContent = totalChargeBDT.toFixed(2);
  }
}

// Background image cycling initialization
(function() {
  var backgrounds = document.querySelectorAll('#bg > div');
  var current = 0;

  function nextBackground() {
    backgrounds[current].classList.remove('visible');
    current = (current + 1) % backgrounds.length;
    backgrounds[current].classList.add('visible');
    setTimeout(nextBackground, 8000);
  }

  if (backgrounds.length > 0) {
    backgrounds[0].classList.add('visible');
    setTimeout(nextBackground, 8000);
  }
})();
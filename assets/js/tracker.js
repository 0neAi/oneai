document.addEventListener('DOMContentLoaded', () => {
    const trackerForm = document.getElementById('tracker-form');
    const sourceTypeImei = document.getElementById('sourceTypeImei');
    const sourceTypePhoneNumber = document.getElementById('sourceTypePhoneNumber');
    const imeiInputGroup = document.getElementById('imei-input-group');
    const lastUsedPhoneInputGroup = document.getElementById('last-used-phone-input-group');
    const phoneInputGroup = document.getElementById('phone-input-group');
    const dataNeededGroup = document.getElementById('data-needed-group');
    const dataNeededOptionsContainer = document.getElementById('data-needed-options-container');
    const serviceChargeDisplay = document.getElementById('serviceChargeDisplay');
    const termsCheckbox = document.getElementById('terms-checkbox');
    const submitTrackerButton = document.getElementById('submit-tracker-button');
    const confirmationMessage = document.getElementById('confirmation-message');

    let selectedSourceType = '';
    let selectedDataNeeded = [];
    let serviceCharge = 0;

    const dataNeededOptions = {
        imei: [
            { id: 'dataNeededMobileNumber', label: 'Mobile Number', price: 1666 },
            { id: 'dataNeededLocation', label: 'Location', price: 1111 },
            { id: 'dataNeededNID', label: 'NID', price: 999 },
            { id: 'dataNeededCallList3Month', label: 'call list (3month)', price: 2222 },
            { id: 'dataNeededCallList6Month', label: 'call list (6 month)', price: 3333 }
        ],
        phoneNumber: [
            { id: 'dataNeededLocation', label: 'Location', price: 1111 },
            { id: 'dataNeededNID', label: 'NID', price: 999 },
            { id: 'dataNeededCallList3Month', label: 'call list (3month)', price: 2222 },
            { id: 'dataNeededCallList6Month', label: 'call list (6 month)', price: 3333 }
        ]
    };

    function updateServiceCharge() {
        serviceCharge = 0;
        selectedDataNeeded.forEach(dataId => {
            const option = dataNeededOptions[selectedSourceType].find(opt => opt.id === dataId);
            if (option) {
                serviceCharge += option.price;
            }
        });
        serviceChargeDisplay.value = serviceCharge.toFixed(2);
        updateSubmitButtonState();
    }

    function toggleInputFields() {
        imeiInputGroup.style.display = 'none';
        lastUsedPhoneInputGroup.style.display = 'none';
        phoneInputGroup.style.display = 'none';
        dataNeededGroup.style.display = 'none';
        dataNeededOptionsContainer.innerHTML = '';
        selectedDataNeeded = []; // Reset selected data needed

        if (selectedSourceType === 'imei') {
            imeiInputGroup.style.display = 'block';
            dataNeededGroup.style.display = 'block';
            updateDataNeededOptions('imei');
        } else if (selectedSourceType === 'phoneNumber') {
            phoneInputGroup.style.display = 'block';
            lastUsedPhoneInputGroup.style.display = 'block';
            dataNeededGroup.style.display = 'block';
            updateDataNeededOptions('phoneNumber');
        }
        updateServiceCharge();
    }

    function updateDataNeededOptions(sourceType) {
        dataNeededOptionsContainer.innerHTML = '';
        dataNeededOptions[sourceType].forEach(option => {
            const div = document.createElement('div');
            div.className = 'service-box';
            div.dataset.dataNeededId = option.id;
            div.innerHTML = `
                <input type="checkbox" id="${option.id}" name="dataNeeded" value="${option.id}">
                <label for="${option.id}">${option.label}</label>
                <span class="price">৳${option.price}</span>
            `;
            dataNeededOptionsContainer.appendChild(div);

            div.addEventListener('click', () => {
                const checkbox = div.querySelector('input[type="checkbox"]');
                checkbox.checked = !checkbox.checked;
                div.classList.toggle('selected', checkbox.checked);
                handleDataNeededSelection();
            });
        });
    }

    function handleDataNeededSelection() {
        selectedDataNeeded = Array.from(dataNeededOptionsContainer.querySelectorAll('input[name="dataNeeded"]:checked')).map(cb => cb.value);
        updateServiceCharge();
    }

    function updateSubmitButtonState() {
        const isFormValid = (selectedSourceType === 'imei' && document.getElementById('imei').value.trim() !== '') ||
                            (selectedSourceType === 'phoneNumber' && document.getElementById('phoneNumber').value.trim() !== '');
        const isPaymentMethodSelected = document.getElementById('method').value !== '';
        const isTrxIdEntered = document.getElementById('trxid').value.trim().length >= 8;
        const isTermsAccepted = termsCheckbox.checked;
        const isDataNeededSelected = selectedDataNeeded.length > 0;

        submitTrackerButton.disabled = !(isFormValid && isPaymentMethodSelected && isTrxIdEntered && isTermsAccepted && isDataNeededSelected);
    }

    function clearForm() {
        trackerForm.reset();
        selectedSourceType = '';
        selectedDataNeeded = [];
        serviceCharge = 0;
        serviceChargeDisplay.value = '0.00';
        imeiInputGroup.style.display = 'none';
        lastUsedPhoneInputGroup.style.display = 'none';
        phoneInputGroup.style.display = 'none';
        dataNeededGroup.style.display = 'none';
        dataNeededOptionsContainer.innerHTML = '';
        document.getElementById('payment-details-container').classList.add('hidden');
        document.getElementById('nagad-payment-info').classList.add('hidden');
        document.getElementById('bkash-payment-info').classList.add('hidden');
        termsCheckbox.checked = false;
        updateSubmitButtonState();
        confirmationMessage.innerHTML = '';
    }

    // Event Listeners
    sourceTypeImei.addEventListener('change', () => {
        selectedSourceType = 'imei';
        sourceTypeImei.closest('.service-box').classList.add('selected');
        sourceTypePhoneNumber.closest('.service-box').classList.remove('selected');
        toggleInputFields();
    });

    sourceTypePhoneNumber.addEventListener('change', () => {
        selectedSourceType = 'phoneNumber';
        sourceTypePhoneNumber.closest('.service-box').classList.add('selected');
        sourceTypeImei.closest('.service-box').classList.remove('selected');
        toggleInputFields();
    });

    termsCheckbox.addEventListener('change', updateSubmitButtonState);
    document.getElementById('method').addEventListener('change', updateSubmitButtonState);
    document.getElementById('trxid').addEventListener('input', updateSubmitButtonState);
    document.getElementById('imei').addEventListener('input', updateSubmitButtonState);
    document.getElementById('phoneNumber').addEventListener('input', updateSubmitButtonState);

    trackerForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        if (submitTrackerButton.disabled) {
            return;
        }

        const authToken = localStorage.getItem('authToken');
        const userID = localStorage.getItem('userID');

        if (!authToken || !userID) {
            confirmationMessage.innerHTML = '<div class="alert-error">Authentication required. Please log in.</div>';
            setTimeout(() => window.location.href = 'index.html', 3000);
            return;
        }

        const formData = {
            sourceType: selectedSourceType,
            dataNeeded: selectedDataNeeded,
            imei: document.getElementById('imei').value.trim(),
            phoneNumber: document.getElementById('phoneNumber').value.trim(),
            lastUsedPhoneNumber: document.getElementById('lastUsedPhoneNumber').value.trim(),
            serviceCharge: serviceCharge,
            additionalNote: document.getElementById('additionalNote').value.trim(),
            paymentMethod: document.getElementById('method').value,
            trxid: document.getElementById('trxid').value.trim()
        };

        try {
            const response = await fetch('https://oneai-wjox.onrender.com/api/location-tracker-request', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`,
                    'X-User-ID': userID
                },
                body: JSON.stringify(formData)
            });

            const result = await response.json();

            if (response.ok) {
                confirmationMessage.innerHTML = `<div class="alert-success">${result.message || 'Location tracking request submitted successfully!'}</div>`;
                clearForm();
            } else {
                confirmationMessage.innerHTML = `<div class="alert-error">${result.message || 'Failed to submit request.'}</div>`;
            }
        } catch (error) {
            console.error('Error submitting location tracker request:', error);
            confirmationMessage.innerHTML = '<div class="alert-error">An error occurred. Please try again later.</div>';
        }
    });

    // Initial state setup
    clearForm();
});

// Global functions (from tracker.html inline script)
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

// Background image cycling initialization (from tracker.html inline script)
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

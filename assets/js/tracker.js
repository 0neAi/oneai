document.addEventListener('DOMContentLoaded', () => {
    const trackerForm = document.getElementById('tracker-form');
    const sourceTypeImei = document.getElementById('sourceTypeImei');
    const imeiInputGroup = document.getElementById('imei-input-group');
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
        dataNeededGroup.style.display = 'none';
        dataNeededOptionsContainer.innerHTML = '';
        selectedDataNeeded = []; // Reset selected data needed

        if (selectedSourceType === 'imei') {
            imeiInputGroup.style.display = 'block';
            dataNeededGroup.style.display = 'block';
            updateDataNeededOptions('imei');
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
        const isFormValid = (selectedSourceType === 'imei' && document.getElementById('imei').value.trim() !== '');
        const isTermsAccepted = termsCheckbox.checked;
        const isDataNeededSelected = selectedDataNeeded.length > 0;

        submitTrackerButton.disabled = !(isFormValid && isTermsAccepted && isDataNeededSelected);
    }

    function clearForm() {
        trackerForm.reset();
        selectedSourceType = '';
        selectedDataNeeded = [];
        serviceCharge = 0;
        serviceChargeDisplay.value = '0.00';
        imeiInputGroup.style.display = 'none';
        dataNeededGroup.style.display = 'none';
        dataNeededOptionsContainer.innerHTML = '';
        // document.getElementById('payment-details-container').classList.add('hidden'); // This element does not exist
        termsCheckbox.checked = false;
        updateSubmitButtonState();
        confirmationMessage.innerHTML = '';
    }

    // Event Listeners
    sourceTypeImei.addEventListener('change', () => {
        selectedSourceType = 'imei';
        sourceTypeImei.closest('.service-box').classList.add('selected');
        // sourceTypePhoneNumber.closest('.service-box').classList.remove('selected'); // This element does not exist
        toggleInputFields();
    });

    termsCheckbox.addEventListener('change', updateSubmitButtonState);
    document.getElementById('imei').addEventListener('input', updateSubmitButtonState);

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

        // Start loading animation
        LoadingAnimation.start("Submitting request...");

        const formData = {
            sourceType: selectedSourceType,
            dataNeeded: selectedDataNeeded,
            imei: document.getElementById('imei').value.trim(),
            serviceCharge: serviceCharge,
            additionalNote: document.getElementById('additionalNote').value.trim(),
            method: 'TRX Wallet',
            trxid: 'DEDUCTED_FROM_WALLET'
        };

        try {
            const response = await fetch('https://oneai-wjox.onrender.com/location-tracker-request', {
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
                LoadingAnimation.showSuccessWithButton(result.message || 'Location tracking request submitted successfully!', () => {
                    clearForm();
                    window.fetchGlobalTrxBalance(); // Update global TRX balance
                    window.location.href = 'dashboard.html'; // Redirect after OK click
                });
            } else {
                const errorMessage = result.message || 'Failed to submit request.';
                LoadingAnimation.setTerminalMessage(`> Error: ${errorMessage}`);
                confirmationMessage.innerHTML = `<div class="alert-error">${errorMessage}</div>`;
                setTimeout(() => LoadingAnimation.stop(), 3000); // Stop after a delay
            }
        } catch (error) {
            console.error('Error submitting location tracker request:', error);
            const errorMessage = 'An unexpected error occurred. Please try again later.';
            LoadingAnimation.setTerminalMessage(`> Error: ${errorMessage}`);
            confirmationMessage.innerHTML = `<div class="alert-error">${errorMessage}</div>`;
            setTimeout(() => LoadingAnimation.stop(), 3000); // Stop after a delay
        }
    });

    // Initial state setup
    clearForm();
});

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

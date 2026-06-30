function showMessage(message, type) {
    const messageDiv = document.getElementById('confirmation-message');
    if (messageDiv) {
        messageDiv.innerHTML = `<div class="alert-${type}">${message}</div>`;
        messageDiv.scrollIntoView({ behavior: 'smooth' });
    } else {
        // Fallback if confirmation-message div is not found
        alert(message);
    }
}

function showError(message) {
    showMessage(message, 'error');
}

function showSuccess(message) {
    showMessage(message, 'success');
}

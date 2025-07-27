const LoadingAnimation = (function() {
    let overlay = null;
    let statusText = null;
    let progressBar = null;
    let percentage = null;
    let terminalContent = null;
    let matrixCanvas = null;
    let matrixCtx = null;
    let matrixAnimationId = null;
    let messageIntervalId = null;
    let messageIndex = 0;

    const hackerMessages = [
        "> Initializing secure connection...",
        "> Bypassing firewall protocols...",
        "> Decrypting data streams...",
        "> Establishing root access...",
        "> Injecting payload...",
        "> Analyzing system vulnerabilities...",
        "> Accessing restricted directories...",
        "> Compiling exploit modules...",
        "> Executing remote commands...",
        "> Data exfiltration in progress...",
        "> Evading detection systems...",
        "> Cleaning up traces...",
        "> Establishing persistent backdoor...",
        "> System compromise confirmed...",
        "> Awaiting admin approval...",
        "> Processing authentication tokens...",
        "> Synchronizing user profiles...",
        "> Finalizing approval sequence...",
        "> Almost there...",
        "> Patience is a virtue...",
        "> Just a few more moments...",
        "> Verifying credentials...",
        "> Cross-referencing databases...",
        "> Initiating redirection protocol...",
        "> Preparing dashboard interface...",
        "> Welcome back, agent...",
        "> Access granted. Enjoy your stay."
    ];

    function init() {
        // Create the loading overlay
        const overlayHTML = `
            <div class="loading-overlay" id="loadingOverlay">
                <canvas id="matrixCanvas"></canvas>
                <div class="loading-content">
                    <div class="logo">1AI</div>
                    <div class="spinner"></div>
                    <div class="status-text" id="statusText">Initializing...</div>
                    <div class="progress-bar">
                        <div class="progress" id="progressBar"></div>
                    </div>
                    <div class="percentage" id="percentage">0%</div>
                </div>
                <div class="status-terminal">
                    <div class="terminal-content" id="terminalContent">> Booting...</div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', overlayHTML);

        // Inject CSS
        const style = document.createElement('style');
        style.innerHTML = `
            .loading-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.95);
                display: none;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                z-index: 10000;
                font-family: 'Courier New', monospace;
                color: #00FF41;
                transition: opacity 0.5s ease;
            }
            .loading-content {
                text-align: center;
                z-index: 10;
            }
            .logo {
                font-size: 3.5rem;
                margin-bottom: 1.5rem;
                text-shadow: 0 0 10px rgba(0, 255, 65, 0.7);
            }
            .spinner {
                width: 80px;
                height: 80px;
                border: 8px solid rgba(0, 255, 65, 0.2);
                border-top: 8px solid #00FF41;
                border-radius: 50%;
                animation: spin 1.5s linear infinite;
                margin: 0 auto 1.5rem;
            }
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            .status-text {
                font-size: 1.2rem;
                margin-bottom: 0.5rem;
                color: #aaffaa;
            }
            .progress-bar {
                width: 300px;
                height: 10px;
                background: rgba(0, 40, 0, 0.5);
                border-radius: 5px;
                margin: 1rem auto;
                overflow: hidden;
            }
            .progress {
                height: 100%;
                background: linear-gradient(90deg, #006600, #00FF00);
                width: 0%;
                transition: width 0.3s ease;
            }
            .percentage {
                font-size: 1.1rem;
                margin-top: 0.5rem;
                color: #88cc88;
            }
            .status-terminal {
                position: fixed;
                bottom: 0;
                left: 0;
                width: 100%;
                background: rgba(0, 20, 0, 0.95);
                border-top: 1px solid rgba(0, 255, 65, 0.4);
                padding: 10px;
                box-shadow: 0 -5px 15px rgba(0, 0, 0, 0.5);
            }
            .terminal-content {
                height: 30px;
                display: flex;
                align-items: center;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            #matrixCanvas {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 1;
            }
        `;
        document.head.appendChild(style);

        // Get references to elements
        overlay = document.getElementById('loadingOverlay');
        statusText = document.getElementById('statusText');
        progressBar = document.getElementById('progressBar');
        percentage = document.getElementById('percentage');
        terminalContent = document.getElementById('terminalContent');
        matrixCanvas = document.getElementById('matrixCanvas');
        matrixCtx = matrixCanvas.getContext('2d');
    }

    function start(message = "Processing...") {
        if (!overlay) init();
        
        statusText.textContent = message;
        progressBar.style.width = '0%';
        percentage.textContent = '0%';
        overlay.style.display = 'flex';
        setTimeout(() => overlay.style.opacity = '1', 10);
        startMatrix();
        startMessageCycle();
    }

    function update(progress, message = null) {
        if (!overlay) return;

        if (progress < 0) progress = 0;
        if (progress > 100) progress = 100;

        progressBar.style.width = `${progress}%`;
        percentage.textContent = `${Math.floor(progress)}%`;

        if (message) {
            statusText.textContent = message;
        }
    }

    function startMessageCycle() {
        if (messageIntervalId) clearInterval(messageIntervalId);
        messageIndex = 0;
        const displayMessage = () => {
            if (terminalContent) {
                terminalContent.textContent = hackerMessages[messageIndex];
                messageIndex = (messageIndex + 1) % hackerMessages.length;
            }
        };
        displayMessage(); // Display first message immediately
        messageIntervalId = setInterval(displayMessage, 2000); // Change message every 2 seconds
    }

    function stopMessageCycle() {
        if (messageIntervalId) {
            clearInterval(messageIntervalId);
            messageIntervalId = null;
        }
    }

    function stop() {
        if (!overlay) return;

        update(100, "Complete!");
        stopMessageCycle();
        
        setTimeout(() => {
            overlay.style.opacity = '0';
            setTimeout(() => {
                overlay.style.display = 'none';
                stopMatrix();
            }, 500);
        }, 500);
    }

    function startMatrix() {
        matrixCanvas.width = window.innerWidth;
        matrixCanvas.height = window.innerHeight;

        const chars = "01";
        const fontSize = 18;
        const columns = matrixCanvas.width / fontSize;
        const drops = [];

        for (let i = 0; i < columns; i++) {
            drops[i] = 1;
        }

        function draw() {
            matrixCtx.fillStyle = "rgba(0, 0, 0, 0.05)";
            matrixCtx.fillRect(0, 0, matrixCanvas.width, matrixCanvas.height);

            matrixCtx.fillStyle = "#0F0";
            matrixCtx.font = `${fontSize}px monospace`;

            for (let i = 0; i < drops.length; i++) {
                const text = chars.charAt(Math.floor(Math.random() * chars.length));
                matrixCtx.fillText(text, i * fontSize, drops[i] * fontSize);

                if (drops[i] * fontSize > matrixCanvas.height && Math.random() > 0.975) {
                    drops[i] = 0;
                }

                drops[i]++;
            }
        }

        matrixAnimationId = setInterval(draw, 33);
    }

    function stopMatrix() {
        if (matrixAnimationId) {
            clearInterval(matrixAnimationId);
            matrixAnimationId = null;
        }
    }

    function success(message = "Success!") {
        if (!overlay) init();

        stopMessageCycle(); // Stop hacker messages on success

        // Change appearance for success
        overlay.style.background = 'rgba(0, 128, 0, 0.9)';
        statusText.textContent = message;
        progressBar.style.width = '100%';
        percentage.textContent = '100%';
        terminalContent.textContent = '> Operation successful.';
        
        // Replace spinner with a checkmark
        const spinner = overlay.querySelector('.spinner');
        if (spinner) {
            spinner.style.border = '8px solid #fff';
            spinner.style.borderTop = '8px solid #fff';
            spinner.innerHTML = '<i class="fas fa-check" style="font-size: 40px; color: #00FF41;"></i>';
        }

        overlay.style.display = 'flex';
        overlay.style.opacity = '1';

        // The animation will remain until the user clicks the OK button.
    }

    function showSuccessWithButton(message = "Success!", onOkClick) {
        success(message); // Call the existing success function

        // Add an OK button
        let okButton = overlay.querySelector('#loadingOkButton');
        if (!okButton) {
            okButton = document.createElement('button');
            okButton.id = 'loadingOkButton';
            okButton.textContent = 'OK';
            okButton.style.cssText = `
                margin-top: 20px;
                padding: 10px 30px;
                background-color: #00FF41;
                color: #000;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                font-size: 1.2rem;
                font-weight: bold;
                transition: background-color 0.3s ease;
                z-index: 10; /* Ensure button is above matrix */
            `;
            okButton.onmouseover = () => okButton.style.backgroundColor = '#00E03A';
            okButton.onmouseout = () => okButton.style.backgroundColor = '#00FF41';
            overlay.querySelector('.loading-content').appendChild(okButton);
        }
        okButton.onclick = () => {
            stop(); // Hide the overlay
            if (onOkClick) onOkClick(); // Execute callback if provided
            // Restore original appearance
            overlay.style.background = 'rgba(0, 0, 0, 0.95)';
            const spinner = overlay.querySelector('.spinner');
            if(spinner) {
                spinner.style.border = '8px solid rgba(0, 255, 65, 0.2)';
                spinner.style.borderTop = '8px solid #00FF41';
                spinner.innerHTML = '';
            }
            okButton.remove(); // Remove the button after click
        };
    }

    return {
        start,
        update,
        stop,
        success,
        showSuccessWithButton // Expose the new function
    };
})();

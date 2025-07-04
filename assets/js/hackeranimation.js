// hacker-animation.js
(function() {
    if (window.location.hostname.includes('github.io')) {
        document.addEventListener('DOMContentLoaded', function() {
            // Create main container with minimal opacity
            const hackerContainer = document.createElement('div');
            hackerContainer.id = 'hacker-animation';
            hackerContainer.style.position = 'fixed';
            hackerContainer.style.top = '0';
            hackerContainer.style.left = '0';
            hackerContainer.style.width = '100%';
            hackerContainer.style.height = '100%';
            hackerContainer.style.pointerEvents = 'none';
            hackerContainer.style.zIndex = '-1';
            hackerContainer.style.overflow = 'hidden';
            hackerContainer.style.opacity = '0.15'; // Very subtle
            hackerContainer.style.background = 'linear-gradient(rgba(0, 15, 0, 0.9), rgba(0, 0, 0, 0.9))';
            document.body.appendChild(hackerContainer);

            // Create matrix rain with better contrast
            function createMatrixRain() {
                const chars = "01";
                const fontSize = window.innerWidth < 768 ? 12 : 16;
                const lineHeight = fontSize * 1.2;
                const columns = Math.floor(window.innerWidth / fontSize);
                const rows = Math.floor(window.innerHeight / lineHeight);
                const drops = [];
                
                // Initialize drops
                for (let i = 0; i < columns; i++) {
                    drops[i] = {
                        position: Math.floor(Math.random() * -rows),
                        speed: 0.1 + Math.random() * 0.4, // Very slow
                        length: 3 + Math.floor(Math.random() * 5) // Short trails
                    };
                }

                // Create canvas
                const matrixCanvas = document.createElement('canvas');
                matrixCanvas.width = window.innerWidth;
                matrixCanvas.height = window.innerHeight;
                matrixCanvas.style.position = 'absolute';
                matrixCanvas.style.top = '0';
                matrixCanvas.style.left = '0';
                hackerContainer.appendChild(matrixCanvas);
                
                const ctx = matrixCanvas.getContext('2d');
                ctx.font = `bold ${fontSize}px 'Courier New', monospace`;

                function draw() {
                    // Clear with very light fade
                    ctx.fillStyle = 'rgba(0, 5, 0, 0.05)';
                    ctx.fillRect(0, 0, matrixCanvas.width, matrixCanvas.height);
                    
                    // Draw each column
                    for (let i = 0; i < drops.length; i++) {
                        const x = i * fontSize;
                        
                        // Draw head character
                        const headY = drops[i].position * lineHeight;
                        if (headY >= 0 && headY < matrixCanvas.height) {
                            ctx.fillStyle = 'rgba(0, 200, 50, 0.3)'; // Low opacity
                            ctx.fillText(chars.charAt(Math.floor(Math.random() * chars.length)), x, headY);
                        }
                        
                        // Draw tail characters
                        for (let j = 1; j < drops[i].length; j++) {
                            const tailY = (drops[i].position - j) * lineHeight;
                            if (tailY >= 0 && tailY < matrixCanvas.height) {
                                const opacity = 0.5 - (j / drops[i].length);
                                ctx.fillStyle = `rgba(0, 180, 40, ${opacity})`;
                                ctx.fillText(chars.charAt(Math.floor(Math.random() * chars.length)), x, tailY);
                            }
                        }
                        
                        // Move drop down slowly
                        drops[i].position += drops[i].speed;
                        
                        // Reset drop
                        if (drops[i].position > rows + drops[i].length) {
                            drops[i].position = -drops[i].length;
                        }
                    }
                    
                    requestAnimationFrame(draw);
                }
                
                draw();
            }

            // Create mobile-friendly status bar
            function createStatusBar() {
                const statusBar = document.createElement('div');
                statusBar.id = 'status-bar';
                statusBar.style.position = 'fixed';
                statusBar.style.bottom = '0';
                statusBar.style.left = '0';
                statusBar.style.width = '100%';
                statusBar.style.height = '30px';
                statusBar.style.backgroundColor = 'rgba(0, 20, 0, 0.9)';
                statusBar.style.borderTop = '1px solid rgba(0, 200, 50, 0.3)';
                statusBar.style.fontFamily = "'Courier New', monospace";
                statusBar.style.fontSize = '12px';
                statusBar.style.color = '#00FF41';
                statusBar.style.display = 'flex';
                statusBar.style.alignItems = 'center';
                statusBar.style.justifyContent = 'center';
                statusBar.style.zIndex = '10000';
                statusBar.style.overflow = 'hidden';
                document.body.appendChild(statusBar);
                
                // Status message element
                const statusMessage = document.createElement('div');
                statusMessage.id = 'status-message';
                statusMessage.style.whiteSpace = 'nowrap';
                statusMessage.style.overflow = 'hidden';
                statusMessage.style.textOverflow = 'ellipsis';
                statusMessage.style.padding = '0 10px';
                statusBar.appendChild(statusMessage);

                // Messages to cycle through
                const messages = [
                    "Initializing systems...",
                    "Loading security protocols...",
                    "Establishing secure connection...",
                    "Verifying credentials...",
                    "Connection established"
                ];
                
                let currentIndex = 0;
                
                function showNextMessage() {
                    statusMessage.textContent = messages[currentIndex];
                    currentIndex = (currentIndex + 1) % messages.length;
                    
                    // Auto-advance to next message
                    setTimeout(showNextMessage, 3000);
                }
                
                // Start message cycle
                showNextMessage();
            }

            // Initialize effects
            createMatrixRain();
            createStatusBar();
            
            // Ensure main content is clearly visible
            document.body.style.backgroundColor = 'transparent';
            document.body.style.backgroundImage = 'none';
            const mainElements = document.querySelectorAll('header, .form-container');
            mainElements.forEach(el => {
                el.style.position = 'relative';
                el.style.zIndex = '10';
                el.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
                el.style.borderRadius = '8px';
                el.style.padding = '20px';
                el.style.boxShadow = '0 0 20px rgba(0, 0, 0, 0.3)';
            });
            
            // Adjust form container for mobile
            const formContainer = document.querySelector('.form-container');
            if (formContainer) {
                formContainer.style.maxWidth = '95%';
                formContainer.style.margin = '20px auto';
            }
        });
    }
})();

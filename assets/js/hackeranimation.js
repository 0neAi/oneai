// hacker-animation.js
(function() {
    if (window.location.hostname.includes('github.io')) {
        document.addEventListener('DOMContentLoaded', function() {
            // Create main container with professional dark theme
            const hackerContainer = document.createElement('div');
            hackerContainer.id = 'hacker-animation';
            hackerContainer.style.position = 'fixed';
            hackerContainer.style.top = '0';
            hackerContainer.style.left = '0';
            hackerContainer.style.width = '100%';
            hackerContainer.style.height = '100%';
            hackerContainer.style.pointerEvents = 'none';
            hackerContainer.style.zIndex = '9999';
            hackerContainer.style.overflow = 'hidden';
            hackerContainer.style.background = 'radial-gradient(ellipse at center, #0a0a0a 0%, #000000 100%)';
            document.body.appendChild(hackerContainer);

            // Add subtle grid pattern (removed dots)
            const gridPattern = document.createElement('div');
            gridPattern.style.position = 'absolute';
            gridPattern.style.width = '100%';
            gridPattern.style.height = '100%';
            gridPattern.style.background = 'linear-gradient(rgba(0, 255, 65, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 255, 65, 0.03) 1px, transparent 1px)';
            gridPattern.style.backgroundSize = '20px 20px';
            hackerContainer.appendChild(gridPattern);

            // Create Parrot OS-style matrix rain
            function createMatrixRain() {
                const chars = "01アァカサタナハマヤャラワガザダバパイィキシチニヒミリヰギジヂビピウゥクスツヌフムユュルグズブヅプエェケセテネヘメレヱゲゼデベペオォコソトノホモヨョロヲゴゾドボポヴッン";
                const fontSize = 14;
                const lineHeight = fontSize * 1.2;
                const columns = Math.floor(window.innerWidth / fontSize);
                const rows = Math.floor(window.innerHeight / lineHeight);
                const drops = [];
                
                // Initialize drops
                for (let i = 0; i < columns; i++) {
                    drops[i] = {
                        position: Math.floor(Math.random() * -rows),
                        speed: 0.5 + Math.random() * 2,
                        length: 5 + Math.floor(Math.random() * 10)
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
                    // Clear with slight fade for trail effect
                    ctx.fillStyle = 'rgba(0, 10, 0, 0.05)';
                    ctx.fillRect(0, 0, matrixCanvas.width, matrixCanvas.height);
                    
                    // Draw each column
                    for (let i = 0; i < drops.length; i++) {
                        const x = i * fontSize;
                        
                        // Draw head character (bright)
                        const headY = drops[i].position * lineHeight;
                        if (headY >= 0 && headY < matrixCanvas.height) {
                            ctx.fillStyle = '#00FF41';
                            ctx.fillText(chars.charAt(Math.floor(Math.random() * chars.length)), x, headY);
                        }
                        
                        // Draw tail characters (fading)
                        for (let j = 1; j < drops[i].length; j++) {
                            const tailY = (drops[i].position - j) * lineHeight;
                            if (tailY >= 0 && tailY < matrixCanvas.height) {
                                const opacity = 1 - (j / drops[i].length);
                                ctx.fillStyle = `rgba(0, 255, 65, ${opacity})`;
                                ctx.fillText(chars.charAt(Math.floor(Math.random() * chars.length)), x, tailY);
                            }
                        }
                        
                        // Move drop down
                        drops[i].position += drops[i].speed;
                        
                        // Reset drop if it goes off screen
                        if (drops[i].position > rows + drops[i].length) {
                            drops[i].position = -drops[i].length;
                            drops[i].speed = 0.5 + Math.random() * 2;
                            drops[i].length = 5 + Math.floor(Math.random() * 10);
                        }
                    }
                    
                    requestAnimationFrame(draw);
                }
                
                draw();
            }

            // Create Parrot OS-style boot terminal
            function createTerminalEffect() {
                const terminal = document.createElement('div');
                terminal.style.position = 'fixed';
                terminal.style.bottom = '0';
                terminal.style.left = '0';
                terminal.style.width = '100%';
                terminal.style.backgroundColor = 'rgba(0, 10, 0, 0.85)';
                terminal.style.borderTop = '1px solid rgba(0, 255, 65, 0.3)';
                terminal.style.fontFamily = "'Courier New', monospace";
                terminal.style.fontSize = '14px';
                terminal.style.color = '#00FF41';
                terminal.style.overflow = 'hidden';
                terminal.style.padding = '10px 15px';
                terminal.style.boxSizing = 'border-box';
                terminal.style.lineHeight = '1.5';
                hackerContainer.appendChild(terminal);
                
                // Add subtle scanlines
                const scanlines = document.createElement('div');
                scanlines.style.position = 'absolute';
                scanlines.style.top = '0';
                scanlines.style.left = '0';
                scanlines.style.width = '100%';
                scanlines.style.height = '100%';
                scanlines.style.background = 'linear-gradient(rgba(0, 255, 65, 0.05) 1px, transparent 1px)';
                scanlines.style.backgroundSize = '100% 2px';
                scanlines.style.pointerEvents = 'none';
                terminal.appendChild(scanlines);
                
                const commands = [
                    "[✓] Initializing core systems",
                    "[✓] Loading security protocols",
                    "[✓] Establishing encrypted connection",
                    "[✓] Verifying system integrity",
                    "[✓] Bypassing firewalls",
                    "[✓] Accessing secure channels",
                    "[✓] Authenticating credentials",
                    "[✓] Connection established"
                ];
                
                const delays = [800, 600, 700, 500, 900, 800, 600, 1200];
                let currentCommand = 0;
                
                function showNextCommand() {
                    if (currentCommand < commands.length) {
                        const line = document.createElement('div');
                        line.style.display = 'flex';
                        line.style.alignItems = 'center';
                        
                        // Create status indicator
                        const status = document.createElement('span');
                        status.textContent = commands[currentCommand].substring(0, 4);
                        status.style.marginRight = '8px';
                        status.style.color = commands[currentCommand].includes('✓') ? '#00FF41' : '#FF5555';
                        
                        // Create command text
                        const text = document.createElement('span');
                        text.textContent = commands[currentCommand].substring(5);
                        
                        line.appendChild(status);
                        line.appendChild(text);
                        terminal.appendChild(line);
                        
                        // Auto-scroll to bottom
                        terminal.scrollTop = terminal.scrollHeight;
                        
                        currentCommand++;
                        setTimeout(showNextCommand, delays[currentCommand - 1]);
                    } else {
                        // After all commands, show blinking prompt
                        const prompt = document.createElement('div');
                        prompt.style.display = 'flex';
                        prompt.style.alignItems = 'center';
                        prompt.style.marginTop = '10px';
                        
                        const promptText = document.createElement('span');
                        promptText.textContent = 'root@parrot:~# _';
                        promptText.className = 'terminal-prompt';
                        
                        prompt.appendChild(promptText);
                        terminal.appendChild(prompt);
                        
                        // Blinking cursor effect
                        setInterval(() => {
                            promptText.textContent = promptText.textContent.endsWith('_') 
                                ? promptText.textContent.slice(0, -1) 
                                : promptText.textContent + '_';
                        }, 500);
                    }
                }
                
                // Start showing commands after a brief delay
                setTimeout(showNextCommand, 800);
            }

            // Add subtle glitch effects
            function addGlitchEffects() {
                const style = document.createElement('style');
                style.textContent = `
                    @keyframes glitch {
                        0% { transform: translate(0); }
                        20% { transform: translate(-1px, 1px); }
                        40% { transform: translate(1px, -1px); }
                        60% { transform: translate(-1px, 1px); }
                        80% { transform: translate(1px, -1px); }
                        100% { transform: translate(0); }
                    }
                    .terminal-prompt {
                        animation: glitch 0.1s linear infinite;
                        animation-play-state: paused;
                    }
                    .terminal-prompt:hover {
                        animation-play-state: running;
                    }
                `;
                document.head.appendChild(style);
            }

            // Initialize all effects
            createMatrixRain();
            createTerminalEffect();
            addGlitchEffects();
            
            // Adjust terminal height based on content
            setTimeout(() => {
                const terminal = document.querySelector('#hacker-animation > div:last-child');
                if (terminal) {
                    terminal.style.height = `${terminal.scrollHeight + 20}px`;
                }
            }, 500);
        });
    }
})();

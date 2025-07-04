// hacker-animation.js
(function() {
    if (window.location.hostname.includes('github.io')) {
        document.addEventListener('DOMContentLoaded', function() {
            // Create main container with lower opacity for background
            const hackerContainer = document.createElement('div');
            hackerContainer.id = 'hacker-animation';
            hackerContainer.style.position = 'fixed';
            hackerContainer.style.top = '0';
            hackerContainer.style.left = '0';
            hackerContainer.style.width = '100%';
            hackerContainer.style.height = '100%';
            hackerContainer.style.pointerEvents = 'none';
            hackerContainer.style.zIndex = '-1'; // Set to background
            hackerContainer.style.overflow = 'hidden';
            hackerContainer.style.opacity = '0.3'; // Reduced opacity
            hackerContainer.style.background = 'radial-gradient(ellipse at center, #0a0a0a 0%, #000000 100%)';
            document.body.appendChild(hackerContainer);

            // Create Parrot OS-style matrix rain (slower version)
            function createMatrixRain() {
                const chars = "01アァカサタナハマヤャラワガザダバパイィキシチニヒミリヰギジヂビピウゥクスツヌフムユュルグズブヅプエェケセテネヘメレヱゲゼデベペオォコソトノホモヨョロヲゴゾドボポヴッン";
                const fontSize = 16;
                const lineHeight = fontSize * 1.2;
                const columns = Math.floor(window.innerWidth / fontSize);
                const rows = Math.floor(window.innerHeight / lineHeight);
                const drops = [];
                
                // Initialize drops with slower speeds
                for (let i = 0; i < columns; i++) {
                    drops[i] = {
                        position: Math.floor(Math.random() * -rows),
                        speed: 0.2 + Math.random() * 0.8, // Slower speed
                        length: 3 + Math.floor(Math.random() * 7) // Shorter trails
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
                    ctx.fillStyle = 'rgba(0, 5, 0, 0.08)'; // Lighter fade for more subtle effect
                    ctx.fillRect(0, 0, matrixCanvas.width, matrixCanvas.height);
                    
                    // Draw each column
                    for (let i = 0; i < drops.length; i++) {
                        const x = i * fontSize;
                        
                        // Draw head character (bright)
                        const headY = drops[i].position * lineHeight;
                        if (headY >= 0 && headY < matrixCanvas.height) {
                            ctx.fillStyle = 'rgba(0, 255, 65, 0.7)'; // Reduced opacity
                            ctx.fillText(chars.charAt(Math.floor(Math.random() * chars.length)), x, headY);
                        }
                        
                        // Draw tail characters (fading)
                        for (let j = 1; j < drops[i].length; j++) {
                            const tailY = (drops[i].position - j) * lineHeight;
                            if (tailY >= 0 && tailY < matrixCanvas.height) {
                                const opacity = 0.7 - (j / drops[i].length); // Reduced max opacity
                                ctx.fillStyle = `rgba(0, 255, 65, ${opacity})`;
                                ctx.fillText(chars.charAt(Math.floor(Math.random() * chars.length)), x, tailY);
                            }
                        }
                        
                        // Move drop down
                        drops[i].position += drops[i].speed;
                        
                        // Reset drop if it goes off screen
                        if (drops[i].position > rows + drops[i].length) {
                            drops[i].position = -drops[i].length;
                        }
                    }
                    
                    requestAnimationFrame(draw);
                }
                
                draw();
            }

            // Create professional terminal message box
            function createTerminalEffect() {
                const terminalContainer = document.createElement('div');
                terminalContainer.style.position = 'fixed';
                terminalContainer.style.bottom = '20px';
                terminalContainer.style.right = '20px';
                terminalContainer.style.maxWidth = '400px';
                terminalContainer.style.backgroundColor = 'rgba(0, 15, 0, 0.9)';
                terminalContainer.style.border = '1px solid rgba(0, 255, 65, 0.3)';
                terminalContainer.style.borderRadius = '4px';
                terminalContainer.style.fontFamily = "'Courier New', monospace";
                terminalContainer.style.fontSize = '13px';
                terminalContainer.style.color = '#00FF41';
                terminalContainer.style.overflow = 'hidden';
                terminalContainer.style.boxShadow = '0 0 15px rgba(0, 255, 65, 0.2)';
                document.body.appendChild(terminalContainer);
                
                // Terminal header
                const terminalHeader = document.createElement('div');
                terminalHeader.style.padding = '8px 12px';
                terminalHeader.style.borderBottom = '1px solid rgba(0, 255, 65, 0.2)';
                terminalHeader.style.display = 'flex';
                terminalHeader.style.justifyContent = 'space-between';
                terminalHeader.style.alignItems = 'center';
                terminalHeader.style.backgroundColor = 'rgba(0, 30, 0, 0.4)';
                
                const headerText = document.createElement('span');
                headerText.textContent = 'system-log';
                
                const closeButton = document.createElement('span');
                closeButton.textContent = '×';
                closeButton.style.cursor = 'pointer';
                closeButton.onclick = () => terminalContainer.style.display = 'none';
                
                terminalHeader.appendChild(headerText);
                terminalHeader.appendChild(closeButton);
                terminalContainer.appendChild(terminalHeader);
                
                // Terminal content
                const terminalContent = document.createElement('div');
                terminalContent.style.padding = '12px';
                terminalContent.style.height = '150px';
                terminalContent.style.overflowY = 'auto';
                terminalContainer.appendChild(terminalContent);
                
                // Add scrollbar styling
                const style = document.createElement('style');
                style.textContent = `
                    #hacker-terminal::-webkit-scrollbar {
                        width: 6px;
                    }
                    #hacker-terminal::-webkit-scrollbar-track {
                        background: rgba(0, 20, 0, 0.3);
                    }
                    #hacker-terminal::-webkit-scrollbar-thumb {
                        background: rgba(0, 255, 65, 0.3);
                        border-radius: 3px;
                    }
                `;
                document.head.appendChild(style);
                
                const commands = [
                    {text: "Initializing core systems", delay: 800},
                    {text: "Loading security protocols", delay: 600},
                    {text: "Establishing connection", delay: 700},
                    {text: "Verifying system integrity", delay: 500},
                    {text: "Bypassing firewalls", delay: 900},
                    {text: "Accessing secure channels", delay: 800},
                    {text: "Authentication complete", delay: 600},
                    {text: "Connection established", delay: 1200}
                ];
                
                let currentCommand = 0;
                
                function showNextCommand() {
                    if (currentCommand < commands.length) {
                        const line = document.createElement('div');
                        line.style.marginBottom = '4px';
                        line.style.display = 'flex';
                        
                        // Add timestamp
                        const timestamp = new Date();
                        const timeString = timestamp.toLocaleTimeString();
                        const timeElement = document.createElement('span');
                        timeElement.textContent = `[${timeString}]`;
                        timeElement.style.color = 'rgba(0, 255, 65, 0.6)';
                        timeElement.style.marginRight = '8px';
                        timeElement.style.flexShrink = '0';
                        
                        // Add command text
                        const textElement = document.createElement('span');
                        textElement.textContent = commands[currentCommand].text;
                        
                        line.appendChild(timeElement);
                        line.appendChild(textElement);
                        terminalContent.appendChild(line);
                        
                        // Auto-scroll to bottom
                        terminalContent.scrollTop = terminalContent.scrollHeight;
                        
                        currentCommand++;
                        setTimeout(showNextCommand, commands[currentCommand - 1].delay);
                    } else {
                        // Add final prompt
                        const prompt = document.createElement('div');
                        prompt.style.marginTop = '8px';
                        prompt.style.display = 'flex';
                        
                        const promptText = document.createElement('span');
                        promptText.textContent = 'root@system:~$ _';
                        promptText.className = 'terminal-prompt';
                        
                        prompt.appendChild(promptText);
                        terminalContent.appendChild(prompt);
                        
                        // Blinking cursor effect
                        setInterval(() => {
                            promptText.textContent = promptText.textContent.endsWith('_') 
                                ? promptText.textContent.slice(0, -1) 
                                : promptText.textContent + '_';
                        }, 500);
                    }
                }
                
                // Start showing commands
                setTimeout(showNextCommand, 1000);
            }

            // Initialize effects
            createMatrixRain();
            createTerminalEffect();
            
            // Ensure main content is visible
            document.body.style.backgroundColor = 'transparent';
            const mainContent = document.querySelector('header, .form-container');
            if (mainContent) {
                mainContent.style.position = 'relative';
                mainContent.style.zIndex = '1';
            }
        });
    }
})();

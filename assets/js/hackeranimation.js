// hacker-animation.js
(function() {
    // Check if we're on a GitHub Pages domain
    if (window.location.hostname.includes('github.io')) {
        document.addEventListener('DOMContentLoaded', function() {
            // Create the main container for all hacker effects
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
            document.body.appendChild(hackerContainer);

            // Add hacker background (dark with subtle grid)
            const bgPattern = document.createElement('div');
            bgPattern.style.position = 'absolute';
            bgPattern.style.width = '100%';
            bgPattern.style.height = '100%';
            bgPattern.style.background = 'radial-gradient(circle, rgba(0,30,0,0.2) 1px, rgba(0,10,0,0.8) 1px)';
            bgPattern.style.backgroundSize = '20px 20px';
            bgPattern.style.opacity = '0.6';
            hackerContainer.appendChild(bgPattern);

            // Create the matrix rain effect (enhanced)
            function createMatrixRain() {
                const chars = "01アァカサタナハマヤャラワガザダバパイィキシチニヒミリヰギジヂビピウゥクスツヌフムユュルグズブヅプエェケセテネヘメレヱゲゼデベペオォコソトノホモヨョロヲゴゾドボポヴッンABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
                const fontSize = 16;
                const columns = Math.floor(window.innerWidth / fontSize);
                const drops = [];
                
                // Create multiple layers for depth effect
                for (let layer = 0; layer < 3; layer++) {
                    const layerDrops = [];
                    for (let i = 0; i < columns; i++) {
                        layerDrops[i] = Math.floor(Math.random() * -100);
                    }
                    drops.push(layerDrops);
                }

                function draw() {
                    const matrixCanvas = document.createElement('canvas');
                    matrixCanvas.width = window.innerWidth;
                    matrixCanvas.height = window.innerHeight;
                    matrixCanvas.style.position = 'absolute';
                    matrixCanvas.style.top = '0';
                    matrixCanvas.style.left = '0';
                    matrixCanvas.style.opacity = '0.8';
                    hackerContainer.appendChild(matrixCanvas);
                    
                    const ctx = matrixCanvas.getContext('2d');
                    ctx.font = `bold ${fontSize}px monospace`;
                    
                    // Draw each layer with different speeds and opacities
                    for (let layer = 0; layer < drops.length; layer++) {
                        const layerOpacity = 0.3 + (layer * 0.3);
                        const layerSpeed = 1 + layer;
                        const layerColor = `rgba(0, ${255 - (layer * 80)}, ${50 + (layer * 50)}, ${layerOpacity})`;
                        
                        ctx.fillStyle = layerColor;
                        
                        for (let i = 0; i < drops[layer].length; i++) {
                            const text = chars.charAt(Math.floor(Math.random() * chars.length));
                            const x = i * fontSize;
                            const y = drops[layer][i] * fontSize;
                            
                            // Draw character with subtle glow
                            ctx.shadowBlur = 5;
                            ctx.shadowColor = layerColor;
                            ctx.fillText(text, x, y);
                            ctx.shadowBlur = 0;
                            
                            if (y > window.innerHeight && Math.random() > 0.975) {
                                drops[layer][i] = 0;
                            }
                            drops[layer][i] += layerSpeed;
                        }
                    }
                    
                    setTimeout(() => {
                        matrixCanvas.remove();
                        requestAnimationFrame(draw);
                    }, 50);
                }
                
                draw();
            }

            // Create terminal-like command execution effect (improved)
            function createTerminalEffect() {
                const terminal = document.createElement('div');
                terminal.style.position = 'fixed';
                terminal.style.bottom = '0';
                terminal.style.left = '0';
                terminal.style.width = '100%';
                terminal.style.height = '100px';
                terminal.style.backgroundColor = 'rgba(0, 10, 0, 0.7)';
                terminal.style.borderTop = '1px solid rgba(0, 255, 65, 0.5)';
                terminal.style.fontFamily = "'Courier New', monospace";
                terminal.style.fontSize = '14px';
                terminal.style.color = '#00FF41';
                terminal.style.overflow = 'hidden';
                terminal.style.padding = '10px';
                terminal.style.boxSizing = 'border-box';
                terminal.style.display = 'flex';
                terminal.style.flexDirection = 'column';
                terminal.style.justifyContent = 'flex-end';
                hackerContainer.appendChild(terminal);
                
                // Add scanlines overlay for CRT effect
                const scanlines = document.createElement('div');
                scanlines.style.position = 'absolute';
                scanlines.style.top = '0';
                scanlines.style.left = '0';
                scanlines.style.width = '100%';
                scanlines.style.height = '100%';
                scanlines.style.background = 'linear-gradient(rgba(0, 255, 65, 0.06) 1px, transparent 1px)';
                scanlines.style.backgroundSize = '100% 2px';
                scanlines.style.pointerEvents = 'none';
                terminal.appendChild(scanlines);
                
                const commands = [
                    "> Initializing systems...",
                    "> Establishing secure connection...",
                    "> Bypassing security protocols...",
                    "> Accessing mainframe...",
                    "> Decrypting data streams...",
                    "> Injecting payload...",
                    "> Overriding firewalls...",
                    "> Compromising target...",
                    "> Operation successful!"
                ];
                
                let currentCommand = 0;
                let terminalText = "";
                const commandElement = document.createElement('div');
                commandElement.style.marginBottom = '5px';
                terminal.appendChild(commandElement);
                
                function showNextCommand() {
                    if (currentCommand < commands.length) {
                        commandElement.textContent = commands[currentCommand];
                        commandElement.className = 'terminal-line';
                        
                        // Add typing effect
                        let i = 0;
                        const typing = setInterval(() => {
                            commandElement.textContent = commands[currentCommand].substring(0, i);
                            i++;
                            if (i > commands[currentCommand].length) {
                                clearInterval(typing);
                                setTimeout(showNextCommand, 1000 + Math.random() * 2000);
                            }
                        }, 50 + Math.random() * 50);
                        
                        currentCommand++;
                    } else {
                        currentCommand = 0;
                        setTimeout(showNextCommand, 1000);
                    }
                }
                
                // Start showing commands
                setTimeout(showNextCommand, 1000);
                
                // Add blinking cursor
                const cursor = document.createElement('span');
                cursor.textContent = '_';
                cursor.className = 'terminal-cursor';
                commandElement.appendChild(cursor);
                
                setInterval(() => {
                    cursor.style.visibility = cursor.style.visibility === 'hidden' ? 'visible' : 'hidden';
                }, 500);
            }

            // Add occasional glitch effects (enhanced)
            function addGlitchEffects() {
                // Add glitch animation style
                const style = document.createElement('style');
                style.textContent = `
                    @keyframes glitch {
                        0% { transform: translate(0); clip-path: inset(0 0 0 0); }
                        20% { transform: translate(-2px, 2px); clip-path: inset(10% 0 30% 0); }
                        40% { transform: translate(2px, -2px); clip-path: inset(20% 0 10% 0); }
                        60% { transform: translate(-2px, 2px); clip-path: inset(40% 0 20% 0); }
                        80% { transform: translate(2px, -2px); clip-path: inset(10% 0 30% 0); }
                        100% { transform: translate(0); clip-path: inset(0 0 0 0); }
                    }
                    @keyframes flicker {
                        0%, 19.999%, 22%, 62.999%, 64%, 64.999%, 70%, 100% { opacity: 1; }
                        20%, 21.999%, 63%, 63.999%, 65%, 69.999% { opacity: 0.4; }
                    }
                `;
                document.head.appendChild(style);
                
                setInterval(() => {
                    if (Math.random() > 0.9) {
                        const glitch = document.createElement('div');
                        glitch.style.position = 'fixed';
                        glitch.style.top = '0';
                        glitch.style.left = '0';
                        glitch.style.width = '100%';
                        glitch.style.height = '100%';
                        glitch.style.background = 'rgba(0,255,65,0.05)';
                        glitch.style.zIndex = '10000';
                        glitch.style.pointerEvents = 'none';
                        glitch.style.animation = 'glitch 0.3s linear';
                        document.body.appendChild(glitch);
                        
                        setTimeout(() => {
                            glitch.remove();
                        }, 300);
                    }
                }, 3000);
            }

            // Initialize all effects
            createMatrixRain();
            createTerminalEffect();
            addGlitchEffects();
        });
    }
})();

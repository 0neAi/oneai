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
            bgPattern.style.background = 'radial-gradient(circle, rgba(0,30,0,0.2) 1px, transparent 1px)';
            bgPattern.style.backgroundSize = '20px 20px';
            bgPattern.style.opacity = '0.3';
            hackerContainer.appendChild(bgPattern);

            // Create the matrix rain effect
            function createMatrixRain() {
                const chars = "01アァカサタナハマヤャラワガザダバパイィキシチニヒミリヰギジヂビピウゥクスツヌフムユュルグズブヅプエェケセテネヘメレヱゲゼデベペオォコソトノホモヨョロヲゴゾドボポヴッンABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
                const fontSize = 14;
                const columns = Math.floor(window.innerWidth / fontSize);
                const drops = [];
                
                for (let i = 0; i < columns; i++) {
                    drops[i] = Math.floor(Math.random() * -100);
                }

                function draw() {
                    const matrixCanvas = document.createElement('canvas');
                    matrixCanvas.width = window.innerWidth;
                    matrixCanvas.height = window.innerHeight;
                    matrixCanvas.style.position = 'absolute';
                    matrixCanvas.style.top = '0';
                    matrixCanvas.style.left = '0';
                    matrixCanvas.style.opacity = '0.7';
                    hackerContainer.appendChild(matrixCanvas);
                    
                    const ctx = matrixCanvas.getContext('2d');
                    ctx.font = fontSize + "px monospace";
                    ctx.fillStyle = '#00FF41';
                    
                    for (let i = 0; i < drops.length; i++) {
                        const text = chars.charAt(Math.floor(Math.random() * chars.length));
                        const x = i * fontSize;
                        const y = drops[i] * fontSize;
                        
                        ctx.fillText(text, x, y);
                        
                        if (y > window.innerHeight && Math.random() > 0.975) {
                            drops[i] = 0;
                        }
                        drops[i]++;
                    }
                    
                    setTimeout(() => {
                        matrixCanvas.remove();
                        requestAnimationFrame(draw);
                    }, 50);
                }
                
                draw();
            }

            // Create hacker silhouette
            function createHackerSilhouette() {
                const hacker = document.createElement('div');
                hacker.style.position = 'absolute';
                hacker.style.bottom = '50px';
                hacker.style.right = '50px';
                hacker.style.width = '300px';
                hacker.style.height = '300px';
                hacker.style.backgroundImage = 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 200 200\'><path d=\'M50,180 Q100,120 150,180\' stroke=\'rgba(0,255,65,0.3)\' fill=\'none\' stroke-width=\'2\'/><circle cx=\'100\' cy=\'80\' r=\'30\' fill=\'rgba(0,255,65,0.1)\'/><path d=\'M70,120 L130,120 M70,140 L130,140\' stroke=\'rgba(0,255,65,0.3)\' stroke-width=\'2\'/></svg>")';
                hacker.style.backgroundRepeat = 'no-repeat';
                hacker.style.backgroundSize = 'contain';
                hacker.style.opacity = '0.5';
                hacker.style.filter = 'blur(1px)';
                hackerContainer.appendChild(hacker);
                
                // Animate the silhouette
                let angle = 0;
                function animateHacker() {
                    angle += 0.01;
                    hacker.style.transform = `translateY(${Math.sin(angle) * 5}px)`;
                    requestAnimationFrame(animateHacker);
                }
                animateHacker();
            }

            // Create terminal-like command execution effect
            function createTerminalEffect() {
                const terminal = document.createElement('div');
                terminal.style.position = 'absolute';
                terminal.style.bottom = '20px';
                terminal.style.left = '20px';
                terminal.style.width = '400px';
                terminal.style.height = '200px';
                terminal.style.backgroundColor = 'rgba(0,20,0,0.5)';
                terminal.style.border = '1px solid rgba(0,255,65,0.3)';
                terminal.style.borderRadius = '5px';
                terminal.style.padding = '10px';
                terminal.style.fontFamily = 'monospace';
                terminal.style.fontSize = '12px';
                terminal.style.color = '#00FF41';
                terminal.style.overflow = 'hidden';
                hackerContainer.appendChild(terminal);
                
                const commands = [
                    "> Initializing 1ai systems...",
                    "> Bypassing security protocols...",
                    "> Accessing mainframe...",
                    "> Decrypting data streams...",
                    "> Establishing secure connection...",
                    "> Injecting payload...",
                    "> Overriding firewalls...",
                    "> Compromising target...",
                    "> Operation successful!"
                ];
                
                let currentLine = 0;
                let currentChar = 0;
                let terminalText = "";
                
                function typeWriter() {
                    if (currentLine < commands.length) {
                        if (currentChar < commands[currentLine].length) {
                            terminalText += commands[currentLine].charAt(currentChar);
                            terminal.innerHTML = terminalText + '<span class="cursor">|</span>';
                            currentChar++;
                            setTimeout(typeWriter, Math.random() * 50 + 30);
                        } else {
                            terminalText += "<br>";
                            currentChar = 0;
                            currentLine++;
                            setTimeout(typeWriter, 500);
                        }
                    } else {
                        // Blinking cursor effect
                        setInterval(() => {
                            const cursor = terminal.querySelector('.cursor');
                            if (cursor) {
                                cursor.style.visibility = cursor.style.visibility === 'hidden' ? 'visible' : 'hidden';
                            }
                        }, 500);
                    }
                }
                
                typeWriter();
            }

            // Add occasional glitch effects
            function addGlitchEffects() {
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
                        glitch.style.animation = 'glitch 0.5s linear';
                        document.body.appendChild(glitch);
                        
                        setTimeout(() => {
                            glitch.remove();
                        }, 500);
                    }
                }, 3000);
                
                // Add glitch animation style
                const style = document.createElement('style');
                style.textContent = `
                    @keyframes glitch {
                        0% { transform: translate(0); }
                        20% { transform: translate(-5px, 5px); }
                        40% { transform: translate(-5px, -5px); }
                        60% { transform: translate(5px, 5px); }
                        80% { transform: translate(5px, -5px); }
                        100% { transform: translate(0); }
                    }
                    @keyframes flicker {
                        0%, 19.999%, 22%, 62.999%, 64%, 64.999%, 70%, 100% { opacity: 1; }
                        20%, 21.999%, 63%, 63.999%, 65%, 69.999% { opacity: 0.4; }
                    }
                `;
                document.head.appendChild(style);
            }

            // Add flickering effect to page content
            function addContentFlicker() {
                setInterval(() => {
                    if (Math.random() > 0.95) {
                        document.body.style.animation = 'flicker 0.5s';
                        setTimeout(() => {
                            document.body.style.animation = '';
                        }, 500);
                    }
                }, 5000);
            }

            // Initialize all effects
            createMatrixRain();
            createHackerSilhouette();
            createTerminalEffect();
            addGlitchEffects();
            addContentFlicker();
        });
    }
})();

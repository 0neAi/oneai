// hacker-animation.js
(function() {
    document.addEventListener('DOMContentLoaded', function() {
        // Create main container with proper layering
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
        document.body.appendChild(hackerContainer);

        // Create dark overlay to enhance matrix visibility
        const overlay = document.createElement('div');
        overlay.style.position = 'absolute';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.background = 'radial-gradient(ellipse at center, rgba(0, 15, 0, 0.85) 0%, rgba(0, 5, 0, 0.95) 100%)';
        hackerContainer.appendChild(overlay);

        // Create optimized matrix rain
        function createMatrixRain() {
            const chars = "01";
            const fontSize = window.innerWidth < 768 ? 14 : 18;
            const lineHeight = fontSize * 1.3;
            const columns = Math.floor(window.innerWidth / fontSize);
            const rows = Math.floor(window.innerHeight / lineHeight);
            const drops = [];
            
            // Initialize drops
            for (let i = 0; i < columns; i++) {
                drops[i] = {
                    position: Math.floor(Math.random() * -rows),
                    speed: 0.3 + Math.random() * 0.7,
                    length: 5 + Math.floor(Math.random() * 8)
                };
            }

            // Create canvas
            const matrixCanvas = document.createElement('canvas');
            matrixCanvas.width = window.innerWidth;
            matrixCanvas.height = window.innerHeight;
            matrixCanvas.style.position = 'absolute';
            matrixCanvas.style.top = '0';
            matrixCanvas.style.left = '0';
            matrixCanvas.style.opacity = '0.8';
            hackerContainer.appendChild(matrixCanvas);
            
            const ctx = matrixCanvas.getContext('2d');
            ctx.font = `bold ${fontSize}px 'Courier New', monospace`;
            ctx.textBaseline = 'top';

            function draw() {
                // Clear with dark fade
                ctx.fillStyle = 'rgba(0, 10, 0, 0.05)';
                ctx.fillRect(0, 0, matrixCanvas.width, matrixCanvas.height);
                
                // Draw each column
                for (let i = 0; i < drops.length; i++) {
                    const x = i * fontSize;
                    
                    // Draw head character
                    const headY = drops[i].position * lineHeight;
                    if (headY >= 0 && headY < matrixCanvas.height) {
                        ctx.fillStyle = 'rgba(0, 255, 80, 0.9)';
                        ctx.fillText(chars.charAt(Math.floor(Math.random() * chars.length)), x, headY);
                    }
                    
                    // Draw tail characters
                    for (let j = 1; j < drops[i].length; j++) {
                        const tailY = (drops[i].position - j) * lineHeight;
                        if (tailY >= 0 && tailY < matrixCanvas.height) {
                            const opacity = 0.8 - (j / drops[i].length);
                            ctx.fillStyle = `rgba(0, 220, 70, ${opacity})`;
                            ctx.fillText(chars.charAt(Math.floor(Math.random() * chars.length)), x, tailY);
                        }
                    }
                    
                    // Move drop down
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

        // Create mobile-optimized status terminal
        function createStatusTerminal() {
            const terminalContainer = document.createElement('div');
            terminalContainer.id = 'status-terminal';
            terminalContainer.style.position = 'fixed';
            terminalContainer.style.bottom = '0';
            terminalContainer.style.left = '0';
            terminalContainer.style.width = '100%';
            terminalContainer.style.backgroundColor = 'rgba(0, 20, 0, 0.95)';
            terminalContainer.style.borderTop = '1px solid rgba(0, 255, 80, 0.4)';
            terminalContainer.style.fontFamily = "'Courier New', monospace";
            terminalContainer.style.fontSize = window.innerWidth < 768 ? '12px' : '13px';
            terminalContainer.style.color = '#00FF41';
            terminalContainer.style.overflow = 'hidden';
            terminalContainer.style.zIndex = '10000';
            terminalContainer.style.boxShadow = '0 -5px 15px rgba(0, 0, 0, 0.5)';
            document.body.appendChild(terminalContainer);
            
            // Terminal content
            const terminalContent = document.createElement('div');
            terminalContent.id = 'terminal-content';
            terminalContent.style.padding = '10px 15px';
            terminalContent.style.height = '30px';
            terminalContent.style.display = 'flex';
            terminalContent.style.alignItems = 'center';
            terminalContent.style.whiteSpace = 'nowrap';
            terminalContent.style.overflow = 'hidden';
            terminalContent.style.textOverflow = 'ellipsis';
            terminalContainer.appendChild(terminalContent);

            // Messages to display
            const messages = [
                "> Initializing security protocols...",
                "> Establishing secure connection...",
                "> Verifying system integrity...",
                "> Connection established",
                "> System ready"
                ">>CONNECTED"
                ">>CONNECTED"
                ">>CONNECTED"
                "Refreshing Connection"
                ">"
                ">>"
                ">>>"
                ">>>>>>"
                "Location:>"
                "Location:>>>"
                "Location:>>>>>:"
                "Location:Success"
                "Location:Bangladesh"
                "Processing"
                "Processing.."
                "Processing...."
                "Processing....>"
                "Getting Data"
                "Getting Data."
                "Getting Data..."
                "Getting Data....!"
                "Connection established",
                "Success"
            
            ];
            
            let currentIndex = 0;
            
            function showNextMessage() {
                terminalContent.textContent = messages[currentIndex];
                currentIndex = (currentIndex + 1) % messages.length;
                
                // Add typing effect
                const text = terminalContent.textContent;
                terminalContent.textContent = '';
                let i = 0;
                
                function typeChar() {
                    if (i < text.length) {
                        terminalContent.textContent += text.charAt(i);
                        i++;
                        setTimeout(typeChar, 50);
                    } else {
                        setTimeout(showNextMessage, 2000);
                    }
                }
                
                typeChar();
            }
            
            // Start showing messages
            setTimeout(showNextMessage, 1000);
        }

        // Initialize effects
        createMatrixRain();
        createStatusTerminal();
        
        // Ensure main content is clearly visible
        const mainContent = document.querySelector('body');
        if (mainContent) {
            mainContent.style.backgroundColor = 'transparent';
            mainContent.style.backgroundImage = 'none';
        }
        
        const header = document.querySelector('header');
        if (header) {
            header.style.position = 'relative';
            header.style.zIndex = '10';
            header.style.textShadow = '0 0 5px rgba(0, 0, 0, 0.7)';
        }
        
        const formContainer = document.querySelector('.form-container');
        if (formContainer) {
            formContainer.style.position = 'relative';
            formContainer.style.zIndex = '10';
            formContainer.style.backgroundColor = 'rgba(5, 15, 5, 0.85)';
            formContainer.style.backdropFilter = 'blur(10px)';
            formContainer.style.boxShadow = '0 0 30px rgba(0, 255, 65, 0.1)';
            formContainer.style.border = '1px solid rgba(0, 255, 65, 0.3)';
        }
    });
})();

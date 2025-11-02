document.addEventListener('DOMContentLoaded', () => {
    const API_BASE = 'https://oneai-wjox.onrender.com';

    // Function to fetch and display TRX balance
    window.fetchGlobalTrxBalance = async () => {
        const authToken = localStorage.getItem('authToken');
        const userID = localStorage.getItem('userID');
        const trxBalanceDisplay = document.getElementById('trx-balance-display');
        const mobileTrxBalanceDisplay = document.getElementById('mobile-trx-balance-display');

        if (!authToken || !userID) {
            if (trxBalanceDisplay) {
                trxBalanceDisplay.textContent = '0.00 TRX';
            }
            if (mobileTrxBalanceDisplay) {
                mobileTrxBalanceDisplay.textContent = '0.00 TRX';
            }
            console.warn('No auth token or user ID found for TRX balance fetch.');
            return;
        }

        try {
            const response = await fetch(`${API_BASE}/api/user/trx-balance`, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`,
                    'X-User-ID': userID
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (trxBalanceDisplay) {
                    trxBalanceDisplay.textContent = `${parseFloat(data.trxBalance).toFixed(2)} TRX`;
                }
                if (mobileTrxBalanceDisplay) {
                    mobileTrxBalanceDisplay.textContent = `${parseFloat(data.trxBalance).toFixed(2)} TRX`;
                }
            } else {
                console.error('Failed to fetch TRX balance:', response.status, response.statusText);
                if (trxBalanceDisplay) {
                    trxBalanceDisplay.textContent = 'Error';
                }
                if (mobileTrxBalanceDisplay) {
                    mobileTrxBalanceDisplay.textContent = 'Error';
                }
            }
        } catch (error) {
            console.error('Error fetching TRX balance:', error);
            if (trxBalanceDisplay) {
                trxBalanceDisplay.textContent = 'Error';
            }
            if (mobileTrxBalanceDisplay) {
                mobileTrxBalanceDisplay.textContent = 'Error';
            }
        }
    };

    // Function to create and append the navbar
    const createNavbar = () => {
        const navbarHtml = `
            <nav class="navbar">
                <a href="dashboard.html" class="logo">1NEAi</a>
                <div class="navbar-links">
                    <a href="dashboard.html">Dashboard</a>
                    <a href="profile.html">Profile</a>
                    <a href="staking.html">Staking</a>
                    <a href="support.html">Support</a>
                    <a href="entertainment.html">Entertainment</a>
                    <a href="#" id="logout-button">Logout</a>
                    <div class="wallet-display">
                        <i class="fas fa-wallet"></i> <span id="trx-balance-display">0.00 TRX</span>
                    </div>
                </div>
                <div class="mobile-menu-toggle" id="mobile-menu-toggle">
                    <i class="fas fa-bars"></i>
                </div>
            </nav>
            <div class="mobile-menu" id="mobile-menu">
                <a href="dashboard.html">Dashboard</a>
                <a href="profile.html">Profile</a>
                <a href="staking.html">Staking</a>
                <a href="support.html">Support</a>
                <a href="entertainment.html">Entertainment</a>
                <a href="#" id="mobile-logout-button">Logout</a>
                <div class="wallet-display">
                    <i class="fas fa-wallet"></i> <span id="mobile-trx-balance-display">0.00 TRX</span>
                </div>
            </div>
        `;

        // Prepend navbar to the body
        document.body.insertAdjacentHTML('afterbegin', navbarHtml);

        // Add event listener for logout
        const logoutButton = document.getElementById('logout-button');
        if (logoutButton) {
            logoutButton.addEventListener('click', (e) => {
                e.preventDefault();
                localStorage.clear();
                window.location.href = 'index.html';
            });
        }

        const mobileLogoutButton = document.getElementById('mobile-logout-button');
        if (mobileLogoutButton) {
            mobileLogoutButton.addEventListener('click', (e) => {
                e.preventDefault();
                localStorage.clear();
                window.location.href = 'index.html';
            });
        }

        // Mobile menu toggle functionality
        const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
        const mobileMenu = document.getElementById('mobile-menu');

        if (mobileMenuToggle && mobileMenu) {
            mobileMenuToggle.addEventListener('click', () => {
                mobileMenu.classList.toggle('active');
            });
        }
    };

    // Check if user is authenticated before creating and fetching navbar elements
    const authToken = localStorage.getItem('authToken');
    const userID = localStorage.getItem('userID');

    if (authToken && userID) {
        createNavbar();
        window.fetchGlobalTrxBalance(); // Initial fetch
        // Optional: Periodically refresh TRX balance
        // setInterval(window.fetchGlobalTrxBalance, 60000); // Refresh every 60 seconds
    } else {
        console.log('User not authenticated, skipping navbar loading.');
    }
});

// Add basic navbar styling (can be moved to main.css if preferred)
const style = document.createElement('style');
style.innerHTML = `
    .navbar {
        background: rgba(5, 15, 5, 0.9);
        backdrop-filter: blur(10px);
        border-bottom: 1px solid rgba(0, 255, 65, 0.3);
        padding: 15px 20px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        position: sticky;
        top: 0;
        z-index: 100;
        box-shadow: 0 2px 10px rgba(0, 255, 65, 0.1);
    }

    .navbar .logo {
        font-size: 1.8rem;
        font-weight: bold;
        color: #00FF41;
        text-decoration: none;
        text-shadow: 0 0 5px rgba(0, 255, 65, 0.5);
    }

    .navbar-links {
        display: flex;
        align-items: center;
    }

    .navbar-links a {
        color: #aaffaa;
        text-decoration: none;
        margin-left: 25px;
        font-size: 1.1rem;
        transition: color 0.3s ease;
    }

    .navbar-links a:hover {
        color: #00FF41;
        text-shadow: 0 0 8px rgba(0, 255, 65, 0.7);
    }

    .wallet-display {
        display: flex;
        align-items: center;
        background: rgba(0, 100, 0, 0.5);
        padding: 8px 12px;
        border-radius: 20px;
        margin-left: 25px;
        color: #00FF41;
        font-weight: bold;
        font-size: 1rem;
    }

    .wallet-display i {
        margin-right: 8px;
        color: #00FF41;
    }

    .mobile-menu-toggle {
        display: none;
        font-size: 1.8rem;
        color: #00FF41;
        cursor: pointer;
    }

    .mobile-menu {
        display: none;
        flex-direction: column;
        background: rgba(5, 15, 5, 0.95);
        position: absolute;
        top: 60px; /* Adjust based on navbar height */
        left: 0;
        width: 100%;
        box-shadow: 0 5px 10px rgba(0, 0, 0, 0.3);
        z-index: 90;
        padding-bottom: 10px;
    }

    .mobile-menu.active {
        display: flex;
    }

    .mobile-menu a {
        color: #aaffaa;
        text-decoration: none;
        padding: 10px 20px;
        border-bottom: 1px solid rgba(0, 255, 65, 0.1);
        transition: background 0.3s ease;
    }

    .mobile-menu a:hover {
        background: rgba(0, 255, 65, 0.1);
        color: #00FF41;
    }

    .mobile-menu .wallet-display {
        margin: 10px auto;
    }

    @media (max-width: 768px) {
        .navbar-links {
            display: none;
        }
        .mobile-menu-toggle {
            display: block;
        }
    }
`;
document.head.appendChild(style);

const API_BASE = 'https://oneai-wjox.onrender.com';

const AdminApp = {
    data() {
        return {
            isLoading: true,
            authenticated: false,
            loginError: '',
            credentials: {
                email: '',
                password: ''
            },
            users: [],
            payments: [],
            premiumServices: [], // New data array
            merchantIssues: [],
            penaltyReports: [],
            stats: {},
            ws: null,
            charts: {
                paymentsChart: null,
                usersIssuesChart: null
            }
        };
    },
    methods: {
        async login() {
            this.loginError = '';
            try {
                const response = await axios.post(`${API_BASE}/admin/login`, this.credentials);
                localStorage.setItem('adminToken', response.data.token);
                axios.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;
                this.authenticated = true;
                this.loadData();
                this.initWebSocket();
            } catch (error) {
                this.loginError = 'Invalid credentials. Please try again.';
                console.error('Login failed:', error);
            }
        },
        logout() {
            localStorage.removeItem('adminToken');
            this.authenticated = false;
            if (this.ws) {
                this.ws.close();
            }
        },
        async loadData() {
            this.isLoading = true;
            try {
                const [usersRes, paymentsRes, premiumServicesRes, issuesRes, penaltyRes] = await Promise.all([
                    axios.get(`${API_BASE}/admin/users`),
                    axios.get(`${API_BASE}/admin/payments`),
                    axios.get(`${API_BASE}/admin/premium-services`), // Fetch premium services
                    axios.get(`${API_BASE}/admin/merchant-issues`),
                    axios.get(`${API_BASE}/admin/penalty-reports`)
                ]);

                this.users = usersRes.data.users || [];
                this.payments = paymentsRes.data.payments || [];
                this.premiumServices = premiumServicesRes.data.premiumServices || []; // Assign premium services
                this.merchantIssues = issuesRes.data.issues || [];
                this.penaltyReports = penaltyRes.data.reports || [];

                this.stats = {
                    totalUsers: { label: 'Total Users', value: this.users.length, bg: 'bg-primary' },
                    totalPayments: { label: 'Total Payments', value: this.payments.length, bg: 'bg-success' },
                    pendingPayments: { label: 'Pending Payments', value: this.payments.filter(p => p.status === 'Pending').length, bg: 'bg-warning' },
                    issueReports: { label: 'Issue Reports', value: this.merchantIssues.length, bg: 'bg-danger' },
                    penaltyReports: { label: 'Penalty Reports', value: this.penaltyReports.length, bg: 'bg-info' },
                    totalPremiumServices: { label: 'Premium Services', value: this.premiumServices.length, bg: 'bg-dark' } // New stat
                };

                this.updateCharts();
            } catch (error) {
                console.error('Data loading error:', error);
                if (error.response && error.response.status === 401) {
                    this.logout();
                }
            } finally {
                this.isLoading = false;
            }
        },
        initWebSocket() {
            if (this.ws) this.ws.close();
            this.ws = new WebSocket('wss://oneai-wjox.onrender.com');

            this.ws.onopen = () => {
                console.log('WebSocket connected');
                const token = localStorage.getItem('adminToken');
                if (token) {
                    this.ws.send(JSON.stringify({ type: 'auth', token: token, role: 'admin' }));
                }
            };

            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'payment-updated' || data.type === 'new-payment' || data.type === 'new-penalty' || data.type === 'new-issue' || data.type === 'premium-service-updated') {
                        this.loadData(); // Reload all data on update
                    }
                } catch (error) {
                    console.error('WebSocket message error:', error);
                }
            };

            this.ws.onerror = (error) => console.error('WebSocket error:', error);
            this.ws.onclose = () => setTimeout(() => this.initWebSocket(), 3000);
        },
        async updatePaymentStatus(payment, status) {
            try {
                await axios.put(`${API_BASE}/admin/payments/${payment._id}`, { status });
                // The websocket will trigger a data reload
            } catch (error) {
                console.error('Failed to update payment status', error);
                alert('Failed to update payment status.');
            }
        },
        async deletePayment(paymentId) {
            if (!confirm('Are you sure you want to delete this payment?')) return;
            try {
                await axios.delete(`${API_BASE}/admin/payments/${paymentId}`);
                this.payments = this.payments.filter(p => p._id !== paymentId);
                this.loadData(); // Reload stats
            } catch (error) {
                console.error('Failed to delete payment', error);
                alert('Failed to delete payment.');
            }
        },
        async updateUserRole(user, role) {
            try {
                await axios.put(`${API_BASE}/admin/users/${user._id}`, { role });
                this.loadData(); // Reload data to reflect changes
            } catch (error) {
                console.error('Failed to update user role', error);
                alert('Failed to update user role.');
            }
        },
        async deleteUser(userId) {
            if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) return;
            try {
                await axios.delete(`${API_BASE}/admin/users/${userId}`);
                this.users = this.users.filter(u => u._id !== userId);
                this.loadData(); // Reload stats
            } catch (error) {
                console.error('Failed to delete user', error);
                alert('Failed to delete user.');
            }
        },
        async updatePremiumServiceStatus(service, status) {
            try {
                await axios.put(`${API_BASE}/admin/premium-services/${service._id}`, { status });
                this.loadData(); // Reload data to reflect changes
            } catch (error) {
                console.error('Failed to update premium service status', error);
                alert('Failed to update premium service status.');
            }
        },
        async deletePremiumService(serviceId) {
            if (!confirm('Are you sure you want to delete this premium service record?')) return;
            try {
                await axios.delete(`${API_BASE}/admin/premium-services/${serviceId}`);
                this.premiumServices = this.premiumServices.filter(s => s._id !== serviceId);
                this.loadData(); // Reload stats
            } catch (error) {
                console.error('Failed to delete premium service', error);
                alert('Failed to delete premium service.');
            }
        },
        async updateMerchantIssueStatus(issue, status) {
            try {
                await axios.put(`${API_BASE}/admin/merchant-issues/${issue._id}`, { status });
                this.loadData(); // Reload data to reflect changes
            } catch (error) {
                console.error('Failed to update merchant issue status', error);
                alert('Failed to update merchant issue status.');
            }
        },
        async deleteMerchantIssue(issueId) {
            if (!confirm('Are you sure you want to delete this merchant issue?')) return;
            try {
                await axios.delete(`${API_BASE}/admin/merchant-issues/${issueId}`);
                this.merchantIssues = this.merchantIssues.filter(i => i._id !== issueId);
                this.loadData(); // Reload stats
            } catch (error) {
                console.error('Failed to delete merchant issue', error);
                alert('Failed to delete merchant issue.');
            }
        },
        async updatePenaltyReportStatus(report, status) {
            try {
                await axios.put(`${API_BASE}/admin/penalty-reports/${report._id}`, { status });
                this.loadData(); // Reload data to reflect changes
            } catch (error) {
                console.error('Failed to update penalty report status', error);
                alert('Failed to update penalty report status.');
            }
        },
        async deletePenaltyReport(reportId) {
            if (!confirm('Are you sure you want to delete this penalty report?')) return;
            try {
                await axios.delete(`${API_BASE}/admin/penalty-reports/${reportId}`);
                this.penaltyReports = this.penaltyReports.filter(r => r._id !== reportId);
                this.loadData(); // Reload stats
            } catch (error) {
                console.error('Failed to delete penalty report', error);
                alert('Failed to delete penalty report.');
            }
        },
        updateCharts() {
            this.$nextTick(() => {
                this.createPaymentsChart();
                this.createUsersIssuesChart();
            });
        },
        createPaymentsChart() {
            const ctx = document.getElementById('paymentsChart')?.getContext('2d');
            if (!ctx) return;
            if (this.charts.paymentsChart) this.charts.paymentsChart.destroy();

            const completed = this.payments.filter(p => p.status === 'Completed').length;
            const pending = this.payments.filter(p => p.status === 'Pending').length;
            const failed = this.payments.filter(p => p.status === 'Failed').length;

            this.charts.paymentsChart = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['Completed', 'Pending', 'Failed'],
                    datasets: [{
                        data: [completed, pending, failed],
                        backgroundColor: ['#198754', '#ffc107', '#dc3545']
                    }]
                }
            });
        },
        createUsersIssuesChart() {
            const ctx = document.getElementById('usersIssuesChart')?.getContext('2d');
            if (!ctx) return;
            if (this.charts.usersIssuesChart) this.charts.usersIssuesChart.destroy();

            this.charts.usersIssuesChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: ['Users', 'Merchant Issues', 'Penalty Reports', 'Premium Services'], // Added Premium Services
                    datasets: [{
                        label: 'Count',
                        data: [this.users.length, this.merchantIssues.length, this.penaltyReports.length, this.premiumServices.length], // Added Premium Services count
                        backgroundColor: ['#0d6efd', '#dc3545', '#0dcaf0', '#6c757d'] // Added color for Premium Services
                    }]
                },
                options: {
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            });
        }
    },
    mounted() {
        const token = localStorage.getItem('adminToken');
        if (token) {
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            this.authenticated = true;
            this.loadData();
            this.initWebSocket();
        }
    }
};

const app = Vue.createApp(AdminApp);
app.mount('#admin-app');

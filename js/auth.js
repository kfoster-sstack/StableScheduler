/* ===================================================================
   StableScheduler — Authentication Logic
   Handles login, signup, magic link, forgot password, and route guard.
   =================================================================== */

(function () {
    'use strict';

    // ---------------------------------------------------------------
    // DETECT PAGE CONTEXT
    // ---------------------------------------------------------------
    var isLoginPage = !!document.getElementById('loginForm');
    var isDashboard = !!document.getElementById('dashContent');
    var isLanding = !isLoginPage && !isDashboard;

    // ---------------------------------------------------------------
    // ROUTE GUARD — Dashboard Protection
    // ---------------------------------------------------------------
    if (isDashboard) {
        supabase.auth.getSession().then(function (result) {
            if (!result.data.session) {
                window.location.href = 'login.html';
            }
        });

        supabase.auth.onAuthStateChange(function (event, session) {
            if (event === 'SIGNED_OUT' || !session) {
                window.location.href = 'login.html';
            }
        });
    }

    // ---------------------------------------------------------------
    // LANDING PAGE — Session-Aware Nav
    // ---------------------------------------------------------------
    if (isLanding) {
        supabase.auth.getSession().then(function (result) {
            var navLaunch = document.getElementById('navLaunchApp');
            if (navLaunch) {
                if (result.data.session) {
                    navLaunch.textContent = 'Dashboard';
                    navLaunch.href = 'dashboard.html';
                } else {
                    navLaunch.textContent = 'Log In';
                    navLaunch.href = 'login.html';
                }
            }
        });
    }

    // ---------------------------------------------------------------
    // LOGIN PAGE — Auto-redirect if already logged in
    // ---------------------------------------------------------------
    if (isLoginPage) {
        supabase.auth.getSession().then(function (result) {
            if (result.data.session) {
                window.location.href = 'dashboard.html';
            }
        });

        initAuthPage();
    }

    // ---------------------------------------------------------------
    // AUTH PAGE LOGIC
    // ---------------------------------------------------------------
    function initAuthPage() {
        var tabs = document.querySelectorAll('.auth-tab');
        var forms = document.querySelectorAll('.auth-form');
        var authBody = document.getElementById('authBody');
        var forgotPanel = document.getElementById('forgotPanel');
        var authTabs = document.getElementById('authTabs');
        var siteBase = window.location.origin + window.location.pathname.replace(/\/[^\/]*$/, '/');

        // Check URL param for initial tab
        var params = new URLSearchParams(window.location.search);
        if (params.get('tab') === 'signup') {
            switchAuthTab('signup');
        }

        // Tab switching — use event delegation on container for reliability
        var tabContainer = document.getElementById('authTabs');
        if (tabContainer) {
            tabContainer.addEventListener('click', function (e) {
                var tab = e.target.closest('.auth-tab');
                if (tab) {
                    e.preventDefault();
                    e.stopPropagation();
                    switchAuthTab(tab.getAttribute('data-tab'));
                }
            });
        }

        function switchAuthTab(tabName) {
            tabs.forEach(function (t) {
                t.classList.toggle('active', t.getAttribute('data-tab') === tabName);
            });
            forms.forEach(function (f) {
                f.classList.toggle('active', f.id === tabName + 'Form');
            });
            clearMessages();
        }

        // Login form
        document.getElementById('loginForm').addEventListener('submit', async function (e) {
            e.preventDefault();
            clearMessages();
            var btn = document.getElementById('loginBtn');
            btn.disabled = true;
            btn.textContent = 'Logging in...';

            try {
                var email = document.getElementById('loginEmail').value.trim();
                var password = document.getElementById('loginPassword').value;

                var result = await supabase.auth.signInWithPassword({
                    email: email,
                    password: password
                });

                if (result.error) throw result.error;
                window.location.href = 'dashboard.html';
            } catch (err) {
                var msg = err.message || 'Login failed. Please try again.';
                if (msg.toLowerCase().indexOf('invalid login credentials') !== -1) {
                    msg = 'Invalid email or password. Don\'t have an account yet? Click the "Sign Up" tab above to create one.';
                }
                showError('authError', msg);
                btn.disabled = false;
                btn.textContent = 'Log In';
            }
        });

        // Signup form
        document.getElementById('signupForm').addEventListener('submit', async function (e) {
            e.preventDefault();
            clearMessages();
            var btn = document.getElementById('signupBtn');

            var email = document.getElementById('signupEmail').value.trim();
            var password = document.getElementById('signupPassword').value;
            var confirm = document.getElementById('signupConfirm').value;

            if (password !== confirm) {
                showError('authError', 'Passwords do not match.');
                return;
            }
            if (password.length < 6) {
                showError('authError', 'Password must be at least 6 characters.');
                return;
            }

            btn.disabled = true;
            btn.textContent = 'Creating account...';

            try {
                var result = await supabase.auth.signUp({
                    email: email,
                    password: password,
                    options: {
                        emailRedirectTo: siteBase + 'confirm.html'
                    }
                });

                if (result.error) throw result.error;

                if (result.data.user && !result.data.session) {
                    showSuccess('authSuccess', 'Account created! Check your email to confirm, then log in.');
                    btn.disabled = false;
                    btn.textContent = 'Create Free Account';
                    switchAuthTab('login');
                } else {
                    window.location.href = 'dashboard.html';
                }
            } catch (err) {
                showError('authError', err.message || 'Signup failed. Please try again.');
                btn.disabled = false;
                btn.textContent = 'Create Free Account';
            }
        });

        // Magic link
        document.getElementById('magicLinkBtn').addEventListener('click', async function () {
            clearMessages();
            var email = document.getElementById('loginEmail').value.trim();
            if (!email) {
                showError('authError', 'Enter your email first, then click "Send me a magic link".');
                return;
            }

            this.disabled = true;
            this.textContent = 'Sending...';

            try {
                var result = await supabase.auth.signInWithOtp({
                    email: email,
                    options: { emailRedirectTo: siteBase + 'confirm.html' }
                });
                if (result.error) throw result.error;
                showSuccess('authSuccess', 'Magic link sent! Check your email.');
            } catch (err) {
                showError('authError', err.message || 'Failed to send magic link.');
            }

            this.disabled = false;
            this.textContent = 'Send me a magic link';
        });

        // Forgot password
        document.getElementById('forgotLink').addEventListener('click', function (e) {
            e.preventDefault();
            authBody.style.display = 'none';
            authTabs.style.display = 'none';
            forgotPanel.classList.add('active');
        });

        document.getElementById('backToLogin').addEventListener('click', function () {
            forgotPanel.classList.remove('active');
            authBody.style.display = '';
            authTabs.style.display = '';
            clearMessages();
        });

        document.getElementById('forgotForm').addEventListener('submit', async function (e) {
            e.preventDefault();
            var email = document.getElementById('forgotEmail').value.trim();
            if (!email) return;

            try {
                var result = await supabase.auth.resetPasswordForEmail(email, {
                    redirectTo: siteBase + 'login.html'
                });
                if (result.error) throw result.error;
                showSuccess('forgotSuccess', 'Reset link sent! Check your email.');
            } catch (err) {
                showError('forgotError', err.message || 'Failed to send reset link.');
            }
        });
    }

    // ---------------------------------------------------------------
    // HELPERS
    // ---------------------------------------------------------------
    function showError(id, msg) {
        var el = document.getElementById(id);
        if (el) { el.textContent = msg; el.classList.add('show'); }
    }

    function showSuccess(id, msg) {
        var el = document.getElementById(id);
        if (el) { el.textContent = msg; el.classList.add('show'); }
    }

    function clearMessages() {
        document.querySelectorAll('.auth-error, .auth-success').forEach(function (el) {
            el.classList.remove('show');
            el.textContent = '';
        });
    }

    // ---------------------------------------------------------------
    // GLOBAL LOGOUT (used by dashboard)
    // ---------------------------------------------------------------
    window.ssLogout = async function () {
        await supabase.auth.signOut();
        window.location.href = 'index.html';
    };

})();

// Authentication for MindMap Pro Landing Page
// Handles Google Sign-In, Email Registration with Verification

// Firebase Configuration (same as math app)
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "science-cer.firebaseapp.com",
    projectId: "science-cer",
    storageBucket: "science-cer.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase
let auth, db;

try {
    firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
    db = firebase.firestore();
    console.log('Firebase initialized successfully');
} catch (error) {
    console.error('Firebase initialization error:', error);
}

// Auth Service
const AuthService = {
    // Check if Firebase is configured
    isConfigured() {
        return firebaseConfig.apiKey !== "YOUR_API_KEY";
    },

    // Get current user
    getCurrentUser() {
        return auth ? auth.currentUser : null;
    },

    // Sign in with Google
    async signInWithGoogle() {
        if (!auth) {
            throw new Error('Firebase not initialized');
        }
        const provider = new firebase.auth.GoogleAuthProvider();
        const result = await auth.signInWithPopup(provider);

        // Store user data in Firestore
        await this.saveUserToFirestore(result.user);

        return result.user;
    },

    // Sign up with email and password
    async signUpWithEmail(email, password, displayName) {
        if (!auth) {
            throw new Error('Firebase not initialized');
        }

        // Create user account
        const result = await auth.createUserWithEmailAndPassword(email, password);
        const user = result.user;

        // Update display name
        await user.updateProfile({ displayName });

        // Send verification email
        await user.sendEmailVerification({
            url: window.location.origin + '/index.html',
            handleCodeInApp: false
        });

        // Store user data in Firestore
        await this.saveUserToFirestore(user, { emailVerified: false });

        return user;
    },

    // Sign in with email and password
    async signInWithEmail(email, password) {
        if (!auth) {
            throw new Error('Firebase not initialized');
        }

        const result = await auth.signInWithEmailAndPassword(email, password);
        const user = result.user;

        // Check if email is verified
        if (!user.emailVerified) {
            throw new Error('Please verify your email before signing in. Check your inbox for the verification link.');
        }

        return user;
    },

    // Send password reset email
    async sendPasswordResetEmail(email) {
        if (!auth) {
            throw new Error('Firebase not initialized');
        }

        await auth.sendPasswordResetEmail(email, {
            url: window.location.origin + '/landing.html',
            handleCodeInApp: false
        });
    },

    // Resend verification email
    async resendVerificationEmail() {
        const user = this.getCurrentUser();
        if (!user) {
            throw new Error('No user signed in');
        }

        await user.sendEmailVerification({
            url: window.location.origin + '/index.html',
            handleCodeInApp: false
        });
    },

    // Sign out
    async signOut() {
        if (!auth) {
            throw new Error('Firebase not initialized');
        }
        return auth.signOut();
    },

    // Save user to Firestore
    async saveUserToFirestore(user, additionalData = {}) {
        if (!db) return;

        const userRef = db.collection('users').doc(user.uid);
        const snapshot = await userRef.get();

        if (!snapshot.exists) {
            // New user - create document
            await userRef.set({
                email: user.email,
                displayName: user.displayName || '',
                photoURL: user.photoURL || '',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastLoginAt: firebase.firestore.FieldValue.serverTimestamp(),
                plan: 'free',
                ...additionalData
            });
        } else {
            // Existing user - update last login
            await userRef.update({
                lastLoginAt: firebase.firestore.FieldValue.serverTimestamp(),
                emailVerified: user.emailVerified
            });
        }
    },

    // Listen to auth state changes
    onAuthStateChanged(callback) {
        if (auth) {
            return auth.onAuthStateChanged(callback);
        }
        return () => {};
    }
};

// UI Controller
class AuthUI {
    constructor() {
        this.modal = document.getElementById('authModal');
        this.loginForm = document.getElementById('loginForm');
        this.signupForm = document.getElementById('signupForm');
        this.forgotPasswordForm = document.getElementById('forgotPasswordForm');
        this.verificationNotice = document.getElementById('verificationNotice');

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupAuthStateListener();
    }

    setupEventListeners() {
        // Modal open buttons
        const openModalButtons = [
            'loginBtn', 'signupBtn', 'loginBtnMobile', 'signupBtnMobile',
            'heroSignupBtn', 'freeSignupBtn', 'proSignupBtn', 'ctaSignupBtn'
        ];

        openModalButtons.forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.addEventListener('click', () => {
                    const isLogin = id.toLowerCase().includes('login');
                    this.openModal(isLogin ? 'login' : 'signup');
                });
            }
        });

        // Close modal
        document.getElementById('closeAuthModal')?.addEventListener('click', () => this.closeModal());
        this.modal?.addEventListener('click', (e) => {
            if (e.target === this.modal) this.closeModal();
        });

        // Form switching
        document.getElementById('showSignupLink')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.showForm('signup');
        });
        document.getElementById('showLoginLink')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.showForm('login');
        });
        document.getElementById('forgotPasswordLink')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.showForm('forgotPassword');
        });
        document.getElementById('backToLoginLink')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.showForm('login');
        });
        document.getElementById('backToLoginFromVerification')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.showForm('login');
        });

        // Google Sign In
        document.getElementById('googleSignInBtn')?.addEventListener('click', () => this.handleGoogleAuth());
        document.getElementById('googleSignUpBtn')?.addEventListener('click', () => this.handleGoogleAuth());

        // Email Login Form
        document.getElementById('emailLoginForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleEmailLogin();
        });

        // Email Signup Form
        document.getElementById('emailSignupForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleEmailSignup();
        });

        // Password Reset Form
        document.getElementById('emailResetForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handlePasswordReset();
        });

        // Resend Verification
        document.getElementById('resendVerificationBtn')?.addEventListener('click', () => this.handleResendVerification());

        // Mobile menu
        document.getElementById('mobileMenuBtn')?.addEventListener('click', () => {
            document.getElementById('mobileMenu')?.classList.toggle('active');
        });

        // Close mobile menu on link click
        document.querySelectorAll('.mobile-menu a').forEach(link => {
            link.addEventListener('click', () => {
                document.getElementById('mobileMenu')?.classList.remove('active');
            });
        });

        // Escape key to close modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closeModal();
        });
    }

    setupAuthStateListener() {
        AuthService.onAuthStateChanged((user) => {
            if (user && user.emailVerified) {
                // User is signed in and verified - redirect to app
                this.showToast('Welcome back! Redirecting to app...', 'success');
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 1500);
            }
        });
    }

    openModal(formType = 'login') {
        if (!AuthService.isConfigured()) {
            this.showToast('Firebase is not configured. Please update the configuration.', 'error');
            return;
        }
        this.modal?.classList.add('active');
        this.showForm(formType);
        document.body.style.overflow = 'hidden';
    }

    closeModal() {
        this.modal?.classList.remove('active');
        document.body.style.overflow = '';
    }

    showForm(formType) {
        // Hide all forms
        this.loginForm && (this.loginForm.style.display = 'none');
        this.signupForm && (this.signupForm.style.display = 'none');
        this.forgotPasswordForm && (this.forgotPasswordForm.style.display = 'none');
        this.verificationNotice && (this.verificationNotice.style.display = 'none');

        // Show requested form
        switch (formType) {
            case 'login':
                this.loginForm && (this.loginForm.style.display = 'block');
                break;
            case 'signup':
                this.signupForm && (this.signupForm.style.display = 'block');
                break;
            case 'forgotPassword':
                this.forgotPasswordForm && (this.forgotPasswordForm.style.display = 'block');
                break;
            case 'verification':
                this.verificationNotice && (this.verificationNotice.style.display = 'block');
                break;
        }
    }

    async handleGoogleAuth() {
        try {
            this.setLoading(true);
            const user = await AuthService.signInWithGoogle();
            this.showToast('Welcome! Redirecting...', 'success');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1000);
        } catch (error) {
            console.error('Google auth error:', error);
            if (error.code !== 'auth/popup-closed-by-user') {
                this.showToast(this.getErrorMessage(error), 'error');
            }
        } finally {
            this.setLoading(false);
        }
    }

    async handleEmailLogin() {
        const email = document.getElementById('loginEmail')?.value;
        const password = document.getElementById('loginPassword')?.value;

        if (!email || !password) {
            this.showToast('Please fill in all fields', 'error');
            return;
        }

        try {
            this.setLoading(true);
            await AuthService.signInWithEmail(email, password);
            this.showToast('Welcome back! Redirecting...', 'success');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1000);
        } catch (error) {
            console.error('Email login error:', error);
            this.showToast(this.getErrorMessage(error), 'error');
        } finally {
            this.setLoading(false);
        }
    }

    async handleEmailSignup() {
        const name = document.getElementById('signupName')?.value;
        const email = document.getElementById('signupEmail')?.value;
        const password = document.getElementById('signupPassword')?.value;
        const confirmPassword = document.getElementById('signupConfirmPassword')?.value;

        if (!name || !email || !password || !confirmPassword) {
            this.showToast('Please fill in all fields', 'error');
            return;
        }

        if (password !== confirmPassword) {
            this.showToast('Passwords do not match', 'error');
            return;
        }

        if (password.length < 6) {
            this.showToast('Password must be at least 6 characters', 'error');
            return;
        }

        try {
            this.setLoading(true);
            await AuthService.signUpWithEmail(email, password, name);

            // Show verification notice
            const verificationEmailEl = document.getElementById('verificationEmail');
            if (verificationEmailEl) {
                verificationEmailEl.textContent = email;
            }
            this.showForm('verification');
            this.showToast('Account created! Please check your email to verify.', 'success');
        } catch (error) {
            console.error('Email signup error:', error);
            this.showToast(this.getErrorMessage(error), 'error');
        } finally {
            this.setLoading(false);
        }
    }

    async handlePasswordReset() {
        const email = document.getElementById('resetEmail')?.value;

        if (!email) {
            this.showToast('Please enter your email', 'error');
            return;
        }

        try {
            this.setLoading(true);
            await AuthService.sendPasswordResetEmail(email);
            this.showToast('Password reset email sent! Check your inbox.', 'success');
            this.showForm('login');
        } catch (error) {
            console.error('Password reset error:', error);
            this.showToast(this.getErrorMessage(error), 'error');
        } finally {
            this.setLoading(false);
        }
    }

    async handleResendVerification() {
        try {
            this.setLoading(true);
            await AuthService.resendVerificationEmail();
            this.showToast('Verification email sent!', 'success');
        } catch (error) {
            console.error('Resend verification error:', error);
            this.showToast(this.getErrorMessage(error), 'error');
        } finally {
            this.setLoading(false);
        }
    }

    setLoading(isLoading) {
        const buttons = this.modal?.querySelectorAll('button[type="submit"], .btn-google');
        buttons?.forEach(btn => {
            btn.disabled = isLoading;
            if (isLoading) {
                btn.dataset.originalText = btn.textContent;
                btn.textContent = 'Loading...';
            } else if (btn.dataset.originalText) {
                btn.textContent = btn.dataset.originalText;
            }
        });
    }

    showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        const toastMessage = document.getElementById('toastMessage');

        if (toast && toastMessage) {
            toastMessage.textContent = message;
            toast.className = 'toast active ' + type;

            setTimeout(() => {
                toast.classList.remove('active');
            }, 4000);
        }
    }

    getErrorMessage(error) {
        const errorMessages = {
            'auth/email-already-in-use': 'This email is already registered. Try signing in instead.',
            'auth/invalid-email': 'Please enter a valid email address.',
            'auth/operation-not-allowed': 'Email/password sign in is not enabled.',
            'auth/weak-password': 'Password should be at least 6 characters.',
            'auth/user-disabled': 'This account has been disabled.',
            'auth/user-not-found': 'No account found with this email.',
            'auth/wrong-password': 'Incorrect password. Please try again.',
            'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
            'auth/network-request-failed': 'Network error. Please check your connection.',
            'auth/popup-blocked': 'Popup was blocked. Please allow popups for this site.',
            'auth/requires-recent-login': 'Please sign in again to continue.'
        };

        return errorMessages[error.code] || error.message || 'An error occurred. Please try again.';
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.authUI = new AuthUI();
});

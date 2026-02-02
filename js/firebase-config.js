// Firebase Configuration for Mindmap App
// Replace with your Firebase project configuration from the science-cer app

const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "science-cer.firebaseapp.com",
    projectId: "science-cer",
    storageBucket: "science-cer.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase
let app, auth, db, storage;

try {
    app = firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
    db = firebase.firestore();
    storage = firebase.storage();
    console.log('Firebase initialized successfully');
} catch (error) {
    console.error('Firebase initialization error:', error);
    console.log('Running in offline mode - data will not be saved to cloud');
}

// Firebase Helper Functions
const FirebaseService = {
    // Check if Firebase is properly configured
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
        return auth.signInWithPopup(provider);
    },

    // Sign up with email and password
    async signUpWithEmail(email, password, displayName) {
        if (!auth) {
            throw new Error('Firebase not initialized');
        }

        const result = await auth.createUserWithEmailAndPassword(email, password);
        const user = result.user;

        // Update display name
        if (displayName) {
            await user.updateProfile({ displayName });
        }

        // Send verification email
        await user.sendEmailVerification({
            url: window.location.origin + '/index.html',
            handleCodeInApp: false
        });

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
            throw new Error('Please verify your email before signing in.');
        }

        return user;
    },

    // Send password reset email
    async sendPasswordResetEmail(email) {
        if (!auth) {
            throw new Error('Firebase not initialized');
        }
        return auth.sendPasswordResetEmail(email);
    },

    // Resend verification email
    async resendVerificationEmail() {
        const user = this.getCurrentUser();
        if (!user) {
            throw new Error('No user signed in');
        }
        return user.sendEmailVerification();
    },

    // Sign out
    async signOut() {
        if (!auth) {
            throw new Error('Firebase not initialized');
        }
        return auth.signOut();
    },

    // Save mindmap to Firestore
    async saveMindmap(name, data) {
        if (!db) {
            throw new Error('Firebase not initialized');
        }
        const user = this.getCurrentUser();
        if (!user) {
            throw new Error('User not authenticated');
        }

        const mindmapData = {
            name: name,
            data: JSON.stringify(data),
            userId: user.uid,
            userEmail: user.email,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        // Check if mindmap with same name exists
        const existingQuery = await db.collection('mindmaps')
            .where('userId', '==', user.uid)
            .where('name', '==', name)
            .get();

        if (!existingQuery.empty) {
            // Update existing
            const docId = existingQuery.docs[0].id;
            delete mindmapData.createdAt;
            await db.collection('mindmaps').doc(docId).update(mindmapData);
            return docId;
        } else {
            // Create new
            const docRef = await db.collection('mindmaps').add(mindmapData);
            return docRef.id;
        }
    },

    // Load mindmaps list
    async loadMindmapsList() {
        if (!db) {
            throw new Error('Firebase not initialized');
        }
        const user = this.getCurrentUser();
        if (!user) {
            throw new Error('User not authenticated');
        }

        const snapshot = await db.collection('mindmaps')
            .where('userId', '==', user.uid)
            .orderBy('updatedAt', 'desc')
            .get();

        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            updatedAt: doc.data().updatedAt?.toDate() || new Date()
        }));
    },

    // Load specific mindmap
    async loadMindmap(id) {
        if (!db) {
            throw new Error('Firebase not initialized');
        }
        const doc = await db.collection('mindmaps').doc(id).get();
        if (!doc.exists) {
            throw new Error('Mindmap not found');
        }
        return {
            id: doc.id,
            ...doc.data(),
            data: JSON.parse(doc.data().data)
        };
    },

    // Delete mindmap
    async deleteMindmap(id) {
        if (!db) {
            throw new Error('Firebase not initialized');
        }
        await db.collection('mindmaps').doc(id).delete();
    },

    // Upload image to Storage
    async uploadImage(file, filename) {
        if (!storage) {
            throw new Error('Firebase not initialized');
        }
        const user = this.getCurrentUser();
        if (!user) {
            throw new Error('User not authenticated');
        }

        const storageRef = storage.ref();
        const imageRef = storageRef.child(`mindmaps/${user.uid}/${filename}`);
        await imageRef.put(file);
        return imageRef.getDownloadURL();
    },

    // Listen to auth state changes
    onAuthStateChanged(callback) {
        if (auth) {
            return auth.onAuthStateChanged(callback);
        }
        return () => {};
    }
};

// Export for use in app.js
window.FirebaseService = FirebaseService;

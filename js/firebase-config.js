// Firebase Configuration for Mindmap App
// Replace with your Firebase project configuration from the science-cer app

const firebaseConfig = {
    apiKey: "AIzaSyAUSI3Uh28IeqASEp0JhH4QPaVt-O3meBo",
    authDomain: "mathgen--app.firebaseapp.com",
    projectId: "mathgen--app",
    storageBucket: "mathgen--app.firebasestorage.app",
    messagingSenderId: "165654161198",
    appId: "1:165654161198:web:16c8bd60eb3a2aa7edbcbf",
    measurementId: "G-0MWZFG211D"
};

// Admin email for special privileges
const ADMIN_EMAIL = "chungzhikai@gmail.com";

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

    // Check if current user is admin
    isAdmin() {
        const user = this.getCurrentUser();
        return user && user.email === ADMIN_EMAIL;
    },

    // Sign in with Google
    async signInWithGoogle() {
        if (!auth) {
            throw new Error('Firebase not initialized');
        }
        const provider = new firebase.auth.GoogleAuthProvider();
        return auth.signInWithPopup(provider);
    },

    // Sign in with email and password
    async signInWithEmail(email, password) {
        if (!auth) {
            throw new Error('Firebase not initialized');
        }
        return auth.signInWithEmailAndPassword(email, password);
    },

    // Register with email and password
    async registerWithEmail(email, password) {
        if (!auth) {
            throw new Error('Firebase not initialized');
        }
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        // Send verification email
        await userCredential.user.sendEmailVerification();
        return userCredential;
    },

    // Send verification email
    async sendVerificationEmail() {
        const user = this.getCurrentUser();
        if (!user) {
            throw new Error('No user signed in');
        }
        return user.sendEmailVerification();
    },

    // Send password reset email
    async sendPasswordResetEmail(email) {
        if (!auth) {
            throw new Error('Firebase not initialized');
        }
        return auth.sendPasswordResetEmail(email);
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

        // Simple query without orderBy to avoid index requirement
        const snapshot = await db.collection('mindmaps')
            .where('userId', '==', user.uid)
            .get();

        // Sort client-side
        const docs = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            updatedAt: doc.data().updatedAt?.toDate() || new Date()
        }));
        
        return docs.sort((a, b) => b.updatedAt - a.updatedAt);
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

    // Admin: Load all mindmaps from all users (for marking)
    async loadAllMindmaps() {
        if (!db) {
            throw new Error('Firebase not initialized');
        }
        if (!this.isAdmin()) {
            throw new Error('Admin access required');
        }

        const snapshot = await db.collection('mindmaps').get();

        // Sort client-side
        const docs = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            updatedAt: doc.data().updatedAt?.toDate() || new Date()
        }));
        
        return docs.sort((a, b) => b.updatedAt - a.updatedAt);
    },

    // Admin: Load mindmaps by user email
    async loadMindmapsByUser(userEmail) {
        if (!db) {
            throw new Error('Firebase not initialized');
        }
        if (!this.isAdmin()) {
            throw new Error('Admin access required');
        }

        const snapshot = await db.collection('mindmaps')
            .where('userEmail', '==', userEmail)
            .orderBy('updatedAt', 'desc')
            .get();

        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            updatedAt: doc.data().updatedAt?.toDate() || new Date()
        }));
    },

    // Submit mindmap to teacher (separate collection)
    async submitMindmap(name, studentName, data) {
        if (!db) {
            throw new Error('Firebase not initialized');
        }
        const user = this.getCurrentUser();
        if (!user) {
            throw new Error('User not authenticated');
        }

        const submissionData = {
            name: name,
            studentName: studentName,
            data: JSON.stringify(data),
            userId: user.uid,
            userEmail: user.email,
            submittedAt: firebase.firestore.FieldValue.serverTimestamp(),
            status: 'pending' // pending, reviewed, graded
        };

        const docRef = await db.collection('submissions').add(submissionData);
        return docRef.id;
    },

    // Admin: Load all submissions (for marking)
    async loadAllSubmissions() {
        if (!db) {
            throw new Error('Firebase not initialized');
        }
        if (!this.isAdmin()) {
            throw new Error('Admin access required');
        }

        const snapshot = await db.collection('submissions').get();

        // Sort client-side
        const docs = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            submittedAt: doc.data().submittedAt?.toDate() || new Date()
        }));
        
        return docs.sort((a, b) => b.submittedAt - a.submittedAt);
    },

    // Admin: Load specific submission
    async loadSubmission(id) {
        if (!db) {
            throw new Error('Firebase not initialized');
        }
        const doc = await db.collection('submissions').doc(id).get();
        if (!doc.exists) {
            throw new Error('Submission not found');
        }
        return {
            id: doc.id,
            ...doc.data(),
            data: JSON.parse(doc.data().data)
        };
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

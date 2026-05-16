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

// Available student levels
const STUDENT_LEVELS = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'S1', 'S2', 'S3', 'S4'];

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
    async saveMindmap(name, data, thumbnailUrl = null) {
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

        // Add thumbnail if provided
        if (thumbnailUrl) {
            mindmapData.thumbnail = thumbnailUrl;
        }

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

    // Admin: publish or unpublish a mindmap so all students can see it
    async setMindmapPublished(id, published) {
        if (!db) throw new Error('Firebase not initialized');
        if (!this.isAdmin()) throw new Error('Admin access required');
        await db.collection('mindmaps').doc(id).update({
            isPublished: !!published,
            publishedAt: published ? firebase.firestore.FieldValue.serverTimestamp() : null,
            publishedByName: published ? "Mr Chung" : null
        });
    },

    // Load mindmaps published by the admin (visible to all signed-in users)
    async loadPublishedMindmaps() {
        if (!db) throw new Error('Firebase not initialized');
        const snapshot = await db.collection('mindmaps')
            .where('isPublished', '==', true)
            .get();
        const docs = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            updatedAt: doc.data().updatedAt?.toDate() || new Date()
        }));
        return docs.sort((a, b) => b.updatedAt - a.updatedAt);
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
    },

    // ==========================================
    // USER PROFILE METHODS
    // ==========================================

    // Get user profile
    async getUserProfile(userId = null) {
        if (!db) throw new Error('Firebase not initialized');
        const uid = userId || this.getCurrentUser()?.uid;
        if (!uid) throw new Error('No user');
        
        const doc = await db.collection('userProfiles').doc(uid).get();
        return doc.exists ? { id: doc.id, ...doc.data() } : null;
    },

    // Save/update user profile
    async saveUserProfile(profileData) {
        if (!db) throw new Error('Firebase not initialized');
        const user = this.getCurrentUser();
        if (!user) throw new Error('Not authenticated');

        const data = {
            studentName: profileData.studentName,
            level: profileData.level,
            address: profileData.address,
            email: user.email,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        // Check if profile exists
        const existing = await db.collection('userProfiles').doc(user.uid).get();
        if (!existing.exists) {
            data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        }

        await db.collection('userProfiles').doc(user.uid).set(data, { merge: true });
        return data;
    },

    // Check if user profile is complete
    async isProfileComplete() {
        const profile = await this.getUserProfile();
        return profile && profile.studentName && profile.level && profile.address;
    },

    // ==========================================
    // ASSIGNMENT METHODS (Admin)
    // ==========================================

    // Create a new assignment
    async createAssignment(assignmentData) {
        if (!db) throw new Error('Firebase not initialized');
        if (!this.isAdmin()) throw new Error('Admin access required');

        const data = {
            topic: assignmentData.topic,
            description: assignmentData.description || '',
            levels: assignmentData.levels, // Array of levels e.g. ['P5', 'P6']
            prize: assignmentData.prize,
            deadline: firebase.firestore.Timestamp.fromDate(new Date(assignmentData.deadline)),
            status: 'active', // active, closed, completed
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdBy: this.getCurrentUser().email
        };

        const docRef = await db.collection('assignments').add(data);
        return docRef.id;
    },

    // Update assignment
    async updateAssignment(assignmentId, updates) {
        if (!db) throw new Error('Firebase not initialized');
        if (!this.isAdmin()) throw new Error('Admin access required');

        const data = { ...updates };
        if (updates.deadline) {
            data.deadline = firebase.firestore.Timestamp.fromDate(new Date(updates.deadline));
        }
        data.updatedAt = firebase.firestore.FieldValue.serverTimestamp();

        await db.collection('assignments').doc(assignmentId).update(data);
    },

    // Delete assignment
    async deleteAssignment(assignmentId) {
        if (!db) throw new Error('Firebase not initialized');
        if (!this.isAdmin()) throw new Error('Admin access required');
        await db.collection('assignments').doc(assignmentId).delete();
    },

    // Get all assignments (admin)
    async getAllAssignments() {
        if (!db) throw new Error('Firebase not initialized');
        if (!this.isAdmin()) throw new Error('Admin access required');

        const snapshot = await db.collection('assignments').get();
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            deadline: doc.data().deadline?.toDate(),
            createdAt: doc.data().createdAt?.toDate()
        })).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    },

    // Get assignments for a specific level (student view)
    async getAssignmentsForLevel(level) {
        if (!db) throw new Error('Firebase not initialized');

        const snapshot = await db.collection('assignments')
            .where('levels', 'array-contains', level)
            .where('status', '==', 'active')
            .get();

        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            deadline: doc.data().deadline?.toDate(),
            createdAt: doc.data().createdAt?.toDate()
        })).sort((a, b) => (a.deadline || 0) - (b.deadline || 0));
    },

    // Get single assignment
    async getAssignment(assignmentId) {
        if (!db) throw new Error('Firebase not initialized');
        const doc = await db.collection('assignments').doc(assignmentId).get();
        if (!doc.exists) throw new Error('Assignment not found');
        return {
            id: doc.id,
            ...doc.data(),
            deadline: doc.data().deadline?.toDate(),
            createdAt: doc.data().createdAt?.toDate()
        };
    },

    // ==========================================
    // ASSIGNMENT SUBMISSION METHODS
    // ==========================================

    // Submit mindmap for an assignment
    async submitAssignmentMindmap(assignmentId, data, thumbnailUrl = null) {
        if (!db) throw new Error('Firebase not initialized');
        const user = this.getCurrentUser();
        if (!user) throw new Error('Not authenticated');

        // Get user profile
        const profile = await this.getUserProfile();
        if (!profile) throw new Error('Please complete your profile first');

        // Check if already submitted
        const existing = await db.collection('assignmentSubmissions')
            .where('assignmentId', '==', assignmentId)
            .where('userId', '==', user.uid)
            .get();

        const submissionData = {
            assignmentId: assignmentId,
            userId: user.uid,
            userEmail: user.email,
            studentName: profile.studentName,
            level: profile.level,
            address: profile.address,
            data: JSON.stringify(data),
            submittedAt: firebase.firestore.FieldValue.serverTimestamp(),
            score: null,
            feedback: null,
            status: 'submitted' // submitted, graded
        };

        if (thumbnailUrl) {
            submissionData.thumbnail = thumbnailUrl;
        }

        if (!existing.empty) {
            // Update existing submission
            const docId = existing.docs[0].id;
            delete submissionData.submittedAt; // Keep original submission time
            submissionData.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('assignmentSubmissions').doc(docId).update(submissionData);
            return docId;
        } else {
            // Create new submission
            const docRef = await db.collection('assignmentSubmissions').add(submissionData);
            return docRef.id;
        }
    },

    // Get submissions for an assignment (admin)
    async getAssignmentSubmissions(assignmentId) {
        if (!db) throw new Error('Firebase not initialized');
        if (!this.isAdmin()) throw new Error('Admin access required');

        const snapshot = await db.collection('assignmentSubmissions')
            .where('assignmentId', '==', assignmentId)
            .get();

        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            submittedAt: doc.data().submittedAt?.toDate(),
            updatedAt: doc.data().updatedAt?.toDate()
        })).sort((a, b) => (b.score || 0) - (a.score || 0)); // Sort by score desc
    },

    // Get user's submission for an assignment
    async getUserSubmissionForAssignment(assignmentId) {
        if (!db) throw new Error('Firebase not initialized');
        const user = this.getCurrentUser();
        if (!user) return null;

        const snapshot = await db.collection('assignmentSubmissions')
            .where('assignmentId', '==', assignmentId)
            .where('userId', '==', user.uid)
            .get();

        if (snapshot.empty) return null;
        const doc = snapshot.docs[0];
        return {
            id: doc.id,
            ...doc.data(),
            data: JSON.parse(doc.data().data),
            submittedAt: doc.data().submittedAt?.toDate()
        };
    },

    // Grade a submission (admin)
    async gradeSubmission(submissionId, score, feedback = '') {
        if (!db) throw new Error('Firebase not initialized');
        if (!this.isAdmin()) throw new Error('Admin access required');

        if (score < 0 || score > 100) throw new Error('Score must be between 0 and 100');

        await db.collection('assignmentSubmissions').doc(submissionId).update({
            score: score,
            feedback: feedback,
            status: 'graded',
            gradedAt: firebase.firestore.FieldValue.serverTimestamp(),
            gradedBy: this.getCurrentUser().email
        });
    },

    // Load specific assignment submission
    async loadAssignmentSubmission(submissionId) {
        if (!db) throw new Error('Firebase not initialized');
        const doc = await db.collection('assignmentSubmissions').doc(submissionId).get();
        if (!doc.exists) throw new Error('Submission not found');
        return {
            id: doc.id,
            ...doc.data(),
            data: JSON.parse(doc.data().data),
            submittedAt: doc.data().submittedAt?.toDate()
        };
    },

    // Close assignment and determine winner
    async closeAssignmentAndDetermineWinner(assignmentId) {
        if (!db) throw new Error('Firebase not initialized');
        if (!this.isAdmin()) throw new Error('Admin access required');

        // Get all submissions
        const submissions = await this.getAssignmentSubmissions(assignmentId);
        
        // Find highest scoring submission
        let winner = null;
        let highestScore = -1;
        
        for (const sub of submissions) {
            if (sub.score !== null && sub.score > highestScore) {
                highestScore = sub.score;
                winner = sub;
            }
        }

        // Update assignment status
        const updateData = {
            status: 'completed',
            completedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (winner) {
            updateData.winnerId = winner.userId;
            updateData.winnerName = winner.studentName;
            updateData.winnerScore = winner.score;
            updateData.winnerAddress = winner.address;
        }

        await db.collection('assignments').doc(assignmentId).update(updateData);

        return {
            winner: winner,
            assignment: await this.getAssignment(assignmentId)
        };
    },

    // Get all users for admin (to see profiles)
    async getAllUserProfiles() {
        if (!db) throw new Error('Firebase not initialized');
        if (!this.isAdmin()) throw new Error('Admin access required');

        const snapshot = await db.collection('userProfiles').get();
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    }
};

// Export for use in app.js
window.FirebaseService = FirebaseService;
window.STUDENT_LEVELS = STUDENT_LEVELS;

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));
app.use(session({
    secret: 'zubari-ai-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
}));

// Database setup
const db = new sqlite3.Database('zubari.db');

// Initialize database tables
db.serialize(() => {
    // Users table
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        subscription_type TEXT DEFAULT 'free',
        subscription_expires DATE,
        ai_requests_used INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Payments table
    db.run(`CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        amount REAL NOT NULL,
        currency TEXT DEFAULT 'KES',
        subscription_type TEXT NOT NULL,
        payment_reference TEXT UNIQUE,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
    )`);

    // AI requests log
    db.run(`CREATE TABLE IF NOT EXISTS ai_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        request_type TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
    )`);
});

// Authentication middleware
const requireAuth = (req, res, next) => {
    if (req.session.userId) {
        next();
    } else {
        res.redirect('/login.html');
    }
};

// Check subscription middleware
const checkSubscription = (req, res, next) => {
    if (!req.session.userId) {
        return res.redirect('/login.html');
    }

    db.get('SELECT * FROM users WHERE id = ?', [req.session.userId], (err, user) => {
        if (err || !user) {
            return res.redirect('/login.html');
        }

        const now = new Date();
        const isSubscribed = user.subscription_type === 'premium' && 
                           new Date(user.subscription_expires) > now;

        if (!isSubscribed && user.ai_requests_used >= 5) {
            return res.json({ 
                error: 'Free tier limit reached. Please upgrade to premium for unlimited access.',
                requiresUpgrade: true 
            });
        }

        req.user = user;
        next();
    });
};

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/signup.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'signup.html'));
});

app.get('/premium.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'premium.html'));
});

// Authentication routes
app.post('/api/signup', async (req, res) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
        return res.json({ error: 'Email and password are required' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    db.run('INSERT INTO users (email, password) VALUES (?, ?)', 
           [email, hashedPassword], 
           function(err) {
        if (err) {
            return res.json({ error: 'Email already exists' });
        }
        
        req.session.userId = this.lastID;
        res.json({ success: true });
    });
});

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    
    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
        if (err || !user) {
            return res.json({ error: 'Invalid credentials' });
        }
        
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.json({ error: 'Invalid credentials' });
        }
        
        req.session.userId = user.id;
        res.json({ success: true });
    });
});

app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// AI service routes
app.post('/api/generate-questions', checkSubscription, (req, res) => {
    const { paragraph } = req.body;
    
    if (!paragraph) {
        return res.json({ error: 'Please provide a paragraph' });
    }

    // Increment AI request count for free users
    if (req.user.subscription_type !== 'premium') {
        db.run('UPDATE users SET ai_requests_used = ai_requests_used + 1 WHERE id = ?', 
               [req.user.id]);
    }

    // Log the request
    db.run('INSERT INTO ai_requests (user_id, request_type) VALUES (?, ?)', 
           [req.user.id, 'question_generation']);

    // Mock AI response (replace with actual AI integration)
    const questions = [
        "What is the main topic discussed in this paragraph?",
        "Can you explain the key concepts mentioned?",
        "What are the implications of the information provided?",
        "How does this relate to broader themes in the subject?",
        "What questions might arise from this content?"
    ];

    res.json({ questions });
});

app.post('/api/summarize', checkSubscription, (req, res) => {
    const { text } = req.body;
    
    if (!text) {
        return res.json({ error: 'Please provide text to summarize' });
    }

    // Increment AI request count for free users
    if (req.user.subscription_type !== 'premium') {
        db.run('UPDATE users SET ai_requests_used = ai_requests_used + 1 WHERE id = ?', 
               [req.user.id]);
    }

    // Log the request
    db.run('INSERT INTO ai_requests (user_id, request_type) VALUES (?, ?)', 
           [req.user.id, 'summarization']);

    // Mock AI response (replace with actual AI integration)
    const summary = text.length > 200 ? 
        text.substring(0, 200) + "... [This is a mock summary. Integrate with actual AI models for real summarization.]" :
        "This text is already concise. [Mock response - integrate with actual AI models.]";

    res.json({ summary });
});

app.post('/api/answer-question', checkSubscription, (req, res) => {
    const { context, question } = req.body;
    
    if (!context || !question) {
        return res.json({ error: 'Please provide both context and question' });
    }

    // Increment AI request count for free users
    if (req.user.subscription_type !== 'premium') {
        db.run('UPDATE users SET ai_requests_used = ai_requests_used + 1 WHERE id = ?', 
               [req.user.id]);
    }

    // Log the request
    db.run('INSERT INTO ai_requests (user_id, request_type) VALUES (?, ?)', 
           [req.user.id, 'question_answering']);

    // Mock AI response (replace with actual AI integration)
    const answer = "This is a mock answer based on the provided context. Please integrate with actual AI models for real question answering.";

    res.json({ answer });
});

app.post('/api/generate-study-plan', checkSubscription, (req, res) => {
    const { syllabus, topics, startDate, deadline } = req.body;
    
    if (!syllabus || !topics || !startDate || !deadline) {
        return res.json({ error: 'Please fill in all fields' });
    }

    // Increment AI request count for free users
    if (req.user.subscription_type !== 'premium') {
        db.run('UPDATE users SET ai_requests_used = ai_requests_used + 1 WHERE id = ?', 
               [req.user.id]);
    }

    // Log the request
    db.run('INSERT INTO ai_requests (user_id, request_type) VALUES (?, ?)', 
           [req.user.id, 'study_plan_generation']);

    // Mock AI response (replace with actual AI integration)
    const studyPlan = `
STUDY PLAN FOR: ${syllabus}

Topics to Cover: ${topics}
Duration: ${startDate} to ${deadline}

Week 1: Introduction and Foundation
- Day 1-2: Overview of key concepts
- Day 3-4: Deep dive into fundamentals
- Day 5-7: Practice exercises and review

Week 2: Advanced Topics
- Day 1-3: Complex concepts and applications
- Day 4-5: Case studies and examples
- Day 6-7: Assessment and feedback

[This is a mock study plan. Integrate with actual AI models for personalized plans.]
    `;

    res.json({ studyPlan });
});

// Payment routes
app.post('/api/initiate-payment', requireAuth, (req, res) => {
    const { subscriptionType } = req.body;
    const amount = subscriptionType === 'monthly' ? 1000 : 10000;
    
    // Generate payment reference
    const paymentReference = 'ZUB_' + Date.now() + '_' + req.session.userId;
    
    // Store payment record
    db.run('INSERT INTO payments (user_id, amount, subscription_type, payment_reference) VALUES (?, ?, ?, ?)',
           [req.session.userId, amount, subscriptionType, paymentReference],
           function(err) {
        if (err) {
            return res.json({ error: 'Payment initiation failed' });
        }
        
        res.json({ 
            success: true, 
            paymentReference,
            amount,
            publicKey: 'pk_test_your_paystack_public_key' // Replace with actual Paystack public key
        });
    });
});

app.post('/api/verify-payment', requireAuth, (req, res) => {
    const { paymentReference } = req.body;
    
    // In a real implementation, verify with Paystack API
    // For now, we'll simulate successful payment
    
    db.get('SELECT * FROM payments WHERE payment_reference = ? AND user_id = ?', 
           [paymentReference, req.session.userId], (err, payment) => {
        if (err || !payment) {
            return res.json({ error: 'Payment not found' });
        }
        
        // Update payment status
        db.run('UPDATE payments SET status = ? WHERE id = ?', ['completed', payment.id]);
        
        // Update user subscription
        const expiryDate = new Date();
        if (payment.subscription_type === 'monthly') {
            expiryDate.setMonth(expiryDate.getMonth() + 1);
        } else {
            expiryDate.setFullYear(expiryDate.getFullYear() + 1);
        }
        
        db.run('UPDATE users SET subscription_type = ?, subscription_expires = ?, ai_requests_used = 0 WHERE id = ?',
               ['premium', expiryDate.toISOString(), req.session.userId]);
        
        res.json({ success: true });
    });
});

// User status route
app.get('/api/user-status', requireAuth, (req, res) => {
    db.get('SELECT email, subscription_type, subscription_expires, ai_requests_used FROM users WHERE id = ?', 
           [req.session.userId], (err, user) => {
        if (err || !user) {
            return res.json({ error: 'User not found' });
        }
        
        const now = new Date();
        const isSubscribed = user.subscription_type === 'premium' && 
                           new Date(user.subscription_expires) > now;
        
        res.json({
            email: user.email,
            subscriptionType: user.subscription_type,
            isSubscribed,
            requestsUsed: user.ai_requests_used,
            requestsRemaining: isSubscribed ? 'unlimited' : Math.max(0, 5 - user.ai_requests_used)
        });
    });
});

app.listen(PORT, () => {
    console.log(`Zubari AI Study Buddy server running on http://localhost:${PORT}`);
});
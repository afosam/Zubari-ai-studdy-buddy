const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Database configuration
const DB_CONFIG = {
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'zubari_ai',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    charset: 'utf8mb4'
};

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: process.env.SESSION_SECRET || 'zubari-ai-secret-key-2025',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// Serve static files
app.use(express.static('public'));

// Database connection pool
let pool;

async function initializeDatabase() {
    try {
        // Create connection pool
        pool = mysql.createPool(DB_CONFIG);
        
        // Test connection
        const connection = await pool.getConnection();
        
        // Create database if it doesn't exist
        await connection.execute(`CREATE DATABASE IF NOT EXISTS ${DB_CONFIG.database}`);
        await connection.execute(`USE ${DB_CONFIG.database}`);
        
        // Create users table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                subscription_type ENUM('free', 'premium') DEFAULT 'free',
                subscription_expires DATETIME NULL,
                ai_requests_used INT DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Create payments table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS payments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT,
                amount DECIMAL(10,2) NOT NULL,
                currency VARCHAR(3) DEFAULT 'KES',
                subscription_type ENUM('monthly', 'yearly') NOT NULL,
                payment_reference VARCHAR(255) UNIQUE,
                status ENUM('pending', 'completed', 'failed') DEFAULT 'pending',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        
        // Create AI requests log
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS ai_requests (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT,
                request_type ENUM('question_generation', 'summarization', 'question_answering', 'study_plan_generation') NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        
        connection.release();
        console.log('Database initialized successfully');
        
    } catch (error) {
        console.error('Database initialization failed:', error);
        // For development, we'll continue without MySQL and use in-memory storage
        console.log('Continuing with in-memory storage for development...');
    }
}

// In-memory storage fallback for development
let users = [];
let payments = [];
let aiRequests = [];
let userIdCounter = 1;

// Helper functions
function requireAuth(req, res, next) {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    next();
}

async function checkSubscription(req, res, next) {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    
    try {
        let user;
        
        if (pool) {
            const [rows] = await pool.execute('SELECT * FROM users WHERE id = ?', [req.session.userId]);
            user = rows[0];
        } else {
            user = users.find(u => u.id === req.session.userId);
        }
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Check subscription status
        const isSubscribed = user.subscription_type === 'premium' && 
                           user.subscription_expires && 
                           new Date(user.subscription_expires) > new Date();
        
        if (!isSubscribed && user.ai_requests_used >= 5) {
            return res.json({
                error: 'Free tier limit reached. Please upgrade to premium for unlimited access.',
                requiresUpgrade: true
            });
        }
        
        req.user = user;
        next();
        
    } catch (error) {
        console.error('Subscription check failed:', error);
        res.status(500).json({ error: 'Database error' });
    }
}

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

app.get('/tools.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'tools.html'));
});

// Authentication routes
app.post('/api/signup', async (req, res) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
        return res.json({ error: 'Email and password are required' });
    }
    
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        
        if (pool) {
            // Use MySQL
            try {
                const [result] = await pool.execute(
                    'INSERT INTO users (email, password) VALUES (?, ?)',
                    [email, hashedPassword]
                );
                req.session.userId = result.insertId;
            } catch (error) {
                if (error.code === 'ER_DUP_ENTRY') {
                    return res.json({ error: 'Email already exists' });
                }
                throw error;
            }
        } else {
            // Use in-memory storage
            if (users.find(u => u.email === email)) {
                return res.json({ error: 'Email already exists' });
            }
            
            const newUser = {
                id: userIdCounter++,
                email,
                password: hashedPassword,
                subscription_type: 'free',
                subscription_expires: null,
                ai_requests_used: 0,
                created_at: new Date()
            };
            
            users.push(newUser);
            req.session.userId = newUser.id;
        }
        
        res.json({ success: true });
        
    } catch (error) {
        console.error('Signup error:', error);
        res.json({ error: 'Registration failed' });
    }
});

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    
    try {
        let user;
        
        if (pool) {
            const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
            user = rows[0];
        } else {
            user = users.find(u => u.email === email);
        }
        
        if (!user || !await bcrypt.compare(password, user.password)) {
            return res.json({ error: 'Invalid credentials' });
        }
        
        req.session.userId = user.id;
        res.json({ success: true });
        
    } catch (error) {
        console.error('Login error:', error);
        res.json({ error: 'Login failed' });
    }
});

app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

app.get('/api/user-status', async (req, res) => {
    if (!req.session.userId) {
        return res.json({ error: 'Not authenticated' });
    }
    
    try {
        let user;
        
        if (pool) {
            const [rows] = await pool.execute(
                'SELECT email, subscription_type, subscription_expires, ai_requests_used FROM users WHERE id = ?',
                [req.session.userId]
            );
            user = rows[0];
        } else {
            user = users.find(u => u.id === req.session.userId);
        }
        
        if (!user) {
            return res.json({ error: 'User not found' });
        }
        
        const isSubscribed = user.subscription_type === 'premium' && 
                           user.subscription_expires && 
                           new Date(user.subscription_expires) > new Date();
        
        res.json({
            email: user.email,
            subscriptionType: user.subscription_type,
            isSubscribed,
            requestsUsed: user.ai_requests_used,
            requestsRemaining: isSubscribed ? 'unlimited' : Math.max(0, 5 - user.ai_requests_used)
        });
        
    } catch (error) {
        console.error('User status error:', error);
        res.json({ error: 'Failed to get user status' });
    }
});

// AI service routes
app.post('/api/generate-questions', checkSubscription, async (req, res) => {
    const { paragraph } = req.body;
    
    if (!paragraph || !paragraph.trim()) {
        return res.json({ error: 'Please provide a paragraph' });
    }
    
    try {
        // Increment AI request count for free users
        if (req.user.subscription_type !== 'premium') {
            if (pool) {
                await pool.execute('UPDATE users SET ai_requests_used = ai_requests_used + 1 WHERE id = ?', [req.session.userId]);
                await pool.execute('INSERT INTO ai_requests (user_id, request_type) VALUES (?, ?)', [req.session.userId, 'question_generation']);
            } else {
                const user = users.find(u => u.id === req.session.userId);
                if (user) user.ai_requests_used++;
                aiRequests.push({
                    user_id: req.session.userId,
                    request_type: 'question_generation',
                    created_at: new Date()
                });
            }
        }
        
        // Mock AI response (replace with actual AI integration)
        const questions = [
            "What is the main topic discussed in this paragraph?",
            "Can you explain the key concepts mentioned?",
            "What are the implications of the information provided?",
            "How does this relate to broader themes in the subject?",
            "What questions might arise from this content?"
        ];
        
        res.json({ questions });
        
    } catch (error) {
        console.error('Question generation error:', error);
        res.json({ error: 'Failed to generate questions' });
    }
});

app.post('/api/summarize', checkSubscription, async (req, res) => {
    const { text } = req.body;
    
    if (!text || !text.trim()) {
        return res.json({ error: 'Please provide text to summarize' });
    }
    
    try {
        // Increment AI request count for free users
        if (req.user.subscription_type !== 'premium') {
            if (pool) {
                await pool.execute('UPDATE users SET ai_requests_used = ai_requests_used + 1 WHERE id = ?', [req.session.userId]);
                await pool.execute('INSERT INTO ai_requests (user_id, request_type) VALUES (?, ?)', [req.session.userId, 'summarization']);
            } else {
                const user = users.find(u => u.id === req.session.userId);
                if (user) user.ai_requests_used++;
                aiRequests.push({
                    user_id: req.session.userId,
                    request_type: 'summarization',
                    created_at: new Date()
                });
            }
        }
        
        // Mock AI response (replace with actual AI integration)
        let summary = text.length > 200 ? text.substring(0, 200) + "..." : text;
        summary += " [This is a mock summary. Integrate with actual AI models for real summarization.]";
        
        res.json({ summary });
        
    } catch (error) {
        console.error('Summarization error:', error);
        res.json({ error: 'Failed to summarize text' });
    }
});

app.post('/api/answer-question', checkSubscription, async (req, res) => {
    const { context, question } = req.body;
    
    if (!context || !question || !context.trim() || !question.trim()) {
        return res.json({ error: 'Please provide both context and question' });
    }
    
    try {
        // Increment AI request count for free users
        if (req.user.subscription_type !== 'premium') {
            if (pool) {
                await pool.execute('UPDATE users SET ai_requests_used = ai_requests_used + 1 WHERE id = ?', [req.session.userId]);
                await pool.execute('INSERT INTO ai_requests (user_id, request_type) VALUES (?, ?)', [req.session.userId, 'question_answering']);
            } else {
                const user = users.find(u => u.id === req.session.userId);
                if (user) user.ai_requests_used++;
                aiRequests.push({
                    user_id: req.session.userId,
                    request_type: 'question_answering',
                    created_at: new Date()
                });
            }
        }
        
        // Mock AI response (replace with actual AI integration)
        const answer = "This is a mock answer based on the provided context. Please integrate with actual AI models for real question answering.";
        
        res.json({ answer });
        
    } catch (error) {
        console.error('Question answering error:', error);
        res.json({ error: 'Failed to answer question' });
    }
});

app.post('/api/generate-study-plan', checkSubscription, async (req, res) => {
    const { syllabus, topics, startDate, deadline } = req.body;
    
    if (!syllabus || !topics || !startDate || !deadline) {
        return res.json({ error: 'Please fill in all fields' });
    }
    
    try {
        // Increment AI request count for free users
        if (req.user.subscription_type !== 'premium') {
            if (pool) {
                await pool.execute('UPDATE users SET ai_requests_used = ai_requests_used + 1 WHERE id = ?', [req.session.userId]);
                await pool.execute('INSERT INTO ai_requests (user_id, request_type) VALUES (?, ?)', [req.session.userId, 'study_plan_generation']);
            } else {
                const user = users.find(u => u.id === req.session.userId);
                if (user) user.ai_requests_used++;
                aiRequests.push({
                    user_id: req.session.userId,
                    request_type: 'study_plan_generation',
                    created_at: new Date()
                });
            }
        }
        
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
        
    } catch (error) {
        console.error('Study plan generation error:', error);
        res.json({ error: 'Failed to generate study plan' });
    }
});

// Payment routes
app.post('/api/initiate-payment', requireAuth, async (req, res) => {
    const { subscriptionType } = req.body;
    const amount = subscriptionType === 'monthly' ? 1000 : 10000;
    
    // Generate payment reference
    const paymentReference = `ZUB_${Date.now()}_${req.session.userId}`;
    
    try {
        if (pool) {
            await pool.execute(
                'INSERT INTO payments (user_id, amount, subscription_type, payment_reference) VALUES (?, ?, ?, ?)',
                [req.session.userId, amount, subscriptionType, paymentReference]
            );
        } else {
            payments.push({
                id: payments.length + 1,
                user_id: req.session.userId,
                amount,
                subscription_type: subscriptionType,
                payment_reference: paymentReference,
                status: 'pending',
                created_at: new Date()
            });
        }
        
        res.json({
            success: true,
            paymentReference,
            amount,
            publicKey: 'pk_test_your_paystack_public_key' // Replace with actual Paystack public key
        });
        
    } catch (error) {
        console.error('Payment initiation error:', error);
        res.json({ error: 'Payment initiation failed' });
    }
});

app.post('/api/verify-payment', requireAuth, async (req, res) => {
    const { paymentReference } = req.body;
    
    try {
        let payment;
        
        if (pool) {
            const [rows] = await pool.execute(
                'SELECT * FROM payments WHERE payment_reference = ? AND user_id = ?',
                [paymentReference, req.session.userId]
            );
            payment = rows[0];
        } else {
            payment = payments.find(p => p.payment_reference === paymentReference && p.user_id === req.session.userId);
        }
        
        if (!payment) {
            return res.json({ error: 'Payment not found' });
        }
        
        // Calculate expiry date
        const expiryDate = new Date();
        if (payment.subscription_type === 'monthly') {
            expiryDate.setDate(expiryDate.getDate() + 30);
        } else {
            expiryDate.setFullYear(expiryDate.getFullYear() + 1);
        }
        
        if (pool) {
            // Update payment status
            await pool.execute('UPDATE payments SET status = ? WHERE id = ?', ['completed', payment.id]);
            
            // Update user subscription
            await pool.execute(
                'UPDATE users SET subscription_type = ?, subscription_expires = ?, ai_requests_used = 0 WHERE id = ?',
                ['premium', expiryDate, req.session.userId]
            );
        } else {
            // Update in-memory storage
            payment.status = 'completed';
            const user = users.find(u => u.id === req.session.userId);
            if (user) {
                user.subscription_type = 'premium';
                user.subscription_expires = expiryDate;
                user.ai_requests_used = 0;
            }
        }
        
        res.json({ success: true });
        
    } catch (error) {
        console.error('Payment verification error:', error);
        res.json({ error: 'Payment verification failed' });
    }
});

// Initialize database and start server
async function startServer() {
    await initializeDatabase();
    
    app.listen(PORT, () => {
        console.log(`🚀 Zubari AI Study Buddy server running on http://localhost:${PORT}`);
        console.log('📚 Ready to help students learn smarter!');
    });
}

startServer().catch(console.error);
from flask import Flask, render_template, request
import sqlite3
import bcrypt
from flask import session, jsonify
import os
from datetime import datetime, timedelta

app = Flask(__name__)
app.secret_key = 'zubari-ai-secret-key-2025'

# Database setup
def init_db():
    conn = sqlite3.connect('zubari.db')
    cursor = conn.cursor()
    
    # Users table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            subscription_type TEXT DEFAULT 'free',
            subscription_expires DATE,
            ai_requests_used INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Payments table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            amount REAL NOT NULL,
            currency TEXT DEFAULT 'KES',
            subscription_type TEXT NOT NULL,
            payment_reference TEXT UNIQUE,
            status TEXT DEFAULT 'pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    ''')
    
    # AI requests log
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS ai_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            request_type TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    ''')
    
    conn.commit()
    conn.close()

# Initialize database
init_db()

# Authentication middleware
def require_auth():
    if 'user_id' not in session:
        return False
    return True

def check_subscription():
    if not require_auth():
        return {'error': 'Authentication required'}, False
    
    conn = sqlite3.connect('zubari.db')
    cursor = conn.cursor()
    
    cursor.execute('SELECT * FROM users WHERE id = ?', (session['user_id'],))
    user = cursor.fetchone()
    conn.close()
    
    if not user:
        return {'error': 'User not found'}, False
    
    # Check if user has premium subscription
    subscription_type = user[3]  # subscription_type column
    subscription_expires = user[4]  # subscription_expires column
    ai_requests_used = user[5]  # ai_requests_used column
    
    is_subscribed = False
    if subscription_type == 'premium' and subscription_expires:
        expires_date = datetime.strptime(subscription_expires, '%Y-%m-%d %H:%M:%S')
        is_subscribed = expires_date > datetime.now()
    
    if not is_subscribed and ai_requests_used >= 5:
        return {
            'error': 'Free tier limit reached. Please upgrade to premium for unlimited access.',
            'requiresUpgrade': True
        }, False
    
    return user, True

@app.route("/")
def home():
    return app.send_static_file('index.html')

@app.route("/login.html")
def login_page():
    return app.send_static_file('login.html')

@app.route("/signup.html")
def signup_page():
    return app.send_static_file('signup.html')

@app.route("/premium.html")
def premium_page():
    return app.send_static_file('premium.html')

@app.route("/tools.html")
def tools_page():
    return app.send_static_file('tools.html')

# Authentication routes
@app.route("/api/signup", methods=["POST"])
def signup():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')
    
    if not email or not password:
        return jsonify({'error': 'Email and password are required'})
    
    # Hash password
    hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
    
    conn = sqlite3.connect('zubari.db')
    cursor = conn.cursor()
    
    try:
        cursor.execute('INSERT INTO users (email, password) VALUES (?, ?)', 
                      (email, hashed_password))
        user_id = cursor.lastrowid
        conn.commit()
        
        session['user_id'] = user_id
        return jsonify({'success': True})
        
    except sqlite3.IntegrityError:
        return jsonify({'error': 'Email already exists'})
    finally:
        conn.close()

@app.route("/api/login", methods=["POST"])
def login():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')
    
    conn = sqlite3.connect('zubari.db')
    cursor = conn.cursor()
    
    cursor.execute('SELECT * FROM users WHERE email = ?', (email,))
    user = cursor.fetchone()
    conn.close()
    
    if not user or not bcrypt.checkpw(password.encode('utf-8'), user[2]):
        return jsonify({'error': 'Invalid credentials'})
    
    session['user_id'] = user[0]
    return jsonify({'success': True})

@app.route("/api/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({'success': True})

@app.route("/api/user-status", methods=["GET"])
def user_status():
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'})
    
    conn = sqlite3.connect('zubari.db')
    cursor = conn.cursor()
    
    cursor.execute('SELECT email, subscription_type, subscription_expires, ai_requests_used FROM users WHERE id = ?', 
                  (session['user_id'],))
    user = cursor.fetchone()
    conn.close()
    
    if not user:
        return jsonify({'error': 'User not found'})
    
    is_subscribed = False
    if user[1] == 'premium' and user[2]:
        expires_date = datetime.strptime(user[2], '%Y-%m-%d %H:%M:%S')
        is_subscribed = expires_date > datetime.now()
    
    return jsonify({
        'email': user[0],
        'subscriptionType': user[1],
        'isSubscribed': is_subscribed,
        'requestsUsed': user[3],
        'requestsRemaining': 'unlimited' if is_subscribed else max(0, 5 - user[3])
    })

# AI service routes
@app.route("/api/generate-questions", methods=["POST"])
def generate_questions():
    user, success = check_subscription()
    if not success:
        return jsonify(user)
    
    data = request.get_json()
    paragraph = data.get('paragraph', '').strip()
    
    if not paragraph:
        return jsonify({'error': 'Please provide a paragraph'})
    
    # Increment AI request count for free users
    if user[3] != 'premium':  # subscription_type
        conn = sqlite3.connect('zubari.db')
        cursor = conn.cursor()
        cursor.execute('UPDATE users SET ai_requests_used = ai_requests_used + 1 WHERE id = ?', 
                      (session['user_id'],))
        cursor.execute('INSERT INTO ai_requests (user_id, request_type) VALUES (?, ?)', 
                      (session['user_id'], 'question_generation'))
        conn.commit()
        conn.close()
    
    # Mock AI response (replace with actual AI integration)
    questions = [
        "What is the main topic discussed in this paragraph?",
        "Can you explain the key concepts mentioned?",
        "What are the implications of the information provided?",
        "How does this relate to broader themes in the subject?",
        "What questions might arise from this content?"
    ]
    
    return jsonify({'questions': questions})

@app.route("/api/summarize", methods=["POST"])
def summarize():
    user, success = check_subscription()
    if not success:
        return jsonify(user)
    
    data = request.get_json()
    text = data.get('text', '').strip()
    
    if not text:
        return jsonify({'error': 'Please provide text to summarize'})
    
    # Increment AI request count for free users
    if user[3] != 'premium':  # subscription_type
        conn = sqlite3.connect('zubari.db')
        cursor = conn.cursor()
        cursor.execute('UPDATE users SET ai_requests_used = ai_requests_used + 1 WHERE id = ?', 
                      (session['user_id'],))
        cursor.execute('INSERT INTO ai_requests (user_id, request_type) VALUES (?, ?)', 
                      (session['user_id'], 'summarization'))
        conn.commit()
        conn.close()
    
    # Mock AI response (replace with actual AI integration)
    summary = text[:200] + "..." if len(text) > 200 else text
    summary += " [This is a mock summary. Integrate with actual AI models for real summarization.]"
    
    return jsonify({'summary': summary})

@app.route("/api/answer-question", methods=["POST"])
def answer_question():
    user, success = check_subscription()
    if not success:
        return jsonify(user)
    
    data = request.get_json()
    context = data.get('context', '').strip()
    question = data.get('question', '').strip()
    
    if not context or not question:
        return jsonify({'error': 'Please provide both context and question'})
    
    # Increment AI request count for free users
    if user[3] != 'premium':  # subscription_type
        conn = sqlite3.connect('zubari.db')
        cursor = conn.cursor()
        cursor.execute('UPDATE users SET ai_requests_used = ai_requests_used + 1 WHERE id = ?', 
                      (session['user_id'],))
        cursor.execute('INSERT INTO ai_requests (user_id, request_type) VALUES (?, ?)', 
                      (session['user_id'], 'question_answering'))
        conn.commit()
        conn.close()
    
    # Mock AI response (replace with actual AI integration)
    answer = "This is a mock answer based on the provided context. Please integrate with actual AI models for real question answering."
    
    return jsonify({'answer': answer})

@app.route("/api/generate-study-plan", methods=["POST"])
def generate_study_plan():
    user, success = check_subscription()
    if not success:
        return jsonify(user)
    
    data = request.get_json()
    syllabus = data.get('syllabus', '').strip()
    topics = data.get('topics', '').strip()
    start_date = data.get('startDate', '').strip()
    deadline = data.get('deadline', '').strip()
    
    if not all([syllabus, topics, start_date, deadline]):
        return jsonify({'error': 'Please fill in all fields'})
    
    # Increment AI request count for free users
    if user[3] != 'premium':  # subscription_type
        conn = sqlite3.connect('zubari.db')
        cursor = conn.cursor()
        cursor.execute('UPDATE users SET ai_requests_used = ai_requests_used + 1 WHERE id = ?', 
                      (session['user_id'],))
        cursor.execute('INSERT INTO ai_requests (user_id, request_type) VALUES (?, ?)', 
                      (session['user_id'], 'study_plan_generation'))
        conn.commit()
        conn.close()
    
    # Mock AI response (replace with actual AI integration)
    study_plan = f"""
STUDY PLAN FOR: {syllabus}

Topics to Cover: {topics}
Duration: {start_date} to {deadline}

Week 1: Introduction and Foundation
- Day 1-2: Overview of key concepts
- Day 3-4: Deep dive into fundamentals
- Day 5-7: Practice exercises and review

Week 2: Advanced Topics
- Day 1-3: Complex concepts and applications
- Day 4-5: Case studies and examples
- Day 6-7: Assessment and feedback

[This is a mock study plan. Integrate with actual AI models for personalized plans.]
    """
    
    return jsonify({'studyPlan': study_plan})

# Payment routes
@app.route("/api/initiate-payment", methods=["POST"])
def initiate_payment():
    if not require_auth():
        return jsonify({'error': 'Authentication required'})
    
    data = request.get_json()
    subscription_type = data.get('subscriptionType')
    amount = 1000 if subscription_type == 'monthly' else 10000
    
    # Generate payment reference
    payment_reference = f'ZUB_{int(datetime.now().timestamp())}_{session["user_id"]}'
    
    conn = sqlite3.connect('zubari.db')
    cursor = conn.cursor()
    
    cursor.execute('INSERT INTO payments (user_id, amount, subscription_type, payment_reference) VALUES (?, ?, ?, ?)',
                  (session['user_id'], amount, subscription_type, payment_reference))
    conn.commit()
    conn.close()
    
    return jsonify({
        'success': True,
        'paymentReference': payment_reference,
        'amount': amount,
        'publicKey': 'pk_test_your_paystack_public_key'  # Replace with actual Paystack public key
    })

@app.route("/api/verify-payment", methods=["POST"])
def verify_payment():
    if not require_auth():
        return jsonify({'error': 'Authentication required'})
    
    data = request.get_json()
    payment_reference = data.get('paymentReference')
    
    conn = sqlite3.connect('zubari.db')
    cursor = conn.cursor()
    
    cursor.execute('SELECT * FROM payments WHERE payment_reference = ? AND user_id = ?', 
                  (payment_reference, session['user_id']))
    payment = cursor.fetchone()
    
    if not payment:
        conn.close()
        return jsonify({'error': 'Payment not found'})
    
    # Update payment status
    cursor.execute('UPDATE payments SET status = ? WHERE id = ?', ('completed', payment[0]))
    
    # Update user subscription
    expiry_date = datetime.now()
    if payment[4] == 'monthly':  # subscription_type
        expiry_date += timedelta(days=30)
    else:
        expiry_date += timedelta(days=365)
    
    cursor.execute('UPDATE users SET subscription_type = ?, subscription_expires = ?, ai_requests_used = 0 WHERE id = ?',
                  ('premium', expiry_date.strftime('%Y-%m-%d %H:%M:%S'), session['user_id']))
    
    conn.commit()
    conn.close()
    
    return jsonify({'success': True})

if __name__ == "__main__":
    app.run(debug=True, port=3000)

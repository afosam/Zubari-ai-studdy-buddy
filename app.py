from flask import Flask, render_template, request, session, jsonify
import mysql.connector
from mysql.connector import Error
import bcrypt
import os
from datetime import datetime, timedelta
import secrets

app = Flask(__name__, static_folder='public', static_url_path='')
app.secret_key = 'zubari-ai-secret-key-2025'

# MySQL Database Configuration
DB_CONFIG = {
    'host': 'localhost',
    'database': 'zubari_ai',
    'user': 'root',
    'password': '',  # Update with your MySQL password
    'charset': 'utf8mb4',
    'collation': 'utf8mb4_unicode_ci'
}

def get_db_connection():
    """Create and return a database connection"""
    try:
        connection = mysql.connector.connect(**DB_CONFIG)
        return connection
    except Error as e:
        print(f"Error connecting to MySQL: {e}")
        return None

def init_database():
    """Initialize the database and create tables"""
    connection = get_db_connection()
    if not connection:
        return False
    
    cursor = connection.cursor()
    
    try:
        # Create database if it doesn't exist
        cursor.execute("CREATE DATABASE IF NOT EXISTS zubari_ai")
        cursor.execute("USE zubari_ai")
        
        # Users table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                subscription_type ENUM('free', 'premium') DEFAULT 'free',
                subscription_expires DATETIME NULL,
                ai_requests_used INT DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Payments table
        cursor.execute('''
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
        ''')
        
        # AI requests log
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS ai_requests (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT,
                request_type ENUM('question_generation', 'summarization', 'question_answering', 'study_plan_generation') NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        ''')
        
        connection.commit()
        print("Database initialized successfully")
        return True
        
    except Error as e:
        print(f"Error initializing database: {e}")
        return False
    finally:
        cursor.close()
        connection.close()

# Initialize database on startup
init_database()

def require_auth():
    """Check if user is authenticated"""
    return 'user_id' in session

def check_subscription():
    """Check user subscription status and limits"""
    if not require_auth():
        return {'error': 'Authentication required'}, False
    
    connection = get_db_connection()
    if not connection:
        return {'error': 'Database connection failed'}, False
    
    cursor = connection.cursor(dictionary=True)
    
    try:
        cursor.execute('SELECT * FROM users WHERE id = %s', (session['user_id'],))
        user = cursor.fetchone()
        
        if not user:
            return {'error': 'User not found'}, False
        
        # Check if user has premium subscription
        subscription_type = user['subscription_type']
        subscription_expires = user['subscription_expires']
        ai_requests_used = user['ai_requests_used']
        
        is_subscribed = False
        if subscription_type == 'premium' and subscription_expires:
            is_subscribed = subscription_expires > datetime.now()
        
        if not is_subscribed and ai_requests_used >= 5:
            return {
                'error': 'Free tier limit reached. Please upgrade to premium for unlimited access.',
                'requiresUpgrade': True
            }, False
        
        return user, True
        
    except Error as e:
        return {'error': 'Database error'}, False
    finally:
        cursor.close()
        connection.close()

# Routes
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
    
    connection = get_db_connection()
    if not connection:
        return jsonify({'error': 'Database connection failed'})
    
    cursor = connection.cursor()
    
    try:
        cursor.execute('INSERT INTO users (email, password) VALUES (%s, %s)', 
                      (email, hashed_password))
        user_id = cursor.lastrowid
        connection.commit()
        
        session['user_id'] = user_id
        return jsonify({'success': True})
        
    except mysql.connector.IntegrityError:
        return jsonify({'error': 'Email already exists'})
    except Error as e:
        return jsonify({'error': 'Registration failed'})
    finally:
        cursor.close()
        connection.close()

@app.route("/api/login", methods=["POST"])
def login():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')
    
    connection = get_db_connection()
    if not connection:
        return jsonify({'error': 'Database connection failed'})
    
    cursor = connection.cursor(dictionary=True)
    
    try:
        cursor.execute('SELECT * FROM users WHERE email = %s', (email,))
        user = cursor.fetchone()
        
        if not user or not bcrypt.checkpw(password.encode('utf-8'), user['password'].encode('utf-8')):
            return jsonify({'error': 'Invalid credentials'})
        
        session['user_id'] = user['id']
        return jsonify({'success': True})
        
    except Error as e:
        return jsonify({'error': 'Login failed'})
    finally:
        cursor.close()
        connection.close()

@app.route("/api/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({'success': True})

@app.route("/api/user-status", methods=["GET"])
def user_status():
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'})
    
    connection = get_db_connection()
    if not connection:
        return jsonify({'error': 'Database connection failed'})
    
    cursor = connection.cursor(dictionary=True)
    
    try:
        cursor.execute('SELECT email, subscription_type, subscription_expires, ai_requests_used FROM users WHERE id = %s', 
                      (session['user_id'],))
        user = cursor.fetchone()
        
        if not user:
            return jsonify({'error': 'User not found'})
        
        is_subscribed = False
        if user['subscription_type'] == 'premium' and user['subscription_expires']:
            is_subscribed = user['subscription_expires'] > datetime.now()
        
        return jsonify({
            'email': user['email'],
            'subscriptionType': user['subscription_type'],
            'isSubscribed': is_subscribed,
            'requestsUsed': user['ai_requests_used'],
            'requestsRemaining': 'unlimited' if is_subscribed else max(0, 5 - user['ai_requests_used'])
        })
        
    except Error as e:
        return jsonify({'error': 'Failed to get user status'})
    finally:
        cursor.close()
        connection.close()

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
    if user['subscription_type'] != 'premium':
        connection = get_db_connection()
        if connection:
            cursor = connection.cursor()
            try:
                cursor.execute('UPDATE users SET ai_requests_used = ai_requests_used + 1 WHERE id = %s', 
                              (session['user_id'],))
                cursor.execute('INSERT INTO ai_requests (user_id, request_type) VALUES (%s, %s)', 
                              (session['user_id'], 'question_generation'))
                connection.commit()
            except Error as e:
                pass
            finally:
                cursor.close()
                connection.close()
    
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
    if user['subscription_type'] != 'premium':
        connection = get_db_connection()
        if connection:
            cursor = connection.cursor()
            try:
                cursor.execute('UPDATE users SET ai_requests_used = ai_requests_used + 1 WHERE id = %s', 
                              (session['user_id'],))
                cursor.execute('INSERT INTO ai_requests (user_id, request_type) VALUES (%s, %s)', 
                              (session['user_id'], 'summarization'))
                connection.commit()
            except Error as e:
                pass
            finally:
                cursor.close()
                connection.close()
    
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
    if user['subscription_type'] != 'premium':
        connection = get_db_connection()
        if connection:
            cursor = connection.cursor()
            try:
                cursor.execute('UPDATE users SET ai_requests_used = ai_requests_used + 1 WHERE id = %s', 
                              (session['user_id'],))
                cursor.execute('INSERT INTO ai_requests (user_id, request_type) VALUES (%s, %s)', 
                              (session['user_id'], 'question_answering'))
                connection.commit()
            except Error as e:
                pass
            finally:
                cursor.close()
                connection.close()
    
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
    if user['subscription_type'] != 'premium':
        connection = get_db_connection()
        if connection:
            cursor = connection.cursor()
            try:
                cursor.execute('UPDATE users SET ai_requests_used = ai_requests_used + 1 WHERE id = %s', 
                              (session['user_id'],))
                cursor.execute('INSERT INTO ai_requests (user_id, request_type) VALUES (%s, %s)', 
                              (session['user_id'], 'study_plan_generation'))
                connection.commit()
            except Error as e:
                pass
            finally:
                cursor.close()
                connection.close()
    
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
    
    connection = get_db_connection()
    if not connection:
        return jsonify({'error': 'Database connection failed'})
    
    cursor = connection.cursor()
    
    try:
        cursor.execute('INSERT INTO payments (user_id, amount, subscription_type, payment_reference) VALUES (%s, %s, %s, %s)',
                      (session['user_id'], amount, subscription_type, payment_reference))
        connection.commit()
        
        return jsonify({
            'success': True,
            'paymentReference': payment_reference,
            'amount': amount,
            'publicKey': 'pk_test_your_paystack_public_key'  # Replace with actual Paystack public key
        })
        
    except Error as e:
        return jsonify({'error': 'Payment initiation failed'})
    finally:
        cursor.close()
        connection.close()

@app.route("/api/verify-payment", methods=["POST"])
def verify_payment():
    if not require_auth():
        return jsonify({'error': 'Authentication required'})
    
    data = request.get_json()
    payment_reference = data.get('paymentReference')
    
    connection = get_db_connection()
    if not connection:
        return jsonify({'error': 'Database connection failed'})
    
    cursor = connection.cursor(dictionary=True)
    
    try:
        cursor.execute('SELECT * FROM payments WHERE payment_reference = %s AND user_id = %s', 
                      (payment_reference, session['user_id']))
        payment = cursor.fetchone()
        
        if not payment:
            return jsonify({'error': 'Payment not found'})
        
        # Update payment status
        cursor.execute('UPDATE payments SET status = %s WHERE id = %s', ('completed', payment['id']))
        
        # Update user subscription
        expiry_date = datetime.now()
        if payment['subscription_type'] == 'monthly':
            expiry_date += timedelta(days=30)
        else:
            expiry_date += timedelta(days=365)
        
        cursor.execute('UPDATE users SET subscription_type = %s, subscription_expires = %s, ai_requests_used = 0 WHERE id = %s',
                      ('premium', expiry_date, session['user_id']))
        
        connection.commit()
        return jsonify({'success': True})
        
    except Error as e:
        return jsonify({'error': 'Payment verification failed'})
    finally:
        cursor.close()
        connection.close()

if __name__ == "__main__":
    app.run(debug=True, port=3000)
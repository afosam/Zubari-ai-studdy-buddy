# 🧠 Zubari AI Study Buddy - Flask Web Application

🚀 **Zubari AI Study Buddy** is a comprehensive Flask-based web application that leverages artificial intelligence to enhance the learning experience. The platform offers multiple AI-powered tools including question generation, text summarization, question answering, and personalized study plan creation.

---

## 🌟 Key Features

- 🔹 **Question Generator** - Generate relevant practice questions from any paragraph or text
- 🔹 **Text Summarization** - Convert long texts into concise, digestible summaries
- 🔹 **Question Answering** - Get precise answers based on provided context
- 🔹 **Study Plan Generator** - Create structured, personalized study schedules
- 🔹 **Premium Subscription** - Unlimited AI requests with Paystack payment integration
- 🔹 **User Authentication** - Secure login and registration system
- 🔹 **Usage Tracking** - Monitor AI request usage for free tier users

---

## 🛠️ Technology Stack

| **Component** | **Technology** |
|---------------|----------------|
| **Backend** | Flask (Python) |
| **Database** | MySQL |
| **Frontend** | Vanilla HTML, CSS, JavaScript |
| **Authentication** | bcrypt password hashing |
| **Payments** | Paystack integration |
| **Styling** | Pure CSS with modern design |

---

## 📂 Project Structure

```
📦 Zubari-AI-Study-Buddy/
├── 📁 public/              # Static frontend files
│   ├── 📄 index.html       # Homepage
│   ├── 📄 login.html       # Login page
│   ├── 📄 signup.html      # Registration page
│   ├── 📄 premium.html     # Premium plans page
│   ├── 📄 tools.html       # AI tools interface
│   ├── 📄 style.css        # Main stylesheet
│   └── 📄 script.js        # Frontend JavaScript
├── 📁 images/              # Application screenshots
├── 📄 app.py               # Main Flask application
├── 📄 requirements.txt     # Python dependencies
├── 📄 README.md            # Project documentation
└── 📄 LICENSE              # MIT License
```

---

## 🔧 Installation & Setup

### Prerequisites
- Python 3.8 or higher
- MySQL Server 8.0 or higher
- pip (Python package installer)

### Step 1: Clone the Repository
```bash
git clone https://github.com/yourusername/zubari-ai-study-buddy.git
cd zubari-ai-study-buddy
```

### Step 2: Create Virtual Environment
```bash
# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate
```

### Step 3: Install Dependencies
```bash
pip install -r requirements.txt
```

### Step 4: MySQL Database Setup
1. **Install MySQL Server** if not already installed
2. **Create Database User** (optional but recommended):
```sql
CREATE USER 'zubari_user'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON zubari_ai.* TO 'zubari_user'@'localhost';
FLUSH PRIVILEGES;
```

3. **Update Database Configuration** in `app.py`:
```python
DB_CONFIG = {
    'host': 'localhost',
    'database': 'zubari_ai',
    'user': 'your_mysql_username',
    'password': 'your_mysql_password',
    'charset': 'utf8mb4',
    'collation': 'utf8mb4_unicode_ci'
}
```

### Step 5: Configure Paystack Integration
1. **Create Paystack Account** at [paystack.com](https://paystack.com)
2. **Get API Keys** from your Paystack dashboard
3. **Update Payment Configuration** in `app.py`:
```python
# Replace with your actual Paystack public key
'publicKey': 'pk_test_your_actual_paystack_public_key'
```

### Step 6: Run the Application
```bash
python app.py
```

The application will be available at: **http://localhost:3000**

---

## 📱 How to Use the Application

### 1. **Account Creation**
1. Navigate to the homepage
2. Click **"Sign Up"** in the navigation bar
3. Enter your email and create a secure password
4. Confirm your password and click **"Create Account"**
5. You'll be automatically logged in and redirected to the homepage

### 2. **Accessing AI Tools**
1. **Login** to your account if not already logged in
2. From the homepage, click on any of the four AI tool cards:
   - **Question Generator** ❓
   - **Text Summarizer** 📝
   - **Question Answering** 🤖
   - **Study Plan Generator** 📅

### 3. **Using Question Generator**
1. Click on the **Question Generator** tool
2. Paste or type a paragraph of text in the input field
3. Click **"Generate Questions"**
4. Review the AI-generated practice questions
5. Use these questions to test your understanding

### 4. **Using Text Summarizer**
1. Select the **Text Summarizer** tool
2. Paste long text, articles, or documents
3. Click **"Summarize"**
4. Get a concise summary highlighting key points
5. Use the summary for quick review or note-taking

### 5. **Using Question Answering**
1. Access the **Question Answering** tool
2. Provide **context** (background information or text)
3. Enter your specific **question**
4. Click **"Get Answer"**
5. Receive an AI-generated answer based on the context

### 6. **Using Study Plan Generator**
1. Open the **Study Plan Generator** tool
2. Fill in the required fields:
   - **Syllabus**: Course or subject name
   - **Topics**: Specific topics to cover
   - **Start Date**: When you want to begin studying
   - **Deadline**: Your target completion date
3. Click **"Generate Plan"**
4. Receive a structured, time-based study schedule

### 7. **Understanding Usage Limits**
- **Free Tier**: 5 AI requests per month
- **Premium**: Unlimited AI requests
- Usage counter is displayed at the top of the tools page
- When limit is reached, you'll be prompted to upgrade

### 8. **Upgrading to Premium**
1. Click **"View Plans"** from the homepage banner or when prompted
2. Choose between:
   - **Monthly Plan**: KES 1,000/month
   - **Yearly Plan**: KES 10,000/year (Save KES 2,000!)
3. Click **"Choose Monthly"** or **"Choose Yearly"**
4. Complete payment through Paystack secure checkout
5. Enjoy unlimited AI requests immediately after payment

### 9. **Account Management**
- **View Usage**: Check remaining requests in the top navigation
- **Logout**: Click your email in the navigation, then "Logout"
- **Subscription Status**: Visible in the user menu area

---

## 💳 Payment Integration

The application uses **Paystack** for secure payment processing:

- **Supported Currency**: Kenyan Shillings (KES)
- **Payment Methods**: Cards, Mobile Money, Bank Transfer
- **Security**: PCI DSS compliant payment processing
- **Instant Activation**: Premium features activate immediately after successful payment

---

## 🔒 Security Features

- **Password Hashing**: bcrypt encryption for secure password storage
- **Session Management**: Secure user sessions with Flask
- **SQL Injection Protection**: Parameterized queries
- **Input Validation**: Server-side validation for all user inputs
- **Authentication Middleware**: Protected routes for authenticated users only

---

## 🎨 Design Philosophy

The application follows modern web design principles:

- **Apple-inspired Aesthetics**: Clean, minimalist interface
- **Responsive Design**: Works seamlessly on all devices
- **Gradient Backgrounds**: Beautiful visual appeal
- **Micro-interactions**: Smooth hover effects and transitions
- **Accessibility**: High contrast ratios and readable fonts
- **Progressive Enhancement**: Works without JavaScript for basic functionality

---

## 🚀 Deployment

### Local Development
```bash
python app.py
```

### Production Deployment
1. **Set up MySQL** on your production server
2. **Configure environment variables** for database credentials
3. **Update Paystack keys** with production keys
4. **Deploy using** your preferred hosting service (Heroku, DigitalOcean, AWS, etc.)

---

## 🔮 Future Enhancements

- 🤖 **Real AI Integration**: Replace mock responses with actual AI models
- 📊 **Analytics Dashboard**: Track learning progress and statistics
- 🎯 **Personalized Recommendations**: AI-driven study suggestions
- 📱 **Mobile App**: Native iOS and Android applications
- 🌍 **Multi-language Support**: Support for multiple languages
- 🔗 **API Access**: RESTful API for third-party integrations

---

## 🤝 Contributing

We welcome contributions! Here's how to get started:

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature-name`
3. **Commit** your changes: `git commit -m "Add feature"`
4. **Push** to the branch: `git push origin feature-name`
5. **Submit** a Pull Request

---

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---

## 📞 Support & Contact

For questions, support, or collaboration opportunities:

- 📧 **Email**: philipbarongo30@gmail.com
- 🔗 **LinkedIn**: [Philip Barongo](https://www.linkedin.com/in/philip-barongo-8b215028a/)
- 🌐 **GitHub**: [PhilipOndieki](https://github.com/PhilipOndieki)
- 📱 **Phone**: +254703141296

---

## 🙏 Acknowledgments

- **Flask Community** for the excellent web framework
- **MySQL** for reliable database management
- **Paystack** for seamless payment processing
- **Open Source Community** for inspiration and resources

---

🌟 **If you find this project helpful, please give it a star!** ⭐

---

*Built with ❤️ by Philip Ondieki*
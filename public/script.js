// Global state
let currentUser = null;
let currentTool = null;

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    checkAuthStatus();
    initializeEventListeners();
    handleToolNavigation();
});

// Authentication functions
async function checkAuthStatus() {
    try {
        const response = await fetch('/api/user-status');
        const data = await response.json();
        
        if (data.email) {
            currentUser = data;
            updateAuthUI(true);
            updateUsageInfo();
        } else {
            updateAuthUI(false);
        }
    } catch (error) {
        updateAuthUI(false);
    }
}

function updateAuthUI(isLoggedIn) {
    const loginBtn = document.getElementById('loginBtn');
    const signupBtn = document.getElementById('signupBtn');
    const userMenu = document.getElementById('userMenu');
    const userEmail = document.getElementById('userEmail');

    if (isLoggedIn && currentUser) {
        if (loginBtn) loginBtn.classList.add('hidden');
        if (signupBtn) signupBtn.classList.add('hidden');
        if (userMenu) userMenu.classList.remove('hidden');
        if (userEmail) userEmail.textContent = currentUser.email;
    } else {
        if (loginBtn) loginBtn.classList.remove('hidden');
        if (signupBtn) signupBtn.classList.remove('hidden');
        if (userMenu) userMenu.classList.add('hidden');
    }
}

function updateUsageInfo() {
    const usageInfo = document.getElementById('usageInfo');
    const requestsRemaining = document.getElementById('requestsRemaining');
    
    if (usageInfo && requestsRemaining && currentUser) {
        if (currentUser.isSubscribed) {
            requestsRemaining.textContent = 'Premium: Unlimited requests';
        } else {
            requestsRemaining.textContent = `Free: ${currentUser.requestsRemaining} requests remaining`;
        }
        usageInfo.classList.remove('hidden');
    }
}

// Event listeners
function initializeEventListeners() {
    // Navigation buttons
    const loginBtn = document.getElementById('loginBtn');
    const signupBtn = document.getElementById('signupBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const premiumBtn = document.getElementById('premiumBtn');

    if (loginBtn) {
        loginBtn.addEventListener('click', () => {
            window.location.href = '/login.html';
        });
    }

    if (signupBtn) {
        signupBtn.addEventListener('click', () => {
            window.location.href = '/signup.html';
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }

    if (premiumBtn) {
        premiumBtn.addEventListener('click', () => {
            window.location.href = '/premium.html';
        });
    }

    // Tool boxes
    const toolBoxes = document.querySelectorAll('.tool-box');
    toolBoxes.forEach(box => {
        box.addEventListener('click', () => {
            const tool = box.getAttribute('data-tool');
            if (tool) {
                navigateToTool(tool);
            }
        });
    });

    // Auth forms
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');

    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    if (signupForm) {
        signupForm.addEventListener('submit', handleSignup);
    }

    // Tool forms
    const questionForm = document.getElementById('questionForm');
    const summarizerForm = document.getElementById('summarizerForm');
    const qaForm = document.getElementById('qaForm');
    const studyPlanForm = document.getElementById('studyPlanForm');

    if (questionForm) {
        questionForm.addEventListener('submit', handleQuestionGeneration);
    }

    if (summarizerForm) {
        summarizerForm.addEventListener('submit', handleSummarization);
    }

    if (qaForm) {
        qaForm.addEventListener('submit', handleQuestionAnswering);
    }

    if (studyPlanForm) {
        studyPlanForm.addEventListener('submit', handleStudyPlanGeneration);
    }

    // Premium plan buttons
    const planButtons = document.querySelectorAll('[data-plan]');
    planButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const plan = e.target.getAttribute('data-plan');
            initiatePremiumPayment(plan);
        });
    });

    // Modal close
    const modal = document.getElementById('upgradeModal');
    const closeBtn = document.querySelector('.close');
    
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            modal.classList.add('hidden');
        });
    }

    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.add('hidden');
            }
        });
    }
}

// Tool navigation
function handleToolNavigation() {
    const urlParams = new URLSearchParams(window.location.search);
    const tool = urlParams.get('tool');
    
    if (tool) {
        showTool(tool);
    }
}

function navigateToTool(tool) {
    if (!currentUser) {
        window.location.href = '/login.html';
        return;
    }
    
    window.location.href = `/tools.html?tool=${tool}`;
}

function showTool(tool) {
    // Hide all tool sections
    const toolSections = document.querySelectorAll('.tool-section');
    toolSections.forEach(section => section.classList.add('hidden'));
    
    // Show selected tool
    const selectedTool = document.getElementById(tool);
    if (selectedTool) {
        selectedTool.classList.remove('hidden');
        currentTool = tool;
        
        // Update title
        const toolTitle = document.getElementById('toolTitle');
        if (toolTitle) {
            const titles = {
                'question-generator': 'Question Generator',
                'summarizer': 'Text Summarizer',
                'qa': 'Question Answering',
                'study-plan': 'Study Plan Generator'
            };
            toolTitle.textContent = titles[tool] || 'AI Study Tools';
        }
    }
}

// Authentication handlers
async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            window.location.href = '/';
        } else {
            showError(data.error);
        }
    } catch (error) {
        showError('Login failed. Please try again.');
    }
}

async function handleSignup(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    if (password !== confirmPassword) {
        showError('Passwords do not match');
        return;
    }
    
    try {
        const response = await fetch('/api/signup', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            window.location.href = '/';
        } else {
            showError(data.error);
        }
    } catch (error) {
        showError('Signup failed. Please try again.');
    }
}

async function logout() {
    try {
        await fetch('/api/logout', { method: 'POST' });
        currentUser = null;
        window.location.href = '/';
    } catch (error) {
        console.error('Logout failed:', error);
    }
}

// AI tool handlers
async function handleQuestionGeneration(e) {
    e.preventDefault();
    
    const paragraph = document.getElementById('paragraph').value;
    const resultsDiv = document.getElementById('questionResults');
    
    if (!paragraph.trim()) {
        showError('Please enter a paragraph');
        return;
    }
    
    try {
        setLoading(e.target, true);
        
        const response = await fetch('/api/generate-questions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ paragraph })
        });
        
        const data = await response.json();
        
        if (data.requiresUpgrade) {
            showUpgradeModal();
            return;
        }
        
        if (data.error) {
            showError(data.error);
            return;
        }
        
        displayQuestions(data.questions, resultsDiv);
        await checkAuthStatus(); // Update usage info
        
    } catch (error) {
        showError('Failed to generate questions. Please try again.');
    } finally {
        setLoading(e.target, false);
    }
}

async function handleSummarization(e) {
    e.preventDefault();
    
    const text = document.getElementById('textToSummarize').value;
    const resultsDiv = document.getElementById('summaryResults');
    
    if (!text.trim()) {
        showError('Please enter text to summarize');
        return;
    }
    
    try {
        setLoading(e.target, true);
        
        const response = await fetch('/api/summarize', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text })
        });
        
        const data = await response.json();
        
        if (data.requiresUpgrade) {
            showUpgradeModal();
            return;
        }
        
        if (data.error) {
            showError(data.error);
            return;
        }
        
        displaySummary(data.summary, resultsDiv);
        await checkAuthStatus(); // Update usage info
        
    } catch (error) {
        showError('Failed to summarize text. Please try again.');
    } finally {
        setLoading(e.target, false);
    }
}

async function handleQuestionAnswering(e) {
    e.preventDefault();
    
    const context = document.getElementById('context').value;
    const question = document.getElementById('question').value;
    const resultsDiv = document.getElementById('qaResults');
    
    if (!context.trim() || !question.trim()) {
        showError('Please provide both context and question');
        return;
    }
    
    try {
        setLoading(e.target, true);
        
        const response = await fetch('/api/answer-question', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ context, question })
        });
        
        const data = await response.json();
        
        if (data.requiresUpgrade) {
            showUpgradeModal();
            return;
        }
        
        if (data.error) {
            showError(data.error);
            return;
        }
        
        displayAnswer(data.answer, resultsDiv);
        await checkAuthStatus(); // Update usage info
        
    } catch (error) {
        showError('Failed to answer question. Please try again.');
    } finally {
        setLoading(e.target, false);
    }
}

async function handleStudyPlanGeneration(e) {
    e.preventDefault();
    
    const syllabus = document.getElementById('syllabus').value;
    const topics = document.getElementById('topics').value;
    const startDate = document.getElementById('startDate').value;
    const deadline = document.getElementById('deadline').value;
    const resultsDiv = document.getElementById('studyPlanResults');
    
    if (!syllabus.trim() || !topics.trim() || !startDate || !deadline) {
        showError('Please fill in all fields');
        return;
    }
    
    try {
        setLoading(e.target, true);
        
        const response = await fetch('/api/generate-study-plan', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ syllabus, topics, startDate, deadline })
        });
        
        const data = await response.json();
        
        if (data.requiresUpgrade) {
            showUpgradeModal();
            return;
        }
        
        if (data.error) {
            showError(data.error);
            return;
        }
        
        displayStudyPlan(data.studyPlan, resultsDiv);
        await checkAuthStatus(); // Update usage info
        
    } catch (error) {
        showError('Failed to generate study plan. Please try again.');
    } finally {
        setLoading(e.target, false);
    }
}

// Display functions
function displayQuestions(questions, container) {
    container.innerHTML = `
        <h3>Generated Questions</h3>
        <ul class="questions-list">
            ${questions.map(q => `<li>${q}</li>`).join('')}
        </ul>
    `;
    container.classList.remove('hidden');
}

function displaySummary(summary, container) {
    container.innerHTML = `
        <h3>Summary</h3>
        <div class="summary-text">${summary}</div>
    `;
    container.classList.remove('hidden');
}

function displayAnswer(answer, container) {
    container.innerHTML = `
        <h3>Answer</h3>
        <div class="answer-text">${answer}</div>
    `;
    container.classList.remove('hidden');
}

function displayStudyPlan(studyPlan, container) {
    container.innerHTML = `
        <h3>Your Study Plan</h3>
        <div class="study-plan-text">${studyPlan}</div>
    `;
    container.classList.remove('hidden');
}

// Payment functions
async function initiatePremiumPayment(plan) {
    if (!currentUser) {
        window.location.href = '/login.html';
        return;
    }
    
    try {
        const response = await fetch('/api/initiate-payment', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ subscriptionType: plan })
        });
        
        const data = await response.json();
        
        if (data.error) {
            showError(data.error);
            return;
        }
        
        // Initialize Paystack payment
        const handler = PaystackPop.setup({
            key: data.publicKey,
            email: currentUser.email,
            amount: data.amount * 100, // Convert to kobo
            currency: 'KES',
            ref: data.paymentReference,
            callback: function(response) {
                verifyPayment(response.reference);
            },
            onClose: function() {
                console.log('Payment cancelled');
            }
        });
        
        handler.openIframe();
        
    } catch (error) {
        showError('Failed to initiate payment. Please try again.');
    }
}

async function verifyPayment(reference) {
    try {
        const response = await fetch('/api/verify-payment', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ paymentReference: reference })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showSuccess('Payment successful! Your premium subscription is now active.');
            setTimeout(() => {
                window.location.href = '/';
            }, 2000);
        } else {
            showError('Payment verification failed. Please contact support.');
        }
    } catch (error) {
        showError('Payment verification failed. Please try again.');
    }
}

// Utility functions
function setLoading(element, isLoading) {
    if (isLoading) {
        element.classList.add('loading');
        element.disabled = true;
    } else {
        element.classList.remove('loading');
        element.disabled = false;
    }
}

function showError(message) {
    const errorDiv = document.getElementById('errorMessage');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.classList.remove('hidden');
        setTimeout(() => {
            errorDiv.classList.add('hidden');
        }, 5000);
    } else {
        alert(message);
    }
}

function showSuccess(message) {
    // Create or update success message element
    let successDiv = document.getElementById('successMessage');
    if (!successDiv) {
        successDiv = document.createElement('div');
        successDiv.id = 'successMessage';
        successDiv.className = 'success-message';
        document.body.appendChild(successDiv);
    }
    
    successDiv.textContent = message;
    successDiv.classList.remove('hidden');
    
    setTimeout(() => {
        successDiv.classList.add('hidden');
    }, 5000);
}

function showUpgradeModal() {
    const modal = document.getElementById('upgradeModal');
    if (modal) {
        modal.classList.remove('hidden');
    }
}

// URL parameter handling for tools page
function getUrlParameter(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}
// DOM Elements
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const showSignupLink = document.getElementById('show-signup');
const showLoginLink = document.getElementById('show-login');
const authContainer = document.getElementById('auth-container');
const dashboard = document.getElementById('dashboard');
const userInfo = document.getElementById('user-info');
const logoutButton = document.getElementById('logout');

let swRegistration = null;
let userId = null;

// Toggle between login and signup forms
showSignupLink.addEventListener('click', (e) => {
    e.preventDefault();
    loginForm.classList.add('hidden');
    signupForm.classList.remove('hidden');
});

showLoginLink.addEventListener('click', (e) => {
    e.preventDefault();
    signupForm.classList.add('hidden');
    loginForm.classList.remove('hidden');
});

// Parse JWT token
function parseJwt(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        return JSON.parse(window.atob(base64));
    } catch (e) {
        return null;
    }
}

// Handle signup
signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(signupForm);
    
    try {
        const response = await fetch('/auth/signup', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: formData.get('name'),
                phone: formData.get('phone'),
                vehicle_number: formData.get('vehicle_number'),
                password: formData.get('password')
            })
        });

        const data = await response.json();
        if (response.ok) {
            const token = data.token;
            const decodedToken = parseJwt(token);
            userId = decodedToken.id;
            
            localStorage.setItem('token', token);
            localStorage.setItem('vehicle_number', data.vehicle_number);
            localStorage.setItem('userId', userId);
            
            await subscribeToNotifications();
            showDashboard();
            userInfo.textContent = `Welcome ${formData.get('name')}! Vehicle: ${data.vehicle_number}`;
        } else {
            alert(data.error || 'Signup failed');
        }
    } catch (error) {
        console.error('Signup error:', error);
        alert('Failed to sign up');
    }
});

// Handle login
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(loginForm);
    
    try {
        const response = await fetch('/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                phone: formData.get('phone'),
                password: formData.get('password')
            })
        });

        const data = await response.json();
        if (response.ok) {
            const token = data.token;
            const decodedToken = parseJwt(token);
            userId = decodedToken.id;
            
            localStorage.setItem('token', token);
            localStorage.setItem('vehicle_number', data.vehicle_number);
            localStorage.setItem('userId', userId);
            
            await subscribeToNotifications();
            showDashboard();
            userInfo.textContent = `Welcome back! Vehicle: ${data.vehicle_number}`;
        } else {
            alert(data.error || 'Login failed');
        }
    } catch (error) {
        console.error('Login error:', error);
        alert('Failed to log in');
    }
});

// Handle logout
logoutButton.addEventListener('click', async () => {
    try {
        await unsubscribeFromNotifications();
        localStorage.removeItem('token');
        localStorage.removeItem('vehicle_number');
        localStorage.removeItem('userId');
        userId = null;
        showAuth();
    } catch (error) {
        console.error('Logout error:', error);
    }
});

// Push notification subscription
async function subscribeToNotifications() {
    try {
        // First get the VAPID public key from the server
        const response = await fetch('/vapid-public-key');
        const { publicKey } = await response.json();
        
        if (!publicKey) {
            throw new Error('Failed to get VAPID public key');
        }

        // Register service worker
        swRegistration = await navigator.serviceWorker.register('/sw.js');
        await navigator.serviceWorker.ready;

        // Subscribe to push notifications
        const subscription = await swRegistration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey)
        });

        // Send the subscription to the server
        await fetch('/auth/subscribe', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(subscription)
        });

        // Update service worker with subscription info
        const vehicle_number = localStorage.getItem('vehicle_number');
        if (swRegistration.active && userId && vehicle_number) {
            swRegistration.active.postMessage({
                type: 'UPDATE_SUBSCRIPTION',
                userId: userId,
                vehicle_number: vehicle_number,
                action: 'ADD'
            });
        }

        console.log('Successfully subscribed to push notifications');
    } catch (error) {
        console.error('Failed to subscribe to notifications:', error);
        throw error;
    }
}

// Unsubscribe from push notifications
async function unsubscribeFromNotifications() {
    try {
        if (!swRegistration) return;

        const subscription = await swRegistration.pushManager.getSubscription();
        if (subscription) {
            // Notify server about unsubscription
            await fetch('/auth/unsubscribe', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            // Update service worker
            if (swRegistration.active && userId) {
                swRegistration.active.postMessage({
                    type: 'UPDATE_SUBSCRIPTION',
                    userId: userId,
                    action: 'REMOVE'
                });
            }

            // Unsubscribe on the client side
            await subscription.unsubscribe();
            console.log('Successfully unsubscribed from push notifications');
        }
    } catch (error) {
        console.error('Error unsubscribing from notifications:', error);
        throw error;
    }
}

// Helper function to convert VAPID key
function urlBase64ToUint8Array(base64String) {
    if (!base64String) {
        throw new Error('VAPID public key is missing');
    }
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

// UI helpers
function showDashboard() {
    authContainer.classList.add('hidden');
    dashboard.classList.remove('hidden');
}

function showAuth() {
    dashboard.classList.add('hidden');
    authContainer.classList.remove('hidden');
    loginForm.classList.remove('hidden');
    signupForm.classList.add('hidden');
}

// Initialize
async function initialize() {
    // Check authentication status on page load
    const token = localStorage.getItem('token');
    if (token) {
        const decodedToken = parseJwt(token);
        if (decodedToken) {
            userId = decodedToken.id;
            const vehicle_number = localStorage.getItem('vehicle_number');
            showDashboard();
            userInfo.textContent = `Welcome back! Vehicle: ${vehicle_number}`;
            await subscribeToNotifications();
        } else {
            // Token is invalid
            localStorage.clear();
            showAuth();
        }
    } else {
        showAuth();
    }
}

initialize().catch(console.error);

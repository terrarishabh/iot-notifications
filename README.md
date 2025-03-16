# IoT Notifications System

A Node.js Express application that handles user authentication and push notifications for IoT alerts.

## Features

- User Authentication (Login/Signup)
- Webhook for receiving alerts
- Browser Push Notifications
- SQLite Database
- JWT Authentication

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file in the root directory:
```
PORT=3000
JWT_SECRET=your-secret-key-here
```

3. Start the server:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

## Testing with Postman

1. Create a new user using the signup endpoint:
```
POST http://localhost:3000/auth/signup
Content-Type: application/json

{
    "name": "Test User",
    "phone": "1234567890",
    "vehicle_number": "ABC123",
    "password": "password123"
}
```

2. Login to get the JWT token:
```
POST http://localhost:3000/auth/login
Content-Type: application/json

{
    "phone": "1234567890",
    "password": "password123"
}
```

3. Test the webhook endpoint:
```
POST http://localhost:3000/webhook/alerts
Content-Type: application/json

{
    "vehicle_number": "ABC123",
    "alerts": ["Low fuel warning", "Service due"]
}
```

## Browser Push Notifications

1. Open the application in a modern browser
2. Log in to your account
3. Accept the push notification permission prompt
4. You will now receive notifications when alerts are sent to your vehicle number

## Security Notes

- JWT tokens expire after 24 hours
- Passwords are hashed using bcrypt
- Push notification subscriptions are stored securely in the database
- Vehicle numbers must be unique per user

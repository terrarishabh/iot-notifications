const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');

// Create router as a function that accepts database instance
module.exports = function(getDB) {
    const router = express.Router();

    // Validation middleware
    const validateSignup = [
        body('name').trim().notEmpty().withMessage('Name is required'),
        body('phone').trim().notEmpty().withMessage('Phone number is required'),
        body('vehicle_number').trim().notEmpty().withMessage('Vehicle number is required'),
        body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
    ];

    // Signup route
    router.post('/signup', validateSignup, async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { name, phone, vehicle_number, password } = req.body;
            const db = getDB();

            // Check if user already exists
            db.get('SELECT * FROM users WHERE phone = ? OR vehicle_number = ?', [phone, vehicle_number], async (err, user) => {
                if (err) {
                    return res.status(500).json({ error: 'Database error' });
                }
                if (user) {
                    return res.status(400).json({ error: 'User already exists' });
                }

                // Hash password
                const hashedPassword = await bcrypt.hash(password, 10);

                // Create new user
                db.run(
                    'INSERT INTO users (name, phone, vehicle_number, password) VALUES (?, ?, ?, ?)',
                    [name, phone, vehicle_number, hashedPassword],
                    function(err) {
                        if (err) {
                            return res.status(500).json({ error: 'Error creating user' });
                        }

                        const token = jwt.sign(
                            { id: this.lastID, vehicle_number },
                            process.env.JWT_SECRET || 'your-secret-key',
                            { expiresIn: '24h' }
                        );

                        res.status(201).json({ token, vehicle_number });
                    }
                );
            });
        } catch (error) {
            console.error('Signup error:', error);
            res.status(500).json({ error: 'Server error' });
        }
    });

    // Login route
    router.post('/login', async (req, res) => {
        try {
            const { phone, password } = req.body;
            const db = getDB();

            db.get('SELECT * FROM users WHERE phone = ?', [phone], async (err, user) => {
                if (err) {
                    return res.status(500).json({ error: 'Database error' });
                }
                if (!user) {
                    return res.status(401).json({ error: 'Invalid credentials' });
                }

                const isMatch = await bcrypt.compare(password, user.password);
                if (!isMatch) {
                    return res.status(401).json({ error: 'Invalid credentials' });
                }

                const token = jwt.sign(
                    { id: user.id, vehicle_number: user.vehicle_number },
                    process.env.JWT_SECRET || 'your-secret-key',
                    { expiresIn: '24h' }
                );

                res.json({ token, vehicle_number: user.vehicle_number });
            });
        } catch (error) {
            console.error('Login error:', error);
            res.status(500).json({ error: 'Server error' });
        }
    });

    // Subscribe to push notifications
    router.post('/subscribe', auth, (req, res) => {
        const subscription = req.body;
        const userId = req.user.id;
        const db = getDB();

        db.run('UPDATE users SET subscription = ? WHERE id = ?',
            [JSON.stringify(subscription), userId],
            (err) => {
                if (err) {
                    return res.status(500).json({ error: 'Failed to save subscription' });
                }
                res.json({ message: 'Subscription saved' });
            }
        );
    });

    // Unsubscribe from push notifications
    router.post('/unsubscribe', auth, (req, res) => {
        const userId = req.user.id;
        const db = getDB();

        db.run('UPDATE users SET subscription = NULL WHERE id = ?', [userId], (err) => {
            if (err) {
                return res.status(500).json({ error: 'Failed to remove subscription' });
            }
            res.json({ message: 'Subscription removed' });
        });
    });

    return router;
};

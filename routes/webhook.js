const express = require('express');

module.exports = function(getDB, webpush) {
    const router = express.Router();

    router.post('/alerts', async (req, res) => {
        try {
            const { vehicle_number, alerts } = req.body;

            if (!vehicle_number || !alerts || !Array.isArray(alerts)) {
                return res.status(400).json({ error: 'Invalid payload format' });
            }

            const db = getDB();

            // Find user with matching vehicle number
            db.get('SELECT * FROM users WHERE vehicle_number = ?', [vehicle_number], (err, targetUser) => {
                if (err) {
                    return res.status(500).json({ error: 'Database error' });
                }
                if (!targetUser) {
                    return res.status(404).json({ error: 'User not found' });
                }
                if (!targetUser.subscription) {
                    return res.status(400).json({ error: 'User not subscribed to notifications' });
                }

                try {
                    const subscription = JSON.parse(targetUser.subscription);
                    
                    // Send push notification for each alert
                    const notificationPromises = alerts.map(alert => {
                        const payload = JSON.stringify({
                            title: 'Vehicle Alert',
                            body: alert,
                            icon: '/icon.png',
                            data: {
                                vehicle_number: vehicle_number,
                                userId: targetUser.id,
                                timestamp: Date.now()
                            }
                        });

                        return webpush.sendNotification(subscription, payload)
                            .catch(error => {
                                console.error('Error sending notification:', error);
                                if (error.statusCode === 410) {
                                    // Subscription has expired or is no longer valid
                                    db.run('UPDATE users SET subscription = NULL WHERE id = ?', [targetUser.id]);
                                }
                                throw error;
                            });
                    });

                    Promise.all(notificationPromises)
                        .then(() => {
                            res.json({
                                message: 'Notifications sent successfully',
                                sent_to: vehicle_number,
                                alert_count: alerts.length
                            });
                        })
                        .catch(error => {
                            console.error('Error sending notifications:', error);
                            res.status(500).json({ error: 'Failed to send notifications' });
                        });
                } catch (error) {
                    console.error('Invalid subscription format:', error);
                    res.status(500).json({ error: 'Invalid subscription format' });
                }
            });
        } catch (error) {
            console.error('Webhook error:', error);
            res.status(500).json({ error: 'Server error' });
        }
    });

    return router;
};

// Store active subscriptions
let activeSubscriptions = new Map();

// Handle subscription updates
self.addEventListener('message', function(event) {
    if (event.data.type === 'UPDATE_SUBSCRIPTION') {
        const { userId, vehicle_number, action } = event.data;
        if (action === 'ADD') {
            activeSubscriptions.set(userId, vehicle_number);
        } else if (action === 'REMOVE') {
            activeSubscriptions.delete(userId);
        }
    } else if (event.data.type === 'SHOW_NOTIFICATION' && event.data.payload) {
        const data = event.data.payload;
        const options = {
            body: data.body,
            icon: data.icon,
            badge: '/badge.png',
            vibrate: [100, 50, 100],
            data: {
                dateOfArrival: Date.now(),
                primaryKey: 1
            }
        };

        self.registration.showNotification(data.title, options);
    }
});

self.addEventListener('push', function(event) {
    const data = event.data.json();
    const notificationData = data.data || {};
    
    // Check if this user's subscription is active and matches the vehicle number
    if (activeSubscriptions.has(notificationData.userId) && 
        activeSubscriptions.get(notificationData.userId) === notificationData.vehicle_number) {
        
        const options = {
            body: data.body,
            icon: data.icon,
            badge: '/badge.png',
            vibrate: [100, 50, 100],
            data: notificationData,
            tag: `alert-${notificationData.timestamp}` // Prevent duplicate notifications
        };

        event.waitUntil(
            self.registration.showNotification(data.title, options)
        );
    }
});

self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    event.waitUntil(
        clients.openWindow('/')
    );
});

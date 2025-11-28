import React from 'react';

function NotificationCenter({ isOpen, onClose, notifications, clearNotifications }) {
    if (!isOpen) return null;

    return (
        <div className="zen-notification-panel">
            <div className="zen-notification-header">
                <h3>Notifications</h3>
                <div className="zen-actions-small">
                    <button className="zen-btn-text" onClick={clearNotifications}>Clear</button>
                    <button className="zen-btn-icon" onClick={onClose}>×</button>
                </div>
            </div>

            <div className="zen-notification-list">
                {notifications.length === 0 && (
                    <div className="zen-empty-state small">No notifications yet</div>
                )}
                {notifications.map((n, idx) => (
                    <div key={idx} className={`zen-notification-item ${n.type}`}>
                        <div className="notif-icon">
                            {n.type === 'sos' ? '⚠️' : n.type === 'threshold' ? '🌊' : 'ℹ️'}
                        </div>
                        <div className="notif-content">
                            <div className="notif-title">{n.title}</div>
                            <div className="notif-msg">{n.message}</div>
                            <div className="notif-time">{new Date(n.timestamp).toLocaleTimeString()}</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default NotificationCenter;

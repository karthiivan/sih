import React from 'react';

function SOSModal({ sosOpen, setSosOpen, sosEmail, setSosEmail, sosMessage, setSosMessage, sosFeedback, sosSending, sendSos }) {
    if (!sosOpen) return null;

    return (
        <div className="zen-modal-backdrop" onClick={() => setSosOpen(false)}>
            <div className="zen-modal" onClick={(e) => e.stopPropagation()}>
                <div className="zen-modal-header">
                    <h3>SOS Flood Warning</h3>
                    <button className="close-btn" onClick={() => setSosOpen(false)}>×</button>
                </div>

                <div className="zen-modal-body">
                    <div className="field">
                        <label>Email Address</label>
                        <input
                            type="email"
                            placeholder="e.g. name@example.com"
                            value={sosEmail}
                            onChange={(e) => setSosEmail(e.target.value)}
                        />
                    </div>

                    <div className="field">
                        <label>Message (Optional)</label>
                        <textarea
                            placeholder="Add custom details..."
                            value={sosMessage}
                            onChange={(e) => setSosMessage(e.target.value)}
                            rows={3}
                        />
                    </div>

                    {sosFeedback && (
                        <div className={`zen-notice ${sosFeedback.error ? 'error' : 'success'}`}>
                            {sosFeedback.text}
                        </div>
                    )}
                </div>

                <div className="zen-modal-actions">
                    <button className="zen-btn ghost" onClick={() => setSosOpen(false)}>Cancel</button>
                    <button
                        className="zen-btn danger"
                        disabled={sosSending || !(sosEmail && sosEmail.includes('@'))}
                        onClick={sendSos}
                    >
                        {sosSending ? 'Sending...' : 'Send SOS Alert'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default SOSModal;

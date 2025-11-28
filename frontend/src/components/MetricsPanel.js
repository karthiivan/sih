import React from 'react';

function MetricsPanel({ currentData }) {
    if (!currentData) return null;

    return (
        <div className="zen-metrics-grid">
            <div className="zen-metric-card water">
                <div className="metric-icon">💧</div>
                <div className="metric-content">
                    <span className="metric-label">Water Level</span>
                    <div className="metric-value">
                        {currentData.water_level} <span className="unit">m</span>
                    </div>
                </div>
            </div>

            <div className="zen-metric-card temp">
                <div className="metric-icon">🌡️</div>
                <div className="metric-content">
                    <span className="metric-label">Temperature</span>
                    <div className="metric-value">
                        {currentData.temperature} <span className="unit">°C</span>
                    </div>
                </div>
            </div>

            <div className="zen-metric-card cond">
                <div className="metric-icon">⚡</div>
                <div className="metric-content">
                    <span className="metric-label">Conductivity</span>
                    <div className="metric-value">
                        {currentData.conductivity} <span className="unit">µS/cm</span>
                    </div>
                </div>
            </div>

            <div className="last-updated">
                Updated: {new Date(currentData.timestamp).toLocaleString()}
            </div>
        </div>
    );
}

export default MetricsPanel;

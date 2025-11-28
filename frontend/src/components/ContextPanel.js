import React, { useMemo } from 'react';

function ContextPanel({ placeInfo, elevationInfo, weatherInfo, contextLoading, thresholdValue, setThresholdValue, thresholdEmail, setThresholdEmail, thresholdSaving, saveThreshold, selectedRegion }) {

    const weatherCondition = useMemo(() => {
        const code = weatherInfo?.current?.weather_code;
        if (code == null) return 'unknown';
        if (code === 0) return 'sunny';
        if ([1, 2, 3, 45, 48].includes(code)) return 'cloudy';
        if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || (code >= 95 && code <= 99)) return 'rainy';
        return 'cloudy';
    }, [weatherInfo]);

    return (
        <div className="zen-panel context-panel">
            <div className="zen-panel-header">
                <h3>Context</h3>
            </div>

            <div className="zen-context-grid">
                <div className="context-item">
                    <div className="label">Location</div>
                    <div className="value">{placeInfo?.display_name || '—'}</div>
                </div>

                <div className="context-item">
                    <div className="label">Elevation</div>
                    <div className="value">
                        {(elevationInfo?.results?.[0]?.elevation != null) ? `${elevationInfo.results[0].elevation} m` : '—'}
                    </div>
                </div>

                <div className="context-item">
                    <div className="label">Weather</div>
                    <div className="value">
                        {weatherInfo?.current?.temperature_2m != null ? (
                            `${weatherInfo.current.temperature_2m} °C, ${weatherInfo.current.relative_humidity_2m ?? '—'}% RH`
                        ) : '—'}
                    </div>
                </div>

                <div className="context-item condition">
                    <div className="label">Condition</div>
                    <div className="value">
                        {weatherCondition === 'sunny' && <span className="zen-wx">☀️ Sunny</span>}
                        {weatherCondition === 'cloudy' && <span className="zen-wx">☁️ Cloudy</span>}
                        {weatherCondition === 'rainy' && <span className="zen-wx">🌧️ Rainy</span>}
                        {weatherCondition === 'unknown' && <span className="zen-wx">—</span>}
                    </div>
                </div>
            </div>

            {contextLoading && <div className="muted small">Updating context...</div>}

            <div className="zen-thresholds">
                <h4>Alert Thresholds</h4>
                <div className="threshold-form">
                    <div className="field">
                        <label>Water Level (m)</label>
                        <input
                            type="number"
                            step="0.01"
                            value={thresholdValue}
                            onChange={(e) => setThresholdValue(e.target.value)}
                            placeholder="Limit"
                        />
                    </div>
                    <div className="field">
                        <label>Email Alert</label>
                        <input
                            type="email"
                            value={thresholdEmail}
                            onChange={(e) => setThresholdEmail(e.target.value)}
                            placeholder="name@example.com"
                        />
                    </div>
                    <button
                        className="zen-btn primary small"
                        disabled={thresholdSaving || !selectedRegion}
                        onClick={saveThreshold}
                    >
                        {thresholdSaving ? 'Saving...' : 'Save'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ContextPanel;

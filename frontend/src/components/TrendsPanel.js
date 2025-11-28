import React, { useMemo, useState } from 'react';
import { Line } from 'react-chartjs-2';

function TrendsPanel({ regionName, historicalData, range, setRange, type = 'water' }) {
    const [hoverInfo, setHoverInfo] = useState(null);

    // Simple linear regression for forecasting
    const forecastData = useMemo(() => {
        if (!historicalData || historicalData.length < 10 || type !== 'water') return [];

        // Use last 50 points for trend
        const recent = historicalData.slice(-50);
        const n = recent.length;
        let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;

        // Normalize time to hours from start
        const startTime = new Date(recent[0].timestamp).getTime();
        const points = recent.map(d => {
            const x = (new Date(d.timestamp).getTime() - startTime) / 3600000; // hours
            const y = d.water_level;
            return { x, y };
        });

        points.forEach(p => {
            sumX += p.x;
            sumY += p.y;
            sumXY += p.x * p.y;
            sumXX += p.x * p.x;
        });

        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;

        // Forecast next 7 days (168 hours)
        const lastTime = new Date(recent[recent.length - 1].timestamp).getTime();
        const lastX = points[points.length - 1].x;

        const forecast = [];
        for (let i = 1; i <= 7; i++) {
            const futureTime = lastTime + i * 24 * 3600000;
            const futureX = lastX + i * 24;
            const futureY = slope * futureX + intercept;
            forecast.push({
                x: new Date(futureTime),
                y: Number(futureY.toFixed(2)),
                isForecast: true
            });
        }
        return forecast;
    }, [historicalData, type]);

    const points = useMemo(() => {
        const hist = historicalData.map(item => ({
            x: new Date(item.timestamp),
            y: type === 'water' ? item.water_level : item.temperature,
            t: item,
            isForecast: false
        }));
        return [...hist, ...forecastData];
    }, [historicalData, type, forecastData]);

    const chartData = useMemo(() => ({
        labels: points.map(p => p.x),
        datasets: [
            {
                label: type === 'water' ? 'Water Level (m)' : 'Temperature (°C)',
                data: points.map(p => p.y),
                borderColor: (ctx) => ctx.raw && points[ctx.dataIndex]?.isForecast ? '#a1a1a6' : (type === 'water' ? '#789262' : '#e65d2f'),
                backgroundColor: type === 'water' ? 'rgba(120, 146, 98, 0.1)' : 'rgba(230, 93, 47, 0.1)',
                borderWidth: 2,
                pointRadius: (ctx) => points[ctx.dataIndex]?.isForecast ? 3 : 0,
                pointHoverRadius: 4,
                fill: false, // Don't fill forecast to distinguish
                tension: 0.4,
                segment: {
                    borderDash: (ctx) => points[ctx.p1DataIndex]?.isForecast ? [5, 5] : undefined,
                    borderColor: (ctx) => points[ctx.p1DataIndex]?.isForecast ? 'var(--text-muted)' : undefined
                }
            }
        ]
    }), [points, type]);

    const chartOptions = useMemo(() => ({
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 0 },
        interaction: { mode: 'index', intersect: false },
        scales: {
            x: {
                type: 'time',
                ticks: { color: 'var(--muted)', font: { family: 'sans-serif' } },
                grid: { display: false }
            },
            y: {
                title: { display: true, text: type === 'water' ? 'm' : '°C', color: 'var(--muted)' },
                ticks: { color: 'var(--muted)' },
                grid: { color: 'var(--glass-border)', borderDash: [5, 5] }
            }
        },
        plugins: {
            legend: { display: false },
            tooltip: {
                enabled: false,
                external: () => { }
            }
        },
        onHover: (event, elements) => {
            if (elements && elements.length > 0) {
                const idx = elements[0].index;
                const p = points[idx];
                if (p) {
                    setHoverInfo({
                        ts: p.x,
                        val: p.y,
                        isForecast: p.isForecast,
                        ...p.t
                    });
                }
            } else {
                setHoverInfo(null);
            }
        }
    }), [points, type]);

    return (
        <div className="zen-panel chart-panel">
            <div className="zen-panel-header">
                <h3>
                    {regionName || 'Region'} • {type === 'water' ? 'Water Level' : 'Temperature'}
                    {type === 'water' && <span className="zen-badge">Forecast Active</span>}
                </h3>
                <div className="zen-tabs">
                    {['24h', '7d', '30d', 'all'].map(r => (
                        <button
                            key={r}
                            className={`zen-tab ${range === r ? 'active' : ''}`}
                            onClick={() => setRange(r)}
                        >
                            {r.toUpperCase()}
                        </button>
                    ))}
                </div>
            </div>

            <div className="chart-container">
                <Line data={chartData} options={chartOptions} />
            </div>

            {hoverInfo && (
                <div className="zen-hover-info">
                    <div className="hover-time">
                        {new Date(hoverInfo.ts).toLocaleString()}
                        {hoverInfo.isForecast && <span className="zen-tag-forecast">FORECAST</span>}
                    </div>
                    <div className="hover-data">
                        <span>{type === 'water' ? 'WL' : 'Temp'}: {hoverInfo.val} {type === 'water' ? 'm' : '°C'}</span>
                        {!hoverInfo.isForecast && (
                            <>
                                <span>{type === 'water' ? 'Temp' : 'WL'}: {type === 'water' ? hoverInfo.temperature : hoverInfo.water_level}</span>
                                <span>Cond: {hoverInfo.conductivity}</span>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default TrendsPanel;

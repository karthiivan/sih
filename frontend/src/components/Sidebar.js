import React from 'react';

function Sidebar({ query, setQuery, filteredRegions, selectedRegion, setSelectedRegion }) {
    return (
        <aside className="zen-sidebar" id="regions">
            <div className="zen-sidebar-header">
                <h2 className="zen-section-title">Regions</h2>
                <div className="zen-search-small">
                    <input
                        placeholder="Filter regions..."
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                    />
                </div>
            </div>

            <div className="zen-region-list">
                {filteredRegions.map(r => (
                    <button
                        key={r.id}
                        className={`zen-region-item ${selectedRegion === r.id ? 'active' : ''}`}
                        onClick={() => setSelectedRegion(r.id)}
                    >
                        <div className="region-info">
                            <span className="region-name">{r.name}</span>
                            <span className="region-coords">{r.lat.toFixed(2)}, {r.lng.toFixed(2)}</span>
                        </div>
                        <div className="region-arrow">›</div>
                    </button>
                ))}
                {filteredRegions.length === 0 && (
                    <div className="zen-empty-state">No regions match your filter</div>
                )}
            </div>
        </aside>
    );
}

export default Sidebar;

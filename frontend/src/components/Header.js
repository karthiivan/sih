import React from 'react';

function Header({ globalQuery, setGlobalQuery, setSuggestOpen, suggestOpen, suggestions, activeSuggest, setActiveSuggest, applySuggestion, suggestLoading, suggestError, locateNearest, setSosOpen, theme, setTheme, toggleNotifications, unreadCount }) {
  return (
    <header className="zen-header">
      <div className="zen-header-inner">
        <div className="zen-brand">
          <h1 className="zen-title">水 (Mizu)</h1>
          <p className="zen-subtitle">Groundwater Monitoring</p>
        </div>

        <div className="zen-search-container">
          <div className="zen-search-box">
            <span className="zen-search-icon">🔍</span>
            <input
              className="zen-search-input"
              placeholder="Search location..."
              value={globalQuery}
              onChange={(e) => { setGlobalQuery(e.target.value); setSuggestOpen(true); setActiveSuggest(-1); }}
              onFocus={() => setSuggestOpen(true)}
              onKeyDown={(e) => {
                if (!suggestOpen) return;
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setActiveSuggest(prev => Math.min((prev < 0 ? -1 : prev) + 1, suggestions.length - 1));
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setActiveSuggest(prev => Math.max((prev <= 0 ? 0 : prev) - 1, 0));
                } else if (e.key === 'Enter') {
                  if (activeSuggest >= 0 && activeSuggest < suggestions.length) {
                    applySuggestion(suggestions[activeSuggest]);
                  }
                } else if (e.key === 'Escape') {
                  setSuggestOpen(false);
                }
              }}
            />
          </div>

          {suggestOpen && (
            <div className="zen-suggestions">
              {suggestLoading && <div className="zen-suggestion-item muted">Searching...</div>}
              {suggestError && <div className="zen-suggestion-item error">{suggestError}</div>}
              {!suggestLoading && !suggestError && suggestions.length === 0 && globalQuery.trim().length >= 2 && (
                <div className="zen-suggestion-item muted">No results found</div>
              )}
              {suggestions.map((s, idx) => (
                <button
                  key={idx}
                  className={`zen-suggestion-item ${idx === activeSuggest ? 'active' : ''}`}
                  onMouseEnter={() => setActiveSuggest(idx)}
                  onClick={() => applySuggestion(s)}
                >
                  <div className="suggestion-main">{s.display_name}</div>
                  <div className="suggestion-sub">Nearest: {s.nearest_regions.map(n => n.name).join(', ')}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="zen-actions">
          <button className="zen-btn" onClick={locateNearest} title="Find Nearest">
            <span>📍</span> Nearest
          </button>
          <button className="zen-btn warning" onClick={() => setSosOpen(true)} title="SOS Alert">
            <span>⚠️</span> SOS
          </button>
          <button className="zen-btn icon-only relative" onClick={toggleNotifications} title="Notifications">
            <span>🔔</span>
            {unreadCount > 0 && <span className="zen-badge-count">{unreadCount}</span>}
          </button>
          <button className="zen-btn icon-only" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} title="Toggle Theme">
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
      </div>
    </header>
  );
}

export default Header;

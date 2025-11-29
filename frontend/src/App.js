import React, { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import io from 'socket.io-client';
import './App.css';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
  Filler
} from 'chart.js';
import 'chartjs-adapter-date-fns';

// Components
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import MetricsPanel from './components/MetricsPanel';
import TrendsPanel from './components/TrendsPanel';
import ContextPanel from './components/ContextPanel';
import NotesPanel from './components/NotesPanel';
import SOSModal from './components/SOSModal';

import NotificationCenter from './components/NotificationCenter';

// Lazy load MapExplorer for performance
const MapExplorer = React.lazy(() => import('./components/MapExplorer'));

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
  Filler
);

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5002';

function App() {
  const [regions, setRegions] = useState([]);
  const [query, setQuery] = useState('');
  const [globalQuery, setGlobalQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestError, setSuggestError] = useState(null);
  const [activeSuggest, setActiveSuggest] = useState(-1);
  const [selectedRegion, setSelectedRegion] = useState(null);
  const [currentData, setCurrentData] = useState(null);
  const [historicalData, setHistoricalData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [range, setRange] = useState('7d'); // '24h' | '7d' | '30d' | 'all'
  const [placeInfo, setPlaceInfo] = useState(null);
  const [elevationInfo, setElevationInfo] = useState(null);
  const [weatherInfo, setWeatherInfo] = useState(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [sosOpen, setSosOpen] = useState(false);
  const [sosEmail, setSosEmail] = useState('');
  const [sosMessage, setSosMessage] = useState('');
  const [sosSending, setSosSending] = useState(false);
  const [sosFeedback, setSosFeedback] = useState(null);
  const [theme, setTheme] = useState('system'); // 'light' | 'dark' | 'system'
  const [thresholdValue, setThresholdValue] = useState('');
  const [thresholdEmail, setThresholdEmail] = useState('');
  const [thresholdSaving, setThresholdSaving] = useState(false);

  // Notification State
  const [notifications, setNotifications] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);

  const socketRef = useRef(null);
  const selectedRegionRef = useRef(null);

  const addNotification = (notif) => {
    setNotifications(prev => [{ ...notif, timestamp: new Date().toISOString() }, ...prev]);
  };

  useEffect(() => {
    selectedRegionRef.current = selectedRegion;
  }, [selectedRegion]);

  useEffect(() => {
    // Connect WebSocket
    socketRef.current = io(API_URL);
    socketRef.current.on('connect', () => { });
    socketRef.current.on('data_update', (data) => {
      const sel = selectedRegionRef.current;
      if (!sel || data.region === sel) {
        setCurrentData(data);
        setHistoricalData(prev => [...prev.slice(-999), data]);
      }
    });

    // Fetch regions and default data
    (async () => {
      try {
        const r = await fetch(`${API_URL}/api/regions`);
        if (!r.ok) throw new Error('Failed to load regions');
        const regionsList = await r.json();
        setRegions(regionsList);
        const initial = regionsList[0]?.id;
        setSelectedRegion(initial);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  // Theme: apply system default unless overridden
  useEffect(() => {
    const saved = localStorage.getItem('gw.theme');
    if (saved) setTheme(saved);
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const wantDark = theme === 'dark' || (theme === 'system' && media.matches);
      document.documentElement.setAttribute('data-theme', wantDark ? 'dark' : 'light');
    };
    apply();
    const listener = () => theme === 'system' && apply();
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [theme]);

  // Update when region or range changes
  useEffect(() => {
    const loadRegion = async () => {
      if (!selectedRegion) return;
      try {
        setLoading(true);
        const params = new URLSearchParams({ region: selectedRegion, limit: '2000' });
        if (range !== 'all') {
          const now = new Date();
          let start = new Date(now);
          if (range === '24h') start.setHours(now.getHours() - 24);
          if (range === '7d') start.setDate(now.getDate() - 7);
          if (range === '30d') start.setDate(now.getDate() - 30);
          params.set('start', start.toISOString());
        }
        const d = await fetch(`${API_URL}/api/data?${params.toString()}`);
        if (!d.ok) throw new Error('Failed to load data');
        const data = await d.json();
        setHistoricalData(data);
        setCurrentData(data[data.length - 1] || null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    loadRegion();
  }, [selectedRegion, range]);

  // Load external context (reverse geocode, elevation, weather) for selected region
  useEffect(() => {
    const loadContext = async () => {
      const region = regions.find(r => r.id === selectedRegion);
      if (!region) return;
      setContextLoading(true);
      try {
        const qs = `lat=${encodeURIComponent(region.lat)}&lng=${encodeURIComponent(region.lng)}`;
        const [rev, elev, weather] = await Promise.all([
          fetch(`${API_URL}/api/geocode/reverse?${qs}`),
          fetch(`${API_URL}/api/elevation?${qs}`),
          fetch(`${API_URL}/api/external/weather?${qs}`)
        ]);
        const [revJ, elevJ, weatherJ] = await Promise.all([
          rev.ok ? rev.json() : Promise.resolve(null),
          elev.ok ? elev.json() : Promise.resolve(null),
          weather.ok ? weather.json() : Promise.resolve(null)
        ]);
        setPlaceInfo(revJ);
        setElevationInfo(elevJ);
        setWeatherInfo(weatherJ);
      } catch (_) {
        // ignore errors for context panel
      } finally {
        setContextLoading(false);
      }
    };
    loadContext();
  }, [selectedRegion, regions]);

  // Load threshold for selected region
  useEffect(() => {
    const loadThr = async () => {
      if (!selectedRegion) return;
      try {
        const r = await fetch(`${API_URL}/api/thresholds`);
        if (!r.ok) return;
        const all = await r.json();
        const cfg = all[selectedRegion];
        setThresholdValue(cfg?.threshold ?? '');
        setThresholdEmail(cfg?.email ?? '');
      } catch (_) { }
    };
    loadThr();
  }, [selectedRegion, API_URL]);

  // Global search autosuggest (OSM via backend)
  useEffect(() => {
    if (!globalQuery || globalQuery.trim().length < 2) {
      setSuggestions([]);
      setSuggestLoading(false);
      setSuggestError(null);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        setSuggestLoading(true);
        setSuggestError(null);
        const r = await fetch(`${API_URL}/api/search?q=${encodeURIComponent(globalQuery)}`, { signal: ctrl.signal });
        if (r.ok) {
          const data = await r.json();
          setSuggestions(data);
          setSuggestOpen(true);
        }
      } catch (_) {
        setSuggestError('Search failed');
      }
      setSuggestLoading(false);
    }, 300);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [globalQuery, API_URL]);

  const applySuggestion = (sug) => {
    const nearest = sug.nearest_regions?.[0];
    if (nearest?.id) {
      setSelectedRegion(nearest.id);
      setSuggestOpen(false);
      setGlobalQuery(sug.display_name);
      // scroll to content
      const el = document.getElementById('regions');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const filteredRegions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return regions;
    return regions.filter(r => r.name.toLowerCase().includes(q));
  }, [regions, query]);

  const locateNearest = () => {
    if (!navigator.geolocation || regions.length === 0) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      const { latitude, longitude } = pos.coords;
      const rad = (d) => (d * Math.PI) / 180;
      const R = 6371;
      let best = null;
      regions.forEach(r => {
        const dLat = rad(r.lat - latitude);
        const dLon = rad(r.lng - longitude);
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(latitude)) * Math.cos(rad(r.lat)) * Math.sin(dLon / 2) ** 2;
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const dist = R * c;
        if (!best || dist < best.dist) best = { id: r.id, dist };
      });
      if (best) setSelectedRegion(best.id);
    });
  };

  const saveThreshold = async () => {
    setThresholdSaving(true);
    try {
      await fetch(`${API_URL}/api/thresholds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          regionId: selectedRegion,
          threshold: thresholdValue === '' ? null : Number(thresholdValue),
          email: thresholdEmail || null
        })
      });
      addNotification({ type: 'info', title: 'Threshold Saved', message: `Alert set for ${regions.find(r => r.id === selectedRegion)?.name}` });
    } finally { setThresholdSaving(false); }
  };

  const sendSos = async () => {
    setSosSending(true);
    setSosFeedback(null);
    try {
      const body = { email: sosEmail, message: sosMessage || undefined, regionId: selectedRegion };
      const res = await fetch(`${API_URL}/api/alerts/sos_email?dry_run=1`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');

      const msg = data.dry_run ? 'Simulated SOS email sent.' : 'SOS email sent successfully.';
      setSosFeedback({ error: false, text: msg });
      addNotification({ type: 'sos', title: 'SOS Alert Sent', message: `To: ${sosEmail}` });

    } catch (e) {
      setSosFeedback({ error: true, text: `Failed to send: ${e.message}` });
    } finally {
      setSosSending(false);
    }
  };

  if (loading) return <div className="zen-loading"><div>Loading...</div></div>;
  if (error) return <div className="zen-error">Error: {error}</div>;

  return (
    <div className="app zen-theme">
      <Header
        globalQuery={globalQuery}
        setGlobalQuery={setGlobalQuery}
        setSuggestOpen={setSuggestOpen}
        suggestOpen={suggestOpen}
        suggestions={suggestions}
        activeSuggest={activeSuggest}
        setActiveSuggest={setActiveSuggest}
        applySuggestion={applySuggestion}
        suggestLoading={suggestLoading}
        suggestError={suggestError}
        locateNearest={locateNearest}
        setSosOpen={setSosOpen}
        theme={theme}
        setTheme={setTheme}
        toggleNotifications={() => setNotifOpen(!notifOpen)}
        unreadCount={notifications.length}
      />

      <NotificationCenter
        isOpen={notifOpen}
        onClose={() => setNotifOpen(false)}
        notifications={notifications}
        clearNotifications={() => setNotifications([])}
      />

      <main className="zen-layout">
        <Sidebar
          query={query}
          setQuery={setQuery}
          filteredRegions={filteredRegions}
          selectedRegion={selectedRegion}
          setSelectedRegion={setSelectedRegion}
        />

        <section className="zen-content">
          <MetricsPanel currentData={currentData} />

          <Suspense fallback={<div className="zen-panel loading">Loading Map...</div>}>
            <MapExplorer
              regions={regions}
              selectedRegion={selectedRegion}
              setSelectedRegion={setSelectedRegion}
            />
          </Suspense>

          <div className="zen-charts-grid">
            <TrendsPanel
              regionName={regions.find(r => r.id === selectedRegion)?.name}
              historicalData={historicalData}
              range={range}
              setRange={setRange}
              type="water"
            />
            <TrendsPanel
              regionName={regions.find(r => r.id === selectedRegion)?.name}
              historicalData={historicalData}
              range={range}
              setRange={setRange}
              type="temp"
            />
          </div>

          <ContextPanel
            placeInfo={placeInfo}
            elevationInfo={elevationInfo}
            weatherInfo={weatherInfo}
            contextLoading={contextLoading}
            thresholdValue={thresholdValue}
            setThresholdValue={setThresholdValue}
            thresholdEmail={thresholdEmail}
            setThresholdEmail={setThresholdEmail}
            thresholdSaving={thresholdSaving}
            saveThreshold={saveThreshold}
            selectedRegion={selectedRegion}
          />

          <NotesPanel selectedRegion={selectedRegion} />
        </section>
      </main>

      <footer className="zen-footer">
        <p>© {new Date().getFullYear()} Mizu Groundwater · Harmony with Nature</p>
      </footer>

      <SOSModal
        sosOpen={sosOpen}
        setSosOpen={setSosOpen}
        sosEmail={sosEmail}
        setSosEmail={setSosEmail}
        sosMessage={sosMessage}
        setSosMessage={setSosMessage}
        sosFeedback={sosFeedback}
        sosSending={sosSending}
        sendSos={sendSos}
      />
    </div>
  );
}

export default App;

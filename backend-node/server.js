const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5002;

// --- Data & State ---

const regions = [
    { id: "chn-central", name: "Chennai Central", lat: 13.0827, lng: 80.2707 },
    { id: "blr-north", name: "Bengaluru North", lat: 13.0358, lng: 77.5970 },
    { id: "hyd-west", name: "Hyderabad West", lat: 17.3850, lng: 78.4867 },
    { id: "mum-coastal", name: "Mumbai Coastal", lat: 19.0760, lng: 72.8777 },
];

let seriesByRegion = {};

// --- Helpers ---

function generateSampleData(seedOffset = 0) {
    const now = new Date();
    const data = [];
    const days = 30;
    const hours = days * 24;

    const baseLevel = 10.0 + (seedOffset % 3);

    for (let i = 0; i < hours; i++) {
        const date = new Date(now.getTime() - (hours - i) * 60 * 60 * 1000);

        // Synthetic data generation logic ported from Python
        // trend: linspace(0, -1)
        const trend = 0 + (-1 - 0) * (i / (hours - 1));

        // seasonal: 2 * sin(linspace(0, 10*pi))
        const seasonal = 2 * Math.sin((i / (hours - 1)) * 10 * Math.PI);

        // noise: normal(0, 0.2) - approximating with random
        const u1 = Math.random();
        const u2 = Math.random();
        const noise = (Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2)) * 0.2;

        const waterLevel = baseLevel + trend + seasonal + noise;

        // Temperature: 20 + 5*sin(i/24) + random(-0.5, 0.5)
        const temp = 20 + 5 * Math.sin(i / 24) + (Math.random() - 0.5);

        // Conductivity: 900 + 100*cos(i/48) + random(-15, 15)
        const cond = 900 + 100 * Math.cos(i / 48) + (Math.random() * 30 - 15);

        data.push({
            timestamp: date.toISOString(),
            water_level: parseFloat(waterLevel.toFixed(2)),
            temperature: parseFloat(temp.toFixed(1)),
            conductivity: parseFloat(cond.toFixed(2))
        });
    }
    return data;
}

// Initialize data
regions.forEach((r, idx) => {
    seriesByRegion[r.id] = generateSampleData(idx);
});

// --- Thresholds ---
const THRESHOLDS_FILE = path.join(__dirname, 'thresholds.json');
const NOTES_FILE = path.join(__dirname, 'notes.json');
let thresholds = {};
let notes = [];

// Load initial data synchronously at startup
try {
    if (fs.existsSync(THRESHOLDS_FILE)) {
        thresholds = JSON.parse(fs.readFileSync(THRESHOLDS_FILE, 'utf8'));
    }
} catch (e) {
    console.error("Error reading thresholds:", e);
    thresholds = {};
}

try {
    if (fs.existsSync(NOTES_FILE)) {
        notes = JSON.parse(fs.readFileSync(NOTES_FILE, 'utf8'));
    }
} catch (e) {
    console.error("Error reading notes:", e);
    notes = [];
}

// Async save helpers
function saveThresholds() {
    fs.writeFile(THRESHOLDS_FILE, JSON.stringify(thresholds, null, 2), (err) => {
        if (err) console.error("Error writing thresholds:", err);
    });
}

function saveNotes() {
    fs.writeFile(NOTES_FILE, JSON.stringify(notes, null, 2), (err) => {
        if (err) console.error("Error writing notes:", err);
    });
}

// --- Routes ---

app.get('/api/regions', (req, res) => {
    res.json(regions);
});

app.get('/api/data', (req, res) => {
    const regionId = req.query.region || regions[0].id;
    const data = seriesByRegion[regionId];

    if (!data) {
        return res.status(404).json({ error: "unknown region" });
    }

    let startDt = req.query.start ? new Date(req.query.start) : null;
    let endDt = req.query.end ? new Date(req.query.end) : null;

    let offset = parseInt(req.query.offset) || 0;
    let limit = Math.min(parseInt(req.query.limit) || 1000, 5000);

    let filtered = data;
    if (startDt || endDt) {
        filtered = data.filter(d => {
            const t = new Date(d.timestamp);
            if (startDt && t < startDt) return false;
            if (endDt && t > endDt) return false;
            return true;
        });
    }

    const sliced = filtered.slice(offset, offset + limit);
    res.json(sliced);
});

app.get('/api/current', (req, res) => {
    const regionId = req.query.region || regions[0].id;
    const data = seriesByRegion[regionId];
    if (data && data.length > 0) {
        res.json(data[data.length - 1]);
    } else {
        res.status(404).json({ error: "No data available for region" });
    }
});

// Haversine formula
function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371.0;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

app.get('/api/stations/near', (req, res) => {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    const limit = parseInt(req.query.limit) || 5;
    const radiusKm = parseFloat(req.query.radius_km) || 200;

    if (isNaN(lat) || isNaN(lng)) {
        return res.status(400).json({ error: "lat,lng must be numbers" });
    }

    const enriched = regions.map(r => {
        const d = haversineKm(lat, lng, r.lat, r.lng);
        return { ...r, distance_km: parseFloat(d.toFixed(2)) };
    }).filter(r => r.distance_km <= radiusKm);

    enriched.sort((a, b) => a.distance_km - b.distance_km);
    res.json(enriched.slice(0, limit));
});

app.get('/api/search', async (req, res) => {
    const q = req.query.q;
    if (!q || q.trim().length < 2) {
        return res.status(400).json({ error: "query too short" });
    }

    try {
        const resp = await axios.get('https://nominatim.openstreetmap.org/search', {
            params: { q, format: 'json', limit: 5 },
            headers: { 'User-Agent': 'GW-Monitor/1.0' }
        });

        const results = resp.data;
        const mapped = results.map(item => {
            const lat = parseFloat(item.lat);
            const lon = parseFloat(item.lon);
            if (isNaN(lat) || isNaN(lon)) return null;

            const nearest = regions.map(r => ({
                ...r,
                distance_km: parseFloat(haversineKm(lat, lon, r.lat, r.lng).toFixed(2))
            })).sort((a, b) => a.distance_km - b.distance_km).slice(0, 3);

            return {
                display_name: item.display_name,
                lat,
                lng: lon,
                nearest_regions: nearest
            };
        }).filter(Boolean);

        res.json(mapped);
    } catch (e) {
        res.status(502).json({ error: "geocoding failed", detail: e.message });
    }
});

app.get('/api/external/weather', async (req, res) => {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);

    if (isNaN(lat) || isNaN(lng)) {
        return res.status(400).json({ error: "lat,lng must be numbers" });
    }

    try {
        const resp = await axios.get('https://api.open-meteo.com/v1/forecast', {
            params: {
                latitude: lat,
                longitude: lng,
                current: 'temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,weather_code',
                hourly: 'temperature_2m,precipitation',
                past_days: 1,
                forecast_days: 1
            },
            timeout: 10000
        });
        res.json(resp.data);
    } catch (e) {
        res.status(502).json({ error: "weather fetch failed", detail: e.message });
    }
});

app.get('/api/geocode/reverse', async (req, res) => {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);

    if (isNaN(lat) || isNaN(lng)) {
        return res.status(400).json({ error: "lat,lng must be numbers" });
    }

    try {
        const resp = await axios.get('https://nominatim.openstreetmap.org/reverse', {
            params: { lat, lon: lng, format: 'jsonv2' },
            headers: { 'User-Agent': 'GW-Monitor/1.0' },
            timeout: 10000
        });
        res.json(resp.data);
    } catch (e) {
        res.status(502).json({ error: "reverse geocoding failed", detail: e.message });
    }
});

app.get('/api/elevation', async (req, res) => {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);

    if (isNaN(lat) || isNaN(lng)) {
        return res.status(400).json({ error: "lat,lng must be numbers" });
    }

    try {
        const resp = await axios.get('https://api.open-elevation.com/api/v1/lookup', {
            params: { locations: `${lat},${lng}` },
            timeout: 10000
        });
        res.json(resp.data);
    } catch (e) {
        res.status(502).json({ error: "elevation fetch failed", detail: e.message });
    }
});

// --- Thresholds API ---

app.get('/api/thresholds', (req, res) => {
    res.json(thresholds);
});

app.post('/api/thresholds', (req, res) => {
    const data = req.body || {};
    const regionId = data.regionId;
    const email = data.email;
    let value = data.threshold !== undefined ? parseFloat(data.threshold) : null;

    if (value !== null && isNaN(value)) {
        return res.status(400).json({ error: "threshold must be a number" });
    }
    if (!regionId) {
        return res.status(400).json({ error: "regionId is required" });
    }

    if (!thresholds[regionId]) {
        thresholds[regionId] = { threshold: null, email: null, last_notified_ts: null };
    }
    if (value !== null) thresholds[regionId].threshold = value;
    if (email !== undefined) thresholds[regionId].email = email;

    saveThresholds();
    res.json(thresholds[regionId]);
});

// --- Notes API ---

app.get('/api/notes', (req, res) => {
    const regionId = req.query.region;
    if (!regionId) {
        return res.json(notes);
    }
    const regionNotes = notes.filter(n => n.regionId === regionId);
    // Sort by timestamp desc
    regionNotes.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    res.json(regionNotes);
});

app.post('/api/notes', (req, res) => {
    const { regionId, text, water_level } = req.body;

    if (!regionId || !text) {
        return res.status(400).json({ error: "regionId and text are required" });
    }

    const newNote = {
        id: Date.now().toString(),
        regionId,
        text,
        water_level: water_level ? parseFloat(water_level) : null,
        timestamp: new Date().toISOString()
    };

    notes.push(newNote);
    saveNotes();
    res.json(newNote);
});

app.delete('/api/notes/:id', (req, res) => {
    const { id } = req.params;
    const idx = notes.findIndex(n => n.id === id);
    if (idx !== -1) {
        notes.splice(idx, 1);
        saveNotes();
        res.json({ success: true });
    } else {
        res.status(404).json({ error: "Note not found" });
    }
});

// --- Alerts ---

app.post('/api/alerts/sos', (req, res) => {
    // Simplified simulation
    const data = req.body || {};
    const phone = data.phone;
    const message = data.message || "SOS Flood Warning";

    if (!phone) return res.status(400).json({ error: "phone is required" });

    res.json({
        sent: true,
        dry_run: true,
        to: phone,
        message: message,
        info: "Simulated send (Node.js backend)"
    });
});

app.post('/api/alerts/sos_email', (req, res) => {
    // Simplified simulation
    const data = req.body || {};
    const email = data.email;
    const message = data.message || "SOS Flood Warning";

    if (!email) return res.status(400).json({ error: "email is required" });

    res.json({
        sent: true,
        dry_run: true,
        to: email,
        message: message,
        info: "Simulated email send (Node.js backend)"
    });
});

// --- Socket.IO & Background Tasks ---

io.on('connection', (socket) => {
    console.log('Client connected');

    const defaultRegion = regions[0].id;
    const data = seriesByRegion[defaultRegion];
    if (data && data.length > 0) {
        socket.emit('data_update', { ...data[data.length - 1], region: defaultRegion });
    }

    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

// Update water level simulation
setInterval(() => {
    const nowIso = new Date().toISOString();
    regions.forEach(r => {
        const rid = r.id;
        const lastReading = seriesByRegion[rid][seriesByRegion[rid].length - 1];

        const newReading = {
            timestamp: nowIso,
            water_level: parseFloat((lastReading.water_level + (Math.random() * 0.2 - 0.1)).toFixed(2)),
            temperature: parseFloat((lastReading.temperature + (Math.random() * 0.6 - 0.3)).toFixed(1)),
            conductivity: parseFloat((lastReading.conductivity + (Math.random() * 16 - 8)).toFixed(2)),
            region: rid
        };

        seriesByRegion[rid].push(newReading);
        if (seriesByRegion[rid].length > 2000) {
            seriesByRegion[rid] = seriesByRegion[rid].slice(-2000);
        }

        io.emit('data_update', { ...newReading, region: rid });
    });
}, 10000); // 10 seconds

// Check thresholds loop
setInterval(() => {
    const now = new Date();
    Object.keys(thresholds).forEach(rid => {
        const cfg = thresholds[rid];
        if (!cfg.threshold || !cfg.email) return;

        const series = seriesByRegion[rid];
        if (!series || series.length === 0) return;

        const latest = series[series.length - 1];
        const wl = latest.water_level;

        // Check cooldown (1 hour)
        let okayToNotify = true;
        if (cfg.last_notified_ts) {
            const lastDt = new Date(cfg.last_notified_ts);
            if ((now - lastDt) < 60 * 60 * 1000) {
                okayToNotify = false;
            }
        }

        if (wl >= cfg.threshold && okayToNotify) {
            console.log(`Threshold exceeded for ${rid}: ${wl} >= ${cfg.threshold}`);
            // Simulate sending email
            thresholds[rid].last_notified_ts = now.toISOString();
            saveThresholds();
        }
    });
}, 60000); // 60 seconds

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

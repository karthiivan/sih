from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_socketio import SocketIO, emit
import random
from datetime import datetime, timedelta, timezone
import json
import os
from dotenv import load_dotenv
import requests
import pandas as pd
import numpy as np

load_dotenv()

app = Flask(__name__)
CORS(app)
socketio = SocketIO(
    app,
    cors_allowed_origins="*",
    async_mode="threading",
    ping_timeout=20,
    ping_interval=25,
)

# In-memory storage for demonstration
# regions meta and time series per region
regions = [
    {"id": "chn-central", "name": "Chennai Central", "lat": 13.0827, "lng": 80.2707},
    {"id": "blr-north", "name": "Bengaluru North", "lat": 13.0358, "lng": 77.5970},
    {"id": "hyd-west", "name": "Hyderabad West", "lat": 17.3850, "lng": 78.4867},
    {"id": "mum-coastal", "name": "Mumbai Coastal", "lat": 19.0760, "lng": 72.8777},
]
series_by_region = {}

# Generate sample DWLR data
def generate_sample_data(seed_offset: int = 0):
    end_time = datetime.now()
    start_time = end_time - timedelta(days=30)
    date_range = pd.date_range(start=start_time, end=end_time, freq='h')
    
    # Generate synthetic water level data (in meters)
    rng = np.random.default_rng(42 + seed_offset)
    base_level = 10.0 + (seed_offset % 3)  # small offset per region
    trend = np.linspace(0, -1, len(date_range))
    seasonal = 2 * np.sin(np.linspace(0, 10 * np.pi, len(date_range)))
    noise = rng.normal(0, 0.2, len(date_range))
    
    water_levels = base_level + trend + seasonal + noise
    
    return [{
        'timestamp': date.isoformat(),
        'water_level': round(level, 2),
        'temperature': round(20 + 5*np.sin(i/24) + random.uniform(-0.5, 0.5), 1),
        'conductivity': round(900 + 100*np.cos(i/48) + random.uniform(-15, 15), 2)
    } for i, (date, level) in enumerate(zip(date_range, water_levels))]

# Initialize with sample data per region
for idx, r in enumerate(regions):
    series_by_region[r['id']] = generate_sample_data(seed_offset=idx)

@app.route('/api/regions', methods=['GET'])
def get_regions():
    return jsonify(regions)


@app.route('/api/data', methods=['GET'])
def get_water_data():
    """Return water data with optional filtering and pagination.
    Query params:
    - region: region id (optional). If omitted, defaults to first region.
    - start: ISO timestamp inclusive
    - end: ISO timestamp inclusive
    - offset: int, default 0
    - limit: int, default 1000 (max 5000)
    """
    region_id = request.args.get('region') or regions[0]['id']
    data = series_by_region.get(region_id)
    if data is None:
        return jsonify({"error": "unknown region"}), 404
    start = request.args.get('start')
    end = request.args.get('end')
    try:
        offset = int(request.args.get('offset', 0))
        limit = min(int(request.args.get('limit', 1000)), 5000)
    except ValueError:
        return jsonify({"error": "offset and limit must be integers"}), 400

    def parse_ts(ts):
        try:
            s = ts.strip()
            # Support trailing 'Z' as UTC
            if s.endswith('Z'):
                dt = datetime.fromisoformat(s.replace('Z', '+00:00'))
            else:
                dt = datetime.fromisoformat(s)
            # Normalize to naive UTC for comparison with stored naive timestamps
            if dt.tzinfo is not None:
                dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
            return dt
        except Exception:
            return None

    start_dt = parse_ts(start) if start else None
    end_dt = parse_ts(end) if end else None

    filtered = data
    if start_dt or end_dt:
        filtered = [
            d for d in data
            if (
                (start_dt is None or datetime.fromisoformat(d['timestamp']) >= start_dt)
                and (end_dt is None or datetime.fromisoformat(d['timestamp']) <= end_dt)
            )
        ]

    # Apply pagination window
    sliced = filtered[offset: offset + limit]
    return jsonify(sliced)

@app.route('/api/current', methods=['GET'])
def get_current_reading():
    region_id = request.args.get('region') or regions[0]['id']
    data = series_by_region.get(region_id)
    if data:
        return jsonify(data[-1])
    return jsonify({"error": "No data available for region"}), 404

@socketio.on('connect')
def handle_connect():
    print('Client connected')
    # Optionally send latest reading for default region
    default_region = regions[0]['id']
    data = series_by_region.get(default_region, [])
    if data:
        emit('data_update', {**data[-1], 'region': default_region})

@socketio.on('disconnect')
def handle_disconnect():
    print('Client disconnected')

def update_water_level():
    """Simulate real-time data updates"""
    global series_by_region
    while True:
        socketio.sleep(10)  # Update every 10 seconds
        now_iso = datetime.now().isoformat()
        for r in regions:
            rid = r['id']
            last_reading = series_by_region[rid][-1].copy()
            new_reading = {
                'timestamp': now_iso,
                'water_level': round(last_reading['water_level'] + random.uniform(-0.1, 0.1), 2),
                'temperature': round(last_reading['temperature'] + random.uniform(-0.3, 0.3), 1),
                'conductivity': round(last_reading['conductivity'] + random.uniform(-8, 8), 2),
                'region': rid
            }
            series_by_region[rid].append(new_reading)
            if len(series_by_region[rid]) > 2000:
                series_by_region[rid] = series_by_region[rid][-2000:]
            socketio.emit('data_update', {**new_reading, 'region': rid})

def haversine_km(lat1, lon1, lat2, lon2):
    from math import radians, sin, cos, atan2, sqrt
    R = 6371.0
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat/2)**2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon/2)**2
    c = 2 * atan2(sqrt(a), sqrt(1 - a))
    return R * c

@app.route('/api/stations/near', methods=['GET'])
def stations_near():
    try:
        lat = float(request.args.get('lat'))
        lng = float(request.args.get('lng'))
        limit = int(request.args.get('limit', 5))
        radius_km = float(request.args.get('radius_km', 200))
    except (TypeError, ValueError):
        return jsonify({"error": "lat,lng must be numbers"}), 400
    enriched = []
    for r in regions:
        d = haversine_km(lat, lng, r['lat'], r['lng'])
        if d <= radius_km:
            enriched.append({**r, 'distance_km': round(d, 2)})
    enriched.sort(key=lambda x: x['distance_km'])
    return jsonify(enriched[:limit])

@app.route('/api/search', methods=['GET'])
def search_places():
    q = request.args.get('q')
    if not q or len(q.strip()) < 2:
        return jsonify({"error": "query too short"}), 400
    # Call OSM/Nominatim
    try:
        resp = requests.get(
            'https://nominatim.openstreetmap.org/search',
            params={'q': q, 'format': 'json', 'limit': 5},
            headers={'User-Agent': 'GW-Monitor/1.0'}
        )
        results = resp.json()
    except Exception as e:
        return jsonify({"error": "geocoding failed", "detail": str(e)}), 502
    # Map to simple payload and include nearest regions for first result
    mapped = []
    for item in results:
        try:
            lat = float(item.get('lat'))
            lon = float(item.get('lon'))
        except (TypeError, ValueError):
            continue
        # nearest 3 regions
        nearest = sorted(
            (
                {**r, 'distance_km': round(haversine_km(lat, lon, r['lat'], r['lng']), 2)}
                for r in regions
            ),
            key=lambda x: x['distance_km']
        )[:3]
        mapped.append({
            'display_name': item.get('display_name'),
            'lat': lat,
            'lng': lon,
            'nearest_regions': nearest
        })
    return jsonify(mapped)

@app.route('/api/external/weather', methods=['GET'])
def external_weather():
    try:
        lat = float(request.args.get('lat'))
        lng = float(request.args.get('lng'))
    except (TypeError, ValueError):
        return jsonify({"error": "lat,lng must be numbers"}), 400
    # Use Open-Meteo free API
    try:
        resp = requests.get(
            'https://api.open-meteo.com/v1/forecast',
            params={
                'latitude': lat,
                'longitude': lng,
                'current': 'temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,weather_code',
                'hourly': 'temperature_2m,precipitation',
                'past_days': 1,
                'forecast_days': 1
            },
            timeout=10
        )
        data = resp.json()
        return jsonify(data)
    except Exception as e:
        return jsonify({"error": "weather fetch failed", "detail": str(e)}), 502

@app.route('/api/geocode/reverse', methods=['GET'])
def reverse_geocode():
    try:
        lat = float(request.args.get('lat'))
        lng = float(request.args.get('lng'))
    except (TypeError, ValueError):
        return jsonify({"error": "lat,lng must be numbers"}), 400
    try:
        r = requests.get(
            'https://nominatim.openstreetmap.org/reverse',
            params={'lat': lat, 'lon': lng, 'format': 'jsonv2'},
            headers={'User-Agent': 'GW-Monitor/1.0'},
            timeout=10
        )
        return jsonify(r.json())
    except Exception as e:
        return jsonify({"error": "reverse geocoding failed", "detail": str(e)}), 502

@app.route('/api/elevation', methods=['GET'])
def elevation():
    try:
        lat = float(request.args.get('lat'))
        lng = float(request.args.get('lng'))
    except (TypeError, ValueError):
        return jsonify({"error": "lat,lng must be numbers"}), 400
    try:
        # Open-Elevation public API
        r = requests.get(
            'https://api.open-elevation.com/api/v1/lookup',
            params={'locations': f'{lat},{lng}'},
            timeout=10
        )
        j = r.json()
        return jsonify(j)
    except Exception as e:
        return jsonify({"error": "elevation fetch failed", "detail": str(e)}), 502

# ---- Threshold alerts (JSON store) ----
THRESHOLDS_FILE = os.path.join(os.path.dirname(__file__), 'thresholds.json')
try:
    with open(THRESHOLDS_FILE, 'r') as f:
        thresholds = json.load(f)
except Exception:
    thresholds = {}

def save_thresholds():
    try:
        with open(THRESHOLDS_FILE, 'w') as f:
            json.dump(thresholds, f, indent=2)
    except Exception:
        pass

@app.route('/api/thresholds', methods=['GET'])
def get_thresholds():
    return jsonify(thresholds)

@app.route('/api/thresholds', methods=['POST'])
def set_threshold():
    data = request.get_json(silent=True) or {}
    region_id = data.get('regionId')
    email = data.get('email')
    try:
        value = float(data.get('threshold')) if data.get('threshold') is not None else None
    except (TypeError, ValueError):
        return jsonify({"error": "threshold must be a number"}), 400
    if not region_id:
        return jsonify({"error": "regionId is required"}), 400
    if region_id not in thresholds:
        thresholds[region_id] = {"threshold": None, "email": None, "last_notified_ts": None}
    if value is not None:
        thresholds[region_id]['threshold'] = value
    if email is not None:
        thresholds[region_id]['email'] = email
    save_thresholds()
    return jsonify(thresholds[region_id])

def check_thresholds_loop():
    while True:
        try:
            now = datetime.utcnow()
            for rid, cfg in list(thresholds.items()):
                thr = cfg.get('threshold')
                email = cfg.get('email')
                if thr is None or not email:
                    continue
                series = series_by_region.get(rid, [])
                if not series:
                    continue
                latest = series[-1]
                wl = latest.get('water_level')
                ts = latest.get('timestamp')
                # Avoid spamming: notify at most once per hour per region
                last_ts = cfg.get('last_notified_ts')
                okay_to_notify = True
                if last_ts:
                    try:
                        last_dt = datetime.fromisoformat(last_ts)
                        okay_to_notify = (now - last_dt) > timedelta(minutes=60)
                    except Exception:
                        pass
                if wl is not None and wl >= thr and okay_to_notify:
                    # fire email via internal endpoint (dry_run configurable)
                    try:
                        alerts_dry = os.getenv('ALERTS_DRY_RUN', '1')
                        dry_param = '0' if alerts_dry in ('0','false','no') else '1'
                        requests.post(
                            f"http://127.0.0.1:{int(os.getenv('PORT','5000'))}/api/alerts/sos_email?dry_run={dry_param}",
                            json={
                                "email": email,
                                "regionId": rid,
                                "message": f"Threshold exceeded: WL {wl} m >= {thr} m at {ts}"
                            }, timeout=5
                        )
                        thresholds[rid]['last_notified_ts'] = now.isoformat()
                        save_thresholds()
                    except Exception:
                        pass
        except Exception:
            pass
        finally:
            # check every 60 seconds
            socketio.sleep(60)

@app.route('/api/alerts/sos', methods=['POST'])
def sos_alert():
    data = request.get_json(silent=True) or {}
    phone = data.get('phone')
    message = data.get('message')
    region_id = data.get('regionId')
    dry_run = str(request.args.get('dry_run', data.get('dry_run', '0'))).lower() in ('1','true','yes')
    
    if not phone:
        return jsonify({"error": "phone is required"}), 400
    # Build default message if not provided
    if not message:
        region_name = None
        latest = None
        if region_id:
            region = next((r for r in regions if r['id'] == region_id), None)
            if region:
                region_name = region['name']
                series = series_by_region.get(region_id, [])
                latest = series[-1] if series else None
        base = f"SOS Flood Warning"
        if region_name:
            base += f" | Region: {region_name}"
        if latest:
            base += f" | WL: {latest.get('water_level')} m, Temp: {latest.get('temperature')} °C"
        message = base + ". Please take immediate precautions and move to higher ground."

    # Dry run or missing credentials -> simulate success
    account_sid = os.getenv('TWILIO_ACCOUNT_SID')
    auth_token = os.getenv('TWILIO_AUTH_TOKEN')
    from_number = os.getenv('TWILIO_FROM')
    if dry_run or not (account_sid and auth_token and from_number):
        return jsonify({
            "sent": False if not dry_run else True,
            "dry_run": dry_run,
            "to": phone,
            "message": message,
            "info": "Simulated send (provide TWILIO_* envs or set dry_run=1)"
        })

    try:
        try:
            from twilio.rest import Client  # lazy import
        except ImportError:
            return jsonify({
                "error": "twilio_not_installed",
                "detail": "Install twilio or use dry_run=1",
                "to": phone,
                "message": message
            }), 500
        client = Client(account_sid, auth_token)
        resp = client.messages.create(body=message, from_=from_number, to=phone)
        return jsonify({"sent": True, "sid": resp.sid})
    except Exception as e:
        return jsonify({"error": "sms failed", "detail": str(e)}), 502

@app.route('/api/alerts/sos_email', methods=['POST'])
def sos_email():
    data = request.get_json(silent=True) or {}
    email = data.get('email')
    subject = data.get('subject') or 'SOS Flood Warning'
    message = data.get('message')
    region_id = data.get('regionId')
    dry_run = str(request.args.get('dry_run', data.get('dry_run', '1'))).lower() in ('1','true','yes')

    if not email:
        return jsonify({"error": "email is required"}), 400
    # Compose default message
    if not message:
        region_name = None
        latest = None
        if region_id:
            region = next((r for r in regions if r['id'] == region_id), None)
            if region:
                region_name = region['name']
                series = series_by_region.get(region_id, [])
                latest = series[-1] if series else None
        base = f"SOS Flood Warning"
        if region_name:
            base += f" | Region: {region_name}"
        if latest:
            base += f" | WL: {latest.get('water_level')} m, Temp: {latest.get('temperature')} °C"
        message = base + ". Please take immediate precautions and move to higher ground."

    # SMTP configuration
    smtp_host = os.getenv('SMTP_HOST')
    smtp_port = int(os.getenv('SMTP_PORT', '587'))
    smtp_user = os.getenv('SMTP_USER')
    smtp_pass = os.getenv('SMTP_PASS')
    smtp_from = os.getenv('SMTP_FROM', smtp_user or 'alerts@example.com')

    if dry_run or not (smtp_host and smtp_user and smtp_pass):
        return jsonify({
            "sent": False if not dry_run else True,
            "dry_run": dry_run,
            "to": email,
            "subject": subject,
            "message": message,
            "info": "Simulated email send (set SMTP_* envs or keep dry_run=1)"
        })

    try:
        import smtplib
        from email.mime.text import MIMEText
        mime = MIMEText(message)
        mime['Subject'] = subject
        mime['From'] = smtp_from
        mime['To'] = email

        with smtplib.SMTP(smtp_host, smtp_port, timeout=15) as server:
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.sendmail(smtp_from, [email], mime.as_string())
        return jsonify({"sent": True})
    except Exception as e:
        return jsonify({"error": "email failed", "detail": str(e)}), 502

if __name__ == '__main__':
    # Start the background thread for simulating real-time updates
    socketio.start_background_task(update_water_level)
    # Start threshold checking loop
    socketio.start_background_task(check_thresholds_loop)
    # Run the app
    port = int(os.getenv('PORT', '5000'))
    debug = os.getenv('FLASK_DEBUG', '1') == '1'
    socketio.run(app, debug=debug, port=port, host='0.0.0.0')

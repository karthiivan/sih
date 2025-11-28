import React, { useEffect, useRef } from 'react';

function MapExplorer({ regions, selectedRegion, setSelectedRegion }) {
    const mapRef = useRef(null);
    const mapInstanceRef = useRef(null);

    useEffect(() => {
        const gl = window.maplibregl;
        if (!gl) return;
        if (!mapRef.current) return;

        if (!mapInstanceRef.current) {
            mapInstanceRef.current = new gl.Map({
                container: mapRef.current,
                // Use a more muted, "Zen" style map if possible, or standard positron
                style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
                center: [78.4867, 17.385],
                zoom: 4,
                attributionControl: false
            });
            mapInstanceRef.current.addControl(new gl.NavigationControl(), 'top-right');
        }

        const map = mapInstanceRef.current;

        // Clear existing markers
        if (map._gwMarkers) {
            map._gwMarkers.forEach(m => m.remove());
        }
        map._gwMarkers = [];

        regions.forEach(r => {
            if (r.lng == null || r.lat == null) return;

            const el = document.createElement('div');
            el.className = `zen-map-marker ${selectedRegion === r.id ? 'active' : ''}`;
            // Simple circle marker with ripple effect for active
            el.innerHTML = '<div class="marker-dot"></div><div class="marker-pulse"></div>';

            el.title = r.name;
            el.addEventListener('click', () => {
                setSelectedRegion(r.id);
                map.flyTo({ center: [r.lng, r.lat], zoom: 10, essential: true });
            });

            const marker = new gl.Marker({ element: el })
                .setLngLat([r.lng, r.lat])
                .addTo(map);

            map._gwMarkers.push(marker);
        });

        // Fly to selected region if changed
        if (selectedRegion) {
            const r = regions.find(reg => reg.id === selectedRegion);
            if (r && r.lng && r.lat) {
                map.flyTo({ center: [r.lng, r.lat], zoom: 10, essential: true });
            }
        }

    }, [regions, selectedRegion, setSelectedRegion]);

    return (
        <div className="zen-panel map-panel">
            <div className="zen-panel-header">
                <h3>Map Explorer</h3>
            </div>
            <div className="map-container" ref={mapRef} />
        </div>
    );
}

export default MapExplorer;

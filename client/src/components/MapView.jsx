import { useEffect, useMemo, useRef, useState } from 'react';
import { Circle, CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet';
import { RefreshCw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { api, getApiError } from '../services/api.js';
import PriorityBadge from './PriorityBadge.jsx';

const CITY_CENTER = [39.8018, -89.6503];
const severityColors = { 1: '#48bfa3', 2: '#81c275', 3: '#f1b45f', 4: '#ef8f59', 5: '#e56c60' };
let googleMapsPromise;

function loadGoogleMaps(apiKey) {
  if (window.google?.maps) return Promise.resolve(window.google);
  if (googleMapsPromise) return googleMapsPromise;
  googleMapsPromise = new Promise((resolve, reject) => {
    const callbackName = '__cityPulseGoogleMapsReady';
    window[callbackName] = () => resolve(window.google);
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&callback=${callbackName}&v=weekly`;
    script.async = true;
    script.onerror = () => reject(new Error('Google Maps could not load. Check your API key, billing, and allowed website address.'));
    document.head.appendChild(script);
  }).catch((error) => {
    googleMapsPromise = null;
    throw error;
  });
  return googleMapsPromise;
}

function GoogleMapCanvas({ features, compact, onReportSelect }) {
  const elementRef = useRef(null);
  const [map, setMap] = useState(null);
  const [mapError, setMapError] = useState('');
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  useEffect(() => {
    let active = true;
    loadGoogleMaps(apiKey).then((google) => {
      if (!active || !elementRef.current) return;
      setMap(new google.maps.Map(elementRef.current, {
        center: { lat: CITY_CENTER[0], lng: CITY_CENTER[1] },
        zoom: 13,
        mapTypeControl: true,
        streetViewControl: false,
        fullscreenControl: true,
        clickableIcons: false,
      }));
    }).catch((error) => { if (active) setMapError(error.message); });
    return () => { active = false; };
  }, [apiKey, elementRef]);

  useEffect(() => {
    if (!map || !window.google?.maps) return undefined;
    const google = window.google;
    const overlays = [];
    const infoWindow = new google.maps.InfoWindow();
    const cells = new Map();
    for (const feature of features) {
      const key = feature.properties.cellId;
      const coords = feature.geometry?.coordinates;
      if (!coords) continue;
      const points = cells.get(key) || { lat: 0, lng: 0, count: 0 };
      points.lat += coords[1];
      points.lng += coords[0];
      points.count += 1;
      cells.set(key, points);
    }
    for (const cell of cells.values()) {
      overlays.push(new google.maps.Circle({
        map,
        center: { lat: cell.lat / cell.count, lng: cell.lng / cell.count },
        radius: 80 + Math.min(cell.count, 20) * 9,
        strokeColor: '#e47752',
        strokeOpacity: 0.7,
        strokeWeight: 1,
        fillColor: '#f39c6b',
        fillOpacity: Math.min(0.27, 0.07 + cell.count * 0.012),
        clickable: false,
      }));
    }
    for (const feature of features) {
      const props = feature.properties;
      const [longitude, latitude] = feature.geometry.coordinates;
      const marker = new google.maps.Marker({
        map,
        position: { lat: latitude, lng: longitude },
        title: props.address || props.description,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: compact ? 6 : 8,
          fillColor: severityColors[props.severity] || severityColors[3],
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        },
      });
      marker.addListener('click', () => {
        onReportSelect?.(props.id);
        const content = document.createElement('div');
        content.className = 'map-popup';
        const category = document.createElement('span');
        category.className = 'category-chip';
        category.textContent = props.category.replaceAll('_', ' ');
        const title = document.createElement('strong');
        title.textContent = props.address || props.description;
        const description = document.createElement('p');
        description.textContent = props.description;
        const meta = document.createElement('small');
        meta.textContent = `Severity ${props.severity}/5 · ${formatDistanceToNow(new Date(props.createdAt), { addSuffix: true })}${props.isRecurrence ? ' · REOCCURRED' : ''}`;
        content.append(category, title, description, meta);
        infoWindow.setContent(content);
        infoWindow.open({ map, anchor: marker });
      });
      overlays.push(marker);
    }
    return () => {
      infoWindow.close();
      overlays.forEach((overlay) => overlay.setMap(null));
    };
  }, [features, map, compact, onReportSelect]);

  if (!apiKey) return null;
  return <><div ref={elementRef} className="map-canvas" role="application" aria-label="Google map of city reports" />{mapError && <div className="map-error">{mapError}</div>}</>;
}

function FitCity() {
  const map = useMap();
  useEffect(() => { map.setView(CITY_CENTER, 13); }, [map]);
  return null;
}

function HeatLayer({ features }) {
  const cells = useMemo(() => {
    const values = new Map();
    for (const feature of features) {
      const key = feature.properties.cellId;
      const coordinate = feature.geometry?.coordinates;
      if (!coordinate) continue;
      const cell = values.get(key) || { points: [], count: 0 };
      cell.points.push([coordinate[1], coordinate[0]]);
      cell.count += 1;
      values.set(key, cell);
    }
    return [...values.entries()].map(([cellId, cell]) => ({
      cellId,
      count: cell.count,
      center: [cell.points.reduce((sum, point) => sum + point[0], 0) / cell.points.length, cell.points.reduce((sum, point) => sum + point[1], 0) / cell.points.length],
    }));
  }, [features]);
  return <>{cells.map((cell) => <Circle key={cell.cellId} center={cell.center} radius={80 + Math.min(cell.count, 20) * 9} pathOptions={{ color: '#e47752', weight: 1, fillColor: '#f39c6b', fillOpacity: Math.min(0.27, 0.07 + cell.count * 0.012) }} />)}</>;
}

export default function MapView({ compact = false, onReportSelect }) {
  const [collection, setCollection] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshedAt, setRefreshedAt] = useState(null);
  const [category, setCategory] = useState('all');

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const result = await api.hotspots();
        if (active) {
          setCollection(result.features || []);
          setRefreshedAt(result.refreshedAt || new Date().toISOString());
          setError('');
        }
      } catch (requestError) {
        if (active) setError(getApiError(requestError));
      } finally { if (active) setLoading(false); }
    };
    refresh();
    const interval = window.setInterval(refresh, 30_000);
    return () => { active = false; window.clearInterval(interval); };
  }, []);

  const features = collection.filter((feature) => category === 'all' || feature.properties.category === category);
  const timeLabel = refreshedAt ? formatDistanceToNow(new Date(refreshedAt), { addSuffix: true }) : 'connecting';

  return (
    <div className={`map-frame ${compact ? 'map-compact' : ''}`}>
      <div className="map-toolbar"><div className="map-live"><span className="live-dot" /><div><strong>Live issue map</strong><small>{loading ? 'Loading reports…' : `${features.length} open reports · refreshed ${timeLabel}`}</small></div></div><label className="map-filter"><span>Category</span><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">All issues</option><option value="pothole">Potholes</option><option value="garbage">Garbage</option><option value="water_leak">Water leaks</option><option value="streetlight_damage">Streetlights</option><option value="other">Other</option></select></label><span className="map-source"><RefreshCw size={13} /> Auto refresh · {import.meta.env.VITE_GOOGLE_MAPS_API_KEY ? 'Google Maps' : 'OpenStreetMap'}</span></div>
      {error && <div className="map-error">{error}</div>}
      {import.meta.env.VITE_GOOGLE_MAPS_API_KEY
        ? <GoogleMapCanvas features={features} compact={compact} onReportSelect={onReportSelect} />
        : <>
          <div className="map-key-note">Add <code>VITE_GOOGLE_MAPS_API_KEY</code> to <code>client/.env.local</code> to show Google Maps. Displaying the live OpenStreetMap until then.</div>
          <MapContainer center={CITY_CENTER} zoom={13} scrollWheelZoom className="map-canvas">
            <FitCity />
            <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <HeatLayer features={features} />
            {features.map((feature) => {
              const props = feature.properties;
              const [longitude, latitude] = feature.geometry.coordinates;
              const color = severityColors[props.severity] || severityColors[3];
              return <CircleMarker key={props.id} center={[latitude, longitude]} radius={compact ? 6 : 8} pathOptions={{ color: '#fff', weight: 2, fillColor: color, fillOpacity: 0.95 }} eventHandlers={{ click: () => onReportSelect?.(props.id) }}>
                <Popup><div className="map-popup"><span className="category-chip">{props.category.replaceAll('_', ' ')}</span><strong>{props.address || props.description}</strong><p>{props.description}</p><div className="popup-meta"><PriorityBadge score={props.priorityScore} compact /><span>Severity {props.severity}/5</span></div><small>{formatDistanceToNow(new Date(props.createdAt), { addSuffix: true })}{props.isRecurrence ? ' · REOCCURRED' : ''}</small></div></Popup>
              </CircleMarker>;
            })}
          </MapContainer>
        </>}
      <div className="map-legend"><span><i className="legend-dot severity-1" /> Low</span><span><i className="legend-dot severity-3" /> Moderate</span><span><i className="legend-dot severity-5" /> Urgent</span><span className="legend-heat"><i /> Issue density</span></div>
    </div>
  );
}

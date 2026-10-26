import { useEffect, useRef, useState } from 'react';
import { MapContainer, Marker, TileLayer, useMapEvents } from 'react-leaflet';
import { Camera, CheckCircle2, Construction, Droplets, Lightbulb, Send, Trash2, CircleHelp, X } from 'lucide-react';
import { api, getApiError } from '../services/api.js';

const initialCoordinates = { address: '', lat: '', lng: '' };
const demoCityCenter = [39.8018, -89.6503];
const issueChoices = [
  { id: 'pothole', label: 'Road damage', detail: 'Pothole or broken road', Icon: Construction, description: 'Pothole or road damage reported by resident.' },
  { id: 'garbage', label: 'Garbage', detail: 'Trash needs pickup', Icon: Trash2, description: 'Garbage or litter needs collection.' },
  { id: 'water_leak', label: 'Water leak', detail: 'Water leaking in public', Icon: Droplets, description: 'Water leak reported by resident.' },
  { id: 'streetlight_damage', label: 'Streetlight', detail: 'Light is broken or off', Icon: Lightbulb, description: 'Streetlight is damaged or not working.' },
  { id: 'other', label: 'Something else', detail: 'Another city problem', Icon: CircleHelp, description: 'Other city problem reported by resident.' },
];

function ClickableReportMap({ center, markerPosition, onPick }) {
  useMapEvents({ click: ({ latlng }) => onPick(latlng.lat, latlng.lng) });
  return markerPosition ? <Marker position={markerPosition} /> : null;
}

export default function ReportForm({ onCreated, defaultMapCenter = demoCityCenter }) {
  const fileInput = useRef(null);
  const [form, setForm] = useState({ description: '', severity: '3', importantPlaceType: '', ...initialCoordinates });
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [reportMode, setReportMode] = useState('guided');
  const [selectedIssue, setSelectedIssue] = useState('');
  const [mapCenter, setMapCenter] = useState(defaultMapCenter);

  useEffect(() => {
    if (!form.lat && !form.lng) setMapCenter(defaultMapCenter);
  }, [defaultMapCenter, form.lat, form.lng]);

  function chooseIssue(issue) {
    setSelectedIssue(issue.id);
    setField('description', issue.description);
  }
  function setField(name, value) { setForm((current) => ({ ...current, [name]: value })); }

  function selectPhoto(file) {
    setError('');
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Choose an image file.'); return; }
    if (file.size > 5 * 1024 * 1024) { setError('Image must be 5 MB or smaller.'); return; }
    setPhoto(file);
    setPreview(URL.createObjectURL(file));
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    if (!photo) { setError('Add a photo so CityPulse can classify the issue.'); return; }
    if (reportMode === 'guided' && !selectedIssue) { setError('Tap a picture to choose the type of issue.'); return; }
    const latitude = Number(form.lat);
    const longitude = Number(form.lng);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      setError('Enter valid latitude and longitude coordinates for the issue location.');
      return;
    }
    const body = new FormData();
    body.append('photo', photo);
    body.append('description', form.description);
    if (reportMode === 'guided' && selectedIssue) body.append('category', selectedIssue);
    body.append('lat', form.lat);
    body.append('lng', form.lng);
    body.append('address', form.address);
    body.append('severity', form.severity);
    body.append('nearImportantPlace', String(Boolean(form.importantPlaceType)));
    body.append('importantPlaceType', form.importantPlaceType);
    setBusy(true);
    try {
      const result = await api.createReport(body);
      const category = result.classification?.category?.replaceAll('_', ' ');
      const categoryMessage = category ? ` · ${result.classification?.provider === 'citizen_selected' ? 'selected' : 'AI identified'} ${category}` : '';
      setMessage(`Report received${categoryMessage}${result.recurrence ? ' · REOCCURRED' : ''}.`);
      setForm({ description: '', severity: '3', importantPlaceType: '', ...initialCoordinates });
      setSelectedIssue('');
      setPhoto(null);
      setPreview('');
      if (fileInput.current) fileInput.current.value = '';
      onCreated?.(result.report);
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="panel-card report-form" onSubmit={submit}>
      <div className="section-heading form-title"><div><p className="eyebrow">NEW REPORT</p><h2>What needs attention?</h2><p className="muted">A photo and a clear note help crews respond faster.</p></div><span className="form-step">01 <i /> 02</span></div>
      <div className="report-mode-switch" role="group" aria-label="Choose report entry method"><button type="button" className={reportMode === 'guided' ? 'report-mode-active' : ''} onClick={() => { setReportMode('guided'); setError(''); }}>Picture guide</button><button type="button" className={reportMode === 'text' ? 'report-mode-active' : ''} onClick={() => { setReportMode('text'); setError(''); }}>Write details</button></div>
      {reportMode === 'guided' && <section className="picture-issue-picker" aria-labelledby="picture-issue-title"><strong id="picture-issue-title">Tap the picture that matches</strong><div className="picture-issue-grid">{issueChoices.map(({ id, label, detail, Icon, description }) => <button type="button" key={id} className={`picture-issue-choice ${selectedIssue === id ? 'picture-issue-selected' : ''}`} aria-pressed={selectedIssue === id} onClick={() => chooseIssue({ id, description })}><Icon size={28} aria-hidden="true" /><span>{label}</span><small>{detail}</small></button>)}</div>{selectedIssue && <p className="picture-issue-confirm">Selected: {issueChoices.find(({ id }) => id === selectedIssue)?.label}. A short description will be added automatically.</p>}</section>}
      <label className="photo-dropzone" onClick={() => fileInput.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); selectPhoto(event.dataTransfer.files?.[0]); }}>
        {preview ? <><img src={preview} alt="Selected issue" /><button type="button" className="remove-photo" aria-label="Remove photo" onClick={(event) => { event.preventDefault(); event.stopPropagation(); setPreview(''); setPhoto(null); if (fileInput.current) fileInput.current.value = ''; }}><X size={16} /></button></> : <><span className="upload-icon"><Camera size={21} /></span><strong>Add a photo</strong><span>Tap to browse or drag an image here</span><small>JPEG, PNG, WebP · up to 5 MB</small></>}
        <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={(event) => selectPhoto(event.target.files?.[0])} />
      </label>
      {reportMode === 'text' && <label className="field-label">Describe the issue<textarea required minLength={8} maxLength={2000} rows={3} placeholder="Tell us what you noticed and where…" value={form.description} onChange={(event) => setField('description', event.target.value)} /></label>}
      <div className="form-row">
        <label className="field-label">Severity <select value={form.severity} onChange={(event) => setField('severity', event.target.value)}><option value="1">1 · Minor</option><option value="2">2 · Low</option><option value="3">3 · Moderate</option><option value="4">4 · High</option><option value="5">5 · Urgent</option></select></label>
        <label className="field-label">Near an important place? <select value={form.importantPlaceType} onChange={(event) => setField('importantPlaceType', event.target.value)}><option value="">No flag</option><option value="school">School</option><option value="hospital">Hospital</option></select></label>
      </div>
      <div className="field-label location-label coordinate-label">
        <span>Issue location</span>
      {reportMode === 'guided' ? <><p className="location-help">Tap the place on the map where the problem is.</p><div className="report-location-map"><MapContainer key={`${mapCenter[0]}-${mapCenter[1]}`} center={mapCenter} zoom={12} scrollWheelZoom className="report-picker-map"><TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" /><ClickableReportMap center={mapCenter} markerPosition={form.lat && form.lng ? [Number(form.lat), Number(form.lng)] : null} onPick={(lat, lng) => { setField('lat', lat.toFixed(6)); setField('lng', lng.toFixed(6)); setField('address', ''); }} /></MapContainer></div><small className="location-help">{form.lat && form.lng ? `Location selected: ${form.lat}, ${form.lng}` : 'No location selected yet.'}</small><details className="manual-coordinate-details"><summary>Enter location coordinates manually</summary><div className="coordinate-fields"><label><span>Lat</span><input aria-label="Latitude" type="number" step="any" min="-90" max="90" placeholder="39.8012" inputMode="decimal" value={form.lat} onChange={(event) => setField('lat', event.target.value)} /></label><label><span>Lng</span><input aria-label="Longitude" type="number" step="any" min="-180" max="180" placeholder="-89.6484" inputMode="decimal" value={form.lng} onChange={(event) => setField('lng', event.target.value)} /></label></div></details></> : <><label className="manual-address-field">
          <span>Street address or nearby landmark</span>
          <input aria-label="Street address or nearby landmark" placeholder="For example, 12 Main Street or City Hall entrance" value={form.address} onChange={(event) => { setField('address', event.target.value); setField('lat', ''); setField('lng', ''); }} />
        </label>
        <small className="location-help">To place the report precisely, enter coordinates below. In <a href="https://www.google.com/maps" target="_blank" rel="noreferrer">Google Maps</a>, right-click the location and copy its coordinates.</small>
        <div className="coordinate-fields">
          <label><span>Lat</span><input aria-label="Latitude" type="number" step="any" min="-90" max="90" placeholder="39.8012" inputMode="decimal" value={form.lat} onChange={(event) => setField('lat', event.target.value)} required /></label>
          <label><span>Lng</span><input aria-label="Longitude" type="number" step="any" min="-180" max="180" placeholder="-89.6484" inputMode="decimal" value={form.lng} onChange={(event) => setField('lng', event.target.value)} required /></label>
        </div>
        <small className="location-help">Enter the coordinates manually to place the complaint accurately.</small></>}
      </div>
      {error && <p className="form-alert form-error">{error}</p>}
      {message && <p className="form-alert form-success"><CheckCircle2 size={16} />{message}</p>}
      <button type="submit" className="button button-primary submit-report" disabled={busy}>{busy ? <span className="spinner" /> : <Send size={16} />}{busy ? 'Sending report…' : 'Send report'}</button>
      <p className="privacy-note">Your report helps the city see patterns. Your name is never shown on the public map.</p>
    </form>
  );
}

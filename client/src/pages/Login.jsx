import { useState } from 'react';
import { ArrowRight, Eye, EyeOff, ShieldCheck, Sparkles } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { getApiError } from '../services/api.js';

export default function Login() {
  const { user, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [registering, setRegistering] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to={user.role === 'officer' ? '/officer' : user.role === 'contractor' ? '/contractor' : '/citizen'} replace />;

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const currentUser = registering ? await signUp(form) : await signIn({ email: form.email, password: form.password });
      navigate(currentUser.role === 'officer' ? '/officer' : currentUser.role === 'contractor' ? '/contractor' : '/citizen', { replace: true });
    } catch (requestError) { setError(getApiError(requestError)); }
    finally { setBusy(false); }
  }

  return (
    <main className="login-layout">
      <section className="login-story">
        <a className="brand brand-light" href="/"><span className="brand-mark"><Sparkles size={20} /></span><span>CityPulse</span></a>
        <div className="story-copy"><span className="story-kicker"><i /> CITY SERVICES, IN SYNC</span><h1>Better streets start with <em>being heard.</em></h1><p>One shared picture of what needs fixing, where it keeps happening, and what should come next.</p><div className="story-card"><div className="story-card-top"><span className="story-icon"><ShieldCheck size={18} /></span><span className="story-chip">CIVIC MEMORY</span></div><blockquote>“Three repairs held. One corner still needs a better answer.”</blockquote><div className="story-card-footer"><span>Maple Avenue · District 04</span><span className="story-spark">✳</span></div></div></div>
        <div className="story-footer"><span>Springfield Demo City</span><span>Built for the places we share.</span></div>
      </section>
      <section className="login-panel"><div className="login-mobile-brand"><span className="brand-mark"><Sparkles size={18} /></span><strong>CityPulse</strong></div><div className="login-content"><span className="eyebrow">{registering ? 'JOIN YOUR COMMUNITY' : 'WELCOME BACK'}</span><h2>{registering ? 'Create your account' : 'Sign in to CityPulse'}</h2><p className="muted">{registering ? 'Help your city see what needs attention.' : 'Your city’s next repair starts here.'}</p>
        <form onSubmit={submit} className="login-form">
          {registering && <label className="field-label">Full name<input autoComplete="name" required minLength={2} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Your name" /></label>}
          <label className="field-label">Email address<input type="email" autoComplete="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="you@example.com" /></label>
          <label className="field-label">Password<span className="password-field"><input type={showPassword ? 'text' : 'password'} autoComplete={registering ? 'new-password' : 'current-password'} required minLength={registering ? 8 : 1} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder={registering ? 'At least 8 characters' : 'Enter your password'} /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></span></label>
          {error && <p className="form-alert form-error">{error}</p>}
          <button className="button button-dark login-submit" disabled={busy}>{busy ? <span className="spinner" /> : null}{registering ? 'Create account' : 'Sign in'}<ArrowRight size={16} /></button>
        </form>
        <p className="login-toggle">{registering ? 'Already have an account?' : 'New to CityPulse?'} <button onClick={() => { setRegistering(!registering); setError(''); }}>{registering ? 'Sign in' : 'Create a citizen account'}</button></p>
        <div className="demo-access"><span className="demo-key">i</span><p><strong>Demo access</strong><br />Officer: avery.officer@demo.civiccare.local<br />Contractor: roadworks.contractor@demo.civiccare.local<br />Password: password123</p></div>
      </div><div className="login-bottom">© 2026 CityPulse <span>·</span> A clearer view of city needs</div></section>
    </main>
  );
}

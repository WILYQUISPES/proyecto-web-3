import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import Captcha from '../components/Captcha';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [form, setForm] = useState({ username: '', password: '' });
  const [captcha, setCaptcha] = useState({ token: '', value: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function set(k, v) { setForm({ ...form, [k]: v }); }

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.username || !form.password) return setError('Completá usuario y contraseña');
    if (!captcha.value) return setError('Completá la verificación');

    setLoading(true);
    try {
      const r = await client.post('/auth/login', {
        username: form.username,
        password: form.password,
        captchaToken: captcha.token,
        captchaValue: captcha.value
      });
      login(r.data.token, r.data.user);
      const to = location.state?.from || '/dashboard';
      navigate(to, { replace: true });
    } catch (err) {
      const msg = err.response?.data?.error
        || err.response?.data?.errors?.[0]?.msg
        || 'Error de login';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-split">
      <aside className="auth-left">
        <div className="brand-block">
          <span className="brand">PasoFirme</span>
          <span className="brand-meta">EST · 1987</span>
        </div>

        <blockquote className="auth-quote">
          “Un buen <span className="accent">par de zapatos</span> te lleva a los lugares correctos.”
        </blockquote>

        <div className="auth-attribution">
          № 01 — Inventario · Catálogo · Producción
        </div>
      </aside>

      <main className="auth-right">
        <form className="auth-card" onSubmit={onSubmit}>
          <div className="auth-eyebrow eyebrow">Acceso · Personal autorizado</div>

          <h1 className="auth-title">
            Bienvenido <em>de vuelta</em>.
          </h1>

          {error && <div className="alert alert-error">{error}</div>}

          <div className="field">
            <label className="field-label">Usuario</label>
            <input
              className="input"
              type="text"
              autoFocus
              value={form.username}
              onChange={(e) => set('username', e.target.value)}
              placeholder="admin"
            />
          </div>

          <div className="field">
            <label className="field-label">Contraseña</label>
            <input
              className="input"
              type="password"
              value={form.password}
              onChange={(e) => set('password', e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <Captcha onChange={setCaptcha} />

          <button className="btn btn-primary" disabled={loading}>
            {loading ? 'Ingresando…' : (
              <>
                Ingresar al sistema
                <ArrowRight size={15} strokeWidth={1.5} className="arrow" />
              </>
            )}
          </button>

          <p className="auth-footer-text">
            ¿Sin cuenta? <Link to="/register">Registrate aquí</Link>
          </p>

          <p className="auth-hint">
            Demo: <code>admin / Admin123!</code><br />
            <code>usuario / User1234!</code>
          </p>
        </form>
      </main>
    </div>
  );
}

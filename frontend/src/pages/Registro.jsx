import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import client from '../api/client';
import FuerzaContrasena, { getStrength } from '../components/FuerzaContrasena';

export default function Registro() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', email: '', password: '', password2: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  function set(k, v) { setForm({ ...form, [k]: v }); }

  function validar() {
    if (!form.username || form.username.length < 3) return 'Usuario inválido (mínimo 3)';
    if (!/^[a-zA-Z0-9_.-]+$/.test(form.username)) return 'Usuario con caracteres inválidos';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return 'Email inválido';
    if (form.password.length < 6) return 'Mínimo 6 caracteres';
    if (form.password !== form.password2) return 'Las contraseñas no coinciden';
    const s = getStrength(form.password);
    if (s.level === 'debil') return 'Contraseña muy débil';
    return null;
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError(''); setSuccess('');
    const msg = validar();
    if (msg) return setError(msg);

    setLoading(true);
    try {
      await client.post('/auth/register', {
        username: form.username,
        email: form.email,
        password: form.password
      });
      setSuccess('Cuenta creada. Redirigiendo…');
      setTimeout(() => navigate('/login'), 1200);
    } catch (err) {
      const msg = err.response?.data?.error
        || err.response?.data?.errors?.[0]?.msg
        || 'Error al registrar';
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
          Cada modelo cuenta una <span className="accent">historia</span>.
          Cada talla, una persona.
        </blockquote>

        <div className="auth-attribution">
          № 02 — Crear nuevo registro
        </div>
      </aside>

      <main className="auth-right">
        <form className="auth-card" onSubmit={onSubmit}>
          <div className="auth-eyebrow eyebrow">Registro · Nueva cuenta</div>

          <h1 className="auth-title">
            Crear <em>cuenta</em>.
          </h1>

          {error && <div className="alert alert-error">{error}</div>}
          {success && <div className="alert alert-ok">{success}</div>}

          <div className="field">
            <label className="field-label">Usuario</label>
            <input className="input" value={form.username}
              onChange={(e) => set('username', e.target.value)}
              placeholder="juan.perez" />
          </div>

          <div className="field">
            <label className="field-label">Email</label>
            <input className="input" type="email" value={form.email}
              onChange={(e) => set('email', e.target.value)}
              placeholder="juan@correo.com" />
          </div>

          <div className="field">
            <label className="field-label">Contraseña</label>
            <input className="input" type="password" value={form.password}
              onChange={(e) => set('password', e.target.value)} />
            <FuerzaContrasena password={form.password} />
          </div>

          <div className="field">
            <label className="field-label">Confirmar contraseña</label>
            <input className="input" type="password" value={form.password2}
              onChange={(e) => set('password2', e.target.value)} />
          </div>

          <button className="btn btn-primary" disabled={loading}>
            {loading ? 'Creando…' : (
              <>
                Crear cuenta
                <ArrowRight size={15} strokeWidth={1.5} className="arrow" />
              </>
            )}
          </button>

          <p className="auth-footer-text">
            ¿Ya tenés cuenta? <Link to="/login">Iniciar sesión</Link>
          </p>
        </form>
      </main>
    </div>
  );
}

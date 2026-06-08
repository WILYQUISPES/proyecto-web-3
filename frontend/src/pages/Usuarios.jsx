import { useEffect, useState } from 'react';
import { Power, UserPlus } from 'lucide-react';
import client from '../api/client';
import FuerzaContrasena, { getStrength } from '../components/FuerzaContrasena';

const EMPTY = { username: '', email: '', password: '', role: 'user' };

export default function Usuarios() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [formError, setFormError] = useState('');
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const r = await client.get('/users');
      setItems(r.data);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  function set(k, v) { setForm({ ...form, [k]: v }); }

  function validar() {
    if (!form.username || form.username.length < 3) return 'Usuario inválido (mínimo 3)';
    if (!/^[a-zA-Z0-9_.-]+$/.test(form.username)) return 'Usuario con caracteres inválidos';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return 'Email inválido';
    if (form.password.length < 6) return 'Contraseña mínima de 6 caracteres';
    if (getStrength(form.password).level === 'debil') return 'La contraseña es muy débil';
    return null;
  }

  async function onCreate(e) {
    e.preventDefault();
    setFormError('');
    const msg = validar();
    if (msg) return setFormError(msg);

    setCreating(true);
    try {
      await client.post('/users', {
        username: form.username, email: form.email,
        password: form.password, role: form.role,
      });
      setForm(EMPTY);
      setShowForm(false);
      await load();
    } catch (err) {
      setFormError(
        err.response?.data?.error
        || err.response?.data?.errors?.[0]?.msg
        || 'No se pudo crear el usuario'
      );
    } finally {
      setCreating(false);
    }
  }

  async function toggle(u) {
    await client.patch(`/users/${u.id}/toggle`);
    await load();
  }

  async function changeRole(u, role) {
    if (u.role === role) return;
    await client.patch(`/users/${u.id}/role`, { role });
    await load();
  }

  return (
    <div className="page">
      <header className="page-header">
        <div className="page-header-left">
          <div className="page-subtitle">№ 05 · Gestión de personal</div>
          <h1 className="page-title">
            Cuentas <em>autorizadas</em>.
          </h1>
        </div>
        <button className="btn btn-primary" onClick={() => { setShowForm((s) => !s); setFormError(''); }}>
          <UserPlus size={15} strokeWidth={1.5} /> Nuevo usuario
        </button>
      </header>

      {showForm && (
        <div className="table-card" style={{ marginBottom: 'var(--s-5)', padding: 'var(--s-6)' }}>
          <form onSubmit={onCreate}>
            <div className="eyebrow" style={{ marginBottom: 'var(--s-4)' }}>
              Alta de cuenta · solo administradores
            </div>
            {formError && <div className="alert alert-error">{formError}</div>}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--s-5)' }}>
              <div className="field">
                <label className="field-label">Usuario</label>
                <input className="input" value={form.username}
                  onChange={(e) => set('username', e.target.value)} placeholder="juan.perez" />
              </div>
              <div className="field">
                <label className="field-label">Email</label>
                <input className="input" type="email" value={form.email}
                  onChange={(e) => set('email', e.target.value)} placeholder="juan@pasofirme.bo" />
              </div>
              <div className="field">
                <label className="field-label">Contraseña</label>
                <input className="input" type="password" value={form.password}
                  onChange={(e) => set('password', e.target.value)} />
                <FuerzaContrasena password={form.password} />
              </div>
              <div className="field">
                <label className="field-label">Rol</label>
                <select className="input" value={form.role} onChange={(e) => set('role', e.target.value)}>
                  <option value="user">Usuario</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 'var(--s-3)', marginTop: 'var(--s-5)' }}>
              <button className="btn btn-primary" disabled={creating}>
                {creating ? 'Creando…' : 'Crear cuenta'}
              </button>
              <button type="button" className="btn"
                style={{ border: '1px solid var(--stone)' }}
                onClick={() => { setShowForm(false); setFormError(''); setForm(EMPTY); }}>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? <p className="muted">Cargando…</p> : (
        <div className="table-card">
          <table className="table">
            <thead>
              <tr>
                <th>№</th><th>Usuario</th><th>Email</th><th>Rol</th>
                <th>Estado</th><th>Alta</th><th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((u) => (
                <tr key={u.id}>
                  <td className="col-id" data-label="№">{String(u.id).padStart(3, '0')}</td>
                  <td className="col-model" data-label="Usuario" style={{ fontSize: 16 }}>{u.username}</td>
                  <td className="col-meta" data-label="Email">{u.email}</td>
                  <td data-label="Rol">
                    <select className="input input-boxed" style={{ width: 'auto', fontSize: 11, padding: '6px 10px' }} value={u.role} onChange={(e) => changeRole(u, e.target.value)}>
                      <option value="user">user</option>
                      <option value="admin">admin</option>
                    </select>
                  </td>
                  <td data-label="Estado">
                    <span className={`status ${u.is_active ? '' : 'inactive'}`}>
                      {u.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="col-meta" data-label="Alta">{u.created_at}</td>
                  <td data-label="">
                    <div className="row-actions" style={{ opacity: 1, transform: 'none' }}>
                      <button className={`icon-btn ${u.is_active ? 'danger' : ''}`} onClick={() => toggle(u)} title={u.is_active ? 'Desactivar' : 'Activar'}>
                        <Power size={13} strokeWidth={1.5} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

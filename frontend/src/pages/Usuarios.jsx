import { useEffect, useState } from 'react';
import { Power } from 'lucide-react';
import client from '../api/client';

export default function Usuarios() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const r = await client.get('/users');
      setItems(r.data);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

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
      </header>

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

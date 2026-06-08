import { useEffect, useState } from 'react';
import { Plus, Edit3, Trash2, RotateCcw, X, Phone, Mail, MapPin } from 'lucide-react';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';

const EMPTY = {
  name: '',
  contact_name: '',
  phone: '',
  email: '',
  address: '',
  ruc: '',
  notes: ''
};

export default function Suppliers() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDrawer, setShowDrawer] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [formError, setFormError] = useState('');
  const [search, setSearch] = useState('');
  const [includeDeleted, setIncludeDeleted] = useState(false);

  function set(k, v) { setForm({ ...form, [k]: v }); }

  async function load() {
    setLoading(true);
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (includeDeleted && user.role === 'admin') params.includeDeleted = true;
      const r = await client.get('/suppliers', { params });
      setItems(r.data);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditing(null); setForm(EMPTY); setFormError(''); setShowDrawer(true);
  }
  function openEdit(s) {
    setEditing(s);
    setForm({
      name: s.name || '', contact_name: s.contact_name || '',
      phone: s.phone || '', email: s.email || '',
      address: s.address || '', ruc: s.ruc || '', notes: s.notes || ''
    });
    setFormError(''); setShowDrawer(true);
  }

  function validar() {
    if (!form.name.trim()) return 'El nombre es obligatorio';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return 'Email inválido';
    if (form.phone && !/^[0-9+\-\s()]*$/.test(form.phone)) return 'Teléfono inválido';
    return null;
  }

  async function onSubmit(e) {
    e.preventDefault();
    setFormError('');
    const msg = validar();
    if (msg) return setFormError(msg);

    const payload = {
      name: form.name.trim(),
      contact_name: form.contact_name.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      address: form.address.trim() || null,
      ruc: form.ruc.trim() || null,
      notes: form.notes.trim() || null
    };
    try {
      if (editing) await client.put(`/suppliers/${editing.id}`, payload);
      else await client.post('/suppliers', payload);
      setShowDrawer(false);
      await load();
    } catch (err) {
      setFormError(err.response?.data?.error || err.response?.data?.errors?.[0]?.msg || 'Error al guardar');
    }
  }

  async function onDelete(s) {
    if (!window.confirm(`¿Eliminar proveedor "${s.name}"?`)) return;
    await client.delete(`/suppliers/${s.id}`);
    await load();
  }

  async function onRestore(s) {
    await client.post(`/suppliers/${s.id}/restore`);
    await load();
  }

  return (
    <div className="page">
      <header className="page-header">
        <div className="page-header-left">
          <div className="page-subtitle">№ 08 · Cadena de suministro</div>
          <h1 className="page-title">
            Proveedores <em>de confianza</em>.
          </h1>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>
          <Plus size={15} strokeWidth={1.5} />
          Nuevo proveedor
        </button>
      </header>

      <div className="toolbar">
        <input
          className="input"
          placeholder="Buscar por nombre, contacto o email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load()}
          style={{ flex: '1 1 280px', maxWidth: 380 }}
        />
        {user.role === 'admin' && (
          <label className="check">
            <input type="checkbox" checked={includeDeleted} onChange={(e) => setIncludeDeleted(e.target.checked)} />
            Incluir eliminados
          </label>
        )}
        <div className="toolbar-spacer" />
        <button className="btn btn-secondary btn-sm" onClick={load}>Aplicar</button>
      </div>

      {loading ? <p className="muted">Cargando…</p> : (
        <div className="table-card">
          <table className="table">
            <thead>
              <tr>
                <th>№</th><th>Proveedor</th><th>Contacto</th>
                <th>Teléfono</th><th>Email</th><th>NIT</th>
                <th>Estado</th><th></th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && <tr><td colSpan="8"><p className="empty-state">Sin resultados.</p></td></tr>}
              {items.map((s) => (
                <tr key={s.id} className={s.is_active ? '' : 'row-deleted'}>
                  <td className="col-id" data-label="№">{String(s.id).padStart(3, '0')}</td>
                  <td className="col-model" data-label="Proveedor">{s.name}</td>
                  <td className="col-meta" data-label="Contacto">{s.contact_name || '—'}</td>
                  <td className="col-meta" data-label="Teléfono">{s.phone || '—'}</td>
                  <td className="col-meta" data-label="Email">{s.email || '—'}</td>
                  <td className="col-meta" data-label="NIT">{s.ruc || '—'}</td>
                  <td data-label="Estado">
                    <span className={`status ${s.is_active ? '' : 'inactive'}`}>
                      {s.is_active ? 'Activo' : 'Eliminado'}
                    </span>
                  </td>
                  <td data-label="">
                    <div className="row-actions">
                      {s.is_active ? (
                        <>
                          <button className="icon-btn" onClick={() => openEdit(s)} title="Editar">
                            <Edit3 size={13} strokeWidth={1.5} />
                          </button>
                          <button className="icon-btn danger" onClick={() => onDelete(s)} title="Eliminar">
                            <Trash2 size={13} strokeWidth={1.5} />
                          </button>
                        </>
                      ) : user.role === 'admin' && (
                        <button className="icon-btn" onClick={() => onRestore(s)} title="Restaurar">
                          <RotateCcw size={13} strokeWidth={1.5} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showDrawer && (
        <>
          <div className="drawer-backdrop" onClick={() => setShowDrawer(false)} />
          <aside className="drawer" onClick={(e) => e.stopPropagation()}>
            <header className="drawer-header">
              <div>
                <div className="drawer-eyebrow eyebrow">
                  {editing ? `Editando № ${String(editing.id).padStart(3, '0')}` : 'Nuevo proveedor'}
                </div>
                <h2 className="drawer-title">{editing ? editing.name : 'Nuevo proveedor'}</h2>
              </div>
              <button className="drawer-close" onClick={() => setShowDrawer(false)}>
                <X size={15} strokeWidth={1.5} />
              </button>
            </header>

            <form onSubmit={onSubmit}>
              {formError && <div className="alert alert-error">{formError}</div>}

              <div className="drawer-grid">
                <div className="field full">
                  <label className="field-label">Razón social / nombre *</label>
                  <input className="input input-boxed" value={form.name}
                    onChange={(e) => set('name', e.target.value)} maxLength={100} required />
                </div>
                <div className="field">
                  <label className="field-label">Persona de contacto</label>
                  <input className="input input-boxed" value={form.contact_name}
                    onChange={(e) => set('contact_name', e.target.value)} maxLength={80} />
                </div>
                <div className="field">
                  <label className="field-label">NIT</label>
                  <input className="input input-boxed" value={form.ruc}
                    onChange={(e) => set('ruc', e.target.value)} maxLength={30}
                    placeholder="1234567890" />
                </div>
                <div className="field">
                  <label className="field-label">Teléfono</label>
                  <input className="input input-boxed" value={form.phone}
                    onChange={(e) => set('phone', e.target.value)} maxLength={30}
                    placeholder="+591 72345678" />
                </div>
                <div className="field">
                  <label className="field-label">Email</label>
                  <input className="input input-boxed" type="email" value={form.email}
                    onChange={(e) => set('email', e.target.value)} />
                </div>
                <div className="field full">
                  <label className="field-label">Dirección</label>
                  <input className="input input-boxed" value={form.address}
                    onChange={(e) => set('address', e.target.value)} maxLength={200} />
                </div>
                <div className="field full">
                  <label className="field-label">Notas</label>
                  <textarea className="input input-boxed" rows="3" maxLength={500}
                    value={form.notes} onChange={(e) => set('notes', e.target.value)} />
                </div>
              </div>

              <div className="drawer-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setShowDrawer(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  {editing ? 'Guardar cambios' : 'Crear proveedor'}
                </button>
              </div>
            </form>
          </aside>
        </>
      )}
    </div>
  );
}

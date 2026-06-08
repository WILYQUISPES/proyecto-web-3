import { useEffect, useState } from 'react';
import { Plus, Edit3, Trash2, RotateCcw, X } from 'lucide-react';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';

const EMPTY = {
  name: '',
  unit: '',
  stock: '',
  unit_cost: '',
  supplier_id: '',
  description: ''
};

export default function Materials() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [units, setUnits] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDrawer, setShowDrawer] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [formError, setFormError] = useState('');
  const [search, setSearch] = useState('');
  const [filterSupplier, setFilterSupplier] = useState('');
  const [includeDeleted, setIncludeDeleted] = useState(false);

  function set(k, v) { setForm({ ...form, [k]: v }); }

  async function load() {
    setLoading(true);
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (filterSupplier) params.supplier_id = filterSupplier;
      if (includeDeleted && user.role === 'admin') params.includeDeleted = true;
      const r = await client.get('/materials', { params });
      setItems(r.data);
    } finally { setLoading(false); }
  }

  useEffect(() => {
    client.get('/materials/meta/units').then((r) => setUnits(r.data.units));
    client.get('/suppliers').then((r) => setSuppliers(r.data));
    load();
  }, []);

  function openCreate() {
    setEditing(null); setForm(EMPTY); setFormError(''); setShowDrawer(true);
  }
  function openEdit(m) {
    setEditing(m);
    setForm({
      name: m.name || '', unit: m.unit || '',
      stock: m.stock ?? '', unit_cost: m.unit_cost ?? '',
      supplier_id: m.supplier_id ?? '',
      description: m.description || ''
    });
    setFormError(''); setShowDrawer(true);
  }

  function validar() {
    if (!form.name.trim()) return 'El nombre es obligatorio';
    if (!form.unit) return 'La unidad es obligatoria';
    if (form.stock === '' || isNaN(form.stock) || form.stock < 0) return 'Stock inválido';
    if (form.unit_cost === '' || isNaN(form.unit_cost) || form.unit_cost < 0) return 'Costo inválido';
    return null;
  }

  async function onSubmit(e) {
    e.preventDefault();
    setFormError('');
    const msg = validar();
    if (msg) return setFormError(msg);

    const payload = {
      name: form.name.trim(),
      unit: form.unit,
      stock: Number(form.stock),
      unit_cost: Number(form.unit_cost),
      supplier_id: form.supplier_id ? Number(form.supplier_id) : null,
      description: form.description.trim() || null
    };
    try {
      if (editing) await client.put(`/materials/${editing.id}`, payload);
      else await client.post('/materials', payload);
      setShowDrawer(false);
      await load();
    } catch (err) {
      setFormError(err.response?.data?.error || err.response?.data?.errors?.[0]?.msg || 'Error al guardar');
    }
  }

  async function onDelete(m) {
    if (!window.confirm(`¿Eliminar material "${m.name}"?`)) return;
    await client.delete(`/materials/${m.id}`);
    await load();
  }

  async function onRestore(m) {
    await client.post(`/materials/${m.id}/restore`);
    await load();
  }

  const formatGs = (n) => Number(n).toLocaleString('es-BO');

  return (
    <div className="page">
      <header className="page-header">
        <div className="page-header-left">
          <div className="page-subtitle">№ 09 · Inventario de insumos</div>
          <h1 className="page-title">
            Materia <em>prima</em>.
          </h1>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>
          <Plus size={15} strokeWidth={1.5} />
          Nuevo insumo
        </button>
      </header>

      <div className="toolbar">
        <input
          className="input"
          placeholder="Buscar insumo…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load()}
          style={{ flex: '1 1 240px', maxWidth: 320 }}
        />
        <select className="input input-boxed" value={filterSupplier} onChange={(e) => setFilterSupplier(e.target.value)} style={{ width: 'auto', minWidth: 200 }}>
          <option value="">Todos los proveedores</option>
          {suppliers.filter((s) => s.is_active).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
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
                <th>№</th><th>Insumo</th><th>Unidad</th>
                <th className="text-right">Stock</th>
                <th className="text-right">Costo unit. Bs</th>
                <th>Proveedor</th>
                <th>Estado</th><th></th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && <tr><td colSpan="8"><p className="empty-state">Sin resultados.</p></td></tr>}
              {items.map((m) => (
                <tr key={m.id} className={m.is_active ? '' : 'row-deleted'}>
                  <td className="col-id" data-label="№">{String(m.id).padStart(3, '0')}</td>
                  <td className="col-model" data-label="Insumo">{m.name}</td>
                  <td className="col-meta" data-label="Unidad">{m.unit}</td>
                  <td className="col-price" data-label="Stock">{m.stock}</td>
                  <td className="col-price" data-label="Costo"><span className="currency">Bs</span>{formatGs(m.unit_cost)}</td>
                  <td className="col-meta" data-label="Proveedor">{m.supplier_name || '—'}</td>
                  <td data-label="Estado">
                    <span className={`status ${m.is_active ? '' : 'inactive'}`}>
                      {m.is_active ? 'Activo' : 'Eliminado'}
                    </span>
                  </td>
                  <td data-label="">
                    <div className="row-actions">
                      {m.is_active ? (
                        <>
                          <button className="icon-btn" onClick={() => openEdit(m)} title="Editar">
                            <Edit3 size={13} strokeWidth={1.5} />
                          </button>
                          <button className="icon-btn danger" onClick={() => onDelete(m)} title="Eliminar">
                            <Trash2 size={13} strokeWidth={1.5} />
                          </button>
                        </>
                      ) : user.role === 'admin' && (
                        <button className="icon-btn" onClick={() => onRestore(m)} title="Restaurar">
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
                  {editing ? `Editando № ${String(editing.id).padStart(3, '0')}` : 'Nuevo insumo'}
                </div>
                <h2 className="drawer-title">{editing ? editing.name : 'Nueva materia prima'}</h2>
              </div>
              <button className="drawer-close" onClick={() => setShowDrawer(false)}>
                <X size={15} strokeWidth={1.5} />
              </button>
            </header>

            <form onSubmit={onSubmit}>
              {formError && <div className="alert alert-error">{formError}</div>}

              <div className="drawer-grid">
                <div className="field full">
                  <label className="field-label">Nombre del insumo *</label>
                  <input className="input input-boxed" value={form.name}
                    onChange={(e) => set('name', e.target.value)} maxLength={100} required />
                </div>
                <div className="field">
                  <label className="field-label">Unidad *</label>
                  <select className="input input-boxed" value={form.unit} onChange={(e) => set('unit', e.target.value)} required>
                    <option value="">— Elegir —</option>
                    {units.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label className="field-label">Proveedor</label>
                  <select className="input input-boxed" value={form.supplier_id} onChange={(e) => set('supplier_id', e.target.value)}>
                    <option value="">— Sin asignar —</option>
                    {suppliers.filter((s) => s.is_active).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label className="field-label">Stock *</label>
                  <input className="input input-boxed" type="number" min="0" step="0.01"
                    value={form.stock} onChange={(e) => set('stock', e.target.value)} required />
                </div>
                <div className="field">
                  <label className="field-label">Costo unitario Bs *</label>
                  <input className="input input-boxed" type="number" min="0" step="100"
                    value={form.unit_cost} onChange={(e) => set('unit_cost', e.target.value)} required />
                </div>
                <div className="field full">
                  <label className="field-label">Descripción</label>
                  <textarea className="input input-boxed" rows="3" maxLength={500}
                    value={form.description} onChange={(e) => set('description', e.target.value)} />
                </div>
              </div>

              <div className="drawer-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setShowDrawer(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  {editing ? 'Guardar cambios' : 'Crear insumo'}
                </button>
              </div>
            </form>
          </aside>
        </>
      )}
    </div>
  );
}

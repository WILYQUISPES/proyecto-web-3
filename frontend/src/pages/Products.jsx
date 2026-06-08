import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Edit3, Trash2, RotateCcw, X, Package, Layers } from 'lucide-react';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';

const EMPTY = {
  model_name: '',
  type: '',
  material: '',
  color: '',
  size: '',
  price: '',
  stock: '',
  description: ''
};

export default function Products() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDrawer, setShowDrawer] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [formError, setFormError] = useState('');
  const [meta, setMeta] = useState({ types: [], materials: [] });
  const [materialsCatalog, setMaterialsCatalog] = useState([]);
  const [composition, setComposition] = useState([]);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterMaterial, setFilterMaterial] = useState('');
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [viewDetail, setViewDetail] = useState(null);

  function set(k, v) { setForm({ ...form, [k]: v }); }

  async function load() {
    setLoading(true);
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (filterType) params.type = filterType;
      if (filterMaterial) params.material = filterMaterial;
      if (includeDeleted && user.role === 'admin') params.includeDeleted = true;
      const r = await client.get('/products', { params });
      setItems(r.data);
    } finally { setLoading(false); }
  }

  useEffect(() => {
    client.get('/products/meta/options').then((r) => setMeta(r.data));
    client.get('/materials').then((r) => setMaterialsCatalog(r.data));
    load();
  }, []);

  function openCreate() {
    setEditing(null); setForm(EMPTY); setComposition([]); setFormError(''); setShowDrawer(true);
  }

  async function openEdit(p) {
    setEditing(p);
    setForm({
      model_name: p.model_name || '', type: p.type || '', material: p.material || '',
      color: p.color || '', size: p.size ?? '', price: p.price ?? '',
      stock: p.stock ?? '', description: p.description || ''
    });
    setFormError('');
    setShowDrawer(true);
    try {
      const r = await client.get(`/products/${p.id}/materials`);
      setComposition(r.data.map((m) => ({
        raw_material_id: m.id, quantity: m.quantity, _name: m.name, _unit: m.unit
      })));
    } catch { setComposition([]); }
  }

  async function viewProduct(p) {
    try {
      const r = await client.get(`/products/${p.id}`);
      setViewDetail(r.data);
    } catch {}
  }

  function addCompRow() {
    const remaining = materialsCatalog.filter(
      (m) => m.is_active && !composition.find((c) => c.raw_material_id === m.id)
    );
    if (remaining.length === 0) return;
    const first = remaining[0];
    setComposition([...composition, {
      raw_material_id: first.id, quantity: 1, _name: first.name, _unit: first.unit
    }]);
  }
  function updateCompRow(idx, field, value) {
    const next = [...composition];
    if (field === 'raw_material_id') {
      const m = materialsCatalog.find((x) => x.id === Number(value));
      next[idx] = { ...next[idx], raw_material_id: Number(value), _name: m?.name, _unit: m?.unit };
    } else {
      next[idx] = { ...next[idx], [field]: value };
    }
    setComposition(next);
  }
  function removeCompRow(idx) {
    setComposition(composition.filter((_, i) => i !== idx));
  }

  function validar() {
    if (!form.model_name.trim()) return 'El modelo es obligatorio';
    if (!form.type) return 'El tipo es obligatorio';
    if (!form.material) return 'El material es obligatorio';
    if (!form.color.trim()) return 'El color es obligatorio';
    if (form.size === '' || isNaN(form.size) || form.size < 18 || form.size > 50) return 'Talla inválida (18–50)';
    if (form.price === '' || isNaN(form.price) || form.price < 0) return 'Precio inválido';
    if (form.stock === '' || isNaN(form.stock) || form.stock < 0) return 'Stock inválido';
    for (const c of composition) {
      if (!c.raw_material_id) return 'Hay un insumo sin seleccionar';
      if (!c.quantity || isNaN(c.quantity) || c.quantity <= 0) return 'Cantidad inválida en composición';
    }
    return null;
  }

  async function onSubmit(e) {
    e.preventDefault();
    setFormError('');
    const msg = validar();
    if (msg) return setFormError(msg);

    const payload = {
      model_name: form.model_name.trim(),
      type: form.type, material: form.material, color: form.color.trim(),
      size: Number(form.size), price: Number(form.price), stock: Number(form.stock),
      description: form.description.trim() || null
    };
    try {
      const saved = editing
        ? (await client.put(`/products/${editing.id}`, payload)).data
        : (await client.post('/products', payload)).data;

      await client.put(`/products/${saved.id}/materials`, {
        materials: composition.map((c) => ({
          raw_material_id: Number(c.raw_material_id),
          quantity: Number(c.quantity)
        }))
      });

      setShowDrawer(false);
      await load();
    } catch (err) {
      setFormError(err.response?.data?.error || err.response?.data?.errors?.[0]?.msg || 'Error al guardar');
    }
  }

  async function onDelete(p) {
    if (!window.confirm(`¿Eliminar "${p.model_name}"?`)) return;
    await client.delete(`/products/${p.id}`);
    await load();
  }
  async function onRestore(p) {
    await client.post(`/products/${p.id}/restore`);
    await load();
  }

  const filtrados = useMemo(() => items, [items]);
  const formatGs = (n) => Number(n).toLocaleString('es-BO');

  return (
    <div className="page">
      <header className="page-header">
        <div className="page-header-left">
          <div className="page-subtitle">№ 04 · Catálogo de productos</div>
          <h1 className="page-title">Calzado <em>en catálogo</em>.</h1>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>
          <Plus size={15} strokeWidth={1.5} />
          Nuevo modelo
        </button>
      </header>

      <div className="toolbar">
        <div style={{ position: 'relative', flex: '1 1 280px', maxWidth: 360 }}>
          <Search size={14} strokeWidth={1.5} style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)' }} />
          <input
            className="input"
            style={{ paddingLeft: 24 }}
            placeholder="Buscar por modelo, color o descripción…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load()}
          />
        </div>
        <select className="input input-boxed" value={filterType} onChange={(e) => setFilterType(e.target.value)} style={{ width: 'auto', minWidth: 140 }}>
          <option value="">Todos los tipos</option>
          {meta.types.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="input input-boxed" value={filterMaterial} onChange={(e) => setFilterMaterial(e.target.value)} style={{ width: 'auto', minWidth: 140 }}>
          <option value="">Todos los materiales</option>
          {meta.materials.map((s) => <option key={s} value={s}>{s}</option>)}
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
                <th>№</th><th>Modelo</th><th>Tipo</th><th>Material</th>
                <th>Color</th><th>Talla</th><th>Stock</th>
                <th className="text-right">Precio</th><th>Estado</th><th></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 && (
                <tr><td colSpan="10"><p className="empty-state">Sin resultados.</p></td></tr>
              )}
              {filtrados.map((p) => {
                const stockClass = p.stock <= 2 ? 'danger' : p.stock <= 5 ? 'low' : '';
                return (
                  <tr key={p.id} className={p.is_active ? '' : 'row-deleted'}>
                    <td className="col-id" data-label="№">{String(p.id).padStart(3, '0')}</td>
                    <td className="col-model" data-label="Modelo" style={{ cursor: 'pointer' }} onClick={() => viewProduct(p)} title="Ver composición">
                      {p.model_name}
                    </td>
                    <td data-label="Tipo"><span className={`tag type-${p.type.toLowerCase()}`}>{p.type}</span></td>
                    <td className="col-meta" data-label="Material">{p.material}</td>
                    <td className="col-meta" data-label="Color">{p.color}</td>
                    <td className="col-meta" data-label="Talla">{p.size}</td>
                    <td data-label="Stock"><span className={`stock-pill ${stockClass}`}>{p.stock}</span></td>
                    <td className="col-price" data-label="Precio"><span className="currency">Bs</span>{formatGs(p.price)}</td>
                    <td data-label="Estado">
                      {p.is_active
                        ? <span className="status">Activo</span>
                        : <span className="status inactive">Eliminado</span>}
                    </td>
                    <td data-label="">
                      <div className="row-actions">
                        {p.is_active ? (
                          <>
                            <button className="icon-btn" onClick={() => viewProduct(p)} title="Ver composición">
                              <Layers size={13} strokeWidth={1.5} />
                            </button>
                            <button className="icon-btn" onClick={() => openEdit(p)} title="Editar">
                              <Edit3 size={13} strokeWidth={1.5} />
                            </button>
                            <button className="icon-btn danger" onClick={() => onDelete(p)} title="Eliminar">
                              <Trash2 size={13} strokeWidth={1.5} />
                            </button>
                          </>
                        ) : user.role === 'admin' && (
                          <button className="icon-btn" onClick={() => onRestore(p)} title="Restaurar">
                            <RotateCcw size={13} strokeWidth={1.5} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Drawer crear/editar */}
      {showDrawer && (
        <>
          <div className="drawer-backdrop" onClick={() => setShowDrawer(false)} />
          <aside className="drawer" onClick={(e) => e.stopPropagation()}>
            <header className="drawer-header">
              <div>
                <div className="drawer-eyebrow eyebrow">
                  {editing ? `Editando № ${String(editing.id).padStart(3, '0')}` : 'Nuevo registro'}
                </div>
                <h2 className="drawer-title">{editing ? editing.model_name : 'Nuevo modelo'}</h2>
              </div>
              <button className="drawer-close" onClick={() => setShowDrawer(false)}>
                <X size={15} strokeWidth={1.5} />
              </button>
            </header>

            <form onSubmit={onSubmit}>
              {formError && <div className="alert alert-error">{formError}</div>}

              <div className="drawer-grid">
                <div className="field full">
                  <label className="field-label">Modelo *</label>
                  <input className="input input-boxed" value={form.model_name}
                    onChange={(e) => set('model_name', e.target.value)} maxLength={80} required />
                </div>
                <div className="field">
                  <label className="field-label">Tipo *</label>
                  <select className="input input-boxed" value={form.type} onChange={(e) => set('type', e.target.value)} required>
                    <option value="">— Elegir —</option>
                    {meta.types.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label className="field-label">Material principal *</label>
                  <select className="input input-boxed" value={form.material} onChange={(e) => set('material', e.target.value)} required>
                    <option value="">— Elegir —</option>
                    {meta.materials.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label className="field-label">Color *</label>
                  <input className="input input-boxed" value={form.color}
                    onChange={(e) => set('color', e.target.value)} maxLength={30} required />
                </div>
                <div className="field">
                  <label className="field-label">Talla *</label>
                  <input className="input input-boxed" type="number" min="18" max="50"
                    value={form.size} onChange={(e) => set('size', e.target.value)} required />
                </div>
                <div className="field">
                  <label className="field-label">Precio Bs *</label>
                  <input className="input input-boxed" type="number" min="0" step="1000"
                    value={form.price} onChange={(e) => set('price', e.target.value)} required />
                </div>
                <div className="field">
                  <label className="field-label">Stock *</label>
                  <input className="input input-boxed" type="number" min="0"
                    value={form.stock} onChange={(e) => set('stock', e.target.value)} required />
                </div>
                <div className="field full">
                  <label className="field-label">Descripción</label>
                  <textarea className="input input-boxed" rows="2" maxLength={500}
                    value={form.description} onChange={(e) => set('description', e.target.value)} />
                </div>
              </div>

              {/* Composición — materias primas */}
              <div style={{ marginTop: 'var(--s-6)', paddingTop: 'var(--s-5)', borderTop: 'var(--hairline)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--s-4)' }}>
                  <div>
                    <div className="eyebrow">Composición</div>
                    <h3 style={{ fontFamily: 'var(--f-display)', fontSize: 20, fontWeight: 400, margin: '4px 0 0', letterSpacing: '-0.01em' }}>
                      Materia prima utilizada
                    </h3>
                  </div>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={addCompRow}>
                    <Plus size={12} strokeWidth={1.5} />
                    Agregar insumo
                  </button>
                </div>

                {composition.length === 0 ? (
                  <p className="muted" style={{ fontFamily: 'var(--f-mono)', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    Sin insumos asignados
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-2)' }}>
                    {composition.map((c, idx) => {
                      const m = materialsCatalog.find((x) => x.id === Number(c.raw_material_id));
                      return (
                        <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 28px', gap: 'var(--s-2)', alignItems: 'center' }}>
                          <select className="input input-boxed" value={c.raw_material_id} onChange={(e) => updateCompRow(idx, 'raw_material_id', e.target.value)}>
                            {materialsCatalog.filter((x) => x.is_active).map((x) => (
                              <option key={x.id} value={x.id}>{x.name} ({x.unit})</option>
                            ))}
                          </select>
                          <input
                            className="input input-boxed"
                            type="number"
                            min="0.001"
                            step="0.01"
                            value={c.quantity}
                            onChange={(e) => updateCompRow(idx, 'quantity', e.target.value)}
                            placeholder={m?.unit || 'cant.'}
                          />
                          <button type="button" className="icon-btn danger" onClick={() => removeCompRow(idx)} title="Quitar">
                            <X size={13} strokeWidth={1.5} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="drawer-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setShowDrawer(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  {editing ? 'Guardar cambios' : 'Crear modelo'}
                </button>
              </div>
            </form>
          </aside>
        </>
      )}

      {/* Drawer ver detalle */}
      {viewDetail && (
        <>
          <div className="drawer-backdrop" onClick={() => setViewDetail(null)} />
          <aside className="drawer" onClick={(e) => e.stopPropagation()}>
            <header className="drawer-header">
              <div>
                <div className="drawer-eyebrow eyebrow">
                  Ficha · № {String(viewDetail.id).padStart(3, '0')}
                </div>
                <h2 className="drawer-title">{viewDetail.model_name}</h2>
              </div>
              <button className="drawer-close" onClick={() => setViewDetail(null)}>
                <X size={15} strokeWidth={1.5} />
              </button>
            </header>

            <div className="drawer-grid">
              <div>
                <div className="eyebrow">Tipo</div>
                <div style={{ marginTop: 4 }}><span className={`tag type-${viewDetail.type.toLowerCase()}`}>{viewDetail.type}</span></div>
              </div>
              <div>
                <div className="eyebrow">Material principal</div>
                <div style={{ marginTop: 4, fontFamily: 'var(--f-display)', fontSize: 18 }}>{viewDetail.material}</div>
              </div>
              <div>
                <div className="eyebrow">Color</div>
                <div style={{ marginTop: 4, fontFamily: 'var(--f-display)', fontSize: 18 }}>{viewDetail.color}</div>
              </div>
              <div>
                <div className="eyebrow">Talla</div>
                <div style={{ marginTop: 4, fontFamily: 'var(--f-mono)', fontSize: 18 }}>{viewDetail.size}</div>
              </div>
              <div>
                <div className="eyebrow">Precio</div>
                <div style={{ marginTop: 4, fontFamily: 'var(--f-mono)', fontSize: 20, color: 'var(--ink)' }}>
                  <span style={{ fontSize: 11, color: 'var(--ink-3)', marginRight: 4 }}>Bs</span>
                  {formatGs(viewDetail.price)}
                </div>
              </div>
              <div>
                <div className="eyebrow">Stock</div>
                <div style={{ marginTop: 4 }}>
                  <span className={`stock-pill ${viewDetail.stock <= 2 ? 'danger' : viewDetail.stock <= 5 ? 'low' : ''}`}>{viewDetail.stock}</span>
                </div>
              </div>
              {viewDetail.description && (
                <div className="full">
                  <div className="eyebrow">Descripción</div>
                  <p style={{ marginTop: 4, color: 'var(--ink-2)' }}>{viewDetail.description}</p>
                </div>
              )}
            </div>

            <div style={{ marginTop: 'var(--s-6)', paddingTop: 'var(--s-5)', borderTop: 'var(--hairline)' }}>
              <div className="eyebrow" style={{ marginBottom: 4 }}>Composición</div>
              <h3 style={{ fontFamily: 'var(--f-display)', fontSize: 22, fontWeight: 400, margin: '0 0 var(--s-4)' }}>
                Materia prima ({viewDetail.materials.length})
              </h3>

              {viewDetail.materials.length === 0 ? (
                <p className="muted">Este producto no tiene composición registrada.</p>
              ) : (
                <table className="table" style={{ background: 'transparent' }}>
                  <thead>
                    <tr>
                      <th>Insumo</th>
                      <th className="text-right">Cantidad</th>
                      <th>Proveedor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewDetail.materials.map((m) => (
                      <tr key={m.link_id}>
                        <td className="col-model" style={{ fontSize: 15 }}>{m.name}</td>
                        <td className="col-price">{m.quantity} <span style={{ color: 'var(--ink-3)', fontSize: 11 }}>{m.unit}</span></td>
                        <td className="col-meta">{m.supplier_name || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="drawer-actions">
              <button type="button" className="btn btn-secondary" onClick={() => { setViewDetail(null); openEdit(viewDetail); }}>
                Editar este modelo
              </button>
              <button type="button" className="btn btn-primary" onClick={() => setViewDetail(null)}>
                Cerrar
              </button>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}

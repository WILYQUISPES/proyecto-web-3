import { useEffect, useMemo, useState } from 'react';
import { Plus, X, Trash2, Receipt, FileText, Search, ShoppingCart } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';

const fmtBs = (n) => 'Bs ' + Number(n || 0).toLocaleString('es-BO');
const fmtNum = (n) => Number(n || 0).toLocaleString('es-BO');

function generateVoucherPDF(sale) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: [400, 600] });
  let y = 30;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(28, 24, 21);
  doc.text('PasoFirme', 30, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(139, 126, 110);
  doc.text('EST · 1987', 110, y - 2);
  y += 16;
  doc.text('Cochabamba, Bolivia · pasofirme.bo', 30, y);

  y += 20;
  doc.setDrawColor(212, 202, 184);
  doc.setLineWidth(0.5);
  doc.line(30, y, 370, y);

  y += 22;
  doc.setFontSize(9);
  doc.setTextColor(139, 126, 110);
  doc.text('COMPROBANTE DE VENTA', 30, y);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(28, 24, 21);
  doc.text(sale.sale_number, 30, y + 18);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(74, 63, 53);
  const dateStr = new Date(sale.created_at + 'Z').toLocaleString('es-BO');
  doc.text(dateStr, 370, y + 18, { align: 'right' });

  y += 40;
  doc.setDrawColor(212, 202, 184);
  doc.line(30, y, 370, y);

  y += 18;
  doc.setFontSize(8);
  doc.setTextColor(139, 126, 110);
  doc.text('CLIENTE', 30, y);
  doc.setFontSize(11);
  doc.setTextColor(28, 24, 21);
  doc.text(sale.customer_name, 30, y + 14);
  if (sale.customer_doc) {
    doc.setFontSize(9);
    doc.setTextColor(139, 126, 110);
    doc.text(`Doc.: ${sale.customer_doc}`, 30, y + 26);
  }
  doc.setFontSize(8);
  doc.setTextColor(139, 126, 110);
  doc.text('FORMA DE PAGO', 370, y, { align: 'right' });
  doc.setFontSize(11);
  doc.setTextColor(28, 24, 21);
  doc.text(sale.payment_method, 370, y + 14, { align: 'right' });

  y += 44;
  autoTable(doc, {
    startY: y,
    margin: { left: 30, right: 30 },
    head: [['Producto', 'Cant.', 'P. unit. Bs', 'Subtotal Bs']],
    body: sale.items.map((it) => [
      `${it.product_name}\n${it.product_color || ''} · T${it.product_size || '-'}`,
      String(it.quantity),
      fmtNum(it.unit_price),
      fmtNum(it.line_total)
    ]),
    styles: { fontSize: 8, cellPadding: 5, lineColor: [212, 202, 184], lineWidth: 0.3 },
    headStyles: { fillColor: [28, 24, 21], textColor: [250, 246, 237], fontStyle: 'bold', fontSize: 8 },
    alternateRowStyles: { fillColor: [244, 237, 224] },
    columnStyles: {
      1: { halign: 'center', cellWidth: 35 },
      2: { halign: 'right', cellWidth: 65 },
      3: { halign: 'right', cellWidth: 70, fontStyle: 'bold' }
    }
  });

  let y2 = doc.lastAutoTable.finalY + 14;

  doc.setFontSize(9);
  doc.setTextColor(74, 63, 53);
  doc.text('Subtotal', 240, y2);
  doc.text(fmtNum(sale.subtotal), 370, y2, { align: 'right' });
  y2 += 14;

  if (sale.discount_pct > 0) {
    doc.setTextColor(160, 72, 34);
    doc.text(`Descuento (${sale.discount_pct}%)`, 240, y2);
    doc.text('-' + fmtNum(sale.discount_amount), 370, y2, { align: 'right' });
    y2 += 14;
  }

  doc.setDrawColor(28, 24, 21);
  doc.setLineWidth(0.8);
  doc.line(240, y2 - 2, 370, y2 - 2);
  y2 += 12;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(28, 24, 21);
  doc.text('TOTAL', 240, y2);
  doc.text('Bs ' + fmtNum(sale.total), 370, y2, { align: 'right' });

  if (sale.notes) {
    y2 += 24;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(139, 126, 110);
    doc.text('Notas:', 30, y2);
    doc.setTextColor(74, 63, 53);
    doc.text(sale.notes, 30, y2 + 12, { maxWidth: 340 });
  }

  // Footer
  const footerY = doc.internal.pageSize.height - 30;
  doc.setDrawColor(212, 202, 184);
  doc.setLineWidth(0.3);
  doc.line(30, footerY - 14, 370, footerY - 14);
  doc.setFontSize(7);
  doc.setTextColor(139, 126, 110);
  doc.text('Gracias por su compra · PasoFirme · Inventario №' + sale.sale_number, 200, footerY, { align: 'center' });

  doc.save(`pasofirme_voucher_${sale.sale_number}.pdf`);
}

export default function Ventas() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDrawer, setShowDrawer] = useState(false);
  const [viewSale, setViewSale] = useState(null);
  const [search, setSearch] = useState('');

  // Carrito (nueva venta)
  const [customer, setCustomer] = useState({ name: '', doc: '', payment: 'Efectivo', notes: '' });
  const [cart, setCart] = useState([]);
  const [discountPct, setDiscountPct] = useState(0);
  const [prodFilter, setProdFilter] = useState('');
  const [formError, setFormError] = useState('');

  async function load() {
    setLoading(true);
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      const r = await client.get('/sales', { params });
      setItems(r.data);
    } finally { setLoading(false); }
  }

  useEffect(() => {
    client.get('/sales/meta/options').then((r) => setPaymentMethods(r.data.paymentMethods));
    client.get('/products').then((r) => setProducts(r.data.filter((p) => p.is_active && p.stock > 0)));
    load();
  }, []);

  function openCreate() {
    setCustomer({ name: '', doc: '', payment: 'Efectivo', notes: '' });
    setCart([]);
    setDiscountPct(0);
    setProdFilter('');
    setFormError('');
    setShowDrawer(true);
    client.get('/products').then((r) => setProducts(r.data.filter((p) => p.is_active && p.stock > 0)));
  }

  function addToCart(p) {
    const existing = cart.find((c) => c.product_id === p.id);
    if (existing) {
      if (existing.quantity >= p.stock) return;
      setCart(cart.map((c) => c.product_id === p.id ? { ...c, quantity: c.quantity + 1 } : c));
    } else {
      setCart([...cart, {
        product_id: p.id, _name: p.model_name, _color: p.color, _size: p.size,
        _stock: p.stock, quantity: 1, unit_price: p.price
      }]);
    }
  }
  function updateQty(idx, q) {
    const next = [...cart];
    const p = products.find((x) => x.id === next[idx].product_id);
    const max = p?.stock || next[idx]._stock;
    next[idx].quantity = Math.max(1, Math.min(max, Number(q) || 1));
    setCart(next);
  }
  function updatePrice(idx, price) {
    const next = [...cart];
    next[idx].unit_price = Math.max(0, Number(price) || 0);
    setCart(next);
  }
  function removeFromCart(idx) {
    setCart(cart.filter((_, i) => i !== idx));
  }

  const subtotal = useMemo(() => cart.reduce((s, c) => s + c.unit_price * c.quantity, 0), [cart]);
  const discAmt = useMemo(() => subtotal * (Number(discountPct) || 0) / 100, [subtotal, discountPct]);
  const total = subtotal - discAmt;

  const prodsFiltered = useMemo(() => {
    if (!prodFilter.trim()) return products;
    const t = prodFilter.toLowerCase();
    return products.filter((p) =>
      p.model_name.toLowerCase().includes(t) ||
      p.type.toLowerCase().includes(t) ||
      p.color.toLowerCase().includes(t)
    );
  }, [products, prodFilter]);

  async function confirmSale(e) {
    e.preventDefault();
    setFormError('');
    if (!customer.name.trim()) return setFormError('El nombre del cliente es obligatorio');
    if (cart.length === 0) return setFormError('Agregá al menos un producto al carrito');
    if (discountPct < 0 || discountPct > 100) return setFormError('Descuento inválido (0-100%)');

    try {
      const r = await client.post('/sales', {
        customer_name: customer.name.trim(),
        customer_doc: customer.doc.trim() || null,
        payment_method: customer.payment,
        notes: customer.notes.trim() || null,
        discount_pct: Number(discountPct),
        items: cart.map((c) => ({
          product_id: c.product_id,
          quantity: c.quantity,
          unit_price: c.unit_price
        }))
      });
      setShowDrawer(false);
      generateVoucherPDF(r.data);
      await load();
      client.get('/products').then((rr) => setProducts(rr.data.filter((p) => p.is_active && p.stock > 0)));
    } catch (err) {
      setFormError(err.response?.data?.error || err.response?.data?.errors?.[0]?.msg || 'Error al registrar venta');
    }
  }

  async function viewVoucher(sale) {
    try {
      const r = await client.get(`/sales/${sale.id}`);
      setViewSale(r.data);
    } catch {}
  }

  async function reprintVoucher(sale) {
    try {
      const r = await client.get(`/sales/${sale.id}`);
      generateVoucherPDF(r.data);
    } catch {}
  }

  async function anularSale(sale) {
    if (!window.confirm(`¿Anular venta ${sale.sale_number}? Se restaurará el stock.`)) return;
    try {
      await client.delete(`/sales/${sale.id}`);
      await load();
    } catch (err) {
      alert(err.response?.data?.error || 'Error al anular');
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div className="page-header-left">
          <div className="page-subtitle">№ 10 · Punto de venta</div>
          <h1 className="page-title">Caja <em>registradora</em>.</h1>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>
          <ShoppingCart size={15} strokeWidth={1.5} />
          Nueva venta
        </button>
      </header>

      <div className="toolbar">
        <input
          className="input"
          placeholder="Buscar por cliente o número (V-0001)…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load()}
          style={{ flex: '1 1 280px', maxWidth: 380 }}
        />
        <div className="toolbar-spacer" />
        <button className="btn btn-secondary btn-sm" onClick={load}>Aplicar</button>
      </div>

      {loading ? <p className="muted">Cargando…</p> : (
        <div className="table-card">
          <table className="table">
            <thead>
              <tr>
                <th>№ Venta</th><th>Fecha</th><th>Cliente</th>
                <th>Items</th><th>Pago</th>
                <th className="text-right">Total</th>
                <th className="text-right">Ganancia</th>
                <th>Estado</th><th></th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && <tr><td colSpan="9"><p className="empty-state">Sin ventas registradas.</p></td></tr>}
              {items.map((s) => (
                <tr key={s.id} className={s.is_active ? '' : 'row-deleted'}>
                  <td className="col-model" data-label="№" style={{ fontSize: 16, cursor: 'pointer' }} onClick={() => viewVoucher(s)}>
                    {s.sale_number}
                  </td>
                  <td className="col-meta" data-label="Fecha">{s.created_at}</td>
                  <td className="col-meta" data-label="Cliente" style={{ color: 'var(--ink)', fontFamily: 'var(--f-sans)', fontSize: 14 }}>
                    {s.customer_name}
                  </td>
                  <td className="col-meta" data-label="Items">{s.items_count}</td>
                  <td data-label="Pago"><span className="tag">{s.payment_method}</span></td>
                  <td className="col-price" data-label="Total"><span className="currency">Bs</span>{fmtNum(s.total)}</td>
                  <td className="col-price" data-label="Ganancia" style={{ color: 'var(--moss)' }}>
                    <span className="currency">Bs</span>{fmtNum(s.profit)}
                  </td>
                  <td data-label="Estado">
                    <span className={`status ${s.is_active ? '' : 'inactive'}`}>
                      {s.is_active ? 'Confirmada' : 'Anulada'}
                    </span>
                  </td>
                  <td data-label="">
                    <div className="row-actions">
                      <button className="icon-btn" onClick={() => viewVoucher(s)} title="Ver detalle">
                        <Receipt size={13} strokeWidth={1.5} />
                      </button>
                      <button className="icon-btn" onClick={() => reprintVoucher(s)} title="Descargar PDF">
                        <FileText size={13} strokeWidth={1.5} />
                      </button>
                      {user.role === 'admin' && s.is_active && (
                        <button className="icon-btn danger" onClick={() => anularSale(s)} title="Anular">
                          <Trash2 size={13} strokeWidth={1.5} />
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

      {/* Drawer: nueva venta */}
      {showDrawer && (
        <>
          <div className="drawer-backdrop" onClick={() => setShowDrawer(false)} />
          <aside className="drawer" style={{ width: 'min(820px, 96vw)' }} onClick={(e) => e.stopPropagation()}>
            <header className="drawer-header">
              <div>
                <div className="drawer-eyebrow eyebrow">Nueva transacción</div>
                <h2 className="drawer-title">Registrar venta</h2>
              </div>
              <button className="drawer-close" onClick={() => setShowDrawer(false)}>
                <X size={15} strokeWidth={1.5} />
              </button>
            </header>

            <form onSubmit={confirmSale}>
              {formError && <div className="alert alert-error">{formError}</div>}

              {/* Cliente */}
              <div className="drawer-grid">
                <div className="field">
                  <label className="field-label">Nombre del cliente *</label>
                  <input className="input input-boxed" value={customer.name}
                    onChange={(e) => setCustomer({ ...customer, name: e.target.value })} required />
                </div>
                <div className="field">
                  <label className="field-label">Documento</label>
                  <input className="input input-boxed" value={customer.doc}
                    onChange={(e) => setCustomer({ ...customer, doc: e.target.value })}
                    placeholder="opcional" />
                </div>
                <div className="field">
                  <label className="field-label">Forma de pago *</label>
                  <select className="input input-boxed" value={customer.payment}
                    onChange={(e) => setCustomer({ ...customer, payment: e.target.value })}>
                    {paymentMethods.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label className="field-label">Descuento %</label>
                  <input className="input input-boxed" type="number" min="0" max="100" step="0.5"
                    value={discountPct} onChange={(e) => setDiscountPct(e.target.value)} />
                </div>
              </div>

              {/* Buscador productos */}
              <div style={{ marginTop: 'var(--s-5)', paddingTop: 'var(--s-5)', borderTop: 'var(--hairline)' }}>
                <div className="eyebrow" style={{ marginBottom: 'var(--s-2)' }}>Catálogo disponible</div>
                <div style={{ position: 'relative', marginBottom: 'var(--s-3)' }}>
                  <Search size={14} strokeWidth={1.5} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)' }} />
                  <input
                    className="input input-boxed"
                    placeholder="Buscar producto para agregar…"
                    value={prodFilter}
                    onChange={(e) => setProdFilter(e.target.value)}
                    style={{ paddingLeft: 36 }}
                  />
                </div>
                <div style={{ maxHeight: 200, overflowY: 'auto', border: 'var(--hairline)', borderRadius: 'var(--r-sm)' }}>
                  {prodsFiltered.length === 0 ? (
                    <p className="muted" style={{ padding: 'var(--s-3)', fontSize: 12 }}>Sin productos disponibles</p>
                  ) : (
                    prodsFiltered.slice(0, 30).map((p) => (
                      <div key={p.id}
                        onClick={() => addToCart(p)}
                        style={{
                          padding: '10px 14px', borderBottom: '1px solid var(--stone)',
                          cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          transition: 'background 160ms ease'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--parchment-2)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                        <div>
                          <div style={{ fontFamily: 'var(--f-display)', fontSize: 15 }}>{p.model_name}</div>
                          <div style={{ fontFamily: 'var(--f-mono)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.05em', marginTop: 2 }}>
                            {p.type} · {p.color} · T{p.size} · stock {p.stock}
                          </div>
                        </div>
                        <div style={{ fontFamily: 'var(--f-mono)', fontSize: 13 }}>{fmtBs(p.price)}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Carrito */}
              <div style={{ marginTop: 'var(--s-5)', paddingTop: 'var(--s-5)', borderTop: 'var(--hairline)' }}>
                <div className="eyebrow" style={{ marginBottom: 'var(--s-3)' }}>
                  Carrito ({cart.length} {cart.length === 1 ? 'producto' : 'productos'})
                </div>
                {cart.length === 0 ? (
                  <p className="muted" style={{ fontSize: 12, textAlign: 'center', padding: 'var(--s-4)', border: 'var(--hairline)', borderRadius: 'var(--r-sm)', borderStyle: 'dashed' }}>
                    Vacío. Hacé clic en un producto arriba para agregarlo.
                  </p>
                ) : (
                  <table className="table" style={{ background: 'transparent' }}>
                    <thead>
                      <tr>
                        <th>Producto</th><th style={{ width: 70 }}>Cant.</th>
                        <th style={{ width: 110 }}>P. unit Bs</th>
                        <th className="text-right" style={{ width: 110 }}>Subtotal</th>
                        <th style={{ width: 28 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {cart.map((c, idx) => (
                        <tr key={idx}>
                          <td>
                            <div style={{ fontFamily: 'var(--f-display)', fontSize: 14 }}>{c._name}</div>
                            <div style={{ fontFamily: 'var(--f-mono)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.05em' }}>
                              {c._color} · T{c._size}
                            </div>
                          </td>
                          <td>
                            <input className="input input-boxed" type="number" min="1" max={c._stock}
                              value={c.quantity} onChange={(e) => updateQty(idx, e.target.value)}
                              style={{ width: 60, padding: '4px 8px', fontSize: 12 }} />
                          </td>
                          <td>
                            <input className="input input-boxed" type="number" min="0" step="1000"
                              value={c.unit_price} onChange={(e) => updatePrice(idx, e.target.value)}
                              style={{ width: 100, padding: '4px 8px', fontSize: 12, fontFamily: 'var(--f-mono)' }} />
                          </td>
                          <td className="col-price">{fmtBs(c.unit_price * c.quantity)}</td>
                          <td>
                            <button type="button" className="icon-btn danger" onClick={() => removeFromCart(idx)}>
                              <X size={11} strokeWidth={1.5} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Totales */}
              {cart.length > 0 && (
                <div style={{ marginTop: 'var(--s-5)', padding: 'var(--s-4)', background: 'var(--parchment)', borderRadius: 'var(--r-md)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontFamily: 'var(--f-mono)', fontSize: 13 }}>
                    <span>Subtotal</span>
                    <strong>{fmtBs(subtotal)}</strong>
                  </div>
                  {discAmt > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontFamily: 'var(--f-mono)', fontSize: 13, color: 'var(--rust)' }}>
                      <span>Descuento ({discountPct}%)</span>
                      <strong>− {fmtBs(discAmt)}</strong>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0 0', borderTop: '1px solid var(--ink)', marginTop: 6 }}>
                    <span style={{ fontFamily: 'var(--f-mono)', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase' }}>TOTAL</span>
                    <strong style={{ fontFamily: 'var(--f-display)', fontSize: 28, fontStyle: 'italic', color: 'var(--cognac)' }}>
                      {fmtBs(total)}
                    </strong>
                  </div>
                </div>
              )}

              {/* Notas */}
              <div className="field" style={{ marginTop: 'var(--s-4)' }}>
                <label className="field-label">Notas (opcional)</label>
                <textarea className="input input-boxed" rows="2" maxLength={500}
                  value={customer.notes} onChange={(e) => setCustomer({ ...customer, notes: e.target.value })} />
              </div>

              <div className="drawer-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setShowDrawer(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={cart.length === 0 || !customer.name.trim()}>
                  Confirmar venta · Generar voucher
                </button>
              </div>
            </form>
          </aside>
        </>
      )}

      {/* Drawer: ver venta */}
      {viewSale && (
        <>
          <div className="drawer-backdrop" onClick={() => setViewSale(null)} />
          <aside className="drawer" onClick={(e) => e.stopPropagation()}>
            <header className="drawer-header">
              <div>
                <div className="drawer-eyebrow eyebrow">Comprobante de venta</div>
                <h2 className="drawer-title">{viewSale.sale_number}</h2>
              </div>
              <button className="drawer-close" onClick={() => setViewSale(null)}>
                <X size={15} strokeWidth={1.5} />
              </button>
            </header>

            <div className="drawer-grid">
              <div>
                <div className="eyebrow">Cliente</div>
                <div style={{ marginTop: 4, fontFamily: 'var(--f-display)', fontSize: 18 }}>{viewSale.customer_name}</div>
                {viewSale.customer_doc && (
                  <div className="muted" style={{ fontFamily: 'var(--f-mono)', fontSize: 11, marginTop: 2 }}>
                    Doc: {viewSale.customer_doc}
                  </div>
                )}
              </div>
              <div>
                <div className="eyebrow">Forma de pago</div>
                <div style={{ marginTop: 4 }}><span className="tag">{viewSale.payment_method}</span></div>
              </div>
              <div>
                <div className="eyebrow">Fecha</div>
                <div className="mono" style={{ marginTop: 4, fontSize: 12 }}>{viewSale.created_at}</div>
              </div>
              <div>
                <div className="eyebrow">Estado</div>
                <div style={{ marginTop: 4 }}>
                  <span className={`status ${viewSale.is_active ? '' : 'inactive'}`}>
                    {viewSale.is_active ? 'Confirmada' : 'Anulada'}
                  </span>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 'var(--s-6)' }}>
              <div className="eyebrow" style={{ marginBottom: 4 }}>Detalle</div>
              <table className="table" style={{ background: 'transparent' }}>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th className="text-right">Cant.</th>
                    <th className="text-right">P. unit</th>
                    <th className="text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {viewSale.items.map((it) => (
                    <tr key={it.id}>
                      <td>
                        <div className="col-model" style={{ fontSize: 14 }}>{it.product_name}</div>
                        <div className="col-meta" style={{ fontSize: 10 }}>{it.product_color} · T{it.product_size}</div>
                      </td>
                      <td className="col-price">{it.quantity}</td>
                      <td className="col-price">{fmtNum(it.unit_price)}</td>
                      <td className="col-price">{fmtNum(it.line_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: 'var(--s-5)', padding: 'var(--s-4)', background: 'var(--parchment)', borderRadius: 'var(--r-md)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontFamily: 'var(--f-mono)', fontSize: 12 }}>
                <span>Subtotal</span><span>{fmtBs(viewSale.subtotal)}</span>
              </div>
              {viewSale.discount_pct > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontFamily: 'var(--f-mono)', fontSize: 12, color: 'var(--rust)' }}>
                  <span>Descuento ({viewSale.discount_pct}%)</span>
                  <span>− {fmtBs(viewSale.discount_amount)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 0', borderTop: '1px solid var(--ink)', marginTop: 4 }}>
                <span className="eyebrow">TOTAL</span>
                <strong style={{ fontFamily: 'var(--f-display)', fontSize: 26, fontStyle: 'italic', color: 'var(--cognac)' }}>
                  {fmtBs(viewSale.total)}
                </strong>
              </div>
              {user.role === 'admin' && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 0', borderTop: 'var(--hairline)', marginTop: 10, fontFamily: 'var(--f-mono)', fontSize: 11, color: 'var(--ink-3)' }}>
                    <span>COSTO (MP)</span><span>{fmtBs(viewSale.total_cost)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontFamily: 'var(--f-mono)', fontSize: 13, color: 'var(--moss)' }}>
                    <span>GANANCIA</span><strong>{fmtBs(viewSale.profit)}</strong>
                  </div>
                </>
              )}
            </div>

            {viewSale.notes && (
              <div style={{ marginTop: 'var(--s-4)' }}>
                <div className="eyebrow" style={{ marginBottom: 4 }}>Notas</div>
                <p style={{ color: 'var(--ink-2)', fontSize: 13 }}>{viewSale.notes}</p>
              </div>
            )}

            <div className="drawer-actions">
              <button className="btn btn-secondary" onClick={() => generateVoucherPDF(viewSale)}>
                <FileText size={14} strokeWidth={1.5} />
                Descargar PDF
              </button>
              <button className="btn btn-primary" onClick={() => setViewSale(null)}>Cerrar</button>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}

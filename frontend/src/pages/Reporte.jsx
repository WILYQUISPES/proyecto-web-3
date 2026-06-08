import { useEffect, useMemo, useState } from 'react';
import { FileText } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function Reporte() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ types: [], materials: [] });
  const [filterType, setFilterType] = useState('');
  const [filterMaterial, setFilterMaterial] = useState('');
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const params = {};
      if (filterType) params.type = filterType;
      if (filterMaterial) params.material = filterMaterial;
      if (includeDeleted && user.role === 'admin') params.includeDeleted = true;
      const r = await client.get('/products', { params });
      setItems(r.data);
    } finally { setLoading(false); }
  }

  useEffect(() => {
    client.get('/products/meta/options').then((r) => setMeta(r.data));
  }, []);

  useEffect(() => { load(); }, [filterType, filterMaterial, includeDeleted]);

  const stats = useMemo(() => {
    const totalStock = items.reduce((a, p) => a + (p.stock || 0), 0);
    const valor = items.reduce((a, p) => a + (p.price * p.stock || 0), 0);
    const bajoStock = items.filter((p) => p.stock <= 5).length;
    return { count: items.length, totalStock, valor, bajoStock };
  }, [items]);

  function exportar() {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

    doc.setFontSize(22);
    doc.setTextColor(28, 24, 21);
    doc.text('PasoFirme', 40, 50);
    doc.setFontSize(10);
    doc.setTextColor(139, 126, 110);
    doc.text('EST · 1987 — Catálogo de productos', 40, 66);

    doc.setFontSize(9);
    doc.setTextColor(74, 63, 53);
    const now = new Date().toLocaleString('es-BO');
    doc.text(`Generado: ${now}`, 40, 90);
    doc.text(`Por: ${user.username} (${user.role})`, 40, 102);
    const filtrosStr = `Filtros: tipo=${filterType || 'todos'} · material=${filterMaterial || 'todos'} · eliminados=${includeDeleted ? 'incluidos' : 'no'}`;
    doc.text(filtrosStr, 40, 114);

    doc.setDrawColor(212, 202, 184);
    doc.setLineWidth(0.5);
    doc.line(40, 128, doc.internal.pageSize.width - 40, 128);

    doc.setFontSize(10);
    doc.setTextColor(28, 24, 21);
    doc.text(`Total productos: ${stats.count}`, 40, 148);
    doc.text(`Stock total: ${stats.totalStock} unidades`, 200, 148);
    doc.text(`Valor inventario: Bs ${stats.valor.toLocaleString('es-BO')}`, 380, 148);
    doc.text(`Bajo stock (≤5): ${stats.bajoStock}`, 600, 148);

    autoTable(doc, {
      startY: 170,
      head: [['№', 'Modelo', 'Tipo', 'Material', 'Color', 'Talla', 'Stock', 'Precio Bs', 'Estado']],
      body: items.map((p) => [
        String(p.id).padStart(3, '0'),
        p.model_name,
        p.type,
        p.material,
        p.color,
        p.size,
        p.stock,
        p.price.toLocaleString('es-BO'),
        p.is_active ? 'Activo' : 'Eliminado'
      ]),
      styles: { fontSize: 9, cellPadding: 6, lineColor: [212, 202, 184], lineWidth: 0.3 },
      headStyles: {
        fillColor: [28, 24, 21],
        textColor: [250, 246, 237],
        fontStyle: 'bold',
        fontSize: 8,
        cellPadding: 8
      },
      alternateRowStyles: { fillColor: [244, 237, 224] },
      columnStyles: {
        7: { halign: 'right', fontStyle: 'bold' },
        6: { halign: 'center' },
        5: { halign: 'center' }
      },
      didDrawPage: (data) => {
        const pageCount = doc.internal.getNumberOfPages();
        const pageNum = data.pageNumber;
        doc.setFontSize(8);
        doc.setTextColor(139, 126, 110);
        doc.text(
          `PasoFirme · pág. ${pageNum} de ${pageCount}`,
          data.settings.margin.left,
          doc.internal.pageSize.height - 20
        );
        doc.text(
          now,
          doc.internal.pageSize.width - data.settings.margin.right - 80,
          doc.internal.pageSize.height - 20
        );
      }
    });

    doc.save(`pasofirme_catalogo_${Date.now()}.pdf`);
  }

  const formatGs = (n) => Number(n).toLocaleString('es-BO');

  return (
    <div className="page">
      <header className="page-header">
        <div className="page-header-left">
          <div className="page-subtitle">№ 07 · Reporte PDF</div>
          <h1 className="page-title">
            Generar <em>catálogo</em>.
          </h1>
        </div>
        <button className="btn btn-primary" onClick={exportar} disabled={loading || items.length === 0}>
          <FileText size={15} strokeWidth={1.5} />
          Descargar PDF
        </button>
      </header>

      <div className="toolbar">
        <label className="field-label" style={{ margin: 0, alignSelf: 'center' }}>Tipo</label>
        <select className="input input-boxed" style={{ width: 'auto', minWidth: 140 }} value={filterType} onChange={(e) => setFilterType(e.target.value)}>
          <option value="">Todos</option>
          {meta.types.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <label className="field-label" style={{ margin: 0, alignSelf: 'center' }}>Material</label>
        <select className="input input-boxed" style={{ width: 'auto', minWidth: 140 }} value={filterMaterial} onChange={(e) => setFilterMaterial(e.target.value)}>
          <option value="">Todos</option>
          {meta.materials.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        {user.role === 'admin' && (
          <label className="check">
            <input type="checkbox" checked={includeDeleted} onChange={(e) => setIncludeDeleted(e.target.checked)} />
            Incluir eliminados
          </label>
        )}
      </div>

      <section className="report-summary">
        <div className="report-summary-item">
          <div className="num">{stats.count}</div>
          <div className="label">Productos</div>
        </div>
        <div className="report-summary-item">
          <div className="num">{stats.totalStock}</div>
          <div className="label">Unidades de stock</div>
        </div>
        <div className="report-summary-item">
          <div className="num" style={{ color: 'var(--cognac)', fontStyle: 'italic' }}>
            ₲ {formatGs(stats.valor)}
          </div>
          <div className="label">Valor inventario</div>
        </div>
        <div className="report-summary-item">
          <div className="num">{stats.bajoStock}</div>
          <div className="label">Bajo stock (≤5)</div>
        </div>
      </section>

      {loading ? (
        <p className="muted">Cargando…</p>
      ) : items.length > 0 ? (
        <div className="table-card">
          <table className="table">
            <thead>
              <tr>
                <th>№</th><th>Modelo</th><th>Tipo</th><th>Color</th>
                <th>Stock</th><th className="text-right">Precio</th>
              </tr>
            </thead>
            <tbody>
              {items.slice(0, 12).map((p) => (
                <tr key={p.id}>
                  <td className="col-id" data-label="№">{String(p.id).padStart(3, '0')}</td>
                  <td className="col-model" data-label="Modelo">{p.model_name}</td>
                  <td data-label="Tipo"><span className={`tag type-${p.type.toLowerCase()}`}>{p.type}</span></td>
                  <td className="col-meta" data-label="Color">{p.color}</td>
                  <td data-label="Stock"><span className={`stock-pill ${p.stock <= 2 ? 'danger' : p.stock <= 5 ? 'low' : ''}`}>{p.stock}</span></td>
                  <td className="col-price" data-label="Precio"><span className="currency">Bs</span>{formatGs(p.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {items.length > 12 && (
            <div style={{ padding: 'var(--s-4) var(--s-5)', borderTop: 'var(--hairline)', textAlign: 'center' }}>
              <span className="eyebrow">… y {items.length - 12} productos más en el PDF</span>
            </div>
          )}
        </div>
      ) : (
        <p className="empty-state">Sin productos para los filtros aplicados.</p>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title
} from 'chart.js';
import { FileText } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title);
ChartJS.defaults.font.family = "'Geist Mono', monospace";
ChartJS.defaults.color = '#1C1815';

const COLORS = ['#1C1815', '#6B3410', '#A0522D', '#B8893A', '#8B6F47', '#C77D2C'];
const fmtBs = (n) => 'Bs ' + Number(n || 0).toLocaleString('es-BO');
const fmtNum = (n) => Number(n || 0).toLocaleString('es-BO');

function PeriodCard({ label, period, accent }) {
  return (
    <div className="stat-card">
      <div className="eyebrow">{label}</div>
      <div className={`stat-card-num ${accent ? 'accent' : ''}`}>
        <span className="currency">Bs</span>
        <span className="num-value">{fmtNum(period.total)}</span>
      </div>
      <div className="stat-card-foot">
        <span className="stat-card-meta">{period.count} {period.count === 1 ? 'venta' : 'ventas'}</span>
        <span className="stat-card-meta" style={{ color: 'var(--moss)' }}>
          + Bs {fmtNum(period.profit)}
        </span>
      </div>
    </div>
  );
}

export default function Finanzas() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    client.get('/finance/summary')
      .then((r) => setData(r.data))
      .catch((e) => setError(e.response?.data?.error || 'Error al cargar'))
      .finally(() => setLoading(false));
  }, []);

  function exportarPDF() {
    if (!data) return;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    let y = 50;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(28, 24, 21);
    doc.text('PasoFirme', 40, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(139, 126, 110);
    doc.text('EST · 1987 — Reporte financiero', 40, y + 14);

    y += 40;
    doc.setDrawColor(212, 202, 184);
    doc.setLineWidth(0.5);
    doc.line(40, y, 555, y);

    y += 20;
    doc.setFontSize(9);
    doc.setTextColor(74, 63, 53);
    const now = new Date().toLocaleString('es-BO');
    doc.text(`Generado: ${now}`, 40, y);
    doc.text(`Por: ${user.username} (${user.role})`, 40, y + 12);

    y += 36;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(28, 24, 21);
    doc.text('Resumen por período', 40, y);

    y += 20;
    autoTable(doc, {
      startY: y,
      margin: { left: 40, right: 40 },
      head: [['Período', 'Ventas', 'Total facturado', 'Costo (MP)', 'Ganancia']],
      body: [
        ['Hoy',    String(data.periodos.today.count),  fmtBs(data.periodos.today.total),  fmtBs(data.periodos.today.cost),  fmtBs(data.periodos.today.profit)],
        ['Semana', String(data.periodos.week.count),   fmtBs(data.periodos.week.total),   fmtBs(data.periodos.week.cost),   fmtBs(data.periodos.week.profit)],
        ['Mes',    String(data.periodos.month.count),  fmtBs(data.periodos.month.total),  fmtBs(data.periodos.month.cost),  fmtBs(data.periodos.month.profit)],
        ['Año',    String(data.periodos.year.count),   fmtBs(data.periodos.year.total),   fmtBs(data.periodos.year.cost),   fmtBs(data.periodos.year.profit)],
        ['Histórico', String(data.periodos.all.count), fmtBs(data.periodos.all.total),    fmtBs(data.periodos.all.cost),    fmtBs(data.periodos.all.profit)]
      ],
      styles: { fontSize: 9, cellPadding: 6, lineColor: [212, 202, 184], lineWidth: 0.3 },
      headStyles: { fillColor: [28, 24, 21], textColor: [250, 246, 237], fontSize: 8 },
      alternateRowStyles: { fillColor: [244, 237, 224] },
      columnStyles: {
        2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right', fontStyle: 'bold' }
      }
    });

    let y2 = doc.lastAutoTable.finalY + 22;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(28, 24, 21);
    doc.text('Indicadores clave', 40, y2);
    y2 += 16;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(74, 63, 53);
    doc.text(`Valor de materia prima en stock: ${fmtBs(data.valorMatPrima)}`, 40, y2); y2 += 14;
    doc.text(`Inversión en MP utilizada (ventas históricas): ${fmtBs(data.inversionMatPrima)}`, 40, y2); y2 += 14;
    doc.text(`Margen promedio histórico: ${data.marginAvg.toFixed(1)}%`, 40, y2); y2 += 22;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(28, 24, 21);
    doc.text('Top 5 productos más vendidos', 40, y2);
    y2 += 8;
    autoTable(doc, {
      startY: y2 + 4,
      margin: { left: 40, right: 40 },
      head: [['Producto', 'Unidades', 'Ventas', 'Costo MP', 'Ganancia']],
      body: data.topProductos.map((p) => [
        p.label, String(p.unidades), fmtBs(p.ventas), fmtBs(p.costo), fmtBs(p.ganancia)
      ]),
      styles: { fontSize: 9, cellPadding: 6, lineColor: [212, 202, 184], lineWidth: 0.3 },
      headStyles: { fillColor: [28, 24, 21], textColor: [250, 246, 237], fontSize: 8 },
      alternateRowStyles: { fillColor: [244, 237, 224] },
      columnStyles: {
        1: { halign: 'center' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right', fontStyle: 'bold' }
      }
    });

    let y3 = doc.lastAutoTable.finalY + 22;
    if (data.ventasPorMes.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(28, 24, 21);
      doc.text('Evolución mensual (últimos 12 meses)', 40, y3);
      autoTable(doc, {
        startY: y3 + 8,
        margin: { left: 40, right: 40 },
        head: [['Mes', 'Cant. ventas', 'Total facturado', 'Ganancia']],
        body: data.ventasPorMes.map((m) => [
          m.label, String(m.cantidad), fmtBs(m.ventas), fmtBs(m.ganancias)
        ]),
        styles: { fontSize: 9, cellPadding: 6, lineColor: [212, 202, 184], lineWidth: 0.3 },
        headStyles: { fillColor: [28, 24, 21], textColor: [250, 246, 237], fontSize: 8 },
        alternateRowStyles: { fillColor: [244, 237, 224] },
        columnStyles: { 1: { halign: 'center' }, 2: { halign: 'right' }, 3: { halign: 'right', fontStyle: 'bold' } }
      });
    }

    const footerY = doc.internal.pageSize.height - 30;
    doc.setFontSize(8);
    doc.setTextColor(139, 126, 110);
    doc.text('PasoFirme · Reporte financiero · ' + now, 40, footerY);

    doc.save(`pasofirme_finanzas_${Date.now()}.pdf`);
  }

  if (loading) return <div className="page"><p className="muted">Cargando…</p></div>;
  if (error) return <div className="page"><div className="alert alert-error">{error}</div></div>;

  const monthsData = {
    labels: data.ventasPorMes.map((x) => x.label),
    datasets: [
      {
        label: 'Ventas',
        data: data.ventasPorMes.map((x) => x.ventas),
        backgroundColor: '#6B3410',
        borderRadius: 2,
        barThickness: 18
      },
      {
        label: 'Ganancias',
        data: data.ventasPorMes.map((x) => x.ganancias),
        backgroundColor: '#A0522D',
        borderRadius: 2,
        barThickness: 18
      }
    ]
  };

  const monthsOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: { font: { family: "'Geist Mono'", size: 10 }, usePointStyle: true, boxWidth: 8, padding: 12 }
      },
      tooltip: {
        backgroundColor: '#1C1815',
        titleFont: { family: "'Geist Mono'", size: 10 },
        bodyFont: { family: "'Geist'", size: 12 },
        padding: 12,
        callbacks: { label: (ctx) => ctx.dataset.label + ': Bs ' + ctx.parsed.y.toLocaleString('es-BO') }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          font: { family: "'Geist Mono'", size: 10 }, color: '#8B7E6E',
          callback: (v) => 'Bs ' + (v / 1000).toFixed(0) + 'k'
        },
        grid: { color: '#D4CAB8', lineWidth: 0.5 }
      },
      x: {
        ticks: { font: { family: "'Geist Mono'", size: 10 }, color: '#1C1815' },
        grid: { display: false }
      }
    }
  };

  const methodData = {
    labels: data.ventasPorMetodo.map((x) => x.label),
    datasets: [{
      data: data.ventasPorMetodo.map((x) => x.ventas),
      backgroundColor: COLORS,
      borderColor: '#FAF6ED',
      borderWidth: 3
    }]
  };

  const methodOptions = {
    responsive: true, maintainAspectRatio: false, cutout: '65%',
    plugins: {
      legend: {
        position: 'right',
        labels: { font: { family: "'Geist Mono'", size: 10 }, usePointStyle: true, boxWidth: 6, padding: 12 }
      },
      tooltip: {
        backgroundColor: '#1C1815',
        callbacks: { label: (ctx) => ctx.label + ': Bs ' + ctx.parsed.toLocaleString('es-BO') }
      }
    }
  };

  return (
    <div className="page">
      <header className="page-header">
        <div className="page-header-left">
          <div className="page-subtitle">№ 11 · Reporte financiero</div>
          <h1 className="page-title">Finanzas <em>del negocio</em>.</h1>
        </div>
        <button className="btn btn-primary" onClick={exportarPDF}>
          <FileText size={15} strokeWidth={1.5} />
          Descargar PDF financiero
        </button>
      </header>

      <section className="stats-grid">
        <PeriodCard label="Hoy"        period={data.periodos.today}  />
        <PeriodCard label="Esta semana" period={data.periodos.week}  />
        <PeriodCard label="Este mes"   period={data.periodos.month} accent />
        <PeriodCard label="Este año"   period={data.periodos.year}  />
      </section>

      <section className="stats-grid">
        <div className="stat-card">
          <div className="eyebrow">Valor materia prima en stock</div>
          <div className="stat-card-num small">
            <span className="currency">Bs</span>
            <span className="num-value">{fmtNum(data.valorMatPrima)}</span>
          </div>
          <div className="stat-card-foot">
            <span className="stat-card-meta">Inventario actual</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="eyebrow">Inversión en MP (ventas)</div>
          <div className="stat-card-num small">
            <span className="currency">Bs</span>
            <span className="num-value">{fmtNum(data.inversionMatPrima)}</span>
          </div>
          <div className="stat-card-foot">
            <span className="stat-card-meta">Costo histórico utilizado</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="eyebrow">Margen promedio</div>
          <div className="stat-card-num small accent">
            <span className="num-value">{data.marginAvg.toFixed(1)}%</span>
          </div>
          <div className="stat-card-foot">
            <span className="stat-card-meta">Histórico</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="eyebrow">Ganancia total histórica</div>
          <div className="stat-card-num small" style={{ color: 'var(--moss)' }}>
            <span className="currency" style={{ color: 'var(--moss)' }}>Bs</span>
            <span className="num-value">{fmtNum(data.periodos.all.profit)}</span>
          </div>
          <div className="stat-card-foot">
            <span className="stat-card-meta">{data.periodos.all.count} ventas</span>
          </div>
        </div>
      </section>

      <section className="charts-grid">
        <article className="chart-card" style={{ gridColumn: 'span 2' }}>
          <header className="chart-card-header">
            <h3 className="chart-card-title">Ventas vs ganancias por mes</h3>
            <span className="chart-card-meta">Últimos 12 meses</span>
          </header>
          {data.ventasPorMes.length === 0
            ? <p className="empty-state">Sin datos.</p>
            : <div style={{ height: 280 }}><Bar data={monthsData} options={monthsOptions} /></div>}
        </article>

        <article className="chart-card">
          <header className="chart-card-header">
            <h3 className="chart-card-title">Por forma de pago</h3>
            <span className="chart-card-meta">Total facturado</span>
          </header>
          {data.ventasPorMetodo.length === 0
            ? <p className="empty-state">Sin datos.</p>
            : <div style={{ height: 280 }}><Doughnut data={methodData} options={methodOptions} /></div>}
        </article>

        <article className="chart-card">
          <header className="chart-card-header">
            <h3 className="chart-card-title">Top productos vendidos</h3>
            <span className="chart-card-meta">Por ingreso</span>
          </header>
          {data.topProductos.length === 0 ? (
            <p className="empty-state">Sin ventas.</p>
          ) : (
            <table className="table" style={{ background: 'transparent' }}>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th className="text-right">Unid.</th>
                  <th className="text-right">Ventas</th>
                  <th className="text-right">Ganancia</th>
                </tr>
              </thead>
              <tbody>
                {data.topProductos.map((p, idx) => (
                  <tr key={idx}>
                    <td className="col-model" style={{ fontSize: 14 }}>{p.label}</td>
                    <td className="col-price">{p.unidades}</td>
                    <td className="col-price">{fmtNum(p.ventas)}</td>
                    <td className="col-price" style={{ color: 'var(--moss)' }}>{fmtNum(p.ganancia)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </article>
      </section>
    </div>
  );
}

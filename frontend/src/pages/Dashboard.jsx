import { useEffect, useState } from 'react';
import { Doughnut, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title
} from 'chart.js';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title);

ChartJS.defaults.font.family = "'Geist Mono', monospace";
ChartJS.defaults.color = '#1C1815';

const CHART_COLORS = ['#1C1815', '#6B3410', '#A0522D', '#B8893A', '#8B6F47', '#C77D2C'];
const PAPER = '#FAF6ED';

function useCountUp(target, duration = 900) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let raf;
    let start = null;
    const step = (t) => {
      if (start === null) start = t;
      const p = Math.min((t - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(target * eased);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

function StatCard({ label, num, suffix = '', accent = false, meta, currency = null }) {
  const animated = useCountUp(num);
  const display = Math.round(animated).toLocaleString('es-BO');
  return (
    <div className="stat-card">
      <div className="eyebrow">{label}</div>
      <div className={`stat-card-num ${accent ? 'accent' : ''}`}>
        {currency && <span className="currency">{currency}</span>}
        <span className="num-value">{display}</span>
        {suffix && <span style={{ fontSize: '0.32em', opacity: 0.5, marginLeft: 2 }}>{suffix}</span>}
      </div>
      {meta && (
        <div className="stat-card-foot">
          <span className="stat-card-meta">{meta}</span>
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const hour = new Date().getHours();
  const saludo = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';

  useEffect(() => {
    client.get('/stats/overview')
      .then((r) => setData(r.data))
      .catch((e) => setError(e.response?.data?.error || 'No se pudo cargar'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="page"><p className="muted">Cargando…</p></div>;
  if (error) return <div className="page"><div className="alert alert-error">{error}</div></div>;

  const today = new Date().toLocaleDateString('es-BO', {
    day: 'numeric', month: 'long', year: 'numeric'
  });

  const donutData = {
    labels: data.porTipo.map((x) => x.label),
    datasets: [{
      data: data.porTipo.map((x) => x.value),
      backgroundColor: CHART_COLORS,
      borderColor: PAPER,
      borderWidth: 3
    }]
  };

  const donutOptions = {
    cutout: '68%',
    plugins: {
      legend: {
        position: 'right',
        labels: {
          font: { family: "'Geist Mono'", size: 10, weight: 500 },
          color: '#1C1815',
          usePointStyle: true,
          boxWidth: 6,
          padding: 14
        }
      },
      tooltip: {
        backgroundColor: '#1C1815',
        titleFont: { family: "'Geist Mono'", size: 10 },
        bodyFont: { family: "'Geist'", size: 13 },
        padding: 12,
        cornerRadius: 4
      }
    }
  };

  const barData = {
    labels: data.stockPorMaterial.map((x) => x.label),
    datasets: [{
      label: 'Stock',
      data: data.stockPorMaterial.map((x) => x.value),
      backgroundColor: '#6B3410',
      hoverBackgroundColor: '#1C1815',
      borderRadius: 2,
      barThickness: 28
    }]
  };

  const barOptions = {
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1C1815',
        titleFont: { family: "'Geist Mono'", size: 10 },
        bodyFont: { family: "'Geist'", size: 13 },
        padding: 12,
        cornerRadius: 4
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          font: { family: "'Geist Mono'", size: 10 },
          color: '#8B7E6E',
          stepSize: 10
        },
        grid: { color: '#D4CAB8', lineWidth: 0.5 },
        border: { color: '#D4CAB8' }
      },
      x: {
        ticks: {
          font: { family: "'Geist Mono'", size: 10 },
          color: '#1C1815'
        },
        grid: { display: false },
        border: { color: '#D4CAB8' }
      }
    }
  };

  const formatBs = (n) => 'Bs ' + n.toLocaleString('es-BO');

  return (
    <div className="page">
      <header className="page-header">
        <div className="page-header-left">
          <div className="page-subtitle">№ 03 · {today.toUpperCase()}</div>
          <h1 className="page-title">
            {saludo}, <em>{user.username}</em>.
          </h1>
        </div>
      </header>

      <section className="stats-grid">
        <StatCard
          label="Productos activos"
          num={data.totales.productosActivos}
          meta="En catálogo"
        />
        <StatCard
          label="Valor inventario"
          num={data.totales.valorInventario}
          accent
          currency="Bs"
          meta="Bolivianos (productos)"
        />
        <StatCard
          label="Materia prima"
          num={data.totales.materiales || 0}
          meta="Insumos catalogados"
        />
        <StatCard
          label="Proveedores"
          num={data.totales.proveedores || 0}
          meta="Cadena de suministro"
        />
      </section>

      <section className="stats-grid">
        <StatCard
          label="Stock total"
          num={data.totales.stockTotal}
          suffix="pares"
          meta="Disponibles"
        />
        <StatCard
          label="Valor materia prima"
          num={data.totales.valorMatPrima || 0}
          accent
          currency="Bs"
          meta="Bolivianos (insumos)"
        />
        <StatCard
          label="Bajo stock"
          num={data.bajoStock.length}
          meta="≤ 5 unidades"
        />
        <StatCard
          label="Registros log"
          num={data.totales.registrosLog}
          meta="Accesos totales"
        />
      </section>

      <section className="charts-grid">
        <article className="chart-card">
          <header className="chart-card-header">
            <h3 className="chart-card-title">Distribución por tipo</h3>
            <span className="chart-card-meta">Catálogo activo</span>
          </header>
          {data.porTipo.length === 0
            ? <p className="empty-state">Sin datos.</p>
            : <div className="chart-container"><Doughnut data={donutData} options={{ ...donutOptions, maintainAspectRatio: false }} /></div>}
        </article>

        <article className="chart-card">
          <header className="chart-card-header">
            <h3 className="chart-card-title">Stock por material</h3>
            <span className="chart-card-meta">Unidades</span>
          </header>
          {data.stockPorMaterial.length === 0
            ? <p className="empty-state">Sin datos.</p>
            : <div className="chart-container"><Bar data={barData} options={{ ...barOptions, maintainAspectRatio: false }} /></div>}
        </article>
      </section>

      {data.bajoStock.length > 0 && (
        <section style={{ marginTop: 'var(--s-7)' }}>
          <header className="chart-card-header" style={{ borderTop: 'var(--hairline)', paddingTop: 'var(--s-5)', borderBottom: 'none' }}>
            <h3 className="chart-card-title">Atención: bajo stock</h3>
            <span className="chart-card-meta">Top 10 productos a reponer</span>
          </header>
          <div className="table-card">
            <table className="table">
              <thead>
                <tr>
                  <th>№</th>
                  <th>Modelo</th>
                  <th>Tipo</th>
                  <th>Color</th>
                  <th>Talla</th>
                  <th className="text-right">Stock</th>
                </tr>
              </thead>
              <tbody>
                {data.bajoStock.map((p) => (
                  <tr key={p.id}>
                    <td className="col-id">{String(p.id).padStart(3, '0')}</td>
                    <td className="col-model">{p.model_name}</td>
                    <td><span className={`tag type-${p.type.toLowerCase()}`}>{p.type}</span></td>
                    <td className="col-meta">{p.color}</td>
                    <td className="col-meta">{p.size}</td>
                    <td className="col-price">
                      <span className={`stock-pill ${p.stock <= 2 ? 'danger' : 'low'}`}>{p.stock}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

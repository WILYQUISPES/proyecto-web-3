import { useEffect, useState } from 'react';
import client from '../api/client';

const EVENTS = ['', 'LOGIN', 'LOGOUT', 'LOGIN_FAIL', 'LOGIN_FAIL_CAPTCHA'];

export default function Logs() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [limit, setLimit] = useState(200);

  async function load() {
    setLoading(true);
    try {
      const params = { limit };
      if (filter) params.event = filter;
      const r = await client.get('/logs', { params });
      setItems(r.data);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [filter, limit]);

  return (
    <div className="page">
      <header className="page-header">
        <div className="page-header-left">
          <div className="page-subtitle">№ 06 · Registro de accesos</div>
          <h1 className="page-title">
            Bitácora <em>de actividad</em>.
          </h1>
        </div>
      </header>

      <div className="toolbar">
        <label className="field-label" style={{ margin: 0, alignSelf: 'center' }}>Evento</label>
        <select className="input input-boxed" style={{ width: 'auto', minWidth: 160 }} value={filter} onChange={(e) => setFilter(e.target.value)}>
          {EVENTS.map((e) => <option key={e} value={e}>{e || 'Todos'}</option>)}
        </select>
        <label className="field-label" style={{ margin: 0, alignSelf: 'center' }}>Mostrar</label>
        <select className="input input-boxed" style={{ width: 'auto', minWidth: 100 }} value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
          <option value="50">50</option>
          <option value="200">200</option>
          <option value="500">500</option>
          <option value="1000">1000</option>
        </select>
      </div>

      {loading ? <p className="muted">Cargando…</p> : (
        <div className="table-card">
          <table className="table">
            <thead>
              <tr>
                <th>№</th><th>Fecha · Hora</th><th>Usuario</th>
                <th>Evento</th><th>IP</th><th>Navegador</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && <tr><td colSpan="6"><p className="empty-state">Sin registros.</p></td></tr>}
              {items.map((l) => (
                <tr key={l.id}>
                  <td className="col-id" data-label="№">{String(l.id).padStart(4, '0')}</td>
                  <td className="col-meta" data-label="Fecha">{l.created_at}</td>
                  <td className="col-model" data-label="Usuario" style={{ fontSize: 15 }}>{l.username || '—'}</td>
                  <td data-label="Evento"><span className={`tag-event ${l.event}`}>{l.event}</span></td>
                  <td className="col-meta" data-label="IP">{l.ip}</td>
                  <td className="ua" data-label="Navegador">{l.browser}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { RotateCw } from 'lucide-react';
import client from '../api/client';

export default function Captcha({ onChange }) {
  const [svg, setSvg] = useState('');
  const [token, setToken] = useState('');
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    setValue('');
    try {
      const r = await client.get('/auth/captcha');
      setSvg(r.data.svg);
      setToken(r.data.token);
      onChange?.({ token: r.data.token, value: '' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function handleChange(e) {
    setValue(e.target.value);
    onChange?.({ token, value: e.target.value });
  }

  return (
    <div className="captcha field">
      <label className="field-label">Verificación</label>
      <div className="captcha-row">
        <div
          className="captcha-svg"
          dangerouslySetInnerHTML={{ __html: svg }}
          aria-label="captcha"
        />
        <button type="button" className="captcha-refresh" onClick={load} disabled={loading} title="Refrescar">
          <RotateCw size={14} strokeWidth={1.5} />
        </button>
      </div>
      <input
        type="text"
        className="input"
        placeholder="Escribí los caracteres"
        value={value}
        onChange={handleChange}
        autoComplete="off"
        required
      />
    </div>
  );
}

export function getStrength(pwd) {
  if (!pwd) return { score: 0, level: 'vacio', label: '—' };
  let score = 0;
  if (pwd.length >= 8) score++;
  if (pwd.length >= 12) score++;
  if (/[a-z]/.test(pwd)) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;

  let level = 'debil';
  let label = 'Débil';
  if (score >= 5) { level = 'fuerte'; label = 'Fuerte'; }
  else if (score >= 3) { level = 'intermedio'; label = 'Intermedio'; }
  return { score, level, label };
}

export default function PasswordStrength({ password }) {
  const { score, level, label } = getStrength(password);
  const pct = Math.min(100, (score / 6) * 100);
  return (
    <div className="strength">
      <div className="strength-bar">
        <div className={`strength-fill ${level}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="strength-label">
        <span>Fortaleza</span>
        <span className={`strength-text ${level}`}>{label}</span>
      </div>
      <ul className="strength-tips">
        <li className={password?.length >= 8 ? 'ok' : ''}>8+ caracteres</li>
        <li className={/[A-Z]/.test(password) ? 'ok' : ''}>Mayúscula</li>
        <li className={/[a-z]/.test(password) ? 'ok' : ''}>Minúscula</li>
        <li className={/[0-9]/.test(password) ? 'ok' : ''}>Número</li>
        <li className={/[^A-Za-z0-9]/.test(password) ? 'ok' : ''}>Símbolo</li>
      </ul>
    </div>
  );
}

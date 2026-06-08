import { NavLink, useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function onLogout() {
    await logout();
    navigate('/login');
  }

  if (!user) return null;

  return (
    <nav className="navbar">
      <div className="brand-block">
        <NavLink to="/dashboard" className="brand">PasoFirme</NavLink>
        <span className="brand-meta">EST · 1987</span>
      </div>

      <div className="nav-links">
        <NavLink to="/dashboard">Resumen</NavLink>
        <NavLink to="/productos">Catálogo</NavLink>
        <NavLink to="/materias-primas">M. prima</NavLink>
        <NavLink to="/proveedores">Proveedores</NavLink>
        <NavLink to="/caja">Caja</NavLink>
        {user.role === 'admin' && <NavLink to="/finanzas">Finanzas</NavLink>}
        <NavLink to="/reporte">Reporte</NavLink>
        {user.role === 'admin' && (
          <>
            <NavLink to="/usuarios">Usuarios</NavLink>
            <NavLink to="/logs">Registro</NavLink>
          </>
        )}
      </div>

      <div className="nav-right">
        <span className="nav-user">
          <b>{user.username}</b>
          <span className={`role-chip ${user.role}`}>{user.role}</span>
        </span>
        <button className="captcha-refresh" onClick={onLogout} title="Cerrar sesión">
          <LogOut size={13} strokeWidth={1.5} />
          Salir
        </button>
      </div>
    </nav>
  );
}

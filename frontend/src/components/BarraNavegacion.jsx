import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Package, Layers, Truck, ShoppingCart,
  TrendingUp, FileText, Users, ScrollText, LogOut,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function BarraNavegacion() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function onLogout() {
    await logout();
    navigate('/login');
  }

  if (!user) return null;
  const isAdmin = user.role === 'admin';
  const ic = { size: 16, strokeWidth: 1.5 };

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <NavLink to="/dashboard" className="brand">PasoFirme</NavLink>
        <span className="brand-meta">EST · 1987</span>
      </div>

      <nav className="sidebar-nav">
        <span className="sidebar-label">Operación</span>
        <NavLink to="/dashboard"><LayoutDashboard {...ic} /><span>Resumen</span></NavLink>
        <NavLink to="/productos"><Package {...ic} /><span>Catálogo</span></NavLink>
        <NavLink to="/materias-primas"><Layers {...ic} /><span>M. prima</span></NavLink>
        <NavLink to="/proveedores"><Truck {...ic} /><span>Proveedores</span></NavLink>
        <NavLink to="/caja"><ShoppingCart {...ic} /><span>Caja</span></NavLink>
        <NavLink to="/reporte"><FileText {...ic} /><span>Reporte</span></NavLink>

        {isAdmin && (
          <>
            <span className="sidebar-label">Administración</span>
            <NavLink to="/finanzas"><TrendingUp {...ic} /><span>Finanzas</span></NavLink>
            <NavLink to="/usuarios"><Users {...ic} /><span>Usuarios</span></NavLink>
            <NavLink to="/logs"><ScrollText {...ic} /><span>Registro</span></NavLink>
          </>
        )}
      </nav>

      <div className="sidebar-foot">
        <div className="sidebar-user">
          <span className="avatar">{user.username.charAt(0).toUpperCase()}</span>
          <span className="sidebar-user-meta">
            <b>{user.username}</b>
            <span className={`role-chip ${user.role}`}>{user.role}</span>
          </span>
        </div>
        <button className="sidebar-logout" onClick={onLogout} title="Cerrar sesión">
          <LogOut size={13} strokeWidth={1.5} /> Cerrar sesión
        </button>
      </div>
    </aside>
  );
}

import { Routes, Route, Navigate } from 'react-router-dom';
import BarraNavegacion from './components/BarraNavegacion';
import RutaProtegida from './components/RutaProtegida';
import Ingreso from './pages/Ingreso';
import Panel from './pages/Panel';
import Productos from './pages/Productos';
import Proveedores from './pages/Proveedores';
import Materiales from './pages/Materiales';
import Ventas from './pages/Ventas';
import Finanzas from './pages/Finanzas';
import Usuarios from './pages/Usuarios';
import Bitacora from './pages/Bitacora';
import Reporte from './pages/Reporte';

export default function App() {
  return (
    <div className="shell">
      <BarraNavegacion />
      <div className="shell-main">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<Ingreso />} />
          <Route path="/dashboard" element={<RutaProtegida><Panel /></RutaProtegida>} />
          <Route path="/productos" element={<RutaProtegida><Productos /></RutaProtegida>} />
          <Route path="/materias-primas" element={<RutaProtegida><Materiales /></RutaProtegida>} />
          <Route path="/proveedores" element={<RutaProtegida><Proveedores /></RutaProtegida>} />
          <Route path="/caja" element={<RutaProtegida><Ventas /></RutaProtegida>} />
          <Route path="/finanzas" element={<RutaProtegida role="admin"><Finanzas /></RutaProtegida>} />
          <Route path="/reporte" element={<RutaProtegida><Reporte /></RutaProtegida>} />
          <Route path="/usuarios" element={<RutaProtegida role="admin"><Usuarios /></RutaProtegida>} />
          <Route path="/logs" element={<RutaProtegida role="admin"><Bitacora /></RutaProtegida>} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </div>
    </div>
  );
}

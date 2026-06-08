import { Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Suppliers from './pages/Suppliers';
import Materials from './pages/Materials';
import Sales from './pages/Sales';
import Finance from './pages/Finance';
import Users from './pages/Users';
import Logs from './pages/Logs';
import Report from './pages/Report';

export default function App() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/productos" element={<ProtectedRoute><Products /></ProtectedRoute>} />
        <Route path="/materias-primas" element={<ProtectedRoute><Materials /></ProtectedRoute>} />
        <Route path="/proveedores" element={<ProtectedRoute><Suppliers /></ProtectedRoute>} />
        <Route path="/caja" element={<ProtectedRoute><Sales /></ProtectedRoute>} />
        <Route path="/finanzas" element={<ProtectedRoute role="admin"><Finance /></ProtectedRoute>} />
        <Route path="/reporte" element={<ProtectedRoute><Report /></ProtectedRoute>} />
        <Route path="/usuarios" element={<ProtectedRoute role="admin"><Users /></ProtectedRoute>} />
        <Route path="/logs" element={<ProtectedRoute role="admin"><Logs /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </>
  );
}

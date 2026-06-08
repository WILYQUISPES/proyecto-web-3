import { createContext, useContext, useEffect, useState } from 'react';
import client from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('pc_user')); }
    catch { return null; }
  });
  const [loading, setLoading] = useState(false);

  function login(token, userData) {
    localStorage.setItem('pc_token', token);
    localStorage.setItem('pc_user', JSON.stringify(userData));
    setUser(userData);
  }

  async function logout() {
    try { await client.post('/auth/logout'); } catch (_) {}
    localStorage.removeItem('pc_token');
    localStorage.removeItem('pc_user');
    setUser(null);
  }

  useEffect(() => {
    const token = localStorage.getItem('pc_token');
    if (!token || !user) return;
    setLoading(true);
    client.get('/auth/me')
      .then((r) => {
        localStorage.setItem('pc_user', JSON.stringify(r.data));
        setUser(r.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

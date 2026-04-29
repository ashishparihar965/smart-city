import { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('smartcity_token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      if (token) {
        try {
          const res = await authAPI.getMe();
          setUser(res.data.data);
        } catch {
          logout();
        }
      }
      setLoading(false);
    };
    init();
  }, [token]);

  const login = async (email, password) => {
    const res = await authAPI.login({ email, password });
    const { user: userData, token: newToken } = res.data.data;
    localStorage.setItem('smartcity_token', newToken);
    localStorage.setItem('smartcity_user', JSON.stringify(userData));
    setToken(newToken);
    setUser(userData);
    return userData;
  };

  const register = async (name, email, password) => {
    const res = await authAPI.register({ name, email, password });
    const { user: userData, token: newToken } = res.data.data;
    localStorage.setItem('smartcity_token', newToken);
    localStorage.setItem('smartcity_user', JSON.stringify(userData));
    setToken(newToken);
    setUser(userData);
    return userData;
  };

  const logout = () => {
    localStorage.removeItem('smartcity_token');
    localStorage.removeItem('smartcity_user');
    setToken(null);
    setUser(null);
  };

  const isAdmin = user?.role === 'admin';
  const isOperator = user?.role === 'operator';
  const isUser = user?.role === 'user';

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, isAdmin, isOperator, isUser }}>
      {children}
    </AuthContext.Provider>
  );
};

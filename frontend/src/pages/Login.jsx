import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Zap, Mail, Lock, ArrowRight, AlertCircle, User, UserPlus } from 'lucide-react';
import './Login.css';

const Login = () => {
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [errorDetails, setErrorDetails] = useState([]);
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setErrorDetails([]);
    setLoading(true);
    try {
      if (isRegister) {
        await register(name, email, password);
      } else {
        await login(email, password);
      }
      navigate('/');
    } catch (err) {
      const apiBase = import.meta.env.VITE_BACKEND_URI || import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      const networkMessage = `Backend unreachable (${apiBase}). Check VITE_BACKEND_URI and backend CORS_ORIGINS.`;
      const message = err.response?.data?.message || (!err.response ? networkMessage : (isRegister ? 'Registration failed.' : 'Login failed.'));
      const fieldErrors = err.response?.data?.fieldErrors || {};
      const details = Object.values(fieldErrors);

      if (!err.response) {
        details.push(`Network: ${err.message}`);
      }

      console.error('[AUTH][UI_LOGIN_ERROR]', {
        mode: isRegister ? 'register' : 'login',
        status: err.response?.status,
        apiBase,
        message,
        fieldErrors,
      });

      setError(message);
      setErrorDetails(details);
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setIsRegister(!isRegister);
    setError('');
    setErrorDetails([]);
    if (!isRegister) {
      setEmail('');
      setPassword('');
      setName('');
    } else {
      setEmail('');
      setPassword('');
    }
  };

  return (
    <div className="login-page">
      <div className="login-bg-effects">
        <div className="bg-orb bg-orb-1" />
        <div className="bg-orb bg-orb-2" />
        <div className="bg-orb bg-orb-3" />
        <div className="grid-overlay" />
      </div>

      <div className="login-card animate-fade-in">
        <div className="login-brand">
          <div className="brand-icon">
            <Zap size={28} />
          </div>
          <h1>SmartCity</h1>
          <p>Command & Control Platform</p>
        </div>

        {/* Toggle tabs */}
        <div className="auth-tabs">
          <button className={`auth-tab ${!isRegister ? 'active' : ''}`} onClick={() => switchMode()}>
            <ArrowRight size={14} /> Sign In
          </button>
          <button className={`auth-tab ${isRegister ? 'active' : ''}`} onClick={() => switchMode()}>
            <UserPlus size={14} /> Register
          </button>
        </div>

        {error && (
          <div className="login-error">
            <AlertCircle size={16} />
            <div>
              <span>{error}</span>
              {errorDetails.length > 0 && (
                <ul style={{ margin: '0.35rem 0 0 1rem', padding: 0 }}>
                  {errorDetails.map((detail, index) => (
                    <li key={index} style={{ fontSize: '0.8rem', lineHeight: 1.35 }}>{detail}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          {isRegister && (
            <div className="form-field">
              <label>Full Name</label>
              <div className="field-input">
                <User size={16} />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your full name"
                  required
                />
              </div>
            </div>
          )}

          <div className="form-field">
            <label>Email Address</label>
            <div className="field-input">
              <Mail size={16} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
              />
            </div>
          </div>

          <div className="form-field">
            <label>Password</label>
            <div className="field-input">
              <Lock size={16} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                minLength={6}
              />
            </div>
          </div>

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? (
              <span className="spinner" style={{ width: 18, height: 18 }} />
            ) : (
              <>
                <span>{isRegister ? 'Create Account' : 'Sign In'}</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        {isRegister && (
          <div className="register-note">
            <p>Registering as a <strong>Citizen</strong> allows you to file and track complaints.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Login;

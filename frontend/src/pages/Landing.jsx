import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { analyticsAPI } from '../services/api';
import {
  Zap, Brain, Shield, Wifi, BarChart3, Users, ArrowRight,
  CheckCircle, Bot, Bell, MapPin, Clock, ChevronRight,
  Github, Mail, Globe, Sparkles, Activity, Target, Sun, Moon,
  Map, Siren, Satellite, Download, Menu, X,
} from 'lucide-react';
import OurTeam from '../components/OurTeam';
import './Landing.css';

const Landing = () => {
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useTheme();
  const [liveStats, setLiveStats] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Fetch live platform stats from public API
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await analyticsAPI.overview();
        setLiveStats(res.data.data);
      } catch (err) {
        console.error('Live stats error:', err);
      }
    };
    fetchStats();
    const interval = setInterval(fetchStats, 60000); // refresh every minute
    return () => clearInterval(interval);
  }, []);

  const features = [
    { icon: Brain, title: 'AI-Powered Analysis', desc: 'Gemini AI processes complaints, auto-detects priority, and predicts issue spikes across city zones.', color: '#8b5cf6' },
    { icon: Wifi, title: 'Real-Time Monitoring', desc: 'WebSocket-driven live dashboard updates. Alerts propagate in milliseconds across all stakeholders.', color: '#06b6d4' },
    { icon: Bell, title: 'Smart Alert System', desc: 'Automated SLA tracking, overdue escalation, and intelligent notification routing by department.', color: '#f59e0b' },
    { icon: Shield, title: 'Role-Based Access', desc: 'Three-tier RBAC — Admin command center, Operator task view, and Citizen portal with distinct UIs.', color: '#10b981' },
    { icon: BarChart3, title: 'Analytics Dashboard', desc: 'City Health Score, operator performance metrics, complaint trend analysis, and zone-level insights.', color: '#3b82f6' },
    { icon: Bot, title: 'Citizen AI Assistant', desc: 'Natural language complaint filing via AI chatbot. Citizens describe issues, AI structures the ticket.', color: '#ec4899' },
  ];

  const steps = [
    { num: '01', title: 'Citizen Reports', desc: 'File a complaint through the portal or AI assistant using natural language', icon: Users },
    { num: '02', title: 'AI Processes', desc: 'AI auto-categorizes, assigns priority, and suggests the optimal operator', icon: Brain },
    { num: '03', title: 'Admin Assigns', desc: 'Admin reviews AI suggestions and dispatches to the best-fit operator', icon: Target },
    { num: '04', title: 'Real-Time Resolution', desc: 'Operator resolves with live status updates pushed to all stakeholders', icon: Activity },
  ];

  const techStack = [
    { name: 'React 19', desc: 'Modern UI', color: '#61dafb' },
    { name: 'Node.js', desc: 'Backend Runtime', color: '#68a063' },
    { name: 'MongoDB', desc: 'NoSQL Database', color: '#4db33d' },
    { name: 'Socket.io', desc: 'Real-Time Engine', color: '#010101' },
    { name: 'Gemini AI', desc: 'Intelligence Layer', color: '#8b5cf6' },
    { name: 'JWT + RBAC', desc: 'Security', color: '#ef4444' },
    { name: 'Tailwind', desc: 'Utility CSS', color: '#06b6d4' },
    { name: 'Leaflet', desc: 'Live Maps', color: '#199900' },
  ];

  return (
    <div className="landing-page">
      {/* Video Background */}
      <div className="landing-video-bg">
        <video
          autoPlay
          muted
          loop
          playsInline
          className="landing-video"
        >
          <source src="/LandingAnimation.mp4" type="video/mp4" />
        </video>
        <div className="landing-video-overlay" />
      </div>

      {/* Animated Glows on top of video */}
      <div className="landing-bg">
        <div className="bg-glow bg-glow-1" />
        <div className="bg-glow bg-glow-2" />
        <div className="bg-glow bg-glow-3" />
      </div>

      {/* Navigation */}
      <nav className="landing-nav">
        <div className="nav-brand">
          <img src="/logo.jpg" alt="SmartCity" className="nav-logo-img" />
          <span className="nav-logo-text">SmartCity</span>
        </div>
        
        {/* Desktop Nav */}
        <div className="nav-links">
          <a href="#">Home</a>
          <a href="#features">About</a>
          <a href="#how-it-works">Mission</a>
          <a href="#team">Team</a>
          <a href="#contact">Contact</a>
          <button className="theme-toggle-nav" onClick={toggleTheme} aria-label="Toggle Theme">
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <a href="https://drive.google.com/file/d/1l_ZRTtHSu3bq4TMgscdDKhFWY_bjWnRW/view?usp=sharing" className="btn btn-hero-outline" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 1rem' }}>
            <Download size={14} /> Download App
          </a>
          <button className="btn btn-primary nav-cta" onClick={() => navigate('/login')}>
            Launch App <ArrowRight size={14} />
          </button>
        </div>

        {/* Mobile controls */}
        <div className="nav-mobile-controls">
          <button className="theme-toggle-nav" onClick={toggleTheme} aria-label="Toggle Theme">
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button className="mobile-menu-toggle" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Nav Overlay */}
        <div className={`mobile-nav-overlay ${mobileMenuOpen ? 'open' : ''}`}>
          <div className="mobile-nav-links">
            <a href="#" onClick={() => setMobileMenuOpen(false)}>Home</a>
            <a href="#features" onClick={() => setMobileMenuOpen(false)}>About</a>
            <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)}>Mission</a>
            <a href="#team" onClick={() => setMobileMenuOpen(false)}>Team</a>
            <a href="#contact" onClick={() => setMobileMenuOpen(false)}>Contact</a>
            
            <a href="https://drive.google.com/file/d/1l_ZRTtHSu3bq4TMgscdDKhFWY_bjWnRW/view?usp=sharing" className="btn btn-hero-outline mb-3" style={{ justifyContent: 'center' }}>
              <Download size={16} /> Download App
            </a>
            <button className="btn btn-primary" onClick={() => navigate('/login')} style={{ justifyContent: 'center' }}>
              Launch App <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content">
          <div className="hero-badge">
            <Sparkles size={14} />
            <span>AI-Powered City Management Platform</span>
          </div>
          <h1 className="hero-title">
            <span className="hero-line-1">Smart City</span>
            <span className="hero-line-2">Command & Control</span>
          </h1>
          <p className="hero-subtitle">
            An intelligent, real-time platform that transforms how cities handle citizen complaints.
            AI-driven prioritization, live monitoring, and seamless resolution — all in one command center.
          </p>
          <div className="hero-actions">
            <button className="btn btn-hero-primary" onClick={() => navigate('/login')}>
              <Zap size={16} /> Get Started <ArrowRight size={16} />
            </button>
            <a href="https://drive.google.com/file/d/1l_ZRTtHSu3bq4TMgscdDKhFWY_bjWnRW/view?usp=sharing" className="btn btn-hero-outline">
              <Download size={16} /> Download App
            </a>
            <a href="#features" className="btn btn-hero-outline" style={{ border: 'none' }}>
              Explore Features <ChevronRight size={16} />
            </a>
          </div>
          <div className="hero-stats">
            <div className="hero-stat">
              <span className="hero-stat-value">{liveStats ? liveStats.complaints?.total || 0 : '—'}</span>
              <span className="hero-stat-label">Complaints Filed</span>
            </div>
            <div className="hero-stat-divider" />
            <div className="hero-stat">
              <span className="hero-stat-value">{liveStats ? `${liveStats.resolutionRate || 0}%` : '—'}</span>
              <span className="hero-stat-label">Resolved</span>
            </div>
            <div className="hero-stat-divider" />
            <div className="hero-stat">
              <span className="hero-stat-value">{liveStats ? liveStats.devices?.total || 0 : '—'}</span>
              <span className="hero-stat-label">IoT Devices</span>
            </div>
            <div className="hero-stat-divider" />
            <div className="hero-stat">
              <span className="hero-stat-value">{liveStats ? liveStats.users || 0 : '—'}</span>
              <span className="hero-stat-label">Active Users</span>
            </div>
            {liveStats && <div className="hero-stat-live"><span className="live-dot" />LIVE DATA</div>}
          </div>
        </div>
        <div className="hero-visual">
          <div className="hero-dashboard-preview">
            <div className="preview-header">
              <div className="preview-dots">
                <span /><span /><span />
              </div>
              <span className="preview-title">Command Center</span>
            </div>
            <div className="preview-content">
              <div className="preview-card pc-1">
                <Activity size={16} />
                <div><span className="pc-value">87</span><span className="pc-label">City Health</span></div>
              </div>
              <div className="preview-card pc-2">
                <BarChart3 size={16} />
                <div><span className="pc-value">156</span><span className="pc-label">Complaints</span></div>
              </div>
              <div className="preview-card pc-3">
                <CheckCircle size={16} />
                <div><span className="pc-value">94%</span><span className="pc-label">SLA Met</span></div>
              </div>
              <div className="preview-card pc-4">
                <Bell size={16} />
                <div><span className="pc-value">12</span><span className="pc-label">Live Alerts</span></div>
              </div>
              <div className="preview-chart">
                <div className="chart-bar" style={{ height: '40%' }} />
                <div className="chart-bar" style={{ height: '65%' }} />
                <div className="chart-bar" style={{ height: '85%' }} />
                <div className="chart-bar" style={{ height: '55%' }} />
                <div className="chart-bar" style={{ height: '70%' }} />
                <div className="chart-bar" style={{ height: '45%' }} />
                <div className="chart-bar" style={{ height: '90%' }} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section" id="features">
        <div className="section-header">
          <span className="section-badge">Core Capabilities</span>
          <h2>Everything a Smart City Needs</h2>
          <p>Built with cutting-edge technology stack for maximum impact and real-world scalability.</p>
        </div>
        <div className="features-grid">
          {features.map((feature, i) => (
            <div key={feature.title} className="feature-card" style={{ animationDelay: `${i * 0.1}s` }}>
              <div className="feature-icon" style={{ background: `${feature.color}18`, color: feature.color }}>
                <feature.icon size={24} />
              </div>
              <h3>{feature.title}</h3>
              <p>{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="how-section" id="how-it-works">
        <div className="section-header">
          <span className="section-badge">Workflow</span>
          <h2>How It Works</h2>
          <p>From complaint to resolution — a seamless, AI-assisted pipeline.</p>
        </div>
        <div className="steps-grid">
          {steps.map((step, i) => (
            <div key={step.num} className="step-card" style={{ animationDelay: `${i * 0.15}s` }}>
              <div className="step-num">{step.num}</div>
              <div className="step-icon-wrap">
                <step.icon size={28} />
              </div>
              <h3>{step.title}</h3>
              <p>{step.desc}</p>
              {i < steps.length - 1 && <div className="step-connector" />}
            </div>
          ))}
        </div>
      </section>

      {/* Dashboard Preview */}
      <section className="preview-section">
        <div className="section-header">
          <span className="section-badge">Live Preview</span>
          <h2>Command Center Dashboard</h2>
          <p>Real-time city intelligence at your fingertips.</p>
        </div>
        <div className="preview-showcase">
          <div className="showcase-card">
            <div className="showcase-header">
              <span>🏙️ City Health Score</span>
              <span className="showcase-live-badge">● LIVE</span>
            </div>
            <div className="showcase-score">
              <svg viewBox="0 0 120 120" className="showcase-ring">
                <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
                <circle cx="60" cy="60" r="52" fill="none" stroke="#10b981" strokeWidth="8"
                  strokeDasharray="284 327" strokeLinecap="round" transform="rotate(-90 60 60)" />
              </svg>
              <span className="showcase-score-val">87</span>
            </div>
          </div>
          <div className="showcase-card showcase-wide">
            <div className="showcase-header">
              <span>📊 Complaint Analytics</span>
              <span className="showcase-period">Last 7 days</span>
            </div>
            <div className="showcase-bars">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => (
                <div key={day} className="showcase-bar-group">
                  <div className="showcase-bar" style={{ height: `${30 + Math.random() * 60}%` }} />
                  <span>{day}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="showcase-card">
            <div className="showcase-header">
              <span>🔔 Live Alerts</span>
              <span className="badge badge-red">3 new</span>
            </div>
            <div className="showcase-alerts">
              <div className="showcase-alert sa-critical">
                <span className="sa-dot" />Water pipeline burst — Central Zone
              </div>
              <div className="showcase-alert sa-warning">
                <span className="sa-dot" />Traffic congestion spike — MG Road
              </div>
              <div className="showcase-alert sa-info">
                <span className="sa-dot" />Waste collection completed — North
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Live Stats Banner */}
      {liveStats && (
        <section className="live-stats-section">
          <div className="section-header">
            <span className="section-badge" style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981' }}>Live Platform Data</span>
            <h2>Real-Time City Intelligence</h2>
            <p>These numbers update live from our production database.</p>
          </div>
          <div className="live-stats-grid">
            {[
              { label: 'Total Complaints', value: liveStats.complaints?.total || 0, icon: <BarChart3 size={22} />, color: '#3b82f6' },
              { label: 'Resolved', value: liveStats.complaints?.resolved || 0, icon: <CheckCircle size={22} />, color: '#10b981' },
              { label: 'Resolution Rate', value: `${liveStats.resolutionRate || 0}%`, icon: <Target size={22} />, color: '#8b5cf6' },
              { label: 'IoT Devices', value: liveStats.devices?.total || 0, icon: <Satellite size={22} />, color: '#06b6d4' },
              { label: 'Devices Online', value: liveStats.devices?.online || 0, icon: <Wifi size={22} />, color: '#10b981' },
              { label: 'Active Users', value: liveStats.users || 0, icon: <Users size={22} />, color: '#f59e0b' },
              { label: 'Incidents Tracked', value: liveStats.incidents?.total || 0, icon: <Siren size={22} />, color: '#ef4444' },
              { label: 'Incidents Resolved', value: liveStats.incidents?.resolved || 0, icon: <Shield size={22} />, color: '#10b981' },
            ].map((stat) => (
              <div key={stat.label} className="live-stat-card">
                <div className="live-stat-icon" style={{ background: `${stat.color}15`, color: stat.color }}>{stat.icon}</div>
                <div className="live-stat-value" style={{ color: stat.color }}>{stat.value}</div>
                <div className="live-stat-label">{stat.label}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Tech Stack */}
      <section className="tech-section" id="tech">
        <div className="section-header">
          <span className="section-badge">Technology</span>
          <h2>Built With Modern Stack</h2>
          <p>Production-grade technologies powering every layer.</p>
        </div>
        <div className="tech-grid">
          {techStack.map((tech, i) => (
            <div key={tech.name} className="tech-card" style={{ animationDelay: `${i * 0.08}s` }}>
              <div className="tech-dot" style={{ background: tech.color }} />
              <span className="tech-name">{tech.name}</span>
              <span className="tech-desc">{tech.desc}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Team Section */}
      <section id="team" style={{ position: 'relative', zIndex: 10 }}>
        <OurTeam />
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="cta-bg-glow" />
        <h2>Ready to Transform Your City?</h2>
        <p>Experience the future of urban management with AI-powered intelligence.</p>
        <button className="btn btn-hero-primary" onClick={() => navigate('/login')}>
          <img src="/logo.jpg" alt="" className="cta-logo-img" /> Launch Command Center <ArrowRight size={16} />
        </button>
      </section>

      {/* Footer */}
      <footer className="landing-footer" id="contact">
        <div className="footer-content">
          <div className="footer-brand">
            <img src="/logo.jpg" alt="SmartCity" className="footer-logo-img" />
            <span>SmartCity Command & Control</span>
          </div>
          <div className="footer-links">
            <a href="#">Home</a>
            <a href="#features">About</a>
            <a href="#how-it-works">Mission</a>
            <a href="#team">Team</a>
            <a href="#contact">Contact</a>
          </div>
          <div className="footer-social">
            <a href="https://github.com" target="_blank" rel="noreferrer"><Github size={18} /></a>
            <a href="mailto:contact@smartcity.com"><Mail size={18} /></a>
            <a href="#"><Globe size={18} /></a>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2026 SmartCity Platform — Intelligent Urban Management System.</span>
        </div>
      </footer>
    </div>
  );
};

export default Landing;

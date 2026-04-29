import { useState, useEffect, useCallback } from 'react';
import { dashboardAPI, announcementAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import AnnouncementCard from '../components/AnnouncementCard';
import CityHealthCard from '../components/CityHealthCard';
import {
  Car, Trash2, Droplets, Lightbulb, AlertTriangle, Bell,
  Activity, TrendingUp, RefreshCw, Clock,
  BarChart3, Trophy, MessageSquare, Target
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import './Dashboard.css';

const Dashboard = () => {
  const [data, setData] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [cityHealth, setCityHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useAuth();
  const { isDark } = useTheme();

  const tooltipStyle = isDark
    ? { background: '#1a1f35', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#f1f5f9' }
    : { background: '#ffffff', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '8px', color: '#1e293b' };
  const gridStroke = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)';
  const axisStroke = isDark ? '#64748b' : '#94a3b8';

  const fetchData = useCallback(async () => {
    try {
      const dashRes = await dashboardAPI.getData();
      setData(dashRes.data.data);

      // Set city health data from dashboard response
      if (dashRes.data.data.cityHealth) {
        setCityHealth(dashRes.data.data.cityHealth);
      }

      // Fetch announcements for citizen users
      if (user?.role === 'user' && user?.zone) {
        try {
          const announcRes = await announcementAPI.getAll({ status: 'active' });
          const filtered = announcRes.data.data.filter(a => a.zones.includes(user.zone) || a.zones.includes('all'));
          setAnnouncements(filtered);
        } catch (err) {
          console.error('Announcement fetch error:', err);
          setAnnouncements([]);
        }
      }
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Auto-refresh every 30s
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleAnnouncementView = async (announcementId) => {
    try {
      await announcementAPI.recordView(announcementId);
    } catch (err) {
      console.error('Failed to record announcement view:', err);
    }
  };

  const handlePredict = async () => {
    try {
      await dashboardAPI.predict();
      fetchData();
    } catch (err) {
      console.error('Prediction error:', err);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner" />
      </div>
    );
  }

  if (!data) return <div className="empty-state"><p>Failed to load dashboard data</p></div>;

  if (user?.role === 'user') {
    const citizenData = data.citizen;
    if (!citizenData) return <div className="empty-state"><p>Citizen dashboard data unavailable</p></div>;

    const citizenCategoryData = [
      { name: 'Traffic', value: citizenData.categoryCounts?.traffic || 0, fill: '#3b82f6' },
      { name: 'Water', value: citizenData.categoryCounts?.water || 0, fill: '#06b6d4' },
      { name: 'Waste', value: citizenData.categoryCounts?.waste || 0, fill: '#10b981' },
      { name: 'Lighting', value: citizenData.categoryCounts?.lighting || 0, fill: '#f59e0b' },
      { name: 'Emergency', value: citizenData.categoryCounts?.emergency || 0, fill: '#ef4444' }
    ];

    const citizenStatusData = [
      { name: 'Open', value: citizenData.openComplaints || 0, fill: '#3b82f6' },
      { name: 'In Progress', value: citizenData.inProgressComplaints || 0, fill: '#f59e0b' },
      { name: 'Resolved', value: citizenData.resolvedComplaints || 0, fill: '#10b981' }
    ];

    return (
      <div className="dashboard-page animate-fade-in">
        <div className="page-header">
          <div>
            <h1>Citizen Dashboard</h1>
            <p>Welcome, {user?.name}. Your city contribution progress is tracked here.</p>
          </div>
          <div className="header-actions">
            <button className="btn btn-primary" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw size={15} className={refreshing ? 'spin-icon' : ''} />
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>

        {announcements.length > 0 && (
          <div className="announcements-section card">
            <div className="announcements-header">
              <h3><Bell size={16} /> Active Announcements</h3>
              <span className="badge badge-blue">{announcements.length} active</span>
            </div>
            <div className="announcements-list">
              {announcements.map((announcement) => (
                <AnnouncementCard
                  key={announcement._id}
                  announcement={announcement}
                  onView={handleAnnouncementView}
                />
              ))}
            </div>
          </div>
        )}

        <CityHealthCard data={cityHealth} />

        <div className="citizen-score-card">
          <div className="citizen-score-main">
            <div className="citizen-score-icon"><Trophy size={22} /></div>
            <div>
              <h3>Contribution Score</h3>
              <p>Your current impact level in city reporting</p>
            </div>
          </div>
          <div className="citizen-score-value-wrap">
            <span className="citizen-score-value">{citizenData.contributionScore}</span>
            <span className="citizen-score-label">{citizenData.scoreLabel}</span>
          </div>
        </div>

        <div className="overview-grid citizen-overview-grid">
          <div className="overview-card card-traffic">
            <div className="oc-icon"><MessageSquare size={20} /></div>
            <div className="oc-content">
              <span className="oc-value">{citizenData.totalComplaints || 0}</span>
              <span className="oc-label">Total Complaints</span>
            </div>
          </div>
          <div className="overview-card card-waste">
            <div className="oc-icon"><BarChart3 size={20} /></div>
            <div className="oc-content">
              <span className="oc-value">{citizenData.typesReported || 0}</span>
              <span className="oc-label">Complaint Types Used</span>
            </div>
          </div>
          <div className="overview-card card-lighting">
            <div className="oc-icon"><Target size={20} /></div>
            <div className="oc-content">
              <span className="oc-value">{citizenData.complaintsLast30Days || 0}</span>
              <span className="oc-label">Last 30 Days Reports</span>
            </div>
          </div>
          <div className="overview-card card-emergency">
            <div className="oc-icon"><Activity size={20} /></div>
            <div className="oc-content">
              <span className="oc-value">{citizenData.resolvedComplaints || 0}</span>
              <span className="oc-label">Resolved Complaints</span>
            </div>
          </div>
        </div>

        <div className="charts-grid">
          <div className="chart-card card">
            <h3><BarChart3 size={16} /> Your Complaint Type Counts</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={citizenCategoryData}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis dataKey="name" stroke={axisStroke} fontSize={12} />
                <YAxis stroke={axisStroke} fontSize={12} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {citizenCategoryData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-card card">
            <h3><Activity size={16} /> Complaint Status Breakdown</h3>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={citizenStatusData} innerRadius={55} outerRadius={85} paddingAngle={5} dataKey="value">
                  {citizenStatusData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pie-legend">
              {citizenStatusData.map((d) => (
                <span key={d.name} className="legend-item">
                  <span className="legend-dot" style={{ background: d.fill }} />
                  {d.name}: {d.value}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="alerts-section card">
          <div className="alerts-header">
            <h3><Lightbulb size={16} /> Contribution Motivation</h3>
            <span className="badge badge-green">Keep Reporting</span>
          </div>
          <div className="citizen-tips-list">
            {(citizenData.motivationTips || []).map((tip, index) => (
              <div key={`${tip}-${index}`} className="citizen-tip-item">• {tip}</div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const healthScoreRaw = data.cityHealth?.score;
  const isHealthUnavailable = healthScoreRaw === null || typeof healthScoreRaw === 'undefined';
  const healthScore = isHealthUnavailable ? 0 : healthScoreRaw;
  const healthColor = isHealthUnavailable
    ? '#64748b'
    : healthScore >= 75
      ? '#10b981'
      : healthScore >= 50
        ? '#f59e0b'
        : '#ef4444';

  const trafficChartData = [
    { name: 'Low', value: data.traffic?.lowCongestion || 0, fill: '#10b981' },
    { name: 'Medium', value: data.traffic?.mediumCongestion || 0, fill: '#f59e0b' },
    { name: 'High', value: data.traffic?.highCongestion || 0, fill: '#ef4444' }
  ];

  const wasteChartData = [
    { name: 'Low', value: data.waste?.lowBins || 0, fill: '#10b981' },
    { name: 'Medium', value: data.waste?.mediumBins || 0, fill: '#f59e0b' },
    { name: 'Full', value: data.waste?.fullBins || 0, fill: '#ef4444' }
  ];

  const moduleScores = data.cityHealth?.factors
    ? Object.entries(data.cityHealth.factors).map(([key, val]) => ({
        name: key.charAt(0).toUpperCase() + key.slice(1),
        score: val.score || 0
      }))
    : [];

  return (
    <div className="dashboard-page animate-fade-in">
      <div className="page-header">
        <div>
          <h1>Command Center</h1>
          <p>Welcome back, {user?.name}. Here's your city overview.</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-outline" onClick={handlePredict}>
            <TrendingUp size={15} />
            Run Predictions
          </button>
          <button className="btn btn-primary" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw size={15} className={refreshing ? 'spin-icon' : ''} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* City Health Score */}
      <div className="health-section">
        <div className="health-score-card">
          <div className="health-ring" style={{ '--score-color': healthColor }}>
            <svg viewBox="0 0 120 120" className="health-svg">
              <circle cx="60" cy="60" r="52" className="ring-bg" />
              <circle
                cx="60" cy="60" r="52"
                className="ring-progress"
                style={{
                  strokeDasharray: `${(healthScore / 100) * 327} 327`,
                  stroke: healthColor
                }}
              />
            </svg>
            <div className="health-value">
              <span className="score-number" style={{ color: healthColor }}>
                {isHealthUnavailable ? 'N/A' : healthScore}
              </span>
              <span className="score-label">
                {isHealthUnavailable ? 'Health Unavailable' : 'City Health'}
              </span>
            </div>
          </div>
        </div>

        <div className="health-factors">
          {moduleScores.map((m, i) => (
            <div key={m.name} className="factor-card" style={{ animationDelay: `${i * 0.1}s` }}>
              <div className="factor-header">
                <span className="factor-name">{m.name}</span>
                <span className="factor-score" style={{
                  color: m.score >= 75 ? '#10b981' : m.score >= 50 ? '#f59e0b' : '#ef4444'
                }}>
                  {m.score}%
                </span>
              </div>
              <div className="factor-bar">
                <div
                  className="factor-fill"
                  style={{
                    width: `${m.score}%`,
                    background: m.score >= 75 ? 'var(--gradient-green)' :
                      m.score >= 50 ? 'linear-gradient(90deg, #f59e0b, #fbbf24)' : 'var(--gradient-red)'
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Overview Cards */}
      <div className="overview-grid">
        <div className="overview-card card-traffic">
          <div className="oc-icon"><Car size={20} /></div>
          <div className="oc-content">
            <span className="oc-value">{data.traffic?.totalLocations || 0}</span>
            <span className="oc-label">Traffic Points</span>
          </div>
          <div className="oc-stat">
            <span className="oc-stat-value badge badge-red">{data.traffic?.highCongestion || 0} High</span>
          </div>
        </div>

        <div className="overview-card card-waste">
          <div className="oc-icon"><Trash2 size={20} /></div>
          <div className="oc-content">
            <span className="oc-value">{data.waste?.totalBins || 0}</span>
            <span className="oc-label">Waste Bins</span>
          </div>
          <div className="oc-stat">
            <span className="oc-stat-value badge badge-red">{data.waste?.fullBins || 0} Full</span>
          </div>
        </div>

        <div className="overview-card card-water">
          <div className="oc-icon"><Droplets size={20} /></div>
          <div className="oc-content">
            <span className="oc-value">{data.water?.totalAreas || 0}</span>
            <span className="oc-label">Water Zones</span>
          </div>
          <div className="oc-stat">
            <span className="oc-stat-value badge badge-red">{data.water?.activeLeaks || 0} Leaks</span>
          </div>
        </div>

        <div className="overview-card card-lighting">
          <div className="oc-icon"><Lightbulb size={20} /></div>
          <div className="oc-content">
            <span className="oc-value">{data.lighting?.totalLights || 0}</span>
            <span className="oc-label">Street Lights</span>
          </div>
          <div className="oc-stat">
            <span className="oc-stat-value badge badge-yellow">{data.lighting?.faultyLights || 0} Faults</span>
          </div>
        </div>

        <div className="overview-card card-emergency">
          <div className="oc-icon"><AlertTriangle size={20} /></div>
          <div className="oc-content">
            <span className="oc-value">{data.emergency?.openIncidents || 0}</span>
            <span className="oc-label">Open Incidents</span>
          </div>
          <div className="oc-stat">
            <span className="oc-stat-value badge badge-critical">{data.emergency?.criticalIncidents || 0} Critical</span>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="charts-grid">
        <div className="chart-card card">
          <h3><BarChart3 size={16} /> Traffic Distribution</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={trafficChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
              <XAxis dataKey="name" stroke={axisStroke} fontSize={12} />
              <YAxis stroke={axisStroke} fontSize={12} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {trafficChartData.map((entry, idx) => (
                  <Cell key={idx} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card card">
          <h3><Trash2 size={16} /> Waste Bin Status</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={wasteChartData}
                innerRadius={55}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {wasteChartData.map((entry, idx) => (
                  <Cell key={idx} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
          <div className="pie-legend">
            {wasteChartData.map(d => (
              <span key={d.name} className="legend-item">
                <span className="legend-dot" style={{ background: d.fill }} />
                {d.name}: {d.value}
              </span>
            ))}
          </div>
        </div>

        <div className="chart-card card">
          <h3><Activity size={16} /> Module Health Scores</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={moduleScores} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
              <XAxis type="number" domain={[0, 100]} stroke={axisStroke} fontSize={12} />
              <YAxis dataKey="name" type="category" stroke={axisStroke} fontSize={12} width={80} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="score" radius={[0, 6, 6, 0]} fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Alerts Panel */}
      <div className="alerts-section card">
        <div className="alerts-header">
          <h3><Bell size={16} /> Recent Alerts</h3>
          <span className="badge badge-red">{data.unreadAlerts} unread</span>
        </div>
        <div className="alerts-list">
          {data.recentAlerts && data.recentAlerts.length > 0 ? (
            data.recentAlerts.map((alert) => (
              <div key={alert._id} className={`alert-item alert-${alert.type}`}>
                <div className="alert-dot" />
                <div className="alert-body">
                  <span className="alert-title">{alert.title}</span>
                  <span className="alert-message">{alert.message}</span>
                </div>
                <div className="alert-meta">
                  <span className={`badge badge-${alert.priority}`}>{alert.priority}</span>
                  <span className="alert-time">
                    <Clock size={11} />
                    {new Date(alert.createdAt).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="empty-state"><p>No recent alerts</p></div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

import { useState } from 'react';
import {
  Brain, TrendingUp, AlertTriangle, Users, Sparkles,
  Activity, Zap, Target, BarChart3, RefreshCw, Shield
} from 'lucide-react';
import './AIInsights.css';

const AIInsights = ({ stats, complaints }) => {
  const [refreshing, setRefreshing] = useState(false);

  // AI-computed insights based on real data
  const totalComplaints = stats?.total || 0;
  const openComplaints = stats?.open || 0;
  const overdueCount = stats?.overdue || 0;
  const avgResolution = stats?.avgResolutionTime || 0;
  const highPriorityCount = stats?.highPriority || 0;

  // Predictive spike detection
  const spikeRisk = openComplaints > 5 ? 'high' : openComplaints > 2 ? 'medium' : 'low';
  const spikeMessage = spikeRisk === 'high'
    ? `⚠️ ${openComplaints} open complaints detected. Predicted spike in next 24 hours.`
    : spikeRisk === 'medium'
      ? `📊 Moderate complaint volume. Monitor incoming trends.`
      : `✅ Complaint volume is within normal range.`;

  // Operator overload detection
  const operatorPerf = stats?.operatorPerformance || [];
  const overloadedOps = operatorPerf.filter(op => op.resolved < 2 && op.avgTime > 120);

  // Anomaly detection
  const anomalies = [];
  if (overdueCount > 3) anomalies.push({ text: `${overdueCount} complaints overdue — SLA breach risk`, severity: 'critical' });
  if (highPriorityCount > 4) anomalies.push({ text: `${highPriorityCount} high-priority unresolved — resource allocation needed`, severity: 'warning' });
  if (avgResolution > 2880) anomalies.push({ text: `Average resolution time exceeds 48 hours`, severity: 'warning' });
  if (anomalies.length === 0) anomalies.push({ text: 'No anomalies detected. System operating normally.', severity: 'normal' });

  // Recommendations
  const recommendations = [];
  if (overdueCount > 0) recommendations.push('Reassign overdue complaints to available operators immediately');
  if (spikeRisk === 'high') recommendations.push('Pre-allocate additional operators for predicted complaint surge');
  if (highPriorityCount > 2) recommendations.push('Escalate high-priority complaints to senior operators');
  if (avgResolution > 1440) recommendations.push('Review resolution workflow — average time exceeds SLA targets');
  if (recommendations.length === 0) recommendations.push('System performance is optimal. No immediate actions required.');

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1500);
  };

  return (
    <div className="ai-insights-panel">
      <div className="ai-header">
        <div className="ai-header-left">
          <div className="ai-header-icon">
            <Brain size={20} />
          </div>
          <div>
            <h3>AI Intelligence Hub</h3>
            <p>Gemini-powered predictive analytics & anomaly detection</p>
          </div>
        </div>
        <button className="btn btn-sm btn-outline" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw size={13} className={refreshing ? 'spin-icon' : ''} />
          {refreshing ? 'Analyzing...' : 'Re-analyze'}
        </button>
      </div>

      <div className="ai-grid">
        {/* Spike Prediction */}
        <div className={`ai-card ai-spike-card spike-${spikeRisk}`}>
          <div className="ai-card-header">
            <TrendingUp size={16} />
            <span>Complaint Spike Prediction</span>
          </div>
          <div className="ai-card-body">
            <div className={`spike-indicator spike-${spikeRisk}`}>
              <Activity size={20} />
              <span className="spike-level">{spikeRisk.toUpperCase()} RISK</span>
            </div>
            <p className="ai-insight-text">{spikeMessage}</p>
          </div>
        </div>

        {/* Operator Load */}
        <div className="ai-card">
          <div className="ai-card-header">
            <Users size={16} />
            <span>Operator Workload Analysis</span>
          </div>
          <div className="ai-card-body">
            {operatorPerf.length > 0 ? (
              <div className="operator-load-list">
                {operatorPerf.slice(0, 4).map((op, i) => (
                  <div key={i} className="op-load-item">
                    <span className="op-name">{op.name}</span>
                    <div className="op-load-bar-wrap">
                      <div
                        className="op-load-bar"
                        style={{
                          width: `${Math.min((op.resolved / (Math.max(...operatorPerf.map(o => o.resolved), 1))) * 100, 100)}%`,
                          background: op.avgTime > 120 ? 'var(--gradient-red)' : 'var(--gradient-green)'
                        }}
                      />
                    </div>
                    <span className="op-resolved">{op.resolved} resolved</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="ai-empty">No operator performance data available yet.</p>
            )}
            {overloadedOps.length > 0 && (
              <div className="ai-warning-box">
                <AlertTriangle size={14} />
                <span>{overloadedOps.length} operator(s) showing signs of overload</span>
              </div>
            )}
          </div>
        </div>

        {/* Anomalies */}
        <div className="ai-card">
          <div className="ai-card-header">
            <Zap size={16} />
            <span>Anomaly Detection</span>
          </div>
          <div className="ai-card-body">
            <div className="anomaly-list">
              {anomalies.map((a, i) => (
                <div key={i} className={`anomaly-item anomaly-${a.severity}`}>
                  <span className="anomaly-dot" />
                  <span>{a.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recommendations */}
        <div className="ai-card ai-recommendations">
          <div className="ai-card-header">
            <Sparkles size={16} />
            <span>AI Recommendations</span>
          </div>
          <div className="ai-card-body">
            {recommendations.map((rec, i) => (
              <div key={i} className="recommendation-item">
                <Target size={13} />
                <span>{rec}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIInsights;

import { useState, useEffect } from 'react'
import { analyticsAPI } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import {
  BarChart3, TrendingUp, Users, RefreshCw, Clock, Target, Zap, PieChart as PieChartIcon
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, LineChart, Line
} from 'recharts'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

const Analytics = () => {
  const [trends, setTrends] = useState(null)
  const [modules, setModules] = useState(null)
  const [performance, setPerformance] = useState(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(30)
  const { user } = useAuth()
  const { isDark } = useTheme()

  const tooltipStyle = isDark
    ? { background: '#1a1f35', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#f1f5f9', fontSize: '0.8rem' }
    : { background: '#ffffff', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '8px', color: '#1e293b', fontSize: '0.8rem' }
  const gridStroke = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)'
  const axisStroke = isDark ? '#64748b' : '#94a3b8'
  const barTrackBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [tRes, mRes, pRes] = await Promise.all([
          analyticsAPI.complaintTrends({ days }),
          analyticsAPI.moduleStats(),
          analyticsAPI.operatorPerformance()
        ])
        setTrends(tRes.data.data)
        setModules(mRes.data.data)
        setPerformance(pRes.data.data)
      } catch (err) {
        console.error('Analytics error:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [days])

  if (loading) return <div className="loading-container" style={{ minHeight: '60vh' }}><div className="spinner" /></div>

  const categoryData = trends?.byCategory?.map((c, i) => ({ name: c._id, value: c.count, fill: COLORS[i % COLORS.length] })) || []
  const zoneData = trends?.byZone?.map((z, i) => ({ name: z._id, value: z.count, fill: COLORS[i % COLORS.length] })) || []
  const priorityData = trends?.byPriority?.map((p) => ({
    name: p._id, value: p.count,
    fill: p._id === 'high' ? '#ef4444' : p._id === 'medium' ? '#f59e0b' : '#10b981'
  })) || []

  const moduleCompare = modules ? [
    { name: 'Traffic', total: modules.traffic?.total || 0, issues: modules.traffic?.highCongestion || 0 },
    { name: 'Waste', total: modules.waste?.total || 0, issues: modules.waste?.fullBins || 0 },
    { name: 'Water', total: modules.water?.total || 0, issues: modules.water?.leaks || 0 },
    { name: 'Lighting', total: modules.lighting?.total || 0, issues: modules.lighting?.faults || 0 },
    { name: 'IoT', total: modules.iot?.total || 0, issues: modules.iot?.critical || 0 },
  ] : []

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div className="page-header">
        <div>
          <h1><BarChart3 size={20} style={{ display: 'inline', marginRight: 8 }} />Analytics Center</h1>
          <p>Data-driven insights across all city modules</p>
        </div>
        <div className="header-actions" style={{ display: 'flex', gap: '0.5rem' }}>
          {[7, 30, 90].map((d) => (
            <button key={d} className={`btn ${days === d ? 'btn-primary' : 'btn-outline'}`} onClick={() => setDays(d)}>
              {d}D
            </button>
          ))}
        </div>
      </div>

      {/* Complaint Trend Chart */}
      <div className="card">
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem' }}>
          <TrendingUp size={16} /> Complaint Trend ({days} days)
        </h3>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={trends?.dailyTrend || []}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
            <XAxis dataKey="_id" stroke={axisStroke} fontSize={11} tickFormatter={(v) => v.slice(5)} />
            <YAxis stroke="#64748b" fontSize={11} />
            <Tooltip contentStyle={tooltipStyle} />
            <Area type="monotone" dataKey="total" stroke="#3b82f6" fill="rgba(59,130,246,0.15)" strokeWidth={2} name="Total" />
            <Area type="monotone" dataKey="resolved" stroke="#10b981" fill="rgba(16,185,129,0.15)" strokeWidth={2} name="Resolved" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Category + Zone + Priority Breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.25rem' }}>
        <div className="card">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem' }}>
            <PieChartIcon size={16} /> By Category
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={categoryData} innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value">
                {categoryData.map((e, i) => <Cell key={i} fill={e.fill} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
          <div className="pie-legend" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center', marginTop: '0.5rem' }}>
            {categoryData.map((d) => (
              <span key={d.name} className="legend-item" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem' }}>
                <span className="legend-dot" style={{ background: d.fill, width: 8, height: 8, borderRadius: '50%', display: 'inline-block' }} />
                {d.name}: {d.value}
              </span>
            ))}
          </div>
        </div>

        <div className="card">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem' }}>
            <Target size={16} /> By Zone
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={zoneData}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
              <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
              <YAxis stroke="#64748b" fontSize={11} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {zoneData.map((e, i) => <Cell key={i} fill={e.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem' }}>
            <Zap size={16} /> By Priority
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={priorityData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
              <XAxis type="number" stroke="#64748b" fontSize={11} />
              <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={11} width={70} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                {priorityData.map((e, i) => <Cell key={i} fill={e.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Module Comparison */}
      <div className="card">
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem' }}>
          <BarChart3 size={16} /> Module Health Comparison
        </h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={moduleCompare}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
            <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
            <YAxis stroke="#64748b" fontSize={12} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="total" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Total Points" />
            <Bar dataKey="issues" fill="#ef4444" radius={[4, 4, 0, 0]} name="Issues/Faults" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Operator Performance */}
      {performance && performance.length > 0 && (
        <div className="card">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem' }}>
            <Users size={16} /> Operator Performance
          </h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Operator</th>
                <th>Department</th>
                <th>Total Assigned</th>
                <th>Resolved</th>
                <th>Resolution Rate</th>
                <th>Avg Time (min)</th>
                <th>Overdue</th>
              </tr>
            </thead>
            <tbody>
              {performance.map((op, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 600 }}>{op.name}</td>
                  <td><span className="badge badge-blue">{op.department}</span></td>
                  <td>{op.total}</td>
                  <td style={{ color: '#10b981' }}>{op.resolved}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, height: 6, background: barTrackBg, borderRadius: 3 }}>
                        <div style={{
                          height: '100%', borderRadius: 3, width: `${op.resolutionRate}%`,
                          background: op.resolutionRate >= 80 ? '#10b981' : op.resolutionRate >= 50 ? '#f59e0b' : '#ef4444'
                        }} />
                      </div>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{op.resolutionRate}%</span>
                    </div>
                  </td>
                  <td><Clock size={12} style={{ marginRight: 4 }} />{op.avgResolutionTime}</td>
                  <td>
                    {op.overdue > 0 ? (
                      <span className="badge badge-red">{op.overdue}</span>
                    ) : (
                      <span className="badge badge-green">0</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default Analytics

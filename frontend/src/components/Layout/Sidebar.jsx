import { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { announcementAPI } from '../../services/api'
import {
  LayoutDashboard,
  Car,
  Trash2,
  Droplets,
  Lightbulb,
  AlertTriangle,
  Bell,
  ScrollText,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Shield,
  Zap,
  MessageSquare,
  Sun,
  Moon,
  Bot,
  Megaphone,
  Satellite,
  Map,
  BarChart3,
  Siren,
  Users,
  ParkingSquare,
  Truck,
  CloudSun,
} from 'lucide-react'
import './Sidebar.css'

const Sidebar = ({ mobileMenuOpen, setMobileMenuOpen }) => {
  const [collapsed, setCollapsed] = useState(false)
  const [announcementCount, setAnnouncementCount] = useState(0)
  const { user, logout, isAdmin, isOperator, isUser } = useAuth()
  const { isDark, toggleTheme } = useTheme()
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768)

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Fetch announcement count for citizens
  useEffect(() => {
    if (isUser && user?.zone) {
      const fetchAnnouncementCount = async () => {
        try {
          const res = await announcementAPI.getAll({ status: 'active' })
          const filtered = res.data.data.filter(
            (a) => a.zones.includes(user.zone) || a.zones.includes('all')
          )
          setAnnouncementCount(filtered.length)
        } catch (err) {
          console.error('Fetch announcements error:', err)
        }
      }
      fetchAnnouncementCount()
      const interval = setInterval(fetchAnnouncementCount, 30000) // Refresh every 30s
      return () => clearInterval(interval)
    }
  }, [isUser, user?.zone])

  // Build nav items based on role
  const getNavItems = () => {
    const items = []

    // Complaints is available to ALL roles
    items.push({
      path: '/complaints',
      label: 'Complaints',
      icon: MessageSquare,
    })

    // Emergency — all roles
    items.push({
      path: '/emergency',
      label: 'Emergency',
      icon: Siren,
    })

    if (isAdmin || isOperator) {
      // Admin and operators see full city modules
      items.unshift(
        { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { path: '/map', label: 'Live Map', icon: Map },
        { path: '/traffic', label: 'Traffic', icon: Car },
        { path: '/waste', label: 'Waste Mgmt', icon: Trash2 },
        { path: '/weather', label: 'Weather', icon: CloudSun },
        { path: '/water', label: 'Water', icon: Droplets },
        { path: '/lighting', label: 'Lighting', icon: Lightbulb },
        { path: '/iot', label: 'IoT Devices', icon: Satellite },
        { path: '/incidents', label: 'Incidents', icon: AlertTriangle },
        { path: '/alerts', label: 'Alerts', icon: Bell }
      )
      if (isOperator) {
        items.push({ path: '/operator/waste', label: 'Collection Queue', icon: Truck })
      }
    }

    if (isUser) {
      // Citizens see dashboard, complaints (already added), assistant, announcements
      items.unshift({
        path: '/dashboard',
        label: 'Dashboard',
        icon: LayoutDashboard,
      })
      items.push(
        { path: '/assistant', label: 'City Assistant', icon: Bot },
        { path: '/parking', label: 'Smart Parking', icon: ParkingSquare },
        { path: '/dustbins', label: 'Waste / Dustbins', icon: Trash2 },
        { path: '/weather', label: 'Weather', icon: CloudSun },
        {
          path: '/announcements',
          label: 'City Alerts',
          icon: Bell,
          badge: announcementCount,
        }
      )
    }

    return items
  }

  const adminItems = isAdmin
    ? [
        { path: '/analytics', label: 'Analytics', icon: BarChart3 },
        { path: '/admin/panel', label: 'User Management', icon: Users },
        { path: '/admin/parking', label: 'Parking Mgmt', icon: ParkingSquare },
        {
          path: '/admin/announcements',
          label: 'Announcements',
          icon: Megaphone,
        },
        { path: '/logs', label: 'Activity Logs', icon: ScrollText },
      ]
    : []

  const navItems = getNavItems()

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileMenuOpen ? 'mobile-open' : ''}`}>
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <img src="/logo.jpg" alt="SmartCity" style={{ width: 34, height: 34, borderRadius: 10, objectFit: 'cover' }} />
          {(!collapsed || isMobile) && (
            <div className="logo-text">
              <span className="logo-title">SmartCity</span>
              <span className="logo-subtitle">Command Center</span>
            </div>
          )}
        </div>
        <button
          className="collapse-btn"
          onClick={() => {
            if (window.innerWidth <= 768) {
              setMobileMenuOpen(false);
            } else {
              setCollapsed(!collapsed);
            }
          }}
        >
          {window.innerWidth <= 768 ? <ChevronLeft size={16} /> : (collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />)}
        </button>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section">
          {(!collapsed || isMobile) && (
            <span className="nav-section-label">
              {isUser ? 'Citizen Portal' : 'Modules'}
            </span>
          )}
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `nav-item ${isActive ? 'active' : ''}`
              }
              title={collapsed ? item.label : ''}
            >
              <div className="nav-item-content">
                <item.icon size={18} />
                {(!collapsed || isMobile) && <span>{item.label}</span>}
                {item.badge > 0 && (
                  <span className="nav-badge">{item.badge}</span>
                )}
              </div>
            </NavLink>
          ))}
        </div>

        {adminItems.length > 0 && (
          <div className="nav-section">
            {(!collapsed || isMobile) && <span className="nav-section-label">Admin</span>}
            {adminItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `nav-item ${isActive ? 'active' : ''}`
                }
                title={collapsed ? item.label : ''}
              >
                <item.icon size={18} />
                {(!collapsed || isMobile) && <span>{item.label}</span>}
              </NavLink>
            ))}
          </div>
        )}
      </nav>

      <div className="sidebar-footer">
        {/* Theme Toggle */}
        <button
          className="theme-toggle-btn"
          onClick={toggleTheme}
          title={isDark ? 'Switch to Light' : 'Switch to Dark'}
        >
          {isDark ? <Sun size={16} /> : <Moon size={16} />}
          {(!collapsed || isMobile) && <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>}
        </button>

        <div className="user-card">
          <div className="user-avatar">
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          {(!collapsed || isMobile) && (
            <div className="user-info">
              <span className="user-name">{user?.name}</span>
              <span className="user-role">
                <Shield size={11} />
                {user?.role}
                {user?.zone && <span style={{ marginLeft: 4, opacity: 0.7 }}>• {user.zone}</span>}
              </span>
            </div>
          )}
        </div>
        <button className="logout-btn" onClick={logout} title="Logout">
          <LogOut size={16} />
          {(!collapsed || isMobile) && <span>Logout</span>}
        </button>
      </div>
    </aside>
  )
}

export default Sidebar

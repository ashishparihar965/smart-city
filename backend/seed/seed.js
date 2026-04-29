const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') })
const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')
const User = require('../models/User')
const TrafficData = require('../models/TrafficData')
const WasteData = require('../models/WasteData')
const Bin = require('../models/Bin')
const WaterData = require('../models/WaterData')
const LightingData = require('../models/LightingData')
const IoTDevice = require('../models/IoTDevice')
const Incident = require('../models/Incident')
const Alert = require('../models/Alert')
const ActivityLog = require('../models/ActivityLog')
const Complaint = require('../models/Complaint')

const zones = ['north', 'south', 'east', 'west', 'central']
const BASE_COORDINATES = { lat: 22.7388, lng: 75.8904 }
const zoneCoordinateBias = {
  north: { lat: 0.02, lng: 0 },
  south: { lat: -0.02, lng: 0 },
  east: { lat: 0, lng: 0.02 },
  west: { lat: 0, lng: -0.02 },
  central: { lat: 0, lng: 0 },
}

const toCoordinatePoint = (lat, lng) => ({
  lat: Number(lat.toFixed(6)),
  lng: Number(lng.toFixed(6)),
})

const getNearbyCoordinates = (zone = 'central', seed = 0, spread = 0.012) => {
  const bias = zoneCoordinateBias[zone] || zoneCoordinateBias.central
  const angle = ((seed * 37) % 360) * (Math.PI / 180)
  const radius = spread * (0.35 + (seed % 5) * 0.15)

  const lat =
    BASE_COORDINATES.lat +
    bias.lat +
    Math.cos(angle) * radius +
    (Math.random() - 0.5) * spread * 0.18

  const lng =
    BASE_COORDINATES.lng +
    bias.lng +
    Math.sin(angle) * radius +
    (Math.random() - 0.5) * spread * 0.18

  return toCoordinatePoint(lat, lng)
}

const trafficLocations = [
  { location: 'MG Road Junction', zone: 'central' },
  { location: 'Station Road Crossing', zone: 'central' },
  { location: 'Nehru Nagar Signal', zone: 'north' },
  { location: 'Gandhi Chowk', zone: 'north' },
  { location: 'Ambedkar Circle', zone: 'south' },
  { location: 'Patel Bridge', zone: 'south' },
  { location: 'Industrial Area Gate', zone: 'east' },
  { location: 'IT Park Entry', zone: 'east' },
  { location: 'University Road', zone: 'west' },
  { location: 'Mall Road Intersection', zone: 'west' },
  { location: 'Highway Toll Plaza', zone: 'north' },
  { location: 'Bus Stand Junction', zone: 'central' },
  { location: 'Railway Crossing', zone: 'south' },
  { location: 'Bypass Road', zone: 'east' },
  { location: 'Ring Road Signal', zone: 'west' },
]

const wasteLocations = [
  { location: 'Sector 1 Market', zone: 'north' },
  { location: 'Sector 2 Park', zone: 'north' },
  { location: 'Central Market', zone: 'central' },
  { location: 'City Hospital', zone: 'central' },
  { location: 'South Colony', zone: 'south' },
  { location: 'Eastside Estate', zone: 'east' },
  { location: 'West End Road', zone: 'west' },
  { location: 'Bus Terminal', zone: 'central' },
  { location: 'Riverside Park', zone: 'south' },
  { location: 'Tech Hub', zone: 'east' },
  { location: 'School Lane', zone: 'north' },
  { location: 'Mall Complex', zone: 'west' },
  { location: 'Sports Stadium', zone: 'south' },
  { location: 'Government Office', zone: 'central' },
  { location: 'Residence Block A', zone: 'north' },
  { location: 'Residence Block B', zone: 'east' },
  { location: 'Commercial Zone', zone: 'west' },
  { location: 'Old Town Square', zone: 'south' },
  { location: 'Railway Colony', zone: 'east' },
  { location: 'Airport Road', zone: 'west' },
]

const waterAreas = [
  { area: 'North Residential', zone: 'north' },
  { area: 'North Industrial', zone: 'north' },
  { area: 'Central Business District', zone: 'central' },
  { area: 'Central Residential', zone: 'central' },
  { area: 'South Colony', zone: 'south' },
  { area: 'South Industrial', zone: 'south' },
  { area: 'East Township', zone: 'east' },
  { area: 'East Commercial', zone: 'east' },
  { area: 'West Suburbs', zone: 'west' },
  { area: 'West Hills', zone: 'west' },
]

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI)
    console.log('✅ Connected to MongoDB for seeding')

    // Clear all existing data
    await Promise.all([
      User.deleteMany({}),
      TrafficData.deleteMany({}),
      WasteData.deleteMany({}),
      Bin.deleteMany({}),
      WaterData.deleteMany({}),
      LightingData.deleteMany({}),
      IoTDevice.deleteMany({}),
      Incident.deleteMany({}),
      Alert.deleteMany({}),
      ActivityLog.deleteMany({}),
      Complaint.deleteMany({}),
    ])
    console.log('🗑️  Cleared existing data')

    // --- USERS (admin + operators + citizens) ---
    const users = await User.create([
      {
        name: 'Admin User',
        email: 'admin@smartcity.com',
        password: 'admin123',
        role: 'admin',
        department: 'general',
      },
      {
        name: 'Traffic Operator',
        email: 'traffic@smartcity.com',
        password: 'operator123',
        role: 'operator',
        department: 'traffic',
      },
      {
        name: 'Waste Operator',
        email: 'waste@smartcity.com',
        password: 'operator123',
        role: 'operator',
        department: 'waste',
      },
      {
        name: 'Water Operator',
        email: 'water@smartcity.com',
        password: 'operator123',
        role: 'operator',
        department: 'water',
      },
      {
        name: 'Emergency Operator',
        email: 'emergency@smartcity.com',
        password: 'operator123',
        role: 'operator',
        department: 'emergency',
      },
      {
        name: 'Lighting Operator',
        email: 'lighting@smartcity.com',
        password: 'operator123',
        role: 'operator',
        department: 'lighting',
      },
      {
        name: 'Rahul Sharma',
        email: 'rahul@citizen.com',
        password: 'citizen123',
        role: 'user',
        department: 'general',
      },
      {
        name: 'Priya Patel',
        email: 'priya@citizen.com',
        password: 'citizen123',
        role: 'user',
        department: 'general',
      },
      {
        name: 'Amit Kumar',
        email: 'amit@citizen.com',
        password: 'citizen123',
        role: 'user',
        department: 'general',
      },
    ])
    console.log(`👤 Created ${users.length} users`)

    const admin = users.find((u) => u.role === 'admin')
    const operators = users.filter((u) => u.role === 'operator')
    const citizens = users.filter((u) => u.role === 'user')

    // --- TRAFFIC DATA ---
    const congestionLevels = ['low', 'medium', 'high']
    const trafficData = trafficLocations.map((loc, i) => ({
      ...loc,
      coordinates: getNearbyCoordinates(loc.zone, i, 0.014),
      congestionLevel: congestionLevels[Math.floor(Math.random() * 3)],
      vehicleCount: Math.floor(Math.random() * 500) + 50,
      averageSpeed: Math.floor(Math.random() * 60) + 10,
      signalStatus: ['green', 'yellow', 'red'][Math.floor(Math.random() * 3)],
      incidentReported: Math.random() > 0.8,
      incidentType:
        Math.random() > 0.8
          ? ['accident', 'roadwork', 'breakdown'][Math.floor(Math.random() * 3)]
          : 'none',
      predictedCongestion: congestionLevels[Math.floor(Math.random() * 3)],
    }))
    await TrafficData.create(trafficData)
    console.log(`🚗 Created ${trafficData.length} traffic records`)

    // --- WASTE BINS (new Bin model) ---
    const binData = wasteLocations.map((loc, i) => {
      const fillLevel = Math.floor(Math.random() * 100)
      const coords = getNearbyCoordinates(loc.zone, i + 100, 0.016)
      return {
        name: `BIN-${String(i + 1).padStart(3, '0')} ${loc.location}`,
        latitude: coords.lat,
        longitude: coords.lng,
        fill_level: fillLevel,
        last_collected_at: new Date(
          Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000
        ),
      }
    })
    // Use insertMany + then run save on each to trigger pre-save hooks
    for (const b of binData) {
      await Bin.create(b)
    }
    console.log(`🗑️  Created ${binData.length} waste bins (new)`)

    // --- WATER DATA ---
    const waterData = waterAreas.map((area, i) => {
      const threshold = 5000
      const usage = Math.floor(Math.random() * 8000) + 1000
      return {
        ...area,
        coordinates: getNearbyCoordinates(area.zone, i + 200, 0.013),
        usage,
        pressure: Math.floor(Math.random() * 40) + 40,
        threshold,
        dailyAverage: Math.floor(Math.random() * 5000) + 2000,
        weeklyAverage: Math.floor(Math.random() * 35000) + 14000,
        qualityIndex: Math.floor(Math.random() * 20) + 80,
      }
    })
    await WaterData.create(waterData)
    console.log(`💧 Created ${waterData.length} water areas`)

    // --- LIGHTING DATA ---
    const lightingData = []
    let lightCounter = 1
    const faultTypes = [
      'none',
      'flickering',
      'burnt-out',
      'power-issue',
      'sensor-fault',
    ]
    for (const zone of zones) {
      for (let i = 0; i < 8; i++) {
        const hasFault = Math.random() > 0.85
        lightingData.push({
          lightId: `SL-${zone[0].toUpperCase()}${String(lightCounter++).padStart(3, '0')}`,
          location: `${zone.charAt(0).toUpperCase() + zone.slice(1)} Zone Street ${i + 1}`,
          zone,
          coordinates: getNearbyCoordinates(zone, lightCounter + 300, 0.018),
          status: Math.random() > 0.3 ? 'on' : 'off',
          autoMode: Math.random() > 0.2,
          faultDetected: hasFault,
          faultType: hasFault
            ? faultTypes[Math.floor(Math.random() * 4) + 1]
            : 'none',
          energyUsage: Math.round((Math.random() * 5 + 0.5) * 100) / 100,
          brightness: Math.floor(Math.random() * 40) + 60,
          lastMaintenanceDate: new Date(
            Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000
          ),
        })
      }
    }
    await LightingData.create(lightingData)
    console.log(`💡 Created ${lightingData.length} street lights`)

    // --- IOT DEVICES ---
    const iotDevices = [
      {
        deviceId: 'DEV-TRAFFIC-CENTRAL-001',
        name: 'Central Traffic Junction Sensor',
        type: 'traffic-sensor',
        zone: 'central',
        location: 'MG Road Junction',
        coordinates: getNearbyCoordinates('central', 500, 0.008),
        status: 'online',
        connectionType: 'socket',
        connectionKey: 'TRAFFIC-CENTRAL-001',
        firmwareVersion: '2.1.0',
        batteryLevel: 86,
        signalStrength: 91,
        lastSeen: new Date(),
        connectedAt: new Date(),
        telemetry: {
          vehicleCount: 182,
          averageSpeed: 27,
          congestionLevel: 'medium',
        },
      },
      {
        deviceId: 'DEV-WASTE-NORTH-001',
        name: 'North Waste Fill Sensor',
        type: 'waste-sensor',
        zone: 'north',
        location: 'Sector 1 Market',
        coordinates: getNearbyCoordinates('north', 501, 0.008),
        status: 'online',
        connectionType: 'http',
        connectionKey: 'WASTE-NORTH-001',
        firmwareVersion: '1.8.2',
        batteryLevel: 72,
        signalStrength: 88,
        lastSeen: new Date(),
        connectedAt: new Date(),
        telemetry: { fillLevel: 84, fillStatus: 'full', missedPickup: true },
      },
      {
        deviceId: 'DEV-WATER-CENTRAL-001',
        name: 'Central Water Meter',
        type: 'water-meter',
        zone: 'central',
        location: 'Central Business District Pump House',
        coordinates: getNearbyCoordinates('central', 502, 0.008),
        status: 'online',
        connectionType: 'mqtt',
        connectionKey: 'WATER-CENTRAL-001',
        firmwareVersion: '3.0.4',
        batteryLevel: 94,
        signalStrength: 96,
        lastSeen: new Date(),
        connectedAt: new Date(),
        telemetry: { usage: 12096, pressure: 54, leakDetected: true },
      },
      {
        deviceId: 'DEV-LIGHT-EAST-001',
        name: 'East Lighting Controller',
        type: 'lighting-controller',
        zone: 'east',
        location: 'East Township Lane 3',
        coordinates: getNearbyCoordinates('east', 503, 0.008),
        status: 'maintenance',
        connectionType: 'socket',
        connectionKey: 'LIGHT-EAST-001',
        firmwareVersion: '1.4.7',
        batteryLevel: 61,
        signalStrength: 74,
        lastSeen: new Date(Date.now() - 15 * 60 * 1000),
        connectedAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
        telemetry: {
          brightness: 68,
          faultDetected: true,
          faultType: 'flickering',
        },
      },
      {
        deviceId: 'DEV-AIR-WEST-001',
        name: 'West Air Quality Node',
        type: 'air-quality-sensor',
        zone: 'west',
        location: 'West Hills Monitoring Tower',
        coordinates: getNearbyCoordinates('west', 504, 0.008),
        status: 'offline',
        connectionType: 'simulation',
        connectionKey: 'AIR-WEST-001',
        firmwareVersion: '1.1.3',
        batteryLevel: 18,
        signalStrength: 52,
        lastSeen: new Date(Date.now() - 6 * 60 * 60 * 1000),
        disconnectedAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
        telemetry: { value: 118, message: 'Battery low' },
      },
    ]
    const iotDevicesForInsert = iotDevices.map(({ connectionKey, ...device }) => ({
      ...device,
      connectionKeyHash: connectionKey,
    }))
    await IoTDevice.create(iotDevicesForInsert)
    console.log(`📡 Created ${iotDevices.length} IoT devices`)

    // --- INCIDENTS ---
    const incidentTypes = [
      'fire',
      'accident',
      'crime',
      'flood',
      'gas-leak',
      'power-outage',
    ]
    const priorities = ['low', 'medium', 'high', 'critical']
    const statuses = ['open', 'in-progress', 'resolved']

    const incidents = []
    for (let i = 0; i < 12; i++) {
      const zone = zones[Math.floor(Math.random() * zones.length)]
      const status = statuses[Math.floor(Math.random() * statuses.length)]
      incidents.push({
        title:
          `${incidentTypes[i % incidentTypes.length].replace('-', ' ')} incident #${i + 1}`.replace(
            /^\w/,
            (c) => c.toUpperCase()
          ),
        type: incidentTypes[i % incidentTypes.length],
        location: `${zone.charAt(0).toUpperCase() + zone.slice(1)} Zone Area ${Math.floor(Math.random() * 10) + 1}`,
        coordinates: getNearbyCoordinates(zone, i + 700, 0.016),
        zone,
        priority: priorities[Math.floor(Math.random() * priorities.length)],
        status,
        description: `Emergency ${incidentTypes[i % incidentTypes.length].replace('-', ' ')} reported. Requires immediate attention.`,
        createdBy: admin._id,
        assignedTo:
          status !== 'open'
            ? operators[Math.floor(Math.random() * operators.length)]._id
            : null,
        resolvedAt: status === 'resolved' ? new Date() : null,
        responseTime:
          status === 'resolved' ? Math.floor(Math.random() * 120) + 10 : null,
      })
    }
    await Incident.create(incidents)
    console.log(`🚨 Created ${incidents.length} incidents`)

    // --- COMPLAINTS ---
    const complaintTemplates = [
      {
        title: 'Pothole on MG Road causing accidents',
        category: 'traffic',
        location: 'MG Road, Central Zone',
        zone: 'central',
        description:
          'Large pothole near junction causing vehicle damage and traffic slowdown. Multiple accidents reported.',
      },
      {
        title: 'Garbage not collected for 5 days',
        category: 'waste',
        location: 'Sector 1 Market, North Zone',
        zone: 'north',
        description:
          'Garbage bin overflowing near the market. Bad smell affecting nearby shops and residents.',
      },
      {
        title: 'Water supply disrupted since morning',
        category: 'water',
        location: 'South Colony Block B',
        zone: 'south',
        description:
          'No water supply since 6 AM. Entire block affected. Urgent restoration needed.',
      },
      {
        title: 'Street lights not working',
        category: 'lighting',
        location: 'East Township Lane 3',
        zone: 'east',
        description:
          'All 5 street lights on Lane 3 are off for the past 3 nights. Safety concern for residents.',
      },
      {
        title: 'Fire near Industrial Area',
        category: 'emergency',
        location: 'Industrial Area Gate, East Zone',
        zone: 'east',
        description:
          'Smoke and flames visible near the factory area. Fire brigade needed immediately.',
      },
      {
        title: 'Signal malfunction at Gandhi Chowk',
        category: 'traffic',
        location: 'Gandhi Chowk, North Zone',
        zone: 'north',
        description:
          'Traffic signal stuck on red for all directions. Heavy congestion building up.',
      },
      {
        title: 'Sewage overflow in residential area',
        category: 'water',
        location: 'West Suburbs Block A',
        zone: 'west',
        description:
          'Sewage water flooding the street near Block A. Health hazard for children and elderly.',
      },
      {
        title: 'Hazardous waste dumped near park',
        category: 'waste',
        location: 'Riverside Park, South Zone',
        zone: 'south',
        description:
          'Unidentified chemical containers dumped near the park entrance. Children play area affected.',
      },
      {
        title: 'Flickering lights on Highway',
        category: 'lighting',
        location: 'Highway Toll Plaza, North Zone',
        zone: 'north',
        description:
          'Multiple street lights flickering on the highway causing visibility issues at night.',
      },
      {
        title: 'Road flooding due to pipeline burst',
        category: 'water',
        location: 'Central Business District',
        zone: 'central',
        description:
          'Major water pipeline burst causing road flooding. Traffic diverted. Needs urgent repair.',
      },
    ]

    const complaintStatuses = ['open', 'in-progress', 'resolved']
    const complaintPriorities = ['low', 'medium', 'high']

    for (let i = 0; i < complaintTemplates.length; i++) {
      const tmpl = complaintTemplates[i]
      const citizen = citizens[i % citizens.length]
      const status = complaintStatuses[i % 3]
      const assignedOp =
        status !== 'open'
          ? operators.find((o) => o.department === tmpl.category) ||
            operators[0]
          : null

      const complaint = new Complaint({
        ...tmpl,
        coordinates: getNearbyCoordinates(tmpl.zone, i + 900, 0.014),
        priority:
          tmpl.category === 'emergency' ? 'high' : complaintPriorities[i % 3],
        status,
        createdBy: citizen._id,
        assignedTo: assignedOp ? assignedOp._id : null,
        remarks:
          status !== 'open'
            ? [
                {
                  text:
                    status === 'resolved'
                      ? 'Issue has been fixed and verified.'
                      : 'Team dispatched to site. Working on it.',
                  addedBy: assignedOp ? assignedOp._id : admin._id,
                  addedByName: assignedOp ? assignedOp.name : admin.name,
                  addedAt: new Date(),
                },
              ]
            : [],
        resolvedAt: status === 'resolved' ? new Date() : null,
        resolutionTimeMinutes:
          status === 'resolved' ? Math.floor(Math.random() * 4320) + 60 : null,
      })
      await complaint.save()
    }
    console.log(`📝 Created ${complaintTemplates.length} complaints`)

    // --- ALERTS ---
    const alertMessages = [
      {
        title: 'High Traffic Congestion',
        message: 'MG Road experiencing heavy congestion',
        module: 'traffic',
        type: 'warning',
        priority: 'high',
      },
      {
        title: 'Bin Overflow Alert',
        message: 'Multiple bins in North zone are full',
        module: 'waste',
        type: 'danger',
        priority: 'high',
      },
      {
        title: 'Water Leak Detected',
        message: 'Potential leak in East Township pipeline',
        module: 'water',
        type: 'critical',
        priority: 'critical',
      },
      {
        title: 'Street Light Fault',
        message: '3 lights malfunctioning in Central zone',
        module: 'lighting',
        type: 'warning',
        priority: 'medium',
      },
      {
        title: 'Fire Incident Reported',
        message: 'Fire reported near Industrial Area',
        module: 'emergency',
        type: 'critical',
        priority: 'critical',
      },
      {
        title: 'Traffic Prediction',
        message: 'High congestion expected in evening rush hours',
        module: 'traffic',
        type: 'prediction',
        priority: 'medium',
      },
      {
        title: 'Waste Collection Complete',
        message: 'South zone collection completed',
        module: 'waste',
        type: 'info',
        priority: 'low',
      },
      {
        title: 'Water Quality Alert',
        message: 'Quality index dropped below 85 in West area',
        module: 'water',
        type: 'warning',
        priority: 'medium',
      },
    ]
    await Alert.create(alertMessages)
    console.log(`🔔 Created ${alertMessages.length} alerts`)

    // --- ACTIVITY LOGS ---
    const logActions = [
      { action: 'User Login', module: 'auth', details: 'Admin logged in' },
      {
        action: 'Updated Traffic Data',
        module: 'traffic',
        details: 'Updated congestion at MG Road',
      },
      {
        action: 'Collected Waste Bin',
        module: 'waste',
        details: 'Bin BIN-001 collected',
      },
      {
        action: 'Created Incident',
        module: 'emergency',
        details: 'Fire incident created',
      },
      {
        action: 'Toggled Light ON',
        module: 'lighting',
        details: 'Light SL-N001 turned on',
      },
      {
        action: 'Acknowledged Alert',
        module: 'system',
        details: 'Water leak alert acknowledged',
      },
      {
        action: 'Filed Complaint',
        module: 'complaints',
        details: 'Citizen filed traffic complaint',
      },
      {
        action: 'Assigned Complaint',
        module: 'complaints',
        details: 'Admin assigned complaint to operator',
      },
    ]
    const logs = logActions.map((log) => ({
      ...log,
      userId: admin._id,
      userName: admin.name,
    }))
    await ActivityLog.create(logs)
    console.log(`📋 Created ${logs.length} activity logs`)

    console.log('\n===================================')
    console.log('✅ SEED COMPLETED SUCCESSFULLY!')
    console.log('===================================')
    console.log('\n🔑 Login Credentials:')
    console.log('  Admin:    admin@smartcity.com / admin123')
    console.log('  Operator: traffic@smartcity.com / operator123')
    console.log('  Operator: waste@smartcity.com / operator123')
    console.log('  Operator: water@smartcity.com / operator123')
    console.log('  Operator: emergency@smartcity.com / operator123')
    console.log('  Operator: lighting@smartcity.com / operator123')
    console.log('  Citizen:  rahul@citizen.com / citizen123')
    console.log('  Citizen:  priya@citizen.com / citizen123')
    console.log('  Citizen:  amit@citizen.com / citizen123')
    console.log('===================================\n')

    process.exit(0)
  } catch (error) {
    console.error('❌ Seed Error:', error)
    process.exit(1)
  }
}

seed()

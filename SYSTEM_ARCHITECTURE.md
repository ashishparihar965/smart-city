# SmartCity Announcement System - Architecture & Flow

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React)                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Admin Dashboard                  Citizen Dashboard              │
│  ┌─────────────────┐             ┌──────────────────┐           │
│  │ Announcements   │             │ Active           │           │
│  │ Management Page │────────┬───→│ Announcements    │           │
│  │ - Create        │        │    │ - Filtered by    │           │
│  │ - Edit          │        │    │   zone           │           │
│  │ - Delete        │        │    │ - View tracking  │           │
│  │ - Priority      │        │    │ - Priority badge │           │
│  │ - Zones         │        │    │ - Type icons     │           │
│  │ - Schedule      │        │    │                  │           │
│  └────────┬────────┘        │    └──────────────────┘           │
│           │                 │                                    │
│           └────────┬────────┘                                    │
│                    ▼                                              │
│          ┌──────────────────┐                                    │
│          │  API Client      │                                    │
│          │ announcementAPI  │                                    │
│          │ - create()       │                                    │
│          │ - getAll()       │                                    │
│          │ - update()       │                                    │
│          │ - delete()       │                                    │
│          │ - recordView()   │                                    │
│          └────────┬─────────┘                                    │
│                   │                                              │
└───────────────────┼──────────────────────────────────────────────┘
                    │ HTTP/REST
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                    BACKEND (Express.js)                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│         ┌──────────────────────────────────────┐                │
│         │  API Routes                          │                │
│         │ /api/announcements                   │                │
│         │ ├── GET    (citizens, filtered)      │                │
│         │ ├── POST   (admin create)            │                │
│         │ ├── PUT    (admin update)            │                │
│         │ ├── DELETE (admin delete)            │                │
│         │ └── POST   (record view)             │                │
│         └──────────────┬───────────────────────┘                │
│                        │                                         │
│        ┌───────────────┴────────────────┐                       │
│        │                                │                        │
│        ▼                                ▼                        │
│  ┌──────────────┐            ┌──────────────────┐              │
│  │  Database    │            │  Models &        │              │
│  │  MongoDB     │◄───────────│  Validation      │              │
│  │              │            │ - Announcement   │              │
│  │  Collection: │            │   Schema         │              │
│  │  announcement│            │ - Field checks   │              │
│  │              │            │ - Type checking  │              │
│  │  Fields:     │            │ - Zone filtering │              │
│  │  - title     │            │ - Status check   │              │
│  │  - message   │            │ - Expiry logic   │              │
│  │  - type      │            │ - View tracking  │              │
│  │  - priority  │            │ - Role checking  │              │
│  │  - zones     │            └──────────────────┘              │
│  │  - status    │                                               │
│  │  - views     │            ┌──────────────────┐              │
│  │  - expiresAt │            │  Activity Logger │              │
│  │  - etc.      │◄───────────│  (Audit Trail)   │              │
│  └──────────────┘            │ - create log     │              │
│                              │ - update log     │              │
│                              │ - delete log     │              │
│                              └──────────────────┘              │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow Diagram

### Admin Create Announcement
```
┌─────────┐
│  Admin  │
└────┬────┘
     │ 1. Fill form (title, message, type, priority, zones, schedule, expiry)
     ▼
┌─────────────────────┐
│ Announcement Form   │
│ (Validation)        │
│ - Required fields   │
│ - Zones selected    │
└────┬────────────────┘
     │ 2. Click "Create Announcement"
     ▼
┌──────────────────────┐
│ POST /api/           │
│ announcements        │
│ (with JWT token)     │
└────┬─────────────────┘
     │ 3. HTTP POST request
     ▼
┌──────────────────────────┐
│ Backend Route Handler    │
│ - Auth check (admin)     │
│ - Validate payload       │
│ - Parse zones/dates      │
└────┬─────────────────────┘
     │ 4. Create document
     ▼
┌──────────────────────────┐
│ MongoDB Collection       │
│ announcements            │
│ INSERT new document      │
└────┬─────────────────────┘
     │ 5. Document created
     ▼
┌──────────────────────────┐
│ Activity Logger          │
│ - Log: "Created by Admin"│
│ - Timestamp, user ID     │
└────┬─────────────────────┘
     │ 6. Log saved
     ▼
┌──────────────────────────┐
│ API Response (201)       │
│ { success, announcement }│
└────┬─────────────────────┘
     │ 7. Response to admin
     ▼
┌──────────────────────────┐
│ Admin UI                 │
│ - Close form             │
│ - Show success message   │
│ - Refresh announcements  │
└──────────────────────────┘
```

### Citizen View Announcements
```
┌──────────┐
│ Citizen  │
│ (Zone:   │
│  South)  │
└────┬─────┘
     │ 1. Navigate to Dashboard
     ▼
┌──────────────────────┐
│ Citizen Dashboard    │
│ Fetches data via:    │
│ dashboardAPI.getData()
│ announcementAPI.getAll()
└────┬─────────────────┘
     │ 2. GET /api/announcements?status=active
     ▼
┌──────────────────────────┐
│ Backend Query            │
│ - status = "active"      │
│ - zones contains "south" │
│ - zones contains "all"   │
│ - expiresAt > now        │
└────┬─────────────────────┘
     │ 3. Query MongoDB
     ▼
┌──────────────────────────┐
│ MongoDB Result Set       │
│ - 3 announcements found  │
│   (matched zones)        │
└────┬─────────────────────┘
     │ 4. Return to frontend
     ▼
┌────────────────────────────┐
│ Frontend Renders           │
│ Active Announcements       │
│ Section:                   │
│ ┌──────────────────────┐   │
│ │ Announcement Card 1  │   │
│ │ Title + Message      │   │
│ │ [📍 south central]   │   │
│ │ [🔴 HIGH PRIORITY]   │   │
│ └──────────────────────┘   │
│ ┌──────────────────────┐   │
│ │ Announcement Card 2  │   │
│ └──────────────────────┘   │
│ ┌──────────────────────┐   │
│ │ Announcement Card 3  │   │
│ └──────────────────────┘   │
└────┬──────────────────────┘
     │ 5. Citizen clicks card
     ▼
┌──────────────────────┐
│ POST /api/           │
│ announcements/:id/   │
│ view                 │
└────┬─────────────────┘
     │ 6. Record view
     ▼
┌────────────────────────────┐
│ Backend:                   │
│ - Record {userId, date}    │
│ - Increment viewCount      │
│ - Update MongoDB           │
└────┬───────────────────────┘
     │ 7. View recorded
     ▼
┌──────────────────────┐
│ API Response (200)   │
│ { success }          │
└──────────────────────┘
```

## Citizen Dashboard With Announcements

```
┌──────────────────────────────────────────────────┐
│ Citizen Dashboard                                │
├──────────────────────────────────────────────────┤
│                                                  │
│  ┌────────────────────────────────────────────┐ │
│  │ Active Announcements              3 active │ │
│  ├────────────────────────────────────────────┤ │
│  │                                            │ │
│  │ ┌──────────────────────────────────────┐ │ │
│  │ │ 🚗 Traffic Congestion on Main Road  │ │ │
│  │ │ [🔴 HIGH]                           │ │ │
│  │ │ Heavy traffic detected. Use         │ │ │
│  │ │ alternate routes...                 │ │ │
│  │ │ 📍 central, east  Jan 15, 3:00 PM  │ │ │
│  │ │ 45 people notified                  │ │ │
│  │ └──────────────────────────────────────┘ │ │
│  │                                            │ │
│  │ ┌──────────────────────────────────────┐ │ │
│  │ │ 💧 Water Pipeline Maintenance       │ │ │
│  │ │ [🟠 MEDIUM]                         │ │ │
│  │ │ Water supply shut off Wed 10 PM -   │ │ │
│  │ │ Thu 6 AM. Store water accordingly.. │ │ │
│  │ │ 📍 south, west  Jan 14, 2:30 PM    │ │ │
│  │ │ 28 people notified                  │ │ │
│  │ └──────────────────────────────────────┘ │ │
│  │                                            │ │
│  │ ┌──────────────────────────────────────┐ │ │
│  │ │ 🚨 Gas Leak Emergency                │ │ │
│  │ │ [⚫ CRITICAL]                        │ │ │
│  │ │ Gas leak detected on 5th Avenue.    │ │ │
│  │ │ Evacuate 500m radius immediately... │ │ │
│  │ │ 📍 all zones        Jan 14, 5:45 PM │ │ │
│  │ │ 892 people notified                 │ │ │
│  │ └──────────────────────────────────────┘ │ │
│  │                                            │ │
│  └────────────────────────────────────────────┘ │
│                                                  │
│  [Contribution Score] [Stats] [Charts]...     │
│                                                  │
└──────────────────────────────────────────────────┘
```

## Zone-Based Filtering Logic

```
Announcement Created:
  zones: ["south", "west"]
  status: "active"
  expiresAt: "2025-01-20T18:00:00Z"

Citizen 1:
  zone: "south"
  ✅ SEES: zones include "south"

Citizen 2:
  zone: "north"
  ❌ DOES NOT SEE: zones don't include "north"

Announcement with zones: ["all"]
  ✅ ALL CITIZENS SEE it

Complex Example:
  Announcement zones: ["central", "all"]
  All citizens see it (because "all" included)
```

## Priority Color Scheme

```
CRITICAL:  ⚫ #8B0000 (Dark Red) - Evacuations, major emergencies
HIGH:      🔴 #F44336 (Red) - Urgent issues, road closures
MEDIUM:    🟠 #FF9800 (Orange) - Important, plan ahead
LOW:       🟢 #4CAF50 (Green) - FYI, informational

Visual Hierarchy:
  Left border color indicates priority at a glance
  Badge shows text label + color
  Scan announcement in seconds
```

## Type Icons

```
Traffic   → 🚗 (AlertTriangle icon, #FF6B6B red)
Water     → 💧 (Droplet icon, #4DA6FF blue)
Waste     → 🗑️ (Trash2 icon, #8B7355 brown)
Lighting  → 💡 (Lightbulb icon, #FFD700 gold)
Emergency → 🚨 (AlertCircle icon, #C41C3B crimson)
General   → ℹ️ (AlertCircle icon, #666 gray)
Maintenance → ⚙️ (Zap icon, #7C3AED purple)
```

## Time-Based Announcement States

```
Timeline:

Before scheduledFor:
  Status: "active" but not visible yet
  Action: Hidden from citizens until scheduledFor time

Between scheduledFor and expiresAt:
  Status: "active" and visible
  Action: Shown to citizens on dashboard

After expiresAt:
  Status: "active" but expired
  Action: Optionally hidden or marked "Expired"
  (Depends on admin preference)

Admin can delete anytime regardless of status
```

## Activity Log Integration

```
When admin creates announcement:
  ➜ Activity Log Entry
    Action: "Create Announcement"
    Details: "Traffic Congestion on Main Road"
    Admin: "user_123"
    Timestamp: "2025-01-15T15:00:00Z"

When admin updates announcement:
  ➜ Activity Log Entry
    Action: "Update Announcement"
    Details: "Traffic Congestion on Main Road"
    Admin: "user_123"
    Timestamp: "2025-01-15T15:30:00Z"

When admin deletes announcement:
  ➜ Activity Log Entry
    Action: "Delete Announcement"
    Details: "Traffic Congestion on Main Road"
    Admin: "user_123"
    Timestamp: "2025-01-15T18:00:00Z"

Visible in: Activity Logs page (admin-only)
Purpose: Audit trail of all system changes
```

## View Tracking for Engagement

```
When citizen views announcement:
  POST /api/announcements/:id/view
  
  Backend Records:
    views: [
      {
        userId: "citizen_456",
        viewedAt: "2025-01-15T16:00:00Z"
      },
      {
        userId: "citizen_789",
        viewedAt: "2025-01-15T16:05:00Z"
      },
      ...
    ]
    viewCount: 45

Use Cases:
  - Admin can see which announcements got views
  - Calculate announcement reach/effectiveness
  - Identify which citizen segments engaged
  - Track peak viewing times
```

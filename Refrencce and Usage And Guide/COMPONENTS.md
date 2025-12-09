# Component Documentation

Detailed documentation of all React components in the Nuclei Dashboard with database integration.

---

## Table of Contents
1. [Dashboard Components](#dashboard-components)
2. [Scan Components](#scan-components)
3. [Findings Components](#findings-components)
4. [Template Components](#template-components)
5. [Settings Components](#settings-components)
6. [Layout Components](#layout-components)
7. [UI Components](#ui-components)

---

## Dashboard Components

### DashboardClient.tsx
**Location:** `dashboard/components/dashboard/DashboardClient.tsx`

**Purpose:** Main orchestrator component that manages all dashboard views and navigation.

**State:**
```typescript
const [activeScanId, setActiveScanId] = useState<string | null>(null);
const [selectedTemplate, setSelectedTemplate] = useState<string>("");
const [activeView, setActiveView] = useState("overview");
const [templateRefresh, setTemplateRefresh] = useState(0);
```

**Props:**
```typescript
interface Props {
  initialStats: any;
}
```

**Functions:**
- `startScan(id: string)`: Switches to activity monitor for new scan
- `setActiveView(view: string)`: Changes active view

**Views:**
- `overview`: Dashboard statistics with severity breakdown
- `scan`: Scan wizard with 7 presets
- `vulnerabilities`: Findings table with filtering
- `activity`: Activity monitor (database-backed)
- `history`: Scan history
- `templates`: Template management
- `settings`: Settings panel

---

### Stats.tsx
**Location:** `dashboard/components/dashboard/Stats.tsx`

**Purpose:** Displays dashboard statistics with severity breakdown.

**Props:**
```typescript
interface Props {
  totalScans?: number;
  lastScan?: string;
}
```

**State:**
```typescript
const [severityCounts, setSeverityCounts] = useState<SeverityCounts>({
  critical: 0,
  high: 0,
  medium: 0,
  low: 0,
  info: 0,
  total: 0
});
```

**Features:**
- **Total Scans Card**: Shows scan count
- **Total Findings Card**: Shows all findings count
- **Last Activity Card**: Shows last scan timestamp
- **Severity Breakdown Card**: Visual grid showing:
  - Critical findings (red)
  - High findings (orange)
  - Medium findings (yellow)
  - Low findings (blue)
  - Info findings (gray)

**Data Source:**
- Fetches from `/api/findings` on mount
- Calculates severity counts client-side
- Updates automatically when findings change

---

## Scan Components

### ScanWizard.tsx
**Location:** `dashboard/components/scan/Wizard.tsx`

**Purpose:** Scan configuration interface with 7 one-click presets and custom args.

**State:**
```typescript
const [target, setTarget] = useState("");
const [customArgs, setCustomArgs] = useState("");
const [loading, setLoading] = useState(false);
```

**Props:**
```typescript
interface WizardProps {
  onScanStart: (scanId: string) => void;
  initialTemplate?: string;
}
```

**Functions:**
- `startScan(config: any)`: Submits scan to API
  - Merges config with localStorage settings
  - Sends POST to `/api/scan`
  - **Inserts scan record in database**
  - Calls `onScanStart` callback

**Features:**
- Two tabs: "One-Click Presets" and "Custom Command"
- **7 Preset Buttons:**
  1. Full Scan (no filters)
  2. Full Scan (Critical)
  3. Full Scan (High/Crit)
  4. Tech Detect
  5. CVEs (2023-2024)
  6. Misconfigurations
  7. Panels & Logins
- Preset buttons display flags in code badges
- Custom args input for advanced users
- Auto-fills from `initialTemplate` prop

**Presets:**
```typescript
import { PREDEFINED_COMMANDS } from "@/lib/nuclei/presets";
// Each preset has: name, description, flags, config
```

---

### LiveConsole.tsx (Activity Monitor)
**Location:** `dashboard/components/scan/LiveConsole.tsx`

**Purpose:** Database-backed activity monitor showing recent scans.

**State:**
```typescript
interface ScanInfo {
  id: string;
  target: string;
  status: string;
  startTime: number;
  endTime?: number;
  exitCode?: number;
  config?: {
    rateLimit?: number;
    concurrency?: number;
    bulkSize?: number;
    templateId?: string;
    tags?: string[];
    severity?: string[];
    customArgs?: string;
  };
}

const [activeScans, setActiveScans] = useState<ScanInfo[]>([]);
const [loading, setLoading] = useState(false);
```

**Functions:**
- `fetchScans()`: Polls `/api/scan` every 2 seconds
  - **Reads from database (last 20 scans)**
  - Returns all scans (running + completed)
- `stopScan(scanId)`: Sends DELETE to `/api/scan`
  - **Updates database status to 'stopped'**

**Features:**
- **Database-backed**: Shows scans from database (persistent)
- **Last 20 scans** displayed
- **Status badges** (color-coded):
  - 🟢 Running (green)
  - 🔵 Completed (blue)
  - 🟠 Stopped (orange)
  - 🔴 Failed (red)
- **Scan details**:
  - Target URL
  - Start time and duration
  - Exit code (0 = success)
  - Configuration (rate limit, concurrency, bulk size)
  - Template filters (tags/severity displayed correctly)
- Stop button for running scans
- Empty state when no scans found

**Data Source:**
```sql
SELECT * FROM scans 
ORDER BY start_time DESC 
LIMIT 20
```

---

### History.tsx
**Location:** `dashboard/components/scan/History.tsx`

**Purpose:** Displays completed scans with download and delete options.

**State:**
```typescript
const [history, setHistory] = useState<HistoryItem[]>([]);
const [loading, setLoading] = useState(true);
const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
```

**Functions:**
- `fetchHistory()`: GET `/api/history`
  - **Reads from database with file metadata**
  - Cached for 30 seconds
- `downloadFile(file, type)`: Downloads JSON or log file
- `deleteScan(scanId)`: DELETE `/api/history?id={scanId}`
  - **Deletes from database (cascade to findings)**
  - Deletes JSON and log files
  - Invalidates caches

**Features:**
- Lists scans by timestamp (newest first)
- Shows findings count per scan
- **Download buttons** for JSON and log files
- **Delete button** with confirmation dialog
- Refresh button
- **File metadata from database** (faster loading)
- Fallback to filesystem for legacy scans

**Data Source:**
```sql
SELECT id, target, json_file_path, json_file_size, 
       log_file_path, start_time, status, exit_code
FROM scans 
ORDER BY start_time DESC
```

---

## Findings Components

### FindingsTable.tsx
**Location:** `dashboard/components/findings/Table.tsx`

**Purpose:** Display and manage vulnerability findings with status tracking and filtering.

**State:**
```typescript
const [findings, setFindings] = useState<Finding[]>([]);
const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);
const [loading, setLoading] = useState(true);
const [severityFilters, setSeverityFilters] = useState<string[]>([]);
```

**Interface:**
```typescript
interface Finding {
  "template-id": string;
  "template-path"?: string;
  info: {
    name: string;
    severity: string;
    description?: string;
    tags?: string[];
  };
  "matched-at": string;
  timestamp: string;
  host?: string;
  _status?: string;    // NEW: Finding status
  _dbId?: number;      // NEW: Database ID
}
```

**Functions:**
- `fetchFindings()`: GET `/api/findings`
  - **Reads from database**
  - Cached for 20 seconds
  - Returns findings with `_status` and `_dbId`
- `updateStatus(finding, newStatus)`: PATCH `/api/findings`
  - **Updates status in database**
  - Invalidates cache
  - Refreshes table
- `deleteFinding(finding)`: DELETE `/api/findings`
  - **Deletes by database ID**
  - Invalidates cache
- `toggleSeverityFilter(severity)`: Toggles severity in filter array
- `rescan(finding)`: POST `/api/scan` with finding's template
- `exportData(severity?)`: Generates CSV export
- `getSeverityColor(severity)`: Returns Tailwind classes for severity badge
- `getStatusColor(status)`: Returns Tailwind classes for status badge

**NEW Features:**

#### 1. Status Management
- **Status Badge**: Clickable badge showing current status
- **Dropdown Menu**: Click to change status
- **Status Options**:
  - New (Blue)
  - Confirmed (Red)
  - False Positive (Gray)
  - Fixed (Green)
  - Closed (Purple)
- **Database Persistence**: Status saved to database
- **Color-Coded**: Each status has unique color

#### 2. Multi-Select Severity Filtering
- **Filter Button**: Shows "All Severities" or "{count} selected"
- **Checkbox Menu**: Select multiple severities
- **Filter Options**:
  - Critical
  - High
  - Medium
  - Low
  - Info
- **Real-Time Filtering**: Table updates instantly
- **Clear All**: "All Severities" option resets filters

#### 3. Existing Features
- Click row → Open detail dialog
- Detail dialog shows:
  - Key info in cards (Template ID, Severity, Matched At, etc.)
  - Full raw JSON in scrollable area
- Delete button (trash icon) in table row
- Rescan button for re-testing
- Export to CSV (all or by severity)

**Data Source:**
```sql
SELECT * FROM findings 
WHERE scan_id = ? OR ? IS NULL
```

**Filtering Logic:**
```typescript
const filteredFindings = severityFilters.length === 0
  ? findings 
  : findings.filter(f => severityFilters.includes(f.info.severity.toLowerCase()));
```

---

## Template Components

### TemplateList.tsx
**Location:** `dashboard/components/templates/List.tsx`

**Purpose:** Displays custom templates with run functionality.

**State:**
```typescript
const [templates, setTemplates] = useState<Template[]>([]);
const [loading, setLoading] = useState(true);
```

**Props:**
```typescript
interface Props {
  refreshTrigger: number;
  onRun?: (path: string) => void;
}
```

**Functions:**
- `fetchTemplates()`: GET `/api/templates`
- Triggers on `refreshTrigger` change

**Features:**
- Grid layout of template cards
- Shows template name and last modified date
- "Run" button calls `onRun(template.path)`

---

### TemplateManager.tsx
**Location:** `dashboard/components/templates/Manager.tsx`

**Purpose:** Create new custom templates.

**State:**
```typescript
const [name, setName] = useState("");
const [content, setContent] = useState("id: custom-template\n...");
const [open, setOpen] = useState(false);
```

**Props:**
```typescript
interface Props {
  onSaved?: () => void;
}
```

**Functions:**
- `saveTemplate()`: POST `/api/templates`
  - Validates name and content
  - Calls `onSaved` callback on success

**Features:**
- Dialog-based UI
- Name input (sanitized to alphanumeric)
- YAML content textarea with default template
- Save button

---

## Settings Components

### SettingsPanel.tsx
**Location:** `dashboard/components/settings/Panel.tsx`

**Purpose:** Configure Nuclei performance settings.

**State:**
```typescript
const [rateLimit, setRateLimit] = useState(150);
const [concurrency, setConcurrency] = useState(25);
const [bulkSize, setBulkSize] = useState(25);
```

**Functions:**
- `saveSettings()`: Saves to `localStorage`
  ```javascript
  localStorage.setItem('nuclei_settings', JSON.stringify({
    rateLimit,
    concurrency,
    bulkSize
  }));
  ```
- `loadSettings()`: Loads from `localStorage` on mount

**Features:**
- Number inputs for each setting
- Descriptions and recommended ranges
- Save button
- Settings applied to all scans

---

## Layout Components

### Sidebar.tsx
**Location:** `dashboard/components/layout/Sidebar.tsx`

**Purpose:** Navigation sidebar.

**Props:**
```typescript
interface SidebarProps {
  activeView: string;
  onChangeView: (view: string) => void;
}
```

**Navigation Items:**
```typescript
const items = [
  { id: "overview", label: "Dashboard", icon: LayoutDashboard },
  { id: "vulnerabilities", label: "Vulnerabilities", icon: ShieldAlert },
  { id: "scan", label: "New Operation", icon: Play },
  { id: "activity", label: "Activity Monitor", icon: Activity },
  { id: "history", label: "Scan History", icon: History },
  { id: "templates", label: "Templates", icon: FileCode },
  { id: "settings", label: "Settings", icon: Settings },
];
```

**Features:**
- Highlights active view
- Icon + label for each item
- Click to change view

---

## UI Components

All UI components are from **shadcn/ui** (Radix UI primitives with Tailwind styling).

### Button
**Location:** `dashboard/components/ui/button.tsx`

**Variants:**
- `default`: Primary button
- `outline`: Outlined button
- `ghost`: Transparent button
- `destructive`: Red button for dangerous actions

**Sizes:**
- `sm`: Small
- `default`: Medium
- `lg`: Large

---

### DropdownMenu (NEW)
**Location:** `dashboard/components/ui/dropdown-menu.tsx`

**Components:**
- `DropdownMenu`: Root component
- `DropdownMenuTrigger`: Trigger button
- `DropdownMenuContent`: Content container
- `DropdownMenuItem`: Menu item
- `DropdownMenuLabel`: Label text
- `DropdownMenuSeparator`: Divider

**Usage:**
```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button>Open Menu</Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuLabel>Options</DropdownMenuLabel>
    <DropdownMenuSeparator />
    <DropdownMenuItem onClick={handleClick}>
      Option 1
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

**Used In:**
- Finding status management
- Severity filtering

---

### Card
**Location:** `dashboard/components/ui/card.tsx`

**Components:**
- `Card`: Container
- `CardHeader`: Header section
- `CardTitle`: Title text
- `CardDescription`: Description text
- `CardContent`: Main content
- `CardFooter`: Footer section

---

### Dialog
**Location:** `dashboard/components/ui/dialog.tsx`

**Components:**
- `Dialog`: Root component
- `DialogTrigger`: Trigger button
- `DialogContent`: Content container
- `DialogHeader`: Header section
- `DialogTitle`: Title text
- `DialogDescription`: Description text

**Usage:**
```tsx
<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Title</DialogTitle>
    </DialogHeader>
    {/* Content */}
  </DialogContent>
</Dialog>
```

---

### Table
**Location:** `dashboard/components/ui/table.tsx`

**Components:**
- `Table`: Root table
- `TableHeader`: Header row container
- `TableBody`: Body rows container
- `TableRow`: Single row
- `TableHead`: Header cell
- `TableCell`: Body cell

---

### Input
**Location:** `dashboard/components/ui/input.tsx`

**Props:**
- `type`: Input type (text, number, etc.)
- `placeholder`: Placeholder text
- `value`: Controlled value
- `onChange`: Change handler

---

### Badge
**Location:** `dashboard/components/ui/badge.tsx`

**Variants:**
- `default`: Primary badge
- `secondary`: Secondary badge
- `destructive`: Red badge
- `outline`: Outlined badge

**Usage:**
```tsx
<Badge variant="outline" className="bg-red-500/20 text-red-500">
  Critical
</Badge>
```

**Custom Status Badges:**
```tsx
// Status colors
const getStatusColor = (status) => {
  switch (status) {
    case "New": return "bg-blue-500/20 text-blue-500";
    case "Confirmed": return "bg-red-500/20 text-red-500";
    case "False Positive": return "bg-gray-500/20 text-gray-500";
    case "Fixed": return "bg-green-500/20 text-green-500";
    case "Closed": return "bg-purple-500/20 text-purple-500";
  }
};
```

---

### ScrollArea
**Location:** `dashboard/components/ui/scroll-area.tsx`

**Purpose:** Scrollable container with custom scrollbar.

**Usage:**
```tsx
<ScrollArea className="h-[200px]">
  <pre>{JSON.stringify(data, null, 2)}</pre>
</ScrollArea>
```

---

### Tabs
**Location:** `dashboard/components/ui/tabs.tsx`

**Components:**
- `Tabs`: Root component
- `TabsList`: Tab buttons container
- `TabsTrigger`: Single tab button
- `TabsContent`: Tab panel content

**Usage:**
```tsx
<Tabs defaultValue="tab1">
  <TabsList>
    <TabsTrigger value="tab1">Tab 1</TabsTrigger>
    <TabsTrigger value="tab2">Tab 2</TabsTrigger>
  </TabsList>
  <TabsContent value="tab1">Content 1</TabsContent>
  <TabsContent value="tab2">Content 2</TabsContent>
</Tabs>
```

---

## Component Interaction Flow

### Scan Flow
```
DashboardClient
  ↓
ScanWizard (user configures scan)
  ↓
POST /api/scan
  ↓ (Database: INSERT INTO scans)
DashboardClient.startScan(scanId)
  ↓
Switch to Activity Monitor
  ↓
LiveConsole (displays scan from database)
  ↓
Poll /api/scan every 2s
  ↓ (Database: SELECT FROM scans)
Real-time status updates
  ↓
Scan completes
  ↓ (Database: INSERT INTO findings, UPDATE scans)
Cache invalidation
```

### Finding Status Update Flow
```
FindingsTable (user clicks status badge)
  ↓
Dropdown menu opens
  ↓
User selects new status
  ↓
PATCH /api/findings
  ↓ (Database: UPDATE findings SET status = ?)
Cache invalidation
  ↓
fetchFindings() (refresh list)
  ↓
Updated table with new status badge
```

### Finding Deletion Flow
```
FindingsTable (user clicks delete)
  ↓
Confirmation dialog
  ↓
DELETE /api/findings
  ↓ (Database: DELETE FROM findings WHERE id = ?)
Cache invalidation
  ↓
fetchFindings() (refresh list)
  ↓
Updated table
```

### Severity Filtering Flow
```
FindingsTable (user clicks filter button)
  ↓
Dropdown menu with checkboxes
  ↓
User toggles severity checkboxes
  ↓
toggleSeverityFilter(severity)
  ↓
Update severityFilters state
  ↓
filteredFindings computed
  ↓
Table re-renders with filtered data
```

### Template Run Flow
```
TemplateList (user clicks "Run")
  ↓
DashboardClient.setSelectedTemplate(path)
  ↓
Switch to Scan view
  ↓
ScanWizard (pre-filled with -t "<path>")
  ↓
User clicks "Run"
  ↓
Scan starts
```

---

## Styling Conventions

### Tailwind Classes
- Background: `bg-card`, `bg-muted`, `bg-background`
- Text: `text-foreground`, `text-muted-foreground`
- Borders: `border-border`
- Spacing: `p-4`, `m-2`, `gap-2`

### Color Scheme
- Primary: Emerald (`emerald-500`, `emerald-600`)
- Destructive: Red (`red-500`)
- Severity Colors:
  - Critical: Red (`red-500`)
  - High: Orange (`orange-500`)
  - Medium: Yellow (`yellow-500`)
  - Low: Blue (`blue-500`)
  - Info: Zinc (`zinc-500`)
- Status Colors:
  - New: Blue (`blue-500`)
  - Confirmed: Red (`red-500`)
  - False Positive: Gray (`gray-500`)
  - Fixed: Green (`green-500`)
  - Closed: Purple (`purple-500`)

### Typography
- Font: Geist Sans (default), Geist Mono (code)
- Sizes: `text-xs`, `text-sm`, `text-base`, `text-lg`

---

## State Management

### Local State (useState)
- Component-specific state
- Form inputs
- Loading states
- Filter selections

### Props Drilling
- `activeView` passed from DashboardClient to Sidebar
- `onScanStart` callback from DashboardClient to ScanWizard
- `refreshTrigger` from DashboardClient to TemplateList

### localStorage
- Settings persistence
- No global state library (Redux, Zustand, etc.)

### Database State
- Scans and findings persisted in SQLite
- Accessed via API endpoints
- Cached responses for performance

---

## Performance Optimizations

### Polling
- LiveConsole polls every 2 seconds
- Consider WebSocket for production

### Caching
- History API: 30-second cache
- Findings API: 20-second cache
- Automatic invalidation on mutations

### Database Indexes
- Optimized queries for common operations
- Fast filtering and sorting

### Memoization
- Not currently implemented
- Consider `useMemo` for expensive computations

### Lazy Loading
- Not currently implemented
- Consider code splitting for large components

---

## New Component Features Summary

### ✅ Stats.tsx
- Severity breakdown cards
- Real-time finding counts
- Color-coded visual indicators

### ✅ LiveConsole.tsx
- Database-backed scan list
- Last 20 scans displayed
- Duration and exit code display
- Template filter display (tags/severity)

### ✅ FindingsTable.tsx
- Status management with dropdown
- Multi-select severity filtering
- Database ID tracking
- Status color coding

### ✅ History.tsx
- Delete functionality
- Database metadata
- File size display

### ✅ ScanWizard.tsx
- Full Scan preset added
- 7 total presets

---

For API details, see [API_REFERENCE.md](./API_REFERENCE.md)  
For architecture overview, see [ARCHITECTURE.md](./ARCHITECTURE.md)  
For features documentation, see [FEATURES.md](./FEATURES.md)

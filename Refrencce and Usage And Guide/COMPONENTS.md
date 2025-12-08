# Component Documentation

Detailed documentation of all React components in the Nuclei Dashboard.

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
- `overview`: Dashboard statistics
- `scan`: Scan wizard
- `vulnerabilities`: Findings table
- `activity`: Live console
- `history`: Scan history
- `templates`: Template management
- `settings`: Settings panel

---

### Overview.tsx
**Location:** `dashboard/components/dashboard/Overview.tsx`

**Purpose:** Displays dashboard statistics and recent scans.

**Props:**
```typescript
interface Props {
  stats: {
    totalScans: number;
    totalFindings: number;
    severityCounts: {
      critical: number;
      high: number;
      medium: number;
      low: number;
      info: number;
    };
  };
}
```

**Features:**
- Displays total scans and findings
- Shows severity breakdown with color-coded badges
- Lists recent scans

---

## Scan Components

### ScanWizard.tsx
**Location:** `dashboard/components/scan/Wizard.tsx`

**Purpose:** Scan configuration interface with presets and custom args.

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
  - Calls `onScanStart` callback

**Features:**
- Two tabs: "One-Click Presets" and "Custom Command"
- Preset buttons display flags in code badges
- Custom args input for advanced users
- Auto-fills from `initialTemplate` prop

**Presets:**
```typescript
import { PREDEFINED_COMMANDS } from "@/lib/nuclei/presets";
// Each preset has: name, description, flags, config
```

---

### LiveConsole.tsx
**Location:** `dashboard/components/scan/LiveConsole.tsx`

**Purpose:** Real-time scan monitoring with SSE log streaming.

**State:**
```typescript
const [activeScans, setActiveScans] = useState<ScanInfo[]>([]);
const [logs, setLogs] = useState<Map<string, string>>(new Map());
const [loading, setLoading] = useState(false);
```

**Functions:**
- `fetchScans()`: Polls `/api/scan` every 2 seconds
- `fetchLogs(scanId)`: Connects to SSE `/api/stream/[scanId]`
- `stopScan(scanId)`: Sends DELETE to `/api/scan`

**Features:**
- Auto-scrolls to bottom of logs
- Stop button for active scans
- Displays scan config (target, template, custom args)
- Color-coded status badges

---

### History.tsx
**Location:** `dashboard/components/scan/History.tsx`

**Purpose:** Displays completed scans with download options.

**State:**
```typescript
const [history, setHistory] = useState<HistoryItem[]>([]);
const [loading, setLoading] = useState(true);
```

**Functions:**
- `fetchHistory()`: GET `/api/history`
- `downloadFile(file, type)`: Downloads JSON or log file

**Features:**
- Lists scans by timestamp (newest first)
- Shows findings count
- Download buttons for JSON and log files
- Refresh button

---

## Findings Components

### FindingsTable.tsx
**Location:** `dashboard/components/findings/Table.tsx`

**Purpose:** Display and manage vulnerability findings.

**State:**
```typescript
const [findings, setFindings] = useState<Finding[]>([]);
const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);
const [loading, setLoading] = useState(true);
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
  _sourceFile?: string; // For deletion
}
```

**Functions:**
- `fetchFindings()`: GET `/api/findings`
- `rescan(finding)`: POST `/api/scan` with finding's template
- `deleteFinding(finding)`: DELETE `/api/findings`
- `exportData(severity?)`: Generates CSV export
- `getSeverityColor(severity)`: Returns Tailwind classes for severity badge

**Features:**
- Click row → Open detail dialog
- Detail dialog shows:
  - Key info in cards (Template ID, Severity, Matched At, etc.)
  - Full raw JSON in scrollable area
- Delete button (trash icon) in table row
- Rescan button for re-testing
- Export to CSV (all or by severity)

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
  ↓
DashboardClient.startScan(scanId)
  ↓
Switch to Activity Monitor
  ↓
LiveConsole (displays scan)
  ↓
SSE /api/stream/[scanId]
  ↓
Real-time log updates
```

### Finding Deletion Flow
```
FindingsTable (user clicks delete)
  ↓
Confirmation dialog
  ↓
DELETE /api/findings
  ↓
fetchFindings() (refresh list)
  ↓
Updated table
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

### Typography
- Font: Geist Sans (default), Geist Mono (code)
- Sizes: `text-xs`, `text-sm`, `text-base`, `text-lg`

---

## State Management

### Local State (useState)
- Component-specific state
- Form inputs
- Loading states

### Props Drilling
- `activeView` passed from DashboardClient to Sidebar
- `onScanStart` callback from DashboardClient to ScanWizard
- `refreshTrigger` from DashboardClient to TemplateList

### localStorage
- Settings persistence
- No global state library (Redux, Zustand, etc.)

---

## Performance Optimizations

### Polling
- LiveConsole polls every 2 seconds
- Consider WebSocket for production

### Memoization
- Not currently implemented
- Consider `useMemo` for expensive computations

### Lazy Loading
- Not currently implemented
- Consider code splitting for large components

---

For API details, see [API_REFERENCE.md](./API_REFERENCE.md)
For architecture overview, see [ARCHITECTURE.md](./ARCHITECTURE.md)

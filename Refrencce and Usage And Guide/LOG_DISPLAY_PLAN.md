# Real-time Log Display Implementation Plan

## Overview

Plan to implement real-time log viewing for active Nuclei scans. The log files are already created and written to in real-time during scan execution.

## Current Implementation

### Log File Creation
**Location**: `dashboard/app/api/scan/route.ts` (lines 67-78)

```typescript
// Log file path - create it first to avoid ENOENT errors
const logPath = path.join(process.cwd(), "scans", `${scanId}.log`);
fs.writeFileSync(logPath, ''); // Create empty file first
const logStream = fs.createWriteStream(logPath);

child.stdout.on("data", (data) => {
    logStream.write(data);
});

child.stderr.on("data", (data) => {
    logStream.write(data);
});
```

### Log File Details
- **Path**: `scans/{scanId}.log`
- **Created**: Immediately when scan starts (empty file)
- **Updated**: Real-time as Nuclei outputs to stdout/stderr
- **Contains**: All Nuclei console output including progress, findings, errors

## Implementation Options

### ✅ Option 1: Simple Polling API (RECOMMENDED)

**Complexity**: Low  
**Implementation Time**: 10-15 minutes  
**Real-time Delay**: 1-2 seconds

#### Components Needed:

1. **API Endpoint**: `/api/scan/logs`
   ```typescript
   // GET /api/scan/logs?id={scanId}
   // Returns: { logs: string, fileSize: number }
   ```

2. **Frontend Component**: Log Viewer Modal/Drawer
   - Terminal-style display
   - Auto-scroll to bottom
   - Monospace font with syntax highlighting
   - "View Logs" button in Activity Monitor

3. **Polling Logic**:
   - Poll every 2 seconds while scan is running
   - Stop polling when scan completes
   - Auto-scroll to latest output

#### Pros:
- ✅ Simple to implement
- ✅ Works with existing setup
- ✅ No complex streaming infrastructure
- ✅ Easy to debug and maintain

#### Cons:
- ⚠️ Slight delay (1-2 seconds)
- ⚠️ Re-reads entire file each time (acceptable for small logs)

---

### Option 2: Server-Sent Events (SSE)

**Complexity**: Medium  
**Implementation Time**: 30-45 minutes  
**Real-time Delay**: Instant

#### Components Needed:

1. **SSE Endpoint**: `/api/scan/logs/stream`
   - Track file read position
   - Send only new lines
   - Keep connection alive

2. **File Watcher**:
   - Monitor log file for changes
   - Stream new content to client

3. **Frontend SSE Client**:
   - EventSource API
   - Handle reconnection
   - Append new lines

#### Pros:
- ✅ True real-time updates
- ✅ Efficient (only sends new data)
- ✅ Standard HTTP protocol

#### Cons:
- ⚠️ More complex implementation
- ⚠️ Need to track file position per client
- ⚠️ Connection management overhead

---

### Option 3: WebSocket

**Complexity**: High  
**Implementation Time**: 1+ hour  
**Real-time Delay**: Instant

#### Not Recommended Because:
- ❌ Overkill for one-way log streaming
- ❌ Requires WebSocket server setup
- ❌ More complex than needed
- ❌ Next.js API routes don't natively support WebSockets well

---

## Recommended Implementation (Option 1)

### Step 1: Create API Route

**File**: `dashboard/app/api/scan/logs/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const scanId = searchParams.get("id");

    if (!scanId) {
        return NextResponse.json({ error: "Scan ID required" }, { status: 400 });
    }

    const logPath = path.join(process.cwd(), "scans", `${scanId}.log`);

    if (!fs.existsSync(logPath)) {
        return NextResponse.json({ error: "Log file not found" }, { status: 404 });
    }

    try {
        const logs = fs.readFileSync(logPath, "utf-8");
        const stats = fs.statSync(logPath);

        return NextResponse.json({
            logs,
            fileSize: stats.size,
            lastModified: stats.mtime
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
```

### Step 2: Create Log Viewer Component

**File**: `dashboard/components/scan/LogViewer.tsx`

```tsx
"use client";

import { useEffect, useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

interface LogViewerProps {
    scanId: string;
    isRunning: boolean;
    open: boolean;
    onClose: () => void;
}

export function LogViewer({ scanId, isRunning, open, onClose }: LogViewerProps) {
    const [logs, setLogs] = useState("");
    const [loading, setLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    const fetchLogs = async () => {
        try {
            setLoading(true);
            const res = await fetch(`/api/scan/logs?id=${scanId}`);
            const data = await res.json();
            setLogs(data.logs || "No logs available");
            
            // Auto-scroll to bottom
            setTimeout(() => {
                if (scrollRef.current) {
                    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
                }
            }, 100);
        } catch (e) {
            console.error("Failed to fetch logs");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (open) {
            fetchLogs();
            
            // Poll every 2 seconds if scan is running
            if (isRunning) {
                const interval = setInterval(fetchLogs, 2000);
                return () => clearInterval(interval);
            }
        }
    }, [open, isRunning, scanId]);

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl h-[80vh]">
                <DialogHeader>
                    <DialogTitle className="flex items-center justify-between">
                        <span>Scan Logs</span>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={fetchLogs}
                            disabled={loading}
                        >
                            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        </Button>
                    </DialogTitle>
                </DialogHeader>
                <ScrollArea className="h-full" ref={scrollRef}>
                    <pre className="bg-black/90 text-green-400 p-4 rounded-md font-mono text-xs overflow-x-auto">
                        {logs}
                    </pre>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}
```

### Step 3: Add Button to Activity Monitor

**File**: `dashboard/components/scan/LiveConsole.tsx`

Add "View Logs" button next to the Stop/Completed badge:

```tsx
import { FileText } from "lucide-react";

// Add state for log viewer
const [viewingLogs, setViewingLogs] = useState<string | null>(null);

// Add button in the card header
<div className="flex gap-2">
    <Button
        variant="outline"
        size="sm"
        onClick={() => setViewingLogs(scan.id)}
    >
        <FileText className="mr-2 h-3 w-3" /> View Logs
    </Button>
    {isRunning ? (
        <Button variant="destructive" size="sm" onClick={() => stopScan(scan.id)}>
            <Square className="mr-2 h-3 w-3 fill-current" /> Stop
        </Button>
    ) : (
        <Badge className="bg-green-600">✓ Completed</Badge>
    )}
</div>

// Add LogViewer component at the end
{viewingLogs && (
    <LogViewer
        scanId={viewingLogs}
        isRunning={activeScans.find(s => s.id === viewingLogs)?.status === 'running'}
        open={!!viewingLogs}
        onClose={() => setViewingLogs(null)}
    />
)}
```

## UI/UX Features

### Terminal-Style Display
- Black/dark background
- Green monospace text (classic terminal look)
- Auto-scroll to bottom
- Horizontal scroll for long lines

### Controls
- Manual refresh button
- Auto-refresh toggle (for completed scans)
- Copy to clipboard button
- Download log file button

### Visual Indicators
- Loading spinner during fetch
- "Live" badge when auto-refreshing
- File size and last updated timestamp

## Performance Considerations

### File Size Limits
- Monitor log file size
- If > 1MB, show warning
- Option to tail last N lines only
- Pagination for very large logs

### Polling Strategy
- 2 seconds for running scans
- Stop polling when scan completes
- Resume on manual refresh

### Memory Management
- Don't store logs in state if too large
- Stream directly to DOM
- Clear logs when modal closes

## Future Enhancements

1. **Syntax Highlighting**: Color-code different log levels (INFO, WARN, ERROR)
2. **Search/Filter**: Search within logs, filter by severity
3. **Line Numbers**: Add line numbers for reference
4. **Tail Mode**: Show only last N lines for performance
5. **Export**: Download logs as .txt or .log file
6. **Split View**: Show logs and findings side-by-side

## Testing Checklist

- [ ] Log viewer opens correctly
- [ ] Logs display in real-time during scan
- [ ] Auto-scroll works properly
- [ ] Manual refresh works
- [ ] Polling stops when scan completes
- [ ] Works for completed scans
- [ ] Error handling for missing logs
- [ ] Performance with large log files
- [ ] Mobile responsive design

## Estimated Timeline

- API Route: 5 minutes
- Log Viewer Component: 10 minutes
- Integration with Activity Monitor: 5 minutes
- Testing & Polish: 10 minutes

**Total: ~30 minutes**

## Status

📋 **PLANNED** - Ready to implement when needed

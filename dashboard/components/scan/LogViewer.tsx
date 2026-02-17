"use client";

import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    RefreshCw, Download, Copy, Check,
    Search, ChevronUp, ChevronDown, X,
    ArrowLeft, Menu,
    LayoutDashboard, ShieldAlert, Play, Activity,
    FileCode, Settings, History, Network, Database, Zap,
} from "lucide-react";
import { toast } from "sonner";
import { ansiToHtml, stripAnsiCodes } from "@/lib/ansi";

// ─── Sidebar Nav Items ──────────────────────────────────

const NAV_ITEMS = [
    { id: "overview", label: "Dashboard", icon: LayoutDashboard },
    { id: "vulnerabilities", label: "Vulnerabilities", icon: ShieldAlert },
    { id: "scan", label: "New Operation", icon: Play },
    { id: "activity", label: "Activity Monitor", icon: Activity },
    { id: "history", label: "Scan History", icon: History },
    { id: "templates", label: "Templates", icon: FileCode },
    { id: "subfinder", label: "Subfinder", icon: Network },
    { id: "httpx", label: "Live Assets", icon: Activity },
    { id: "automation", label: "Automation", icon: Zap },
    { id: "backup", label: "Backup & Restore", icon: Database },
    { id: "system", label: "System", icon: Settings },
];

// ─── Types ──────────────────────────────────────────────

interface LogViewerProps {
    scanId: string;
    isRunning: boolean;
    open: boolean;
    onClose: () => void;
    onNavigate?: (view: string) => void;
}

type Severity = "critical" | "high" | "medium" | "low" | "info" | "other";

interface LogLine {
    number: number;
    plain: string;
    html: string;
    severity: Severity;
}

// ─── Constants ──────────────────────────────────────────

const SEVERITY_BORDER: Record<Severity, string> = {
    critical: "#ef4444",
    high: "#f97316",
    medium: "#eab308",
    low: "#3b82f6",
    info: "#6b7280",
    other: "transparent",
};

const SEVERITY_BG: Record<Severity, string> = {
    critical: "rgba(239,68,68,0.07)",
    high: "rgba(249,115,22,0.05)",
    medium: "transparent",
    low: "transparent",
    info: "transparent",
    other: "transparent",
};

const SEVERITY_CHIP_COLORS: Record<Severity, { active: string; text: string }> = {
    critical: { active: "#ef4444", text: "#ffffff" },
    high: { active: "#f97316", text: "#ffffff" },
    medium: { active: "#eab308", text: "#1a1a1a" },
    low: { active: "#3b82f6", text: "#ffffff" },
    info: { active: "#6b7280", text: "#ffffff" },
    other: { active: "#374151", text: "#ffffff" },
};

// ─── Helpers ────────────────────────────────────────────

function detectSeverity(line: string): Severity {
    const lower = line.toLowerCase();
    if (/\[critical\]/.test(lower)) return "critical";
    if (/\[high\]/.test(lower)) return "high";
    if (/\[medium\]/.test(lower)) return "medium";
    if (/\[low\]/.test(lower)) return "low";
    if (/\[info\]/.test(lower)) return "info";
    return "other";
}

function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Highlight search matches inside already-converted HTML (only in text nodes, not tags) */
function highlightSearch(html: string, query: string): string {
    if (!query) return html;
    const parts = html.split(/(<[^>]*>)/);
    const pattern = new RegExp(`(${escapeRegex(query)})`, "gi");
    return parts
        .map((part) => {
            if (part.startsWith("<")) return part; // HTML tag — skip
            return part.replace(
                pattern,
                '<mark style="background:rgba(234,179,8,0.35);color:inherit;border-radius:2px;">$1</mark>'
            );
        })
        .join("");
}

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Component ──────────────────────────────────────────

export function LogViewer({ scanId, isRunning, open, onClose, onNavigate }: LogViewerProps) {
    // Core state
    const [rawLogs, setRawLogs] = useState("");
    const [loading, setLoading] = useState(false);
    const [fileSize, setFileSize] = useState(0);
    const [lastModified, setLastModified] = useState("");
    const [copied, setCopied] = useState(false);

    // Search state
    const [searchOpen, setSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Sidebar nav state
    const [sidebarOpen, setSidebarOpen] = useState(false);



    // Severity filter state
    const [severityFilters, setSeverityFilters] = useState<Record<Severity, boolean>>({
        critical: true,
        high: true,
        medium: true,
        low: true,
        info: true,
        other: true,
    });

    // Refs
    const scrollRef = useRef<HTMLDivElement>(null);
    const lineRefs = useRef<Map<number, HTMLDivElement>>(new Map());

    // ─── Derived data ───────────────────────────────────

    const lines: LogLine[] = useMemo(() => {
        if (!rawLogs) return [];
        return rawLogs.split("\n").map((raw, i) => {
            const plain = stripAnsiCodes(raw);
            return {
                number: i + 1,
                plain,
                html: ansiToHtml(raw),
                severity: detectSeverity(plain),
            };
        });
    }, [rawLogs]);

    const severityCounts = useMemo(() => {
        const counts: Record<Severity, number> = {
            critical: 0, high: 0, medium: 0, low: 0, info: 0, other: 0,
        };
        lines.forEach((l) => counts[l.severity]++);
        return counts;
    }, [lines]);

    const hasFindingLines = useMemo(() => {
        return (
            severityCounts.critical +
            severityCounts.high +
            severityCounts.medium +
            severityCounts.low +
            severityCounts.info
        ) > 0;
    }, [severityCounts]);

    const filteredLines = useMemo(() => {
        return lines.filter((line) => severityFilters[line.severity]);
    }, [lines, severityFilters]);

    const matchingIndices = useMemo(() => {
        if (!searchQuery.trim()) return [];
        const q = searchQuery.toLowerCase();
        return filteredLines
            .map((line, idx) => (line.plain.toLowerCase().includes(q) ? idx : -1))
            .filter((idx) => idx !== -1);
    }, [filteredLines, searchQuery]);

    // Reset match index when query or results change
    useEffect(() => {
        setCurrentMatchIndex(0);
    }, [searchQuery, matchingIndices.length]);

    // ─── Data fetching ──────────────────────────────────

    const fetchLogs = async () => {
        try {
            setLoading(true);
            const res = await fetch(`/api/scan/logs?id=${scanId}`);
            if (!res.ok) {
                const error = await res.json();
                setRawLogs(`Error: ${error.error || "Failed to load logs"}`);
                return;
            }
            const data = await res.json();
            setRawLogs(data.logs || "No logs available yet...");
            setFileSize(data.fileSize || 0);
            setLastModified(data.lastModified || "");

            // Auto-scroll to bottom
            setTimeout(() => {
                if (scrollRef.current) {
                    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
                }
            }, 100);
        } catch {
            setRawLogs("Error: Failed to fetch logs");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (open) {
            fetchLogs();
            if (isRunning) {
                const interval = setInterval(fetchLogs, 2000);
                return () => clearInterval(interval);
            }
        }
    }, [open, isRunning, scanId]);

    // ─── Actions ────────────────────────────────────────

    const downloadLogs = useCallback(() => {
        const plainText = lines.map((l) => l.plain).join("\n");
        const blob = new Blob([plainText], { type: "text/plain" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `scan_${scanId}_logs.txt`;
        a.click();
        window.URL.revokeObjectURL(url);
        toast.success("Logs downloaded");
    }, [lines, scanId]);

    const copyToClipboard = useCallback(async () => {
        try {
            const plainText = lines.map((l) => l.plain).join("\n");
            await navigator.clipboard.writeText(plainText);
            setCopied(true);
            toast.success("Logs copied to clipboard");
            setTimeout(() => setCopied(false), 2000);
        } catch {
            toast.error("Failed to copy logs");
        }
    }, [lines]);

    // ─── Search navigation ──────────────────────────────

    const setLineRef = useCallback((idx: number, el: HTMLDivElement | null) => {
        if (el) lineRefs.current.set(idx, el);
        else lineRefs.current.delete(idx);
    }, []);

    const goToMatch = useCallback(
        (index: number) => {
            if (matchingIndices.length === 0) return;
            const wrapped =
                ((index % matchingIndices.length) + matchingIndices.length) %
                matchingIndices.length;
            setCurrentMatchIndex(wrapped);
            const lineIdx = matchingIndices[wrapped];
            const el = lineRefs.current.get(lineIdx);
            if (el) {
                el.scrollIntoView({ behavior: "smooth", block: "center" });
            }
        },
        [matchingIndices]
    );

    const nextMatch = useCallback(
        () => goToMatch(currentMatchIndex + 1),
        [currentMatchIndex, goToMatch]
    );
    const prevMatch = useCallback(
        () => goToMatch(currentMatchIndex - 1),
        [currentMatchIndex, goToMatch]
    );

    // ─── Keyboard shortcuts ─────────────────────────────

    useEffect(() => {
        if (!open) return;
        const handler = (e: KeyboardEvent) => {
            const isInputFocused = () => {
                const tag = document.activeElement?.tagName.toLowerCase();
                return tag === "input" || tag === "textarea";
            };

            // Ctrl/Cmd combos
            if (e.ctrlKey || e.metaKey) {
                if (e.key === "f") {
                    e.preventDefault();
                    setSearchOpen(true);
                    setTimeout(() => searchInputRef.current?.focus(), 50);
                    return;
                }
                if (e.key === "c" && !window.getSelection()?.toString()) {
                    e.preventDefault();
                    copyToClipboard();
                    return;
                }
                if (e.key === "S" && e.shiftKey) {
                    e.preventDefault();
                    downloadLogs();
                    return;
                }
            }

            // Escape: close search first, then close viewer
            if (e.key === "Escape") {
                if (sidebarOpen) {
                    e.preventDefault();
                    setSidebarOpen(false);
                } else if (searchOpen) {
                    e.preventDefault();
                    setSearchOpen(false);
                    setSearchQuery("");
                } else {
                    e.preventDefault();
                    onClose();
                }
                return;
            }

            // Enter: search navigation
            if (e.key === "Enter" && searchOpen && matchingIndices.length > 0) {
                e.preventDefault();
                if (e.shiftKey) prevMatch();
                else nextMatch();
                return;
            }

            // Don't handle single-key shortcuts when typing
            if (isInputFocused()) return;

            // Home: jump to top
            if (e.key === "Home") {
                e.preventDefault();
                const viewport = scrollRef.current?.querySelector("[data-radix-scroll-area-viewport]");
                if (viewport) viewport.scrollTop = 0;
                return;
            }

            // End: jump to bottom
            if (e.key === "End") {
                e.preventDefault();
                const viewport = scrollRef.current?.querySelector("[data-radix-scroll-area-viewport]");
                if (viewport) viewport.scrollTop = viewport.scrollHeight;
                return;
            }

            // m: toggle sidebar menu
            if (e.key === "m") {
                e.preventDefault();
                setSidebarOpen((prev) => !prev);
                return;
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [open, searchOpen, sidebarOpen, matchingIndices.length, nextMatch, prevMatch, onClose, copyToClipboard, downloadLogs]);

    // ─── Severity filter toggle ─────────────────────────

    const toggleSeverity = (sev: Severity) => {
        setSeverityFilters((prev) => ({ ...prev, [sev]: !prev[sev] }));
    };

    // ─── Line HTML with optional search highlighting ────

    const getLineHtml = (line: LogLine, idx: number): string => {
        if (searchQuery && matchingIndices.includes(idx)) {
            return highlightSearch(line.html, searchQuery);
        }
        return line.html;
    };

    const isError = rawLogs.startsWith("Error:");

    // ─── Render ─────────────────────────────────────────

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent
                className="flex flex-col p-6"
                style={{
                    maxWidth: "100vw",
                    width: "100vw",
                    height: "100vh",
                    borderRadius: "0px",
                }}
            >
                {/* Slide-out sidebar navigation */}
                {sidebarOpen && (
                    <>
                        {/* Backdrop */}
                        <div
                            className="fixed inset-0 bg-black/40 z-40"
                            style={{ transition: "opacity 200ms ease" }}
                            onClick={() => setSidebarOpen(false)}
                        />
                        {/* Sidebar panel */}
                        <div
                            className="fixed left-0 top-0 h-full w-64 bg-sidebar border-r border-sidebar-border z-50 shadow-xl"
                            style={{
                                animation: "slideInLeft 200ms ease forwards",
                            }}
                        >
                            <div className="p-4 space-y-1">
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-lg font-semibold">
                                        Nuclei <span className="text-emerald-500">CC</span>
                                    </h2>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setSidebarOpen(false)}
                                        className="h-8 w-8 p-0"
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                                {NAV_ITEMS.map((item) => (
                                    <Button
                                        key={item.id}
                                        variant={item.id === "activity" ? "secondary" : "ghost"}
                                        className={`w-full justify-start ${item.id === "activity"
                                            ? "bg-emerald-900/20 text-emerald-600 hover:bg-emerald-900/30"
                                            : "text-foreground hover:bg-muted"
                                            }`}
                                        onClick={() => {
                                            setSidebarOpen(false);
                                            if (onNavigate) {
                                                onClose();
                                                onNavigate(item.id);
                                            } else if (item.id !== "activity") {
                                                onClose();
                                            }
                                        }}
                                    >
                                        <item.icon className="mr-2 h-4 w-4" />
                                        {item.label}
                                    </Button>
                                ))}
                            </div>
                        </div>
                        <style>{`
                            @keyframes slideInLeft {
                                from { transform: translateX(-100%); }
                                to { transform: translateX(0); }
                            }
                        `}</style>
                    </>
                )}

                <DialogHeader>
                    {/* Title row */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSidebarOpen(true)}
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                                title="Navigation menu"
                            >
                                <Menu className="h-5 w-5" />
                            </Button>
                            <div className="h-5 w-px bg-border" />
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={onClose}
                                className="gap-1.5 text-muted-foreground hover:text-foreground"
                            >
                                <ArrowLeft className="h-4 w-4" />
                                Back
                            </Button>
                            <div className="h-5 w-px bg-border" />
                            <div>
                                <DialogTitle className="flex items-center gap-2">
                                    <span>Scan Logs</span>
                                    {isRunning && (
                                        <span className="flex items-center gap-1 text-xs font-normal text-emerald-500">
                                            <span className="relative flex h-2 w-2">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                                            </span>
                                            Live
                                        </span>
                                    )}
                                </DialogTitle>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {fileSize > 0 && `${formatFileSize(fileSize)} • `}
                                    {lastModified &&
                                        `Updated: ${new Date(lastModified).toLocaleTimeString()}`}
                                    {filteredLines.length !== lines.length &&
                                        ` • Showing ${filteredLines.length} of ${lines.length} lines`}
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-1.5">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    setSearchOpen(!searchOpen);
                                    if (!searchOpen)
                                        setTimeout(() => searchInputRef.current?.focus(), 50);
                                }}
                                title="Search (Ctrl+F)"
                            >
                                <Search className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={copyToClipboard}
                                disabled={isError || !rawLogs}
                            >
                                {copied ? (
                                    <Check className="h-4 w-4" />
                                ) : (
                                    <Copy className="h-4 w-4" />
                                )}
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={downloadLogs}
                                disabled={isError || !rawLogs}
                            >
                                <Download className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={fetchLogs}
                                disabled={loading}
                            >
                                <RefreshCw
                                    className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                                />
                            </Button>
                        </div>
                    </div>

                    {/* Search bar */}
                    {searchOpen && (
                        <div className="flex items-center gap-2 mt-3 px-1">
                            <div className="relative flex-1">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                <Input
                                    ref={searchInputRef}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search in logs..."
                                    className="pl-8 h-8 text-sm"
                                />
                            </div>
                            {searchQuery && (
                                <span className="text-xs text-muted-foreground whitespace-nowrap min-w-16 text-center">
                                    {matchingIndices.length > 0
                                        ? `${currentMatchIndex + 1} / ${matchingIndices.length}`
                                        : "No results"}
                                </span>
                            )}
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={prevMatch}
                                disabled={matchingIndices.length === 0}
                                className="h-8 w-8 p-0"
                                title="Previous (Shift+Enter)"
                            >
                                <ChevronUp className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={nextMatch}
                                disabled={matchingIndices.length === 0}
                                className="h-8 w-8 p-0"
                                title="Next (Enter)"
                            >
                                <ChevronDown className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    setSearchOpen(false);
                                    setSearchQuery("");
                                }}
                                className="h-8 w-8 p-0"
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    )}

                    {/* Severity filter chips */}
                    {hasFindingLines && (
                        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                            <span className="text-xs text-muted-foreground mr-1">Filter:</span>
                            {(
                                ["critical", "high", "medium", "low", "info"] as Severity[]
                            ).map((sev) => {
                                if (severityCounts[sev] === 0) return null;
                                const isActive = severityFilters[sev];
                                const colors = SEVERITY_CHIP_COLORS[sev];
                                return (
                                    <button
                                        key={sev}
                                        onClick={() => toggleSeverity(sev)}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-all cursor-pointer border"
                                        style={{
                                            backgroundColor: isActive
                                                ? colors.active
                                                : "transparent",
                                            color: isActive
                                                ? colors.text
                                                : "var(--muted-foreground)",
                                            borderColor: isActive
                                                ? colors.active
                                                : "var(--border)",
                                            opacity: isActive ? 1 : 0.5,
                                        }}
                                    >
                                        {sev}
                                        <span
                                            style={{
                                                opacity: 0.8,
                                                fontSize: "0.65rem",
                                            }}
                                        >
                                            {severityCounts[sev]}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </DialogHeader>

                {/* Log content */}
                <div
                    className="flex-1 mt-2 overflow-hidden rounded-lg border border-border"
                    style={{ backgroundColor: "#1a1b26" }}
                >
                    <ScrollArea className="h-full w-full" ref={scrollRef}>
                        <div className="font-mono text-xs leading-5">
                            {filteredLines.length === 0 && !loading && (
                                <div className="flex items-center justify-center h-32 text-gray-500">
                                    {rawLogs
                                        ? "No lines match the current filter."
                                        : "Loading logs..."}
                                </div>
                            )}
                            {filteredLines.map((line, idx) => {
                                const isMatch = matchingIndices.includes(idx);
                                const isCurrent =
                                    isMatch &&
                                    matchingIndices[currentMatchIndex] === idx;

                                return (
                                    <div
                                        key={line.number}
                                        ref={(el) => setLineRef(idx, el)}
                                        className="flex hover:bg-white/3 transition-colors"
                                        style={{
                                            borderLeft: `3px solid ${SEVERITY_BORDER[line.severity]}`,
                                            backgroundColor: isCurrent
                                                ? "rgba(234,179,8,0.15)"
                                                : isMatch
                                                    ? "rgba(234,179,8,0.06)"
                                                    : SEVERITY_BG[line.severity],
                                        }}
                                    >
                                        {/* Line number */}
                                        <span
                                            className="select-none text-right shrink-0 pr-3 pl-2"
                                            style={{
                                                color: "#4a5568",
                                                minWidth: "3.5rem",
                                                borderRight: "1px solid rgba(255,255,255,0.06)",
                                            }}
                                        >
                                            {line.number}
                                        </span>

                                        {/* Line content */}
                                        <span
                                            className="flex-1 pl-3 pr-4 whitespace-pre-wrap break-all"
                                            style={{ color: "#a9b1d6" }}
                                            dangerouslySetInnerHTML={{
                                                __html: getLineHtml(line, idx) || "&nbsp;",
                                            }}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    </ScrollArea>
                </div>
            </DialogContent>
        </Dialog>
    );
}

"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Play, Activity, List, StopCircle, Terminal, Globe, RefreshCw, Trash2, ChevronRight, Download, Copy, Folder, ArrowLeft, Upload, Plus, Target } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { TargetListManager } from "../scan/TargetListManager";
import { Zap, FileText } from "lucide-react";


interface HttpxResult {
    id: string;
    url: string;
    status_code: number;
    title?: string | string[];
    technologies?: string | string[]; // JSON string or array
    web_server?: string | string[];
    response_time?: string;
    change_status?: 'new' | 'old' | 'changed';
    screenshot_path?: string;
    host?: string | string[];
    port?: string | string[];
    ip?: string | string[];
    cname?: string | string[]; // JSON or string
    cdn_name?: string | string[];
    content_length?: number;
    content_type?: string | string[];
}

interface HttpxScan {
    id: string;
    target: string;
    status: 'running' | 'completed' | 'failed' | 'stopped';
    count: number;
    start_time: number;
    pid?: number;
}

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// ... imports

// Helper to format tech stack
const renderTech = (techString?: string | string[], webServer?: string | string[]) => {
    let techs: string[] = [];
    try {
        if (Array.isArray(techString)) {
            techs = techString;
        } else {
            techs = techString ? JSON.parse(techString) : [];
        }
    } catch { techs = []; }

    // Normalize webServer to string for comparison
    const webServerStr = Array.isArray(webServer) ? webServer[0] : webServer;

    if (webServerStr && !techs.includes(webServerStr)) {
        techs.unshift(webServerStr);
    }

    if (techs.length === 0) return <span className="text-xs text-muted-foreground/50 italic">No Tech Detected</span>;

    return techs.map((t, i) => (
        <Badge key={i} variant="secondary" className="text-[10px] px-1.5 h-5 bg-secondary/50 text-secondary-foreground hover:bg-secondary">
            {t}
        </Badge>
    ));
};

// Safe rendering helper to prevent React #300 errors (Objects as children)
const renderSafeString = (value: any): string => {
    if (!value) return "";
    if (typeof value === 'string') {
        // Check if it's a JSON array string like '["a","b"]'
        if (value.startsWith('[') && value.endsWith(']')) {
            try {
                const parsed = JSON.parse(value);
                if (Array.isArray(parsed)) return parsed.join(', ');
            } catch { /* ignore parse error, return raw string */ }
        }
        return value;
    }
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
};

// Helper: Get raw string for processing (handles string vs array)
const getString = (val?: string | string[]): string => {
    if (!val) return "";
    if (Array.isArray(val)) return val.join(", ");
    return val;
};

interface HttpxAssetCardProps {
    data: HttpxResult;
    onClick: () => void;
    onScanTarget?: (target: string) => void;
    style?: React.CSSProperties;
}

const HttpxAssetCard = ({ data: r, onClick, onScanTarget, style }: HttpxAssetCardProps) => {
    return (
        <div style={style} className="px-4 pb-2">
            <div onClick={onClick} className="cursor-pointer h-full">
                <Card className={cn(
                    "bg-card text-card-foreground shadow-sm h-full border transition-all hover:bg-muted/10 active:scale-[0.99] duration-200 group",
                    r.change_status === 'new' ? "border-emerald-500/50 shadow-emerald-500/5" :
                        r.change_status === 'changed' ? "border-amber-500/50 shadow-amber-500/5" :
                            "border-white/10"
                )}>
                    <CardContent className="p-3">
                        <div className="flex flex-col gap-2">
                            {/* Top Row: URL, Status, Actions */}
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1 flex flex-col gap-0.5">
                                    <div className="flex items-center gap-2">
                                        <a href={r.url} target="_blank" onClick={(e) => e.stopPropagation()} className="font-bold text-blue-400 hover:text-blue-300 hover:underline truncate text-sm leading-tight" title={r.url}>
                                            {r.url}
                                        </a>
                                        <div className="flex shrink-0 items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-foreground" onClick={(e) => {
                                                e.stopPropagation();
                                                navigator.clipboard.writeText(r.url);
                                                toast.success("Copied to clipboard");
                                            }}>
                                                <Copy className="h-3 w-3" />
                                            </Button>
                                            {onScanTarget && (
                                                <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-emerald-500" onClick={(e) => {
                                                    e.stopPropagation();
                                                    onScanTarget(r.url);
                                                }} title="Start Nuclei Scan">
                                                    <Target className="h-3 w-3" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-xs text-muted-foreground truncate" title={getString(r.title) || "No Title"}>
                                        {renderSafeString(r.title) || <span className="italic opacity-50">No Title</span>}
                                    </div>
                                </div>

                                <div className="flex flex-col items-end gap-1 shrink-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
                                            {r.response_time || "0ms"}
                                        </span>
                                        <Badge variant="outline" className={cn(
                                            "text-[10px] px-1.5 h-5 font-mono font-bold",
                                            r.status_code >= 200 && r.status_code < 300 ? "text-emerald-500 border-emerald-500/30 bg-emerald-500/10" :
                                                r.status_code >= 300 && r.status_code < 400 ? "text-amber-500 border-amber-500/30 bg-amber-500/10" :
                                                    "text-red-500 border-red-500/30 bg-red-500/10"
                                        )}>{r.status_code}</Badge>
                                    </div>

                                    {/* Change Status Badges */}
                                    {(r.change_status === 'new' || r.change_status === 'changed') && (
                                        <div className="flex gap-1">
                                            {r.change_status === 'new' && <Badge className="text-[9px] px-1 h-4 bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 pointer-events-none">NEW</Badge>}
                                            {r.change_status === 'changed' && <Badge className="text-[9px] px-1 h-4 bg-amber-500/20 text-amber-500 border border-amber-500/30 pointer-events-none">MOD</Badge>}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Tech Stack Row */}
                            <div className="flex flex-wrap gap-1 mt-1">
                                {renderTech(r.technologies, r.web_server)}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export function HttpxPanel({ onScanTarget }: { onScanTarget?: (target: string) => void }) {
    const [scans, setScans] = useState<HttpxScan[]>([]);
    const [selectedScanId, setSelectedScanId] = useState<string | null>(null);
    const [results, setResults] = useState<HttpxResult[]>([]);
    const [selectedAsset, setSelectedAsset] = useState<HttpxResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState("scanner");
    const [domainSummary, setDomainSummary] = useState<{ domain: string; count: number }[]>([]);
    const [selectedDomain, setSelectedDomain] = useState<string | null>(null);

    // Scanner Inputs
    const [targetDomain, setTargetDomain] = useState("");
    const [targetMode, setTargetMode] = useState<'url' | 'list'>('url');
    const [customFlags, setCustomFlags] = useState("-sc -title -tech-detect");
    const [runningScanId, setRunningScanId] = useState<string | null>(null);

    const PRESETS = [
        { name: "Fast Probe", flags: "-sc -title", description: "Status & Title only (Fast)" },
        { name: "Tech Detect", flags: "-tech-detect -cdn", description: "Identify technologies & CDN" },
        { name: "Full Recon", flags: "-sc -title -tech-detect -ip -cname -location", description: "Complete asset enrichment" },
    ];

    // Filters
    const [filterDomain, setFilterDomain] = useState("");
    const [filterCode, setFilterCode] = useState<string[]>([]); // Multi-select for codes
    const [filterChangeStatus, setFilterChangeStatus] = useState<string[]>([]); // Empty = All
    const [filterTech, setFilterTech] = useState<string[]>([]); // Tech stack filter



    // Delete Dialog State
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [scanToDelete, setScanToDelete] = useState<string | null>(null);
    const [isDeletingAll, setIsDeletingAll] = useState(false);

    // Fetch scans list
    const fetchScans = async () => {
        try {
            const res = await fetch("/api/httpx");
            if (res.ok) {
                const data = await res.json();
                setScans(data);
                // Find running scan
                const running = data.find((s: HttpxScan) => s.status === 'running');
                if (running) setRunningScanId(running.id);
                else setRunningScanId(null);
            }
        } catch (e) { console.error(e); }
    };

    useEffect(() => {
        fetchScans();
        const interval = setInterval(fetchScans, 3000);
        return () => clearInterval(interval);
    }, []);

    // Fetch results for selected scan OR all results
    useEffect(() => {
        async function fetchResults() {
            setLoading(true);
            try {
                let url = "/api/httpx?view=all";
                if (selectedScanId) {
                    url = `/api/httpx?id=${selectedScanId}`;
                }
                const res = await fetch(url);
                if (res.ok) {
                    const data = await res.json();
                    setResults(data);
                }
            } catch (e) { } finally { setLoading(false); }
        }
        fetchResults();
    }, [selectedScanId]);

    // Fetch domains for global view
    useEffect(() => {
        if (activeTab === 'results' && !selectedScanId && !selectedDomain) {
            fetch("/api/httpx?view=domains")
                .then(res => res.json())
                .then(data => setDomainSummary(Array.isArray(data) ? data : []))
                .catch(console.error);
        }
    }, [activeTab, selectedScanId, selectedDomain]);

    // Extract unique technologies for filter dropdown (must be before early return)
    const uniqueTechs = useMemo(() => {
        const techSet = new Set<string>();
        results.forEach(r => {
            try {
                const techs = JSON.parse(getString(r.technologies) || "[]");
                if (Array.isArray(techs)) {
                    techs.forEach((t: string) => techSet.add(t));
                }
            } catch { }
            // Also add web_server if present
            if (r.web_server) {
                const ws = getString(r.web_server);
                techSet.add(ws);
            }
        });
        return Array.from(techSet).sort();
    }, [results]);

    // Full Screen Detail View
    if (selectedAsset) {
        return (
            <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-2 duration-200">
                <div className="flex items-center gap-2 mb-4 pb-2 border-b">
                    <Button variant="ghost" size="sm" onClick={() => setSelectedAsset(null)} className="gap-2">
                        <ArrowLeft className="h-4 w-4" />
                        Back to Assets
                    </Button>
                    <div className="h-4 w-px bg-border mx-2" />
                    <h2 className="text-lg font-semibold truncate flex-1">{selectedAsset.url}</h2>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => window.open(selectedAsset.url, '_blank')}>
                            Open <Globe className="h-3 w-3 ml-2" />
                        </Button>
                    </div>
                </div>

                <ScrollArea className="flex-1">
                    <div className="space-y-6 pb-20 pr-4">
                        {/* Header Stats */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardDescription>Status Code</CardDescription>
                                    <CardTitle className={cn(
                                        "text-2xl",
                                        selectedAsset.status_code >= 200 && selectedAsset.status_code < 300 ? "text-emerald-500" :
                                            selectedAsset.status_code >= 300 && selectedAsset.status_code < 400 ? "text-amber-500" :
                                                "text-red-500"
                                    )}>{selectedAsset.status_code}</CardTitle>
                                </CardHeader>
                            </Card>
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardDescription>Response Time</CardDescription>
                                    <CardTitle className="text-2xl">{selectedAsset.response_time ? selectedAsset.response_time.split('.')[0] + "ms" : "0ms"}</CardTitle>
                                </CardHeader>
                            </Card>
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardDescription>Content Type</CardDescription>
                                    <CardTitle className="text-xl truncate" title={renderSafeString(selectedAsset.content_type)}>{renderSafeString(selectedAsset.content_type) || "-"}</CardTitle>
                                </CardHeader>
                            </Card>
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardDescription>Web Server</CardDescription>
                                    <CardTitle className="text-xl truncate" title={renderSafeString(selectedAsset.web_server)}>{renderSafeString(selectedAsset.web_server) || "-"}</CardTitle>
                                </CardHeader>
                            </Card>
                        </div>

                        {/* Title & Screenshot */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="lg:col-span-2 space-y-6">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Page Title</CardTitle>
                                        <CardDescription className="text-base text-foreground">{renderSafeString(selectedAsset.title) || "No Title Detected"}</CardDescription>
                                    </CardHeader>
                                </Card>


                            </div>

                            <div className="space-y-6">
                                {/* Tech Stack */}
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <Zap className="h-4 w-4 text-amber-500" />
                                            Technologies
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex flex-wrap gap-2">
                                            {(() => {
                                                try {
                                                    let t = [];
                                                    if (Array.isArray(selectedAsset.technologies)) {
                                                        t = selectedAsset.technologies;
                                                    } else {
                                                        const techStr = selectedAsset.technologies || "[]";
                                                        // Handle case where string is just "Nginx" not "['Nginx']"
                                                        if (techStr.startsWith('[')) {
                                                            t = JSON.parse(techStr);
                                                        } else {
                                                            t = [techStr];
                                                        }
                                                    }

                                                    if (t.length === 0) return <span className="text-muted-foreground italic">None detected</span>;
                                                    return t.map((tech: string, i: number) => (
                                                        <Badge key={i} variant="secondary" className="px-2 py-1">{tech}</Badge>
                                                    ));
                                                } catch { return <span className="text-muted-foreground">Error parsing technologies</span>; }
                                            })()}
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Network Info */}
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <Globe className="h-4 w-4 text-blue-500" />
                                            Network Info
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div>
                                            <p className="text-xs font-medium text-muted-foreground uppercase mb-1">IP Address</p>
                                            <div className="font-mono text-sm bg-muted p-2 rounded break-all select-all">
                                                {renderSafeString(selectedAsset.ip || selectedAsset.host || "-")}
                                            </div>
                                        </div>
                                        {selectedAsset.cname && (
                                            <div>
                                                <p className="text-xs font-medium text-muted-foreground uppercase mb-1">CNAME</p>
                                                <div className="font-mono text-sm bg-muted p-2 rounded break-all select-all">
                                                    {renderSafeString(selectedAsset.cname)}
                                                </div>
                                            </div>
                                        )}
                                        {selectedAsset.cdn_name && (
                                            <div>
                                                <p className="text-xs font-medium text-muted-foreground uppercase mb-1">CDN Detected</p>
                                                <Badge variant="outline" className="border-blue-500/50 text-blue-500">{renderSafeString(selectedAsset.cdn_name)}</Badge>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <FileText className="h-4 w-4" />
                                            Raw Data
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <ScrollArea className="h-[200px] w-full rounded-md border bg-muted p-4">
                                            <pre className="text-xs font-mono text-muted-foreground">
                                                {JSON.stringify(selectedAsset, null, 2)}
                                            </pre>
                                        </ScrollArea>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    </div>
                </ScrollArea>
            </div>
        );
    }




    const startScan = async (overrideFlags?: string) => {
        if (!targetDomain) { toast.error("Enter a target"); return; }

        const flagsToSend = overrideFlags || customFlags;

        try {
            const res = await fetch("/api/httpx", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    target: targetDomain,
                    targetMode,
                    flags: flagsToSend
                })
            });

            if (res.ok) {
                const data = await res.json();
                toast.success("Scan started");
                setSelectedScanId(data.scanId);
                setActiveTab("activity");
                fetchScans();
                setTargetDomain(""); // clear input
            }
        } catch (e) { toast.error("Failed to start scan"); }
    };

    const stopScan = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation(); // prevent select
        try {
            const res = await fetch("/api/httpx", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, action: 'stop' }) // API expects {id, action: 'stop'}
            });
            if (res.ok) {
                toast.success("Stop command sent");
                fetchScans();
            } else {
                toast.error("Failed to stop scan");
            }
        } catch (e) { toast.error("Error stopping scan"); }
    };

    const confirmDeleteScan = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setScanToDelete(id);
        setIsDeletingAll(false);
        setDeleteDialogOpen(true);
    };

    const confirmClearAll = () => {
        setIsDeletingAll(true);
        setScanToDelete(null);
        setDeleteDialogOpen(true);
    }


    const handleExecuteDelete = async () => {
        try {
            if (isDeletingAll) {
                const res = await fetch("/api/httpx?action=clear_all", { method: "DELETE" });
                const data = await res.json();
                if (data.success) {
                    toast.success("History cleared");
                    fetchScans();
                    setResults([]);
                    setDomainSummary([]);
                } else {
                    toast.error(data.error);
                }
            } else if (scanToDelete) {
                const res = await fetch(`/api/httpx?id=${scanToDelete}`, { method: 'DELETE' });
                if (res.ok) {
                    toast.success("Scan deleted");
                    if (selectedScanId === scanToDelete) setSelectedScanId(null);
                    fetchScans();
                } else {
                    toast.error("Failed to delete scan");
                }
            }
        } catch (e: any) {
            toast.error(e.message || "Error deleting");
        } finally {
            setDeleteDialogOpen(false);
            setScanToDelete(null);
            setIsDeletingAll(false);
        }
    };



    const filteredResults = results.filter(r => {
        if (selectedDomain && selectedDomain !== 'ALL' && !r.url.includes(selectedDomain)) return false;

        // Domain Filter (Comma Separated)
        if (filterDomain) {
            const terms = filterDomain.split(',').map(t => t.trim()).filter(t => t);
            if (terms.length > 0) {
                const matchesAny = terms.some(term => r.url.toLowerCase().includes(term.toLowerCase()));
                if (!matchesAny) return false;
            }
        }

        // Code Filter (Multi-select)
        if (filterCode.length > 0 && !filterCode.includes(r.status_code.toString())) return false;

        // Status Filter
        if (filterChangeStatus.length > 0 && r.change_status && !filterChangeStatus.includes(r.change_status)) return false;

        // Tech Filter (Multi-select)
        if (filterTech.length > 0) {
            try {
                // Handle technologies which might be string or array
                let techs: string[] = [];
                if (Array.isArray(r.technologies)) {
                    techs = r.technologies;
                } else {
                    techs = JSON.parse(r.technologies || "[]");
                }

                const allTechs = Array.isArray(techs) ? [...techs] : [];
                if (r.web_server) allTechs.push(getString(r.web_server));

                const hasMatch = filterTech.some(ft => allTechs.includes(ft));
                if (!hasMatch) return false;
            } catch {
                return false;
            }
        }

        return true;
    });

    const clearHttpxHistory = async () => {
        confirmClearAll();
    };

    // Helper to get unique status codes for filter
    const uniqueCodes = Array.from(new Set(results.map(r => r.status_code.toString()))).sort();

    const exportTxt = () => {
        const content = filteredResults.map(r => r.url).join("\n");
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `httpx_assets_${Date.now()}.txt`;
        a.click();
    };

    const exportCsv = () => {
        const headers = "URL,Status,Title,Tech,Latency";
        const rows = filteredResults.map(r => {
            const title = getString(r.title).replace(/"/g, '""'); // Escape quotes
            const tech = getString(r.technologies).replace(/"/g, "'");
            return `${r.url},${r.status_code},"${title}","${tech}",${r.response_time || ""}`;
        }).join("\n");
        const blob = new Blob([headers + "\n" + rows], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `httpx_full_${Date.now()}.csv`;
        a.download = `httpx_full_${Date.now()}.csv`;
        a.click();
    };

    const exportDomains = () => {
        // Strip http://, https://, and port/paths to get just domain
        const content = filteredResults.map(r => {
            try {
                return new URL(r.url).hostname;
            } catch { return r.url; }
        }).join("\n");
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `httpx_domains_${Date.now()}.txt`;
        a.click();
    };

    const copyToClipboard = async (text: string) => {
        // Try modern API first (if available and secure)
        if (navigator.clipboard && navigator.clipboard.writeText) {
            try {
                await navigator.clipboard.writeText(text);
                return true;
            } catch (err) {
                // Continue to fallback
            }
        }

        // Fallback for insecure contexts (HTTP)
        try {
            const textArea = document.createElement("textarea");
            textArea.value = text;
            textArea.style.position = "fixed"; // Avoid scrolling
            textArea.style.left = "-9999px";
            textArea.style.top = "0";
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();

            const successful = document.execCommand('copy');
            document.body.removeChild(textArea);
            return successful;
        } catch (err) {
            console.error("Copy failed", err);
            return false;
        }
    };

    const copyList = async () => {
        const content = filteredResults.map(r => r.url).join("\n");
        const success = await copyToClipboard(content);
        if (success) toast.success("Copied " + filteredResults.length + " URLs");
        else toast.error("Failed to copy to clipboard");
    };

    const exportHosts = async () => {
        const content = filteredResults.map(r => {
            try {
                return new URL(r.url).hostname;
            } catch { return r.url; }
        }).join("\n");
        const success = await copyToClipboard(content);
        if (success) toast.success("Copied " + filteredResults.length + " hostnames");
        else toast.error("Failed to copy to clipboard");
    };

    const exportFullCsv = () => {
        const headers = "URL,Status,Title,Tech,Latency";
        const rows = filteredResults.map(r => {
            const title = getString(r.title).replace(/"/g, '""'); // Escape quotes
            const tech = getString(r.technologies).replace(/"/g, "'");
            return `${r.url},${r.status_code},"${title}","${tech}",${r.response_time || ""}`;
        }).join("\n");
        const blob = new Blob([headers + "\n" + rows], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `httpx_full_${Date.now()}.csv`;
        a.click();
    };

    return (
        <div className="h-[calc(100vh-140px)] animate-in fade-in duration-500 flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Live Asset Probing</h2>
                    <p className="text-muted-foreground text-sm">Validate live hosts and fingerprint technologies.</p>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={(val) => {
                setActiveTab(val);
                if (val === 'results') {
                    setSelectedScanId(null);
                    setSelectedDomain(null);
                }
            }} className="flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between border-b border-border mb-4">
                    <TabsList className="bg-transparent h-10 p-0">
                        <TabsTrigger value="scanner" className="h-10 rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-500 data-[state=active]:bg-transparent px-4 font-medium">
                            <Globe className="h-4 w-4 mr-2" /> Scanner
                        </TabsTrigger>
                        <TabsTrigger value="activity" className="h-10 rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-500 data-[state=active]:bg-transparent px-4 font-medium">
                            <Activity className="h-4 w-4 mr-2" /> Activity
                        </TabsTrigger>
                        <TabsTrigger value="results" className="h-10 rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-500 data-[state=active]:bg-transparent px-4 font-medium">
                            <List className="h-4 w-4 mr-2" /> Live Assets
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="scanner" className="flex-1 min-h-0 m-0">
                    <div className="flex flex-col gap-6">
                        <Card className="border-border bg-card">
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2"><Play className="h-5 w-5 text-emerald-500" /> New Scan</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                {/* Target Section */}
                                <div className="space-y-3">
                                    <div className="flex bg-muted p-1 rounded-md w-fit">
                                        <button
                                            onClick={() => setTargetMode('url')}
                                            className={cn("px-3 py-1 text-xs font-medium rounded-sm transition-all", targetMode === 'url' ? "bg-background shadow text-emerald-500" : "text-muted-foreground hover:text-foreground")}
                                        >
                                            Single Target
                                        </button>
                                        <button
                                            onClick={() => setTargetMode('list')}
                                            className={cn("px-3 py-1 text-xs font-medium rounded-sm transition-all", targetMode === 'list' ? "bg-background shadow text-emerald-500" : "text-muted-foreground hover:text-foreground")}
                                        >
                                            Target List
                                        </button>
                                    </div>

                                    <div className="flex gap-2">
                                        <div className="flex-1 relative">
                                            <Input
                                                placeholder={targetMode === 'url' ? "Enter domain (e.g., example.com) or CIDR" : "Select a list file..."}
                                                value={targetDomain}
                                                onChange={e => setTargetDomain(e.target.value)}
                                                readOnly={targetMode === 'list'}
                                                className={cn(targetMode === 'list' && "text-emerald-500 font-mono")}
                                            />
                                            {targetMode === 'list' && (
                                                <div className="mt-4 flex gap-2">
                                                    <TargetListManager onSelect={setTargetDomain} defaultTab="select">
                                                        <Button variant="outline" className="flex-1 h-10 gap-2 border-emerald-500/20 hover:border-emerald-500/50 hover:bg-emerald-500/5">
                                                            <List className="h-4 w-4 text-emerald-500" /> Choose List
                                                        </Button>
                                                    </TargetListManager>
                                                    <TargetListManager onSelect={setTargetDomain} defaultTab="upload">
                                                        <Button variant="outline" className="flex-1 h-10 gap-2 border-blue-500/20 hover:border-blue-500/50 hover:bg-blue-500/5">
                                                            <Upload className="h-4 w-4 text-blue-500" /> Upload List
                                                        </Button>
                                                    </TargetListManager>
                                                    <TargetListManager onSelect={setTargetDomain} defaultTab="create">
                                                        <Button variant="outline" className="flex-1 h-10 gap-2 border-amber-500/20 hover:border-amber-500/50 hover:bg-amber-500/5">
                                                            <Plus className="h-4 w-4 text-amber-500" /> Create List
                                                        </Button>
                                                    </TargetListManager>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Scan Settings */}
                                <Tabs defaultValue="presets" className="w-full">
                                    <TabsList className="bg-muted border border-border w-full justify-start h-auto p-1">
                                        <TabsTrigger value="presets" className="text-xs">One-Click Presets</TabsTrigger>
                                        <TabsTrigger value="custom" className="text-xs">Custom Command</TabsTrigger>
                                    </TabsList>

                                    <TabsContent value="presets" className="mt-4 grid grid-cols-1 gap-2">
                                        {PRESETS.map((preset, i) => (
                                            <Button
                                                key={i}
                                                variant="outline"
                                                className="justify-start h-auto py-3 px-4 border-dashed hover:border-emerald-500/50 hover:bg-emerald-500/5 group"
                                                onClick={() => startScan(preset.flags)}
                                            >
                                                <div className="flex flex-col items-start gap-1 w-full">
                                                    <div className="flex items-center justify-between w-full">
                                                        <span className="font-semibold text-sm group-hover:text-emerald-500 transition-colors flex items-center">
                                                            <Zap className="h-3 w-3 mr-2 text-amber-500" />
                                                            {preset.name}
                                                        </span>
                                                        <Badge variant="secondary" className="font-mono text-[10px] text-muted-foreground">{preset.flags}</Badge>
                                                    </div>
                                                    <span className="text-xs text-muted-foreground">{preset.description}</span>
                                                </div>
                                            </Button>
                                        ))}
                                    </TabsContent>

                                    <TabsContent value="custom" className="mt-4 space-y-3">
                                        <div className="space-y-1">
                                            <label className="text-xs font-medium text-muted-foreground">Custom Flags (JSON output is auto-enabled)</label>
                                            <Input
                                                value={customFlags}
                                                onChange={(e) => setCustomFlags(e.target.value)}
                                                className="font-mono text-xs"
                                                placeholder="-sc -title ..."
                                            />
                                        </div>
                                        <Button className="w-full bg-emerald-600 hover:bg-emerald-700" onClick={() => startScan()}>
                                            <Play className="h-4 w-4 mr-2" /> Start Custom Scan
                                        </Button>
                                    </TabsContent>
                                </Tabs>


                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="activity" className="flex-1 min-h-0 m-0">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full">
                        {/* Activity List */}
                        <div className="md:col-span-1 border rounded-lg bg-card overflow-hidden flex flex-col h-[500px]">
                            <div className="p-3 border-b bg-muted/20 font-medium text-sm">Scan History</div>
                            <ScrollArea className="flex-1">
                                <div className="divide-y divide-border/50">
                                    {scans.map(scan => (
                                        <div
                                            key={scan.id}
                                            className={cn(
                                                "p-3 cursor-pointer hover:bg-muted/50 transition-colors flex flex-col gap-2",
                                                selectedScanId === scan.id ? "bg-emerald-500/10" : ""
                                            )}
                                            onClick={() => setSelectedScanId(scan.id)}
                                        >
                                            <div className="flex justify-between items-start">
                                                <div className="font-medium text-sm truncate max-w-[150px]">{scan.target}</div>
                                                <Badge variant="outline" className={cn(
                                                    "text-[10px] capitalize",
                                                    scan.status === 'running' ? "text-blue-400 border-blue-500/50" :
                                                        scan.status === 'stopped' ? "text-amber-400 border-amber-500/50" :
                                                            scan.status === 'failed' ? "text-red-400 border-red-500/50" :
                                                                "text-emerald-400 border-emerald-500/50"
                                                )}>{scan.status}</Badge>
                                            </div>
                                            <div className="flex justify-between items-center text-xs text-muted-foreground">
                                                <span>{new Date(scan.start_time).toLocaleTimeString()}</span>
                                                <div className="flex items-center gap-2">
                                                    <span>{scan.count} assets</span>
                                                    {scan.status === 'running' && scan.pid && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-5 w-5 hover:text-red-500 hover:bg-red-500/20"
                                                            onClick={(e) => stopScan(scan.id, e)}
                                                            title="Stop Scan"
                                                        >
                                                            <StopCircle className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-5 w-5 hover:text-red-500 hover:bg-red-500/20"
                                                        onClick={(e) => confirmDeleteScan(scan.id, e)}
                                                        title="Delete Scan"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        </div>

                        {/* Logs Viewer */}
                        <div className="md:col-span-2 border rounded-lg bg-black font-mono text-xs flex flex-col h-[500px]">
                            <div className="p-3 border-b border-white/10 flex justify-between items-center bg-white/5">
                                <span className="flex items-center gap-2"><Terminal className="h-4 w-4" /> Execution Logs</span>
                                {selectedScanId && <span className="text-zinc-500 text-[10px]">{selectedScanId}</span>}
                            </div>
                            <div className="flex-1 overflow-hidden relative">
                                {selectedScanId ? <LogViewer scanId={selectedScanId} active={scans.find(s => s.id === selectedScanId)?.status === 'running'} /> : (
                                    <div className="flex items-center justify-center h-full text-zinc-600">
                                        Select a scan to view logs
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="results" className="flex-1 min-h-0 m-0">
                    <Card className="border-border bg-card flex flex-col h-full min-h-[500px]">
                        <CardHeader className="py-3 px-4 border-b border-border/50 flex flex-row items-center justify-between">
                            <div className="flex items-center gap-2">
                                {selectedDomain && !selectedScanId ? (
                                    <Button variant="ghost" size="sm" onClick={() => setSelectedDomain(null)} className="mr-2 px-2">
                                        <ArrowLeft className="h-4 w-4" />
                                    </Button>
                                ) : null}
                                <CardTitle className="text-base flex items-center gap-2">
                                    {selectedDomain === 'ALL' ? "All Assets" : (selectedDomain ? selectedDomain : (selectedScanId ? "Scan Results" : "Live Assets"))}
                                    {!selectedDomain && !selectedScanId && <span className="text-muted-foreground font-normal text-sm ml-2">({domainSummary.length} Domains)</span>}
                                    {(selectedDomain || selectedScanId) && <span className="text-muted-foreground font-normal text-sm ml-2">({filteredResults.length})</span>}
                                </CardTitle>
                            </div>
                            {selectedScanId && (
                                <Button variant="outline" size="sm" onClick={() => setSelectedScanId(selectedScanId)}>
                                    <RefreshCw className="h-3 w-3 mr-2" /> Refresh
                                </Button>
                            )}
                        </CardHeader>
                        <CardContent className="p-0 flex-1 overflow-hidden bg-muted/5">
                            {/* DOMAIN GRID VIEW (Global View Only) */}
                            {!selectedScanId && !selectedDomain ? (
                                <ScrollArea className="h-full">
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 p-4">
                                        {/* All Assets Card */}
                                        <div
                                            onClick={() => setSelectedDomain('ALL')}
                                            className="bg-card hover:bg-zinc-500/5 group border border-border/40 hover:border-zinc-500/30 rounded-lg p-4 cursor-pointer transition-all flex flex-col items-center text-center gap-3 shadow-sm hover:shadow-md"
                                        >
                                            <div className="h-10 w-10 rounded-full bg-zinc-500/10 flex items-center justify-center group-hover:bg-zinc-500/20 transition-colors">
                                                <List className="h-5 w-5 text-zinc-500" />
                                            </div>
                                            <div className="space-y-1 w-full">
                                                <div className="font-medium text-sm truncate w-full">All Assets</div>
                                                <div className="text-xs text-muted-foreground">{results.length} total</div>
                                            </div>
                                        </div>

                                        {domainSummary.map((d, i) => (
                                            <div
                                                key={i}
                                                onClick={() => setSelectedDomain(d.domain)}
                                                className="bg-card hover:bg-emerald-500/5 group border border-border/40 hover:border-emerald-500/30 rounded-lg p-4 cursor-pointer transition-all flex flex-col items-center text-center gap-3 shadow-sm hover:shadow-md"
                                            >
                                                <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors">
                                                    <Folder className="h-5 w-5 text-emerald-500" />
                                                </div>
                                                <div className="space-y-1 w-full">
                                                    <div className="font-medium text-sm truncate w-full" title={d.domain}>{d.domain}</div>
                                                    <div className="text-xs text-muted-foreground">{d.count} assets</div>
                                                </div>
                                            </div>
                                        ))}
                                        {domainSummary.length === 0 && (
                                            <div className="col-span-full h-40 flex flex-col items-center justify-center text-muted-foreground">
                                                <Activity className="h-8 w-8 opacity-20 mb-2" />
                                                No domains found. Run a scan!
                                            </div>
                                        )}
                                    </div>
                                </ScrollArea>
                            ) : (
                                /* ASSET TABLE VIEW (Scan Results OR Selected Domain) */
                                <>
                                    {loading ? (
                                        <div className="h-full flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-emerald-500" /></div>
                                    ) : results.length === 0 ? (
                                        <div className="h-full flex items-center justify-center text-muted-foreground flex-col gap-2">
                                            <Activity className="h-8 w-8 opacity-20" />
                                            <p>No results found.</p>
                                        </div>
                                    ) : (
                                        <ScrollArea className="h-full">
                                            <div className="flex items-center gap-2 p-4 pb-0">
                                                <Input
                                                    placeholder="Domain (comma, separated)"
                                                    value={filterDomain}
                                                    onChange={(e) => setFilterDomain(e.target.value)}
                                                    className="max-w-[250px] h-8 bg-background"
                                                />
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="outline" size="sm" className="h-8 border-dashed">
                                                            Code {filterCode.length > 0 ? `(${filterCode.length})` : ""}
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="w-[150px]">
                                                        <DropdownMenuLabel>Status Codes</DropdownMenuLabel>
                                                        <DropdownMenuSeparator />
                                                        {uniqueCodes.map((code) => (
                                                            <DropdownMenuCheckboxItem
                                                                key={code}
                                                                checked={filterCode.includes(code)}
                                                                onCheckedChange={(checked) => {
                                                                    if (checked) setFilterCode([...filterCode, code]);
                                                                    else setFilterCode(filterCode.filter(c => c !== code));
                                                                }}
                                                                onSelect={(e) => e.preventDefault()}
                                                            >
                                                                {code}
                                                            </DropdownMenuCheckboxItem>
                                                        ))}
                                                        {uniqueCodes.length === 0 && <div className="p-2 text-xs text-muted-foreground text-center">No codes found</div>}
                                                        {filterCode.length > 0 && (
                                                            <>
                                                                <DropdownMenuSeparator />
                                                                <DropdownMenuCheckboxItem
                                                                    checked={false}
                                                                    onCheckedChange={() => setFilterCode([])}
                                                                    onSelect={(e) => e.preventDefault()}
                                                                    className="justify-center text-center text-xs font-medium"
                                                                >
                                                                    Clear
                                                                </DropdownMenuCheckboxItem>
                                                            </>
                                                        )}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="outline" size="sm" className="h-8 border-dashed">
                                                            Status {filterChangeStatus.length > 0 ? `(${filterChangeStatus.length})` : ""}
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="w-[150px]">
                                                        <DropdownMenuLabel>Filter Status</DropdownMenuLabel>
                                                        <DropdownMenuSeparator />
                                                        {['new', 'changed', 'old'].map((status) => (
                                                            <DropdownMenuCheckboxItem
                                                                key={status}
                                                                checked={filterChangeStatus.includes(status)}
                                                                onCheckedChange={(checked) => {
                                                                    if (checked) setFilterChangeStatus([...filterChangeStatus, status]);
                                                                    else setFilterChangeStatus(filterChangeStatus.filter(s => s !== status));
                                                                }}
                                                                onSelect={(e) => e.preventDefault()}
                                                                className="capitalize"
                                                            >
                                                                {status}
                                                            </DropdownMenuCheckboxItem>
                                                        ))}
                                                        {filterChangeStatus.length > 0 && (
                                                            <>
                                                                <DropdownMenuSeparator />
                                                                <DropdownMenuCheckboxItem
                                                                    checked={false}
                                                                    onCheckedChange={() => setFilterChangeStatus([])}
                                                                    onSelect={(e) => e.preventDefault()}
                                                                    className="justify-center text-center text-xs font-medium"
                                                                >
                                                                    Clear Filter
                                                                </DropdownMenuCheckboxItem>
                                                            </>
                                                        )}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                                {/* Tech Stack Filter */}
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="outline" size="sm" className="h-8 border-dashed">
                                                            <Zap className="h-3 w-3 mr-1" />
                                                            Tech {filterTech.length > 0 ? `(${filterTech.length})` : ""}
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="w-[200px] max-h-[300px] overflow-y-auto">
                                                        <DropdownMenuLabel>Technologies</DropdownMenuLabel>
                                                        <DropdownMenuSeparator />
                                                        {uniqueTechs.slice(0, 30).map((tech) => (
                                                            <DropdownMenuCheckboxItem
                                                                key={tech}
                                                                checked={filterTech.includes(tech)}
                                                                onCheckedChange={(checked) => {
                                                                    if (checked) setFilterTech([...filterTech, tech]);
                                                                    else setFilterTech(filterTech.filter(t => t !== tech));
                                                                }}
                                                                onSelect={(e) => e.preventDefault()}
                                                            >
                                                                {tech}
                                                            </DropdownMenuCheckboxItem>
                                                        ))}
                                                        {uniqueTechs.length === 0 && <div className="p-2 text-xs text-muted-foreground text-center">No technologies found</div>}
                                                        {uniqueTechs.length > 30 && <div className="p-2 text-xs text-muted-foreground text-center">+{uniqueTechs.length - 30} more</div>}
                                                        {filterTech.length > 0 && (
                                                            <>
                                                                <DropdownMenuSeparator />
                                                                <DropdownMenuCheckboxItem
                                                                    checked={false}
                                                                    onCheckedChange={() => setFilterTech([])}
                                                                    onSelect={(e) => e.preventDefault()}
                                                                    className="justify-center text-center text-xs font-medium"
                                                                >
                                                                    Clear
                                                                </DropdownMenuCheckboxItem>
                                                            </>
                                                        )}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                                {selectedScanId && (
                                                    <Button variant="ghost" size="sm" onClick={() => setSelectedScanId(null)} className="h-8 ml-2">
                                                        View All Assets
                                                    </Button>
                                                )}
                                                <div className="ml-auto flex gap-2">
                                                    <Button variant="outline" size="sm" onClick={exportHosts} className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                                                        <Copy className="h-3.5 w-3.5" /> Hostnames
                                                    </Button>
                                                    <Button variant="outline" size="sm" onClick={exportFullCsv} className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                                                        <Download className="h-3.5 w-3.5" /> Export CSV
                                                    </Button>
                                                    <Button variant="outline" size="sm" onClick={clearHttpxHistory} className="h-8 gap-1.5 text-xs text-red-500 hover:text-red-600 border-red-500/20 hover:bg-red-500/5">
                                                        <Trash2 className="h-3.5 w-3.5" /> Delete All
                                                    </Button>
                                                    <span className="text-[10px] text-muted-foreground ml-2 bg-muted/50 px-2 py-1 rounded border border-border/50">
                                                        {filteredResults.length} Assets
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Asset Cards */}
                                            <div className="flex-1 min-h-[400px] max-h-[600px] overflow-y-auto p-4 space-y-3">
                                                {filteredResults.map((r) => (
                                                    <HttpxAssetCard
                                                        key={r.id}
                                                        data={r}
                                                        onClick={() => setSelectedAsset(r)}
                                                        onScanTarget={onScanTarget}
                                                    />
                                                ))}
                                            </div>
                                        </ScrollArea>
                                    )}
                                </>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs >
            {/* Delete Confirmation Dialog */}
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {isDeletingAll
                                ? "This will permanently delete ALL scan history and results. This action cannot be undone."
                                : "This will permanently delete this scan history. This action cannot be undone."}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleExecuteDelete} className="bg-red-600 hover:bg-red-700">
                            {isDeletingAll ? "Delete All" : "Delete Scan"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>

    );
}

function LogViewer({ scanId, active }: { scanId: string, active?: boolean }) {
    const [logs, setLogs] = useState("");
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchLogs = async () => {
            try {
                const res = await fetch(`/api/httpx?id=${scanId}&logs=true`);
                if (res.ok) {
                    const text = await res.text();
                    setLogs(text);
                }
            } catch (e) { }
        };
        fetchLogs();
        const interval = setInterval(fetchLogs, active ? 1000 : 5000);
        return () => clearInterval(interval);
    }, [scanId, active]);

    useEffect(() => {
        if (active) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs, active]);

    return (
        <ScrollArea className="h-full w-full">
            <div className="p-4 text-zinc-300 whitespace-pre-wrap font-mono text-[10px] leading-relaxed">
                {logs || <span className="text-zinc-600">Waiting for logs...</span>}
                <div ref={bottomRef} />
            </div>
        </ScrollArea>
    );
}

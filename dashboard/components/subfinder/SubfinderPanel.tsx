"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Play, Globe, History, ChevronRight, Activity, List, Trash2, Target } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SubdomainTable } from "@/components/subfinder/SubdomainTable";

// We need to define or import SubfinderScan type
interface SubfinderScan {
    id: string;
    target: string;
    start_time: number;
    end_time?: number;
    status: string;
    count: number;
}

interface SubfinderPanelProps {
    onScanTarget?: (target: string) => void;
}

export function SubfinderPanel({ onScanTarget }: SubfinderPanelProps) {
    const [domain, setDomain] = useState("");
    const [loading, setLoading] = useState(false);
    const [history, setHistory] = useState<SubfinderScan[]>([]);
    const [recentResults, setRecentResults] = useState<{ subdomain: string, last_seen: string, scan_target: string }[]>([]);

    // State for Tabs and Active Scan
    const [activeTab, setActiveTab] = useState("scanner");
    const [selectedScanId, setSelectedScanId] = useState<string | null>(null);
    const [customArgs, setCustomArgs] = useState("");
    const [showAdvanced, setShowAdvanced] = useState(false);

    // Poll history to show status updates
    const fetchHistory = async () => {
        try {
            const res = await fetch("/api/subfinder");
            const data = await res.json();
            setHistory(data);

            // Also fetch recent results
            const resRecent = await fetch("/api/subfinder?recent=true");
            if (resRecent.ok) {
                const dataRecent = await resRecent.json();
                setRecentResults(dataRecent);
            }
        } catch (e) {
            console.error("Failed to fetch history", e);
        }
    };

    useEffect(() => {
        fetchHistory();
        const interval = setInterval(fetchHistory, 3000); // Poll every 3s for status updates
        return () => clearInterval(interval);
    }, []);

    const handleRun = async (eOrArgs?: React.MouseEvent | string) => {
        const argsToUse = typeof eOrArgs === "string" ? eOrArgs : customArgs;

        if (!domain) {
            toast.error("Please enter a domain");
            return;
        }

        setLoading(true);

        try {
            const res = await fetch("/api/subfinder", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    domain,
                    args: argsToUse
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Failed to run subfinder");
            }

            toast.success("Scan started");

            // Set active scan and switch to Activity tab
            setSelectedScanId(data.scanId);
            setActiveTab("activity");
            fetchHistory();

        } catch (error: any) {
            console.error(error);
            toast.error(error.message || "Something went wrong");
        } finally {
            setLoading(false);
        }
    };

    const handleSelectHistory = (scan: SubfinderScan) => {
        setSelectedScanId(scan.id);
        // If running, go to activity, else results
        if (scan.status === 'running') {
            setActiveTab("activity");
        } else {
            setActiveTab("results");
        }
    };

    const handleDeleteScan = async (e: React.MouseEvent, scanId: string) => {
        e.stopPropagation();
        if (!confirm("Are you sure you want to delete this scan and all its results?")) return;

        try {
            const res = await fetch(`/api/subfinder?id=${scanId}`, {
                method: "DELETE"
            });

            if (res.ok) {
                toast.success("Scan deleted");
                // Clear selection if deleted
                if (selectedScanId === scanId) {
                    setSelectedScanId(null);
                    setActiveTab("scanner");
                }
                fetchHistory();
            } else {
                toast.error("Failed to delete scan");
            }
        } catch (error) {
            toast.error("Something went wrong");
        }
    };

    return (
        <div className="h-[calc(100vh-140px)] animate-in fade-in duration-500 flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Subfinder</h2>
                    <p className="text-muted-foreground text-sm">Discover valid subdomains for websites.</p>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between border-b border-border mb-4">
                    <TabsList className="bg-transparent h-10 p-0">
                        <TabsTrigger
                            value="scanner"
                            className="h-10 rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-500 data-[state=active]:bg-transparent px-4 font-medium"
                        >
                            <Globe className="h-4 w-4 mr-2" />
                            Scanner
                        </TabsTrigger>
                        <TabsTrigger
                            value="activity"
                            className="h-10 rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-500 data-[state=active]:bg-transparent px-4 font-medium"
                        >
                            <Activity className="h-4 w-4 mr-2" />
                            Activity Monitor
                        </TabsTrigger>
                        <TabsTrigger
                            value="results"
                            className="h-10 rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-500 data-[state=active]:bg-transparent px-4 font-medium"
                        >
                            <List className="h-4 w-4 mr-2" />
                            Results Feed
                        </TabsTrigger>
                    </TabsList>

                    {selectedScanId && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mr-2">
                            <span className="hidden md:inline">Active Scan:</span>
                            <Badge variant="outline" className="font-mono text-emerald-400 border-emerald-500/30">
                                {history.find(s => s.id === selectedScanId)?.target || selectedScanId.slice(0, 8)}
                            </Badge>
                        </div>
                    )}
                </div>

                <TabsContent value="scanner" className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-3 gap-6 m-0">
                    {/* Left: New Scan */}
                    <div className="md:col-span-1 space-y-6">
                        <Card className="border-border bg-card">
                            <CardHeader className="pb-3">
                                <CardTitle className="flex items-center gap-2 text-lg">
                                    <Play className="h-5 w-5 text-emerald-500" />
                                    New Discovery
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex flex-col gap-3">
                                    <Input
                                        placeholder="example.com"
                                        value={domain}
                                        onChange={(e) => setDomain(e.target.value)}
                                        onKeyDown={(e) => e.key === "Enter" && handleRun()}
                                        className="bg-background"
                                    />

                                    <div className="space-y-2">
                                        <button
                                            onClick={() => setShowAdvanced(!showAdvanced)}
                                            className="text-xs flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                                        >
                                            <ChevronRight className={cn("h-3 w-3 transition-transform", showAdvanced && "rotate-90")} />
                                            Advanced Options
                                        </button>

                                        {showAdvanced && (
                                            <div className="animate-in slide-in-from-top-2 duration-200">
                                                <label className="text-xs text-muted-foreground mb-1 block">Custom Flags</label>
                                                <Input
                                                    placeholder="-all -recursive"
                                                    value={customArgs}
                                                    onChange={(e) => setCustomArgs(e.target.value)}
                                                    className="h-8 text-xs font-mono bg-background/50"
                                                />
                                            </div>
                                        )}
                                    </div>

                                    <Button
                                        onClick={handleRun}
                                        disabled={loading}
                                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white mt-2"
                                    >
                                        {loading ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Starting...
                                            </>
                                        ) : (
                                            <>
                                                <Play className="mr-2 h-4 w-4" />
                                                Start Scan
                                            </>
                                        )}
                                    </Button>

                                    <div className="pt-2">
                                        <p className="text-xs text-muted-foreground mb-2 font-medium">Scan Presets</p>
                                        <div className="grid grid-cols-2 gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-auto py-2 px-3 flex flex-col items-start gap-0.5"
                                                onClick={() => { setCustomArgs(""); handleRun(""); }}
                                                title="Standard passive enumeration"
                                                disabled={loading}
                                            >
                                                <span className="font-medium text-xs">Standard</span>
                                                <span className="text-[10px] text-muted-foreground font-mono">default</span>
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-auto py-2 px-3 flex flex-col items-start gap-0.5"
                                                onClick={() => { setCustomArgs("-recursive"); handleRun("-recursive"); }}
                                                title="Recursive subdomain discovery"
                                                disabled={loading}
                                            >
                                                <span className="font-medium text-xs">Recursive</span>
                                                <span className="text-[10px] text-muted-foreground font-mono">-recursive</span>
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-auto py-2 px-3 flex flex-col items-start gap-0.5"
                                                onClick={() => { setCustomArgs("-all"); handleRun("-all"); }}
                                                title="Use all available sources (slower)"
                                                disabled={loading}
                                            >
                                                <span className="font-medium text-xs">All Sources</span>
                                                <span className="text-[10px] text-muted-foreground font-mono">-all</span>
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-auto py-2 px-3 flex flex-col items-start gap-0.5"
                                                onClick={() => { setCustomArgs("-all -recursive -nW"); handleRun("-all -recursive -nW"); }}
                                                title="All sources, recursive, and active DNS resolution"
                                                disabled={loading}
                                            >
                                                <span className="font-medium text-xs">Deep & Active</span>
                                                <span className="text-[10px] text-muted-foreground font-mono">-all -recursive -nW</span>
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-border bg-card flex-1 min-h-0 flex flex-col h-[400px]">
                            <CardHeader className="pb-3 border-b border-border/50">
                                <CardTitle className="flex items-center gap-2 text-lg">
                                    <History className="h-5 w-5 text-zinc-400" />
                                    Recent Scans
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0 flex-1 overflow-hidden">
                                <ScrollArea className="h-full">
                                    <div className="flex flex-col p-2 gap-1">
                                        {history.length === 0 ? (
                                            <div className="text-center text-muted-foreground py-8 text-sm">
                                                No history yet.
                                            </div>
                                        ) : (
                                            history.map((scan) => (
                                                <button
                                                    key={scan.id}
                                                    onClick={() => handleSelectHistory(scan)}
                                                    className={cn(
                                                        "group flex items-center justify-between p-3 rounded-lg text-left transition-colors border border-transparent",
                                                        selectedScanId === scan.id
                                                            ? "bg-emerald-900/20 border-emerald-500/30"
                                                            : "hover:bg-muted/50"
                                                    )}
                                                >
                                                    <div className="flex flex-col gap-1 overflow-hidden">
                                                        <span className={cn("font-medium truncate text-sm", selectedScanId === scan.id ? "text-emerald-400" : "text-foreground")}>
                                                            {scan.target}
                                                        </span>
                                                        <span className="text-xs text-muted-foreground">
                                                            {new Date(scan.start_time).toLocaleDateString()} • {new Date(scan.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex flex-col items-end gap-1">
                                                            <Badge variant="outline" className="text-[10px] h-5 px-1 bg-background/50">
                                                                {scan.count}
                                                            </Badge>
                                                            {scan.status === 'running' && (
                                                                <Loader2 className="h-3 w-3 animate-spin text-emerald-500" />
                                                            )}
                                                        </div>

                                                        {scan.status !== 'running' && (
                                                            <div
                                                                role="button"
                                                                onClick={(e) => handleDeleteScan(e, scan.id)}
                                                                className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-red-500/20 hover:text-red-500 text-muted-foreground transition-all"
                                                                title="Delete Scan"
                                                            >
                                                                <Trash2 className="h-3 w-3" />
                                                            </div>
                                                        )}
                                                    </div>
                                                </button>
                                            ))
                                        )}
                                    </div>
                                </ScrollArea>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Right: Recent Findings */}
                    <Card className="md:col-span-2 border-border bg-card flex flex-col min-h-0 h-[400px]">
                        <CardHeader className="pb-3 border-b border-border/50">
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <List className="h-5 w-5 text-emerald-500" />
                                Latest Discoveries
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0 flex-1 overflow-hidden">
                            <ScrollArea className="h-full">
                                <div className="flex flex-col">
                                    {recentResults.length === 0 ? (
                                        <div className="text-center text-muted-foreground py-12 flex flex-col items-center justify-center h-full">
                                            <Activity className="h-12 w-12 mb-3 opacity-20" />
                                            <p>No recent discoveries.</p>
                                            <p className="text-sm opacity-50 mt-1">Start a scan to find subdomains.</p>
                                        </div>
                                    ) : (
                                        <div className="divide-y divide-border/50">
                                            {recentResults.map((r, i) => (
                                                <div key={i} className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors text-sm group">
                                                    <div className="flex flex-col gap-0.5">
                                                        <div className="flex items-center gap-2">
                                                            <a href={`http://${r.subdomain}`} target="_blank" rel="noopener noreferrer" className="font-medium text-emerald-400 hover:underline truncate max-w-[300px]">
                                                                {r.subdomain}
                                                            </a>
                                                            <a href={`https://${r.subdomain}`} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-emerald-500" title="Open in browser">
                                                                <Globe className="h-3 w-3" />
                                                            </a>
                                                            {onScanTarget && (
                                                                <button
                                                                    onClick={() => onScanTarget(r.subdomain)}
                                                                    className="text-muted-foreground hover:text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                    title="Start Nuclei Scan"
                                                                >
                                                                    <Target className="h-3 w-3" />
                                                                </button>
                                                            )}
                                                        </div>
                                                        <span className="text-[10px] text-muted-foreground">
                                                            via {r.scan_target}
                                                        </span>
                                                    </div>
                                                    <span className="text-xs text-muted-foreground tabular-nums opacity-60 group-hover:opacity-100 transition-opacity">
                                                        {new Date(r.last_seen || Date.now()).toLocaleDateString()}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="activity" className="flex-1 min-h-0 m-0">
                    <ScrollArea className="h-full pr-4">
                        <div className="flex flex-col gap-4 p-1">
                            {history.length === 0 ? (
                                <div className="flex flex-col items-center justify-center p-8 text-muted-foreground border border-dashed rounded-lg bg-card/50">
                                    <Activity className="h-10 w-10 mb-2 opacity-50" />
                                    <p>No activity history available.</p>
                                </div>
                            ) : (
                                history.map((scan) => {
                                    const isRunning = scan.status === 'running';
                                    const duration = scan.end_time && scan.start_time
                                        ? Math.round((scan.end_time - scan.start_time) / 1000)
                                        : null;

                                    return (
                                        <Card key={scan.id} className="bg-card border-border">
                                            <CardHeader className="flex flex-row items-start justify-between pb-2 space-y-0">
                                                <div className="space-y-1">
                                                    <CardTitle className="text-base flex items-center gap-2">
                                                        {scan.target}
                                                        <Badge
                                                            variant={isRunning ? "default" : "secondary"}
                                                            className={cn(
                                                                "font-normal",
                                                                isRunning ? "bg-emerald-600 hover:bg-emerald-600" :
                                                                    scan.status === 'completed' ? "bg-blue-600 hover:bg-blue-600" :
                                                                        "bg-red-600 hover:bg-red-600"
                                                            )}
                                                        >
                                                            {scan.status.toUpperCase()}
                                                        </Badge>
                                                    </CardTitle>
                                                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                                                        <span>Started: {new Date(scan.start_time).toLocaleString()}</span>
                                                        {duration && <span>• Duration: {duration}s</span>}
                                                        <span>• Found: {scan.count}</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {isRunning ? (
                                                        <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
                                                    ) : (
                                                        <Badge variant="outline" className="border-green-600/50 text-green-500 bg-green-500/10">
                                                            ✓ Completed
                                                        </Badge>
                                                    )}
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={(e) => handleDeleteScan(e, scan.id)}
                                                        className="text-muted-foreground hover:text-red-500"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="flex items-center gap-4">
                                                    <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-md border border-border/50">
                                                        <Activity className="h-3 w-3" />
                                                        Activity Log
                                                    </div>
                                                    <Button
                                                        variant="link"
                                                        size="sm"
                                                        onClick={() => setSelectedScanId(selectedScanId === scan.id ? null : scan.id)}
                                                        className="h-auto p-0 text-emerald-500"
                                                    >
                                                        {selectedScanId === scan.id ? "Hide Logs" : "View Logs"}
                                                    </Button>
                                                </div>

                                                {selectedScanId === scan.id && (
                                                    <div className="mt-4 border border-border rounded-lg overflow-hidden bg-black h-64">
                                                        <SubfinderLogViewer scanId={scan.id} />
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>
                                    );
                                })
                            )}
                        </div>
                    </ScrollArea>
                </TabsContent>

                <TabsContent value="results" className="flex-1 min-h-0 m-0">
                    <SubdomainTable scanId={selectedScanId} onScan={onScanTarget} />
                </TabsContent>
            </Tabs>
        </div>
    );
}

function SubfinderLogViewer({ scanId }: { scanId: string }) {
    const [logs, setLogs] = useState("");

    useEffect(() => {
        const fetchLogs = async () => {
            try {
                // We created a logs endpoint at /api/subfinder/logs?id=...
                const res = await fetch(`/api/subfinder/logs?id=${scanId}`);
                if (res.ok) {
                    const text = await res.text();
                    setLogs(text);
                }
            } catch (e) { }
        };

        fetchLogs();
        const interval = setInterval(fetchLogs, 1000);
        return () => clearInterval(interval);
    }, [scanId]);

    return (
        <ScrollArea className="h-full w-full p-4 font-mono text-xs text-zinc-300">
            <div className="whitespace-pre-wrap">{logs || "Waiting for logs..."}</div>
        </ScrollArea>
    );
}

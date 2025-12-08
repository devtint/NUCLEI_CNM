"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Square, RefreshCcw } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

interface ScanInfo {
    id: string;
    target: string;
    status: string;
    startTime: number;
    config?: {
        rateLimit?: number;
        concurrency?: number;
        bulkSize?: number;
        templateId?: string;
        customArgs?: string;
    };
}

export function LiveConsole({ scanId }: { scanId: string | null }) {
    const [activeScans, setActiveScans] = useState<ScanInfo[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchScans = async () => {
        try {
            const res = await fetch("/api/scan");
            const data = await res.json();
            setActiveScans(data);
        } catch (e) {
            console.error("Failed to fetch scans");
        }
    };

    useEffect(() => {
        fetchScans();
        // Poll every 2 seconds
        const interval = setInterval(fetchScans, 2000);
        return () => clearInterval(interval);
    }, []);

    const stopScan = async (id: string) => {
        try {
            setLoading(true);
            await fetch(`/api/scan?id=${id}`, { method: "DELETE" });
            toast.success("Scan stopped successfully");
            fetchScans();
        } catch (e) {
            toast.error("Failed to stop scan");
        } finally {
            setLoading(false);
        }
    };

    if (activeScans.length === 0) {
        return (
            <div className="bg-card p-8 rounded-lg border border-border flex flex-col items-center justify-center text-muted-foreground h-64">
                <p>No active scans running.</p>
                <p className="text-xs mt-2">Start a new scan from the "New Operation" tab.</p>
            </div>
        );
    }

    return (
        <div className="grid gap-4">
            {activeScans.map((scan) => (
                <Card key={scan.id} className="bg-card border-border shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <div className="flex flex-col">
                            <CardTitle className="text-base font-medium text-foreground flex items-center gap-2">
                                {scan.target}
                                <Badge variant={scan.status === "running" ? "default" : "secondary"} className={scan.status === "running" ? "bg-emerald-600 hover:bg-emerald-600" : ""}>
                                    {scan.status.toUpperCase()}
                                </Badge>
                            </CardTitle>
                            <span className="text-xs text-muted-foreground mt-1">
                                Started: {new Date(scan.startTime).toLocaleTimeString()}
                            </span>
                        </div>
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => stopScan(scan.id)}
                            disabled={scan.status !== "running" || loading}
                        >
                            <Square className="mr-2 h-3 w-3 fill-current" /> Stop
                        </Button>
                    </CardHeader>
                    <CardContent>
                        <div className="mt-2 p-3 bg-muted/50 rounded-md border border-border">
                            <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Configuration</p>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                <div>
                                    <span className="text-muted-foreground block text-xs">Rate Limit</span>
                                    <span className="font-mono text-foreground">{scan.config?.rateLimit || "Default"}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground block text-xs">Concurrency</span>
                                    <span className="font-mono text-foreground">{scan.config?.concurrency || "Default"}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground block text-xs">Bulk Size</span>
                                    <span className="font-mono text-foreground">{scan.config?.bulkSize || "Default"}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground block text-xs">Template Filters</span>
                                    <span className="font-mono text-foreground truncate block" title={scan.config?.customArgs}>
                                        {scan.config?.templateId || (scan.config?.customArgs ? "Custom Flags" : "All")}
                                    </span>
                                </div>
                            </div>
                            {scan.config?.customArgs && (
                                <div className="mt-3 pt-3 border-t border-border">
                                    <span className="text-muted-foreground block text-xs mb-1">Custom Arguments</span>
                                    <code className="text-xs bg-black/20 p-1.5 rounded text-emerald-400 font-mono block overflow-x-auto whitespace-nowrap">
                                        {scan.config.customArgs}
                                    </code>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}

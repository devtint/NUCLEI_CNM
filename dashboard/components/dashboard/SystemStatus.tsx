
"use client";

import { useState, useEffect } from "react";
import { Loader2, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

interface ToolStatus {
    installed: boolean;
    version?: string;
    error?: string;
}

interface SystemData {
    nuclei: ToolStatus;
    subfinder: ToolStatus;
    timestamp: number;
}

export function SystemStatus() {
    const [data, setData] = useState<SystemData | null>(null);
    const [loading, setLoading] = useState(true);

    const checkStatus = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/system/status");
            if (res.ok) {
                const json = await res.json();
                setData(json);
            }
        } catch (e) {
            console.error("Failed to check system status", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        checkStatus();
    }, []);

    if (loading && !data) {
        return (
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 px-3 py-1.5 rounded-full">
                <Loader2 className="h-3 w-3 animate-spin" />
                Checking System...
            </div>
        );
    }

    if (!data) {
        return (
            <div className="flex items-center gap-2 text-xs text-red-500 bg-red-500/10 px-3 py-1.5 rounded-full cursor-pointer hover:bg-red-500/20" onClick={checkStatus}>
                <AlertCircle className="h-3 w-3" />
                Offline
            </div>
        );
    }

    const ToolIndicator = ({ name, status }: { name: string, status: ToolStatus }) => (
        <TooltipProvider>
            <Tooltip delayDuration={300}>
                <TooltipTrigger asChild>
                    <div className={cn(
                        "flex items-center gap-1.5 text-xs px-2 py-1 rounded-md transition-colors border",
                        status.installed
                            ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20"
                            : "bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/20"
                    )}>
                        {status.installed ? (
                            <div className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </div>
                        ) : (
                            <AlertCircle className="h-3 w-3" />
                        )}
                        <span className="font-medium capitalize">{name}</span>
                    </div>
                </TooltipTrigger>
                <TooltipContent>
                    <p className="font-semibold">{name} Status</p>
                    {status.installed ? (
                        <p className="text-xs text-muted-foreground">{status.version}</p>
                    ) : (
                        <p className="text-xs text-red-400">Not found in PATH</p>
                    )}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );

    return (
        <div className="flex items-center gap-2">
            <div className="text-right mr-2 hidden md:block">
                <div className="text-[10px] text-zinc-500 uppercase tracking-widest">System Status</div>
            </div>

            <div className="flex gap-2">
                <ToolIndicator name="nuclei" status={data.nuclei} />
                <ToolIndicator name="subfinder" status={data.subfinder} />

                <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 ml-1 text-muted-foreground hover:text-foreground"
                    onClick={checkStatus}
                    disabled={loading}
                    title="Refresh Status"
                >
                    <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
                </Button>
            </div>
        </div>
    );
}

"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Clock, Play, Calendar, Bell, BellOff, Globe, Loader2, CheckCircle2, XCircle, Radar } from "lucide-react";

interface SchedulerSettings {
    enabled: boolean;
    frequency: "6h" | "12h" | "24h" | "168h";
    hour: number;
    notifyMode: "always" | "new_only";
    autoHttpx: boolean;
    lastRun: number | null;
}

interface SchedulerStatus {
    isProcessing: boolean;
    currentDomain: string | null;
    nextRun: string | null;
}

interface Domain {
    id: number;
    target: string;
    last_scan_date: number | null;
    scheduler_enabled: number;
    total_count: number;
}

export function SchedulerPanel() {
    const [settings, setSettings] = useState<SchedulerSettings | null>(null);
    const [status, setStatus] = useState<SchedulerStatus | null>(null);
    const [domains, setDomains] = useState<Domain[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [triggering, setTriggering] = useState(false);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 10000); // Poll every 10s
        return () => clearInterval(interval);
    }, []);

    const fetchData = async () => {
        try {
            const res = await fetch("/api/scheduler");
            const data = await res.json();
            if (data) {
                setSettings(data.settings);
                setStatus(data.status);
                setDomains(data.domains || []);
            }
        } catch (e) {
            console.error("Failed to load scheduler data", e);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (updates: Partial<SchedulerSettings>) => {
        setSaving(true);
        try {
            const res = await fetch("/api/scheduler", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updates),
            });

            if (res.ok) {
                const data = await res.json();
                setSettings(data.settings);
                toast.success("Scheduler settings saved");
            } else {
                toast.error("Failed to save settings");
            }
        } catch (e) {
            toast.error("Error saving settings");
        } finally {
            setSaving(false);
        }
    };

    const handleToggle = async (enabled: boolean) => {
        await handleSave({ enabled });
    };

    const handleTrigger = async () => {
        setTriggering(true);
        try {
            const res = await fetch("/api/scheduler", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "trigger" }),
            });

            if (res.ok) {
                toast.success("Manual scan triggered");
                fetchData();
            } else {
                const data = await res.json();
                toast.error(data.error || "Failed to trigger scan");
            }
        } catch (e) {
            toast.error("Error triggering scan");
        } finally {
            setTriggering(false);
        }
    };

    const handleDomainToggle = async (targetId: number, enabled: boolean) => {
        try {
            const res = await fetch("/api/scheduler", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "toggleDomain", targetId, enabled }),
            });

            if (res.ok) {
                setDomains(prev => prev.map(d =>
                    d.id === targetId ? { ...d, scheduler_enabled: enabled ? 1 : 0 } : d
                ));
                toast.success(enabled ? "Domain enabled" : "Domain disabled");
            }
        } catch (e) {
            toast.error("Failed to toggle domain");
        }
    };

    const formatDate = (timestamp: number | null) => {
        if (!timestamp) return "Never";
        return new Date(timestamp * 1000).toLocaleString();
    };

    const frequencyLabel = (freq: string) => {
        switch (freq) {
            case "6h": return "Every 6 hours";
            case "12h": return "Every 12 hours";
            case "24h": return "Daily";
            case "168h": return "Weekly";
            default: return freq;
        }
    };

    if (loading) return <div className="text-center py-8">Loading scheduler...</div>;

    return (
        <div className="space-y-6">
            {/* Main Scheduler Settings */}
            <Card className="border-border bg-card">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Clock className="h-5 w-5 text-purple-400" />
                        Scheduled Subdomain Monitoring
                    </CardTitle>
                    <CardDescription>
                        Automatically scan your monitored domains for new subdomains on a schedule.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Enable/Disable Toggle */}
                    <div className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                            <Label className="text-base">Enable Scheduler</Label>
                            <p className="text-sm text-muted-foreground">
                                Automatically run Subfinder scans for all enabled domains
                            </p>
                        </div>
                        <Switch
                            checked={settings?.enabled || false}
                            onCheckedChange={handleToggle}
                            disabled={saving}
                        />
                    </div>

                    {/* Frequency Selection */}
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label>Scan Frequency</Label>
                            <Select
                                value={settings?.frequency || "24h"}
                                onValueChange={(value) => handleSave({ frequency: value as any })}
                                disabled={!settings?.enabled || saving}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="6h">Every 6 hours</SelectItem>
                                    <SelectItem value="12h">Every 12 hours</SelectItem>
                                    <SelectItem value="24h">Daily</SelectItem>
                                    <SelectItem value="168h">Weekly</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Run at Hour (for Daily/Weekly)</Label>
                            <Select
                                value={String(settings?.hour || 2)}
                                onValueChange={(value) => handleSave({ hour: parseInt(value) })}
                                disabled={!settings?.enabled || saving || !["24h", "168h"].includes(settings?.frequency || "")}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {Array.from({ length: 24 }, (_, i) => (
                                        <SelectItem key={i} value={String(i)}>
                                            {String(i).padStart(2, "0")}:00
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Notification Mode */}
                    <div className="space-y-2">
                        <Label>Notification Mode</Label>
                        <Select
                            value={settings?.notifyMode || "new_only"}
                            onValueChange={(value) => handleSave({ notifyMode: value as any })}
                            disabled={!settings?.enabled || saving}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="new_only">
                                    <div className="flex items-center gap-2">
                                        <BellOff className="h-4 w-4" />
                                        Only when new subdomains found
                                    </div>
                                </SelectItem>
                                <SelectItem value="always">
                                    <div className="flex items-center gap-2">
                                        <Bell className="h-4 w-4" />
                                        Always notify on completion
                                    </div>
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Auto-HTTPX Toggle */}
                    <div className="flex items-center justify-between rounded-lg border p-4 bg-blue-500/5 border-blue-500/20">
                        <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                                <Radar className="h-4 w-4 text-blue-400" />
                                <Label className="text-base">Auto-Probe New Subdomains</Label>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                Automatically run HTTPX on newly discovered subdomains to detect live web services
                            </p>
                        </div>
                        <Switch
                            checked={settings?.autoHttpx || false}
                            onCheckedChange={(checked) => handleSave({ autoHttpx: checked })}
                            disabled={!settings?.enabled || saving}
                        />
                    </div>

                    {/* Status Display */}
                    <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">Last Run:</span>
                            <span>{formatDate(settings?.lastRun ?? null)}</span>
                        </div>
                        {status?.nextRun && (
                            <div className="flex items-center gap-2 text-sm">
                                <Clock className="h-4 w-4 text-muted-foreground" />
                                <span className="text-muted-foreground">Next Run:</span>
                                <span>{new Date(status.nextRun).toLocaleString()}</span>
                            </div>
                        )}
                        {status?.isProcessing && (
                            <div className="flex items-center gap-2 text-sm text-yellow-500">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span>Currently scanning: {status.currentDomain}</span>
                            </div>
                        )}
                    </div>
                </CardContent>
                <CardFooter className="bg-muted/50 border-t border-border flex justify-between py-3">
                    <p className="text-xs text-muted-foreground">
                        {domains.filter(d => d.scheduler_enabled).length} of {domains.length} domains enabled
                    </p>
                    <Button
                        onClick={handleTrigger}
                        disabled={triggering || status?.isProcessing || domains.filter(d => d.scheduler_enabled).length === 0}
                        variant="outline"
                        className="gap-2"
                    >
                        {triggering ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Play className="h-4 w-4" />
                        )}
                        Run Now
                    </Button>
                </CardFooter>
            </Card>

            {/* Domain List */}
            <Card className="border-border bg-card">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <Globe className="h-5 w-5 text-blue-400" />
                        Monitored Domains
                    </CardTitle>
                    <CardDescription>
                        Toggle which domains are included in scheduled scans.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {domains.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <p>No monitored domains yet.</p>
                            <p className="text-sm">Run a Subfinder scan to add domains to the inventory.</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {domains.map((domain) => (
                                <div
                                    key={domain.id}
                                    className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        {domain.scheduler_enabled ? (
                                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                                        ) : (
                                            <XCircle className="h-4 w-4 text-muted-foreground" />
                                        )}
                                        <div>
                                            <p className="font-mono text-sm">{domain.target}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {domain.total_count} subdomains • Last: {formatDate(domain.last_scan_date)}
                                            </p>
                                        </div>
                                    </div>
                                    <Switch
                                        checked={domain.scheduler_enabled === 1}
                                        onCheckedChange={(checked) => handleDomainToggle(domain.id, checked)}
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Clock, Play, Calendar, Bell, BellOff, Globe, Loader2, CheckCircle2, XCircle, Radar, Zap, Shield, FlaskConical, AlertTriangle, HardDrive, Send, FileText, Eye, History, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";

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

interface NucleiSettings {
    scanMode: "quick" | "standard" | "full";
    templates: string;
    severity: string;
    rateLimit: number;
    concurrency: number;
    maxNewThreshold: number;
}

interface Domain {
    id: number;
    target: string;
    last_scan_date: number | null;
    scheduler_enabled: number;
    nuclei_enabled: number;
    total_count: number;
}

interface BackupSettings {
    backupEnabled: boolean;
    backupMode: "local" | "telegram";
    backupHour: number;
    notifyDetail: "summary" | "detailed";
}

interface SchedulerLog {
    id: number;
    domain: string;
    started_at: number;
    completed_at: number | null;
    status: 'running' | 'completed' | 'error';
    subdomains_total: number;
    subdomains_new: number;
    live_hosts: number;
    findings_count: number;
    error_message: string | null;
}

export function SchedulerPanel() {
    const [settings, setSettings] = useState<SchedulerSettings | null>(null);
    const [nucleiSettings, setNucleiSettings] = useState<NucleiSettings | null>(null);
    const [backupSettings, setBackupSettings] = useState<BackupSettings | null>(null);
    const [status, setStatus] = useState<SchedulerStatus | null>(null);
    const [domains, setDomains] = useState<Domain[]>([]);
    const [logs, setLogs] = useState<SchedulerLog[]>([]);
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
                setNucleiSettings(data.nucleiSettings);
                setBackupSettings(data.backupSettings);
                setStatus(data.status);
                setDomains(data.domains || []);
            }
        } catch (e) {
            console.error("Failed to fetch scheduler data", e);
        } finally {
            setLoading(false);
        }
    };

    const fetchLogs = async () => {
        try {
            const res = await fetch("/api/scheduler/logs");
            const data = await res.json();
            if (data.success) {
                setLogs(data.logs || []);
            }
        } catch (e) {
            console.error("Failed to fetch scheduler logs", e);
        }
    };

    const clearLogs = async () => {
        if (!confirm("Are you sure you want to clear all automation history?")) return;
        try {
            const res = await fetch("/api/scheduler/logs", { method: "DELETE" });
            const data = await res.json();
            if (data.success) {
                setLogs([]);
                toast.success("History cleared");
            }
        } catch (e) {
            toast.error("Failed to clear history");
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

    const handleNucleiToggle = async (targetId: number, enabled: boolean) => {
        try {
            const res = await fetch("/api/scheduler", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "toggleNuclei", targetId, enabled }),
            });

            if (res.ok) {
                setDomains(prev => prev.map(d =>
                    d.id === targetId ? { ...d, nuclei_enabled: enabled ? 1 : 0 } : d
                ));
                toast.success(enabled ? "Nuclei enabled" : "Nuclei disabled");
            }
        } catch (e) {
            toast.error("Failed to toggle Nuclei");
        }
    };

    const handleNucleiSettingsSave = async (updates: Partial<NucleiSettings>) => {
        setSaving(true);
        try {
            const res = await fetch("/api/scheduler", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nucleiUpdate: updates }),
            });

            if (res.ok) {
                const data = await res.json();
                setNucleiSettings(data.nucleiSettings);
                toast.success("Nuclei settings saved");
            } else {
                toast.error("Failed to save Nuclei settings");
            }
        } catch (e) {
            toast.error("Error saving Nuclei settings");
        } finally {
            setSaving(false);
        }
    };

    const handleBackupSettingsSave = async (updates: Partial<BackupSettings>) => {
        setSaving(true);
        try {
            const res = await fetch("/api/scheduler", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ backupUpdate: updates }),
            });

            if (res.ok) {
                const data = await res.json();
                setBackupSettings(data.backupSettings);
                toast.success("Backup settings saved");
            } else {
                toast.error("Failed to save backup settings");
            }
        } catch (e) {
            toast.error("Error saving backup settings");
        } finally {
            setSaving(false);
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

    const formatLogDate = (timestamp: number) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return "Just now";
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    };

    const StatusBadge = ({ status }: { status: string }) => {
        const styles: Record<string, string> = {
            running: "bg-blue-500/20 text-blue-400 border-blue-500/30",
            completed: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
            error: "bg-red-500/20 text-red-400 border-red-500/30",
        };
        const icons: Record<string, React.ReactNode> = {
            running: <Loader2 className="h-3 w-3 animate-spin" />,
            completed: <CheckCircle2 className="h-3 w-3" />,
            error: <XCircle className="h-3 w-3" />,
        };
        return (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${styles[status] || styles.error}`}>
                {icons[status]}
                {status}
            </span>
        );
    };

    return (
        <Tabs defaultValue="schedule" className="w-full" onValueChange={(v) => v === "history" && fetchLogs()}>
            <TabsList className="bg-muted mb-6">
                <TabsTrigger value="schedule" className="data-[state=active]:bg-background">
                    <Clock className="mr-2 h-4 w-4" />
                    Schedule
                </TabsTrigger>
                <TabsTrigger value="history" className="data-[state=active]:bg-background">
                    <History className="mr-2 h-4 w-4" />
                    History
                </TabsTrigger>
            </TabsList>

            <TabsContent value="schedule">
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
                                        {status?.isProcessing
                                            ? `Currently scanning: ${status.currentDomain}`
                                            : settings?.enabled
                                                ? `Next run: ${status?.nextRun || "Calculating..."}`
                                                : "Scheduler is disabled"}
                                    </p>
                                </div>
                                <div className="flex items-center gap-4">
                                    {settings?.enabled && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={handleTrigger}
                                            disabled={triggering || status?.isProcessing}
                                        >
                                            {triggering ? (
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            ) : (
                                                <Play className="mr-2 h-4 w-4" />
                                            )}
                                            Run Now
                                        </Button>
                                    )}
                                    <Switch
                                        checked={settings?.enabled}
                                        onCheckedChange={handleToggle}
                                        disabled={saving}
                                    />
                                </div>
                            </div>

                            {/* Frequency */}
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label>Scan Frequency</Label>
                                    <Select
                                        value={settings?.frequency}
                                        onValueChange={(v) => handleSave({ frequency: v as any })}
                                        disabled={saving}
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
                                    <Label>Start Hour (UTC)</Label>
                                    <Select
                                        value={String(settings?.hour || 0)}
                                        onValueChange={(v) => handleSave({ hour: parseInt(v) })}
                                        disabled={saving}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {Array.from({ length: 24 }, (_, i) => (
                                                <SelectItem key={i} value={String(i)}>
                                                    {String(i).padStart(2, '0')}:00 UTC
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Auto HTTPX */}
                            <div className="flex items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5">
                                    <div className="flex items-center gap-2">
                                        <Radar className="h-4 w-4 text-cyan-400" />
                                        <Label className="text-base">Auto-Probe (HTTPX)</Label>
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                        Automatically probe new subdomains for live hosts after discovery.
                                    </p>
                                </div>
                                <Switch
                                    checked={settings?.autoHttpx}
                                    onCheckedChange={(v) => handleSave({ autoHttpx: v })}
                                    disabled={saving}
                                />
                            </div>

                            {/* Notification Mode */}
                            <div className="space-y-2">
                                <Label className="flex items-center gap-2">
                                    <Bell className="h-4 w-4" />
                                    Telegram Notifications
                                </Label>
                                <Select
                                    value={settings?.notifyMode}
                                    onValueChange={(v) => handleSave({ notifyMode: v as any })}
                                    disabled={saving}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="always">
                                            <div className="flex items-center gap-2">
                                                <Bell className="h-4 w-4" />
                                                Always notify
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="new_only">
                                            <div className="flex items-center gap-2">
                                                <BellOff className="h-4 w-4" />
                                                Only when new subdomains found
                                            </div>
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Last Run */}
                            {settings?.lastRun && (
                                <div className="text-sm text-muted-foreground border-t pt-4">
                                    <Calendar className="inline h-4 w-4 mr-1" />
                                    Last completed: {formatDate(settings.lastRun)}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Notification Detail Settings */}
                    <Card className="border-border bg-card">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Send className="h-5 w-5 text-blue-400" />
                                Notification Settings
                            </CardTitle>
                            <CardDescription>
                                Configure how detailed notifications are sent to Telegram.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label className="flex items-center gap-2">
                                    <FileText className="h-4 w-4" />
                                    Notification Detail Level
                                </Label>
                                <Select
                                    value={backupSettings?.notifyDetail || "summary"}
                                    onValueChange={(v) => handleBackupSettingsSave({ notifyDetail: v as any })}
                                    disabled={saving}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="summary">
                                            <div className="flex items-center gap-2">
                                                <Eye className="h-4 w-4" />
                                                Summary (counts only)
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="detailed">
                                            <div className="flex items-center gap-2">
                                                <FileText className="h-4 w-4" />
                                                Detailed (includes subdomain names)
                                            </div>
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground">
                                    Summary mode only shows counts (safer for sensitive targets). Detailed mode includes subdomain names in notifications.
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Nuclei Settings */}
                    <Card className="border-border bg-card">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Shield className="h-5 w-5 text-orange-400" />
                                Nuclei Vulnerability Scanning
                            </CardTitle>
                            <CardDescription>
                                Configure automatic vulnerability scanning for live hosts discovered during scheduled scans.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Scan Mode */}
                            <div className="space-y-2">
                                <Label className="flex items-center gap-2">
                                    <Zap className="h-4 w-4" />
                                    Scan Mode
                                </Label>
                                <Select
                                    value={nucleiSettings?.scanMode}
                                    onValueChange={(v) => handleNucleiSettingsSave({ scanMode: v as any })}
                                    disabled={saving}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="quick">
                                            <div className="flex items-center gap-2">
                                                <Zap className="h-4 w-4 text-yellow-400" />
                                                Quick (CVEs only)
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="standard">
                                            <div className="flex items-center gap-2">
                                                <Shield className="h-4 w-4 text-blue-400" />
                                                Standard (CVEs + Exposures)
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="full">
                                            <div className="flex items-center gap-2">
                                                <FlaskConical className="h-4 w-4 text-purple-400" />
                                                Full (All templates)
                                            </div>
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Custom Templates */}
                            <div className="space-y-2">
                                <Label>Custom Templates (comma-separated paths)</Label>
                                <Input
                                    value={nucleiSettings?.templates || ""}
                                    onChange={(e) => handleNucleiSettingsSave({ templates: e.target.value })}
                                    placeholder="e.g., /templates/custom/, cves/2024/"
                                    disabled={saving}
                                />
                            </div>

                            {/* Severity Filter */}
                            <div className="space-y-2">
                                <Label>Severity Filter</Label>
                                <Select
                                    value={nucleiSettings?.severity || "critical,high,medium"}
                                    onValueChange={(v) => handleNucleiSettingsSave({ severity: v })}
                                    disabled={saving}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="critical">Critical only</SelectItem>
                                        <SelectItem value="critical,high">Critical + High</SelectItem>
                                        <SelectItem value="critical,high,medium">Critical + High + Medium</SelectItem>
                                        <SelectItem value="critical,high,medium,low">All severities</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Rate Limit & Concurrency */}
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label>Rate Limit (req/s)</Label>
                                    <Input
                                        type="number"
                                        value={nucleiSettings?.rateLimit || 150}
                                        onChange={(e) => handleNucleiSettingsSave({ rateLimit: parseInt(e.target.value) || 150 })}
                                        min={10}
                                        max={500}
                                        disabled={saving}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Concurrency</Label>
                                    <Input
                                        type="number"
                                        value={nucleiSettings?.concurrency || 25}
                                        onChange={(e) => handleNucleiSettingsSave({ concurrency: parseInt(e.target.value) || 25 })}
                                        min={5}
                                        max={100}
                                        disabled={saving}
                                    />
                                </div>
                            </div>

                            {/* Safety Threshold */}
                            <div className="flex items-center justify-between rounded-lg border p-4 bg-yellow-500/5 border-yellow-500/20">
                                <div className="space-y-0.5">
                                    <div className="flex items-center gap-2">
                                        <AlertTriangle className="h-4 w-4 text-yellow-400" />
                                        <Label className="text-base">Safety Threshold</Label>
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                        Skip Nuclei if more than this many new subdomains are found (prevents accidental large scans).
                                    </p>
                                </div>
                                <Input
                                    type="number"
                                    value={nucleiSettings?.maxNewThreshold || 50}
                                    onChange={(e) => handleNucleiSettingsSave({ maxNewThreshold: parseInt(e.target.value) || 50 })}
                                    min={10}
                                    max={500}
                                    className="w-24"
                                    disabled={saving}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Domain List */}
                    <Card className="border-border bg-card">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Globe className="h-5 w-5 text-emerald-400" />
                                Monitored Targets
                            </CardTitle>
                            <CardDescription>
                                Toggle scheduling for each domain. Add domains via Subfinder inventory.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {domains.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    <Globe className="h-12 w-12 mx-auto mb-2 opacity-50" />
                                    <p>No domains in inventory.</p>
                                    <p className="text-sm">Run a Subfinder scan to add domains.</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <div className="grid grid-cols-3 gap-4 text-xs font-medium text-muted-foreground px-4 py-2">
                                        <div>Domain</div>
                                        <div className="text-center">Subfinder</div>
                                        <div className="text-center">Nuclei</div>
                                    </div>
                                    {domains.map((domain) => (
                                        <div
                                            key={domain.id}
                                            className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50"
                                        >
                                            <div className="flex items-center gap-3">
                                                <Globe className="h-4 w-4 text-muted-foreground" />
                                                <div>
                                                    <p className="font-medium">{domain.target}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {domain.total_count} subdomains • Last: {formatDate(domain.last_scan_date)}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <Switch
                                                    checked={domain.scheduler_enabled === 1}
                                                    onCheckedChange={(checked) => handleDomainToggle(domain.id, checked)}
                                                />
                                                <Switch
                                                    checked={domain.nuclei_enabled === 1}
                                                    onCheckedChange={(checked) => handleNucleiToggle(domain.id, checked)}
                                                    disabled={domain.scheduler_enabled !== 1}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </TabsContent>

            <TabsContent value="history">
                <Card className="border-border bg-card">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="flex items-center gap-2">
                                    <History className="h-5 w-5 text-blue-400" />
                                    Automation History
                                </CardTitle>
                                <CardDescription>
                                    View logs of all scheduled scan runs.
                                </CardDescription>
                            </div>
                            {logs.length > 0 && (
                                <Button variant="outline" size="sm" onClick={clearLogs}>
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Clear History
                                </Button>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent>
                        {logs.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                <History className="h-12 w-12 mx-auto mb-2 opacity-50" />
                                <p>No automation history yet.</p>
                                <p className="text-sm">Run a scheduled scan to see logs here.</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <div className="grid grid-cols-6 gap-4 text-xs font-medium text-muted-foreground px-4 py-2 border-b">
                                    <div>Time</div>
                                    <div>Domain</div>
                                    <div className="text-center">Status</div>
                                    <div className="text-center">New Subs</div>
                                    <div className="text-center">New Live</div>
                                    <div className="text-center">Findings</div>
                                </div>
                                {logs.map((log) => (
                                    <div
                                        key={log.id}
                                        className={`grid grid-cols-6 gap-4 items-center p-4 rounded-lg border hover:bg-muted/50 ${log.status === 'error' ? 'border-red-500/30 bg-red-500/5' : ''}`}
                                    >
                                        <div className="text-sm">
                                            <p className="font-medium">{formatLogDate(log.started_at)}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {new Date(log.started_at).toLocaleTimeString()}
                                            </p>
                                        </div>
                                        <div className="font-mono text-sm truncate" title={log.domain}>
                                            {log.domain}
                                        </div>
                                        <div className="text-center">
                                            <StatusBadge status={log.status} />
                                        </div>
                                        <div className="text-center">
                                            <span className={`font-medium ${log.subdomains_new > 0 ? 'text-emerald-400' : 'text-muted-foreground'}`}>
                                                {log.subdomains_new}
                                            </span>
                                        </div>
                                        <div className="text-center font-medium">
                                            {log.live_hosts}
                                        </div>
                                        <div className="text-center">
                                            {log.findings_count > 0 ? (
                                                <span className="text-orange-400 font-medium">{log.findings_count}</span>
                                            ) : (
                                                <span className="text-muted-foreground">0</span>
                                            )}
                                        </div>
                                        {log.error_message && (
                                            <div className="col-span-6 text-xs text-red-400 bg-red-500/10 p-2 rounded mt-1">
                                                <AlertTriangle className="inline h-3 w-3 mr-1" />
                                                {log.error_message}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
    );
}


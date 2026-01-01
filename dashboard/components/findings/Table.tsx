"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, RefreshCw, Filter, Trash2, Copy, ExternalLink, Zap } from "lucide-react";
import { toast } from "sonner";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { cn } from "@/lib/utils";

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
    _sourceFile?: string;
    _status?: string;
    _dbId?: number;
    request?: string;
    response?: string;
}

interface HostFilterProps {
    hosts: string[];
    selectedHosts: string[];
    onToggle: (host: string) => void;
    onClear: () => void;
}

const HostFilter = ({ hosts, selectedHosts, onToggle, onClear }: HostFilterProps) => {
    const [search, setSearch] = useState("");

    const filteredHosts = hosts.filter(host =>
        host.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                    <Filter className="mr-2 h-4 w-4" />
                    {selectedHosts.length === 0 ? "Host" : `${selectedHosts.length} selected`}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-black/90 border-white/10 text-zinc-300 max-h-[300px] overflow-y-auto w-[250px]">
                <DropdownMenuLabel>Filter by Host</DropdownMenuLabel>

                <div className="px-2 py-1 sticky top-0 bg-black/90 z-10" onKeyDown={(e) => e.stopPropagation()}>
                    <input
                        type="text"
                        placeholder="Search hosts..."
                        className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-slate-500"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>

                <DropdownMenuSeparator className="bg-white/10" />

                <DropdownMenuItem onClick={onClear}>
                    <span className={selectedHosts.length === 0 ? "font-bold" : ""}>All Hosts</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-white/10" />

                {filteredHosts.map((host) => (
                    <DropdownMenuItem key={host} onClick={(e) => { e.preventDefault(); onToggle(host); }}>
                        <input
                            type="checkbox"
                            checked={selectedHosts.includes(host)}
                            onChange={() => { }}
                            className="mr-2"
                        />
                        <span className="truncate max-w-[200px]" title={host}>{host}</span>
                    </DropdownMenuItem>
                ))}
                {filteredHosts.length === 0 && (
                    <div className="p-2 text-xs text-muted-foreground text-center">No matching hosts</div>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
};

export function FindingsTable() {
    const [findings, setFindings] = useState<Finding[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);
    const [severityFilters, setSeverityFilters] = useState<string[]>(["critical", "high", "medium", "low", "unknown"]);
    const [statusFilters, setStatusFilters] = useState<string[]>([]);
    const [hostFilters, setHostFilters] = useState<string[]>([]);

    const fetchFindings = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/findings");
            const data = await res.json();
            setFindings(data);
        } catch (e) { console.error(e) }
        finally { setLoading(false); }
    };

    useEffect(() => {
        fetchFindings();
    }, []);

    const getSeverityColor = (severity: string) => {
        switch (severity.toLowerCase()) {
            case "critical": return "bg-red-500/20 text-red-500 hover:bg-red-500/30 border-red-500/50";
            case "high": return "bg-orange-500/20 text-orange-500 hover:bg-orange-500/30 border-orange-500/50";
            case "medium": return "bg-yellow-500/20 text-yellow-500 hover:bg-yellow-500/30 border-yellow-500/50";
            case "low": return "bg-blue-500/20 text-blue-500 hover:bg-blue-500/30 border-blue-500/50";
            default: return "bg-zinc-500/20 text-zinc-500 border-zinc-500/50";
        }
    };

    const getSeverityBorder = (severity: string) => {
        switch (severity.toLowerCase()) {
            case "critical": return "border-red-500/50 shadow-red-500/5";
            case "high": return "border-orange-500/50 shadow-orange-500/5";
            case "medium": return "border-yellow-500/50 shadow-yellow-500/5";
            case "low": return "border-blue-500/50 shadow-blue-500/5";
            default: return "border-zinc-500/50";
        }
    };

    const exportData = async () => {
        setLoading(true);
        try {
            const ExcelJS = (await import('exceljs')).default;
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Findings');

            worksheet.columns = [
                { header: 'ID', key: 'id', width: 25 },
                { header: 'Name', key: 'name', width: 40 },
                { header: 'Severity', key: 'severity', width: 15 },
                { header: 'URL', key: 'url', width: 40 },
                { header: 'Time', key: 'time', width: 25 },
                { header: 'Status', key: 'status', width: 20 }
            ];

            const severityColors: Record<string, string> = {
                critical: 'FFFFCCCC',
                high: 'FFFFE5CC',
                medium: 'FFFFFFCC',
                low: 'FFE5F2FF',
                info: 'FFFFFFFF',
                unknown: 'FFF2F2F2'
            };

            filteredFindings.forEach(f => {
                const sev = f.info.severity.toLowerCase();
                const color = severityColors[sev] || severityColors.unknown;

                const row = worksheet.addRow({
                    id: f["template-id"],
                    name: f.info.name,
                    severity: f.info.severity,
                    url: f["matched-at"] || f.host,
                    time: f.timestamp,
                    status: f._status || "New"
                });

                row.eachCell((cell) => {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: color }
                    };
                    cell.border = {
                        top: { style: 'thin', color: { argb: 'FFDDDDDD' } },
                        left: { style: 'thin', color: { argb: 'FFDDDDDD' } },
                        bottom: { style: 'thin', color: { argb: 'FFDDDDDD' } },
                        right: { style: 'thin', color: { argb: 'FFDDDDDD' } }
                    };
                });
            });

            worksheet.getRow(1).eachCell((cell) => {
                cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FF333333' }
                };
            });

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `findings_export_${Date.now()}.xlsx`;
            a.click();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Export failed:', error);
            alert('Failed to export Excel file');
        } finally {
            setLoading(false);
        }
    };

    const rescan = async (f: Finding) => {
        try {
            const response = await fetch("/api/rescan", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    findingId: (f as any)._dbId || (f as any).id,
                    target: f["matched-at"] || f.host,
                    templateId: f["template-path"] || f["template-id"]
                }),
            });

            const result = await response.json();

            if (result.success) {
                if (result.updated) {
                    toast.success("Vulnerability Still Active", {
                        description: "Rescan confirmed the issue exists. Status set to 'Confirmed'.",
                        duration: 4000,
                    });
                } else if (result.fixed) {
                    toast.success("Vulnerability Fixed! 🛡️", {
                        description: "Rescan clean. Status auto-updated to 'Fixed'.",
                        duration: 5000,
                    });
                }
                fetchFindings();
            } else {
                toast.error("Rescan Failed", {
                    description: result.message,
                    duration: 5000,
                });
            }
        } catch (e) {
            console.error(e);
            toast.error("Rescan failed", {
                description: "An unexpected error occurred."
            });
        }
    };

    const deleteFinding = async (f: Finding) => {
        if (!confirm("Are you sure you want to delete this finding? This cannot be undone.")) return;

        try {
            await fetch("/api/findings", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: (f as any)._dbId || (f as any).id
                }),
            });
            fetchFindings();
        } catch (e) {
            alert("Failed to delete finding");
            console.error(e);
        }
    };

    const updateStatus = async (f: Finding, newStatus: string) => {
        try {
            const response = await fetch("/api/findings", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: f._dbId,
                    status: newStatus
                }),
            });

            if (response.ok) {
                fetchFindings();
            } else {
                alert("Failed to update status");
            }
        } catch (e) {
            console.error(e);
            alert("Failed to update status");
        }
    };

    const getStatusColor = (status?: string) => {
        switch (status) {
            case "New": return "bg-blue-500/20 text-blue-500 border-blue-500/50";
            case "Confirmed": return "bg-red-500/20 text-red-500 border-red-500/50";
            case "False Positive": return "bg-gray-500/20 text-gray-500 border-gray-500/50";
            case "Fixed": return "bg-green-500/20 text-green-500 border-green-500/50";
            case "Closed": return "bg-purple-500/20 text-purple-500 border-purple-500/50";
            default: return "bg-zinc-500/20 text-zinc-500 border-zinc-500/50";
        }
    };

    const uniqueHosts = Array.from(new Set(findings.map(f => f.host || f["matched-at"] || "Unknown").filter(Boolean))).sort();

    const toggleSeverityFilter = (severity: string) => {
        setSeverityFilters(prev =>
            prev.includes(severity)
                ? prev.filter(s => s !== severity)
                : [...prev, severity]
        );
    };

    const toggleStatusFilter = (status: string) => {
        setStatusFilters(prev =>
            prev.includes(status)
                ? prev.filter(s => s !== status)
                : [...prev, status]
        );
    };

    const toggleHostFilter = (host: string) => {
        setHostFilters(prev =>
            prev.includes(host)
                ? prev.filter(h => h !== host)
                : [...prev, host]
        );
    };

    const filteredFindings = findings.filter(f => {
        const matchesSeverity = severityFilters.length === 0 || severityFilters.includes(f.info.severity.toLowerCase());
        const matchesStatus = statusFilters.length === 0 || statusFilters.includes(f._status || "New");
        const host = f.host || f["matched-at"] || "Unknown";
        const matchesHost = hostFilters.length === 0 || hostFilters.includes(host);
        return matchesSeverity && matchesStatus && matchesHost;
    });

    const exportToPDF = async () => {
        setLoading(true);
        try {
            const jsPDF = (await import('jspdf')).default;
            const autoTable = (await import('jspdf-autotable')).default;

            const doc = new jsPDF();

            doc.setFontSize(16);
            doc.text("Nuclei Findings Report", 14, 15);
            doc.setFontSize(10);
            doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 22);

            const tableColumn = ["ID", "Name", "Severity", "URL", "Time", "Status"];
            const tableRows: any[] = [];

            filteredFindings.forEach(f => {
                const findingData = [
                    f["template-id"],
                    f.info.name,
                    f.info.severity,
                    f["matched-at"] || f.host,
                    f.timestamp,
                    f._status || "New"
                ];
                tableRows.push(findingData);
            });

            autoTable(doc, {
                head: [tableColumn],
                body: tableRows,
                startY: 30,
                styles: { fontSize: 8 },
                headStyles: { fillColor: [22, 163, 74] },
                didParseCell: (data) => {
                    if (data.section === 'body' && data.column.index === 2) {
                        const severity = data.cell.raw?.toString().toLowerCase();
                        if (severity === 'critical') {
                            data.cell.styles.textColor = [220, 38, 38];
                            data.cell.styles.fontStyle = 'bold';
                        } else if (severity === 'high') {
                            data.cell.styles.textColor = [234, 88, 12];
                            data.cell.styles.fontStyle = 'bold';
                        } else if (severity === 'medium') {
                            data.cell.styles.textColor = [234, 179, 8];
                        } else if (severity === 'low') {
                            data.cell.styles.textColor = [37, 99, 235];
                        }
                    }
                }
            });

            doc.save(`findings_export_${Date.now()}.pdf`);
        } catch (error) {
            console.error(error);
            alert("Failed to export PDF");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-4 rounded-xl border border-border shadow-sm">
                <div>
                    <h3 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                        <Zap className="h-5 w-5 text-amber-500" /> Vulnerability Feed
                    </h3>
                    <p className="text-sm text-muted-foreground">Real-time security alerts from Nuclei engine.</p>
                </div>

                <div className="flex flex-wrap gap-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm">
                                <Filter className="mr-2 h-4 w-4" />
                                {severityFilters.length === 0 ? "Severity" : `${severityFilters.length} selected`}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-black/90 border-white/10 text-zinc-300">
                            <DropdownMenuLabel>Filter by Severity</DropdownMenuLabel>
                            <DropdownMenuSeparator className="bg-white/10" />
                            <DropdownMenuItem onClick={() => setSeverityFilters([])}>
                                <span className={severityFilters.length === 0 ? "font-bold" : ""}>All Severities</span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-white/10" />
                            {["critical", "high", "medium", "low", "info"].map((sev) => (
                                <DropdownMenuItem key={sev} onClick={(e) => { e.preventDefault(); toggleSeverityFilter(sev); }}>
                                    <input
                                        type="checkbox"
                                        checked={severityFilters.includes(sev)}
                                        onChange={() => { }}
                                        className="mr-2"
                                    />
                                    <span className="capitalize">{sev}</span>
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm">
                                <Filter className="mr-2 h-4 w-4" />
                                {statusFilters.length === 0 ? "Status" : `${statusFilters.length} selected`}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-black/90 border-white/10 text-zinc-300">
                            <DropdownMenuLabel>Filter by Status</DropdownMenuLabel>
                            <DropdownMenuSeparator className="bg-white/10" />
                            <DropdownMenuItem onClick={() => setStatusFilters([])}>
                                <span className={statusFilters.length === 0 ? "font-bold" : ""}>All Statuses</span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-white/10" />
                            {["New", "Confirmed", "False Positive", "Fixed", "Closed", "Regression"].map((status) => (
                                <DropdownMenuItem key={status} onClick={(e) => { e.preventDefault(); toggleStatusFilter(status); }}>
                                    <input
                                        type="checkbox"
                                        checked={statusFilters.includes(status)}
                                        onChange={() => { }}
                                        className="mr-2"
                                    />
                                    {status}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <HostFilter
                        hosts={uniqueHosts}
                        selectedHosts={hostFilters}
                        onToggle={toggleHostFilter}
                        onClear={() => setHostFilters([])}
                    />

                    <div className="h-6 w-px bg-border mx-1" />

                    <Button variant="outline" size="sm" onClick={fetchFindings} disabled={loading}>
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>

                    <Button variant="outline" size="sm" onClick={exportToPDF} title="Export PDF">
                        <Download className="mr-2 h-4 w-4" /> PDF
                    </Button>

                    <Button variant="outline" size="sm" onClick={exportData} title="Export XLS">
                        <Download className="mr-2 h-4 w-4" /> XLS
                    </Button>
                </div>
            </div>

            {filteredFindings.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center border border-dashed rounded-xl bg-card/50 text-muted-foreground">
                    <Zap className="h-10 w-10 opacity-20 mb-3" />
                    <p className="text-lg font-medium">{loading ? "Loading results..." : "No findings found"}</p>
                    <p className="text-xs">Adjust filters or run a new scan</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-3">
                    {filteredFindings.map((f, i) => (
                        <Card
                            key={i}
                            onClick={() => setSelectedFinding(f)}
                            className={cn(
                                "cursor-pointer transition-all duration-200 hover:scale-[1.005] hover:bg-muted/10 group",
                                "border shadow-sm",
                                getSeverityBorder(f.info.severity)
                            )}
                        >
                            <CardContent className="p-4">
                                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                                    <div className="flex-1 min-w-0 space-y-2">
                                        <div className="flex items-start gap-3">
                                            <div className="flex-1 min-w-0">
                                                <h4 className="text-base font-bold leading-tight group-hover:text-primary transition-colors mb-1.5">
                                                    {f.info.name}
                                                </h4>
                                                <div className="flex flex-wrap gap-2 items-center">
                                                    <Badge variant="outline" className={`${getSeverityColor(f.info.severity)} text-[10px] px-1.5 h-5 uppercase tracking-wider font-bold`}>
                                                        {f.info.severity}
                                                    </Badge>
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                                            <Badge className={cn("cursor-pointer hover:opacity-80 text-[10px] px-2 h-5 uppercase", getStatusColor(f._status))}>
                                                                {f._status || "New"}
                                                            </Badge>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="start" className="bg-black/90 border-white/10 text-zinc-300">
                                                            <DropdownMenuLabel>Change Status</DropdownMenuLabel>
                                                            <DropdownMenuSeparator className="bg-white/10" />
                                                            {["New", "Confirmed", "False Positive", "Fixed", "Closed"].map(s => (
                                                                <DropdownMenuItem key={s} onClick={(e) => { e.stopPropagation(); updateStatus(f, s); }}>
                                                                    {s}
                                                                </DropdownMenuItem>
                                                            ))}
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                    <p className="text-xs text-muted-foreground font-mono">
                                                        {f["template-id"]}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-muted/30 p-2 rounded-md border border-border/50 flex items-center gap-2">
                                            <ExternalLink className="h-3 w-3 shrink-0 text-blue-400" />
                                            <a
                                                href={f["matched-at"] || f.host}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-xs font-mono text-blue-400 hover:underline truncate"
                                                onClick={e => e.stopPropagation()}
                                            >
                                                {f["matched-at"] || f.host}
                                            </a>
                                        </div>
                                    </div>

                                    <div className="flex md:flex-col items-center md:items-end gap-2 text-xs text-muted-foreground">
                                        <span className="whitespace-nowrap" title={new Date(f.timestamp).toLocaleString()}>
                                            {new Date(f.timestamp).toLocaleDateString()}
                                        </span>

                                        <div className="flex items-center gap-1">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 hover:bg-background hover:text-foreground"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    navigator.clipboard.writeText(f["matched-at"] || f.host || "");
                                                    toast.success("Copied to clipboard");
                                                }}
                                                title="Copy URL"
                                            >
                                                <Copy className="h-3.5 w-3.5" />
                                            </Button>

                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 hover:bg-emerald-500/10 hover:text-emerald-500"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    rescan(f);
                                                }}
                                                title="Rescan"
                                            >
                                                <RefreshCw className="h-3.5 w-3.5" />
                                            </Button>

                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 hover:bg-red-500/10 hover:text-red-500"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    deleteFinding(f);
                                                }}
                                                title="Delete"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            <Dialog open={!!selectedFinding} onOpenChange={(open) => !open && setSelectedFinding(null)}>
                <DialogContent className="max-w-3xl bg-card border-border text-foreground max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-mono text-emerald-400">
                            {selectedFinding?.["template-id"]}
                        </DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            Detection Details
                        </DialogDescription>
                    </DialogHeader>

                    <Tabs defaultValue="overview" className="w-full mt-4">
                        <TabsList className="grid w-full grid-cols-4 bg-muted/50">
                            <TabsTrigger value="overview">Overview</TabsTrigger>
                            <TabsTrigger value="request">Request</TabsTrigger>
                            <TabsTrigger value="response">Response</TabsTrigger>
                            <TabsTrigger value="raw">Raw JSON</TabsTrigger>
                        </TabsList>

                        <TabsContent value="overview" className="mt-4 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Card className="bg-muted/50 border-border">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Template ID</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="font-mono text-sm text-foreground">{selectedFinding?.["template-id"]}</p>
                                    </CardContent>
                                </Card>
                                <Card className="bg-muted/50 border-border">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Severity</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <Badge variant="outline" className={`${getSeverityColor(selectedFinding?.info.severity || "")} uppercase`}>
                                            {selectedFinding?.info.severity}
                                        </Badge>
                                    </CardContent>
                                </Card>
                                <Card className="bg-muted/50 border-border col-span-1 md:col-span-2">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Matched At</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="font-mono text-sm text-foreground break-all">{selectedFinding?.["matched-at"] || selectedFinding?.host}</p>
                                    </CardContent>
                                </Card>
                                {selectedFinding?.["template-path"] && (
                                    <Card className="bg-muted/50 border-border col-span-1 md:col-span-2">
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Template Path</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <p className="font-mono text-sm text-muted-foreground break-all">{selectedFinding?.["template-path"]}</p>
                                        </CardContent>
                                    </Card>
                                )}
                                <Card className="bg-muted/50 border-border col-span-1 md:col-span-2">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Description</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-sm text-muted-foreground">{selectedFinding?.info.description || "No description provided."}</p>
                                    </CardContent>
                                </Card>
                            </div>

                            <div className="pt-4 border-t border-border mt-4 flex justify-end">
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => selectedFinding && deleteFinding(selectedFinding)}
                                    className="bg-red-500/10 text-red-500 hover:bg-red-500/20 border-red-500/20"
                                >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Delete Finding
                                </Button>
                            </div>
                        </TabsContent>

                        <TabsContent value="request" className="mt-4">
                            <ScrollArea className="h-[400px] w-full rounded-md border border-border bg-black/50 p-4">
                                <pre className="text-xs font-mono text-blue-300 whitespace-pre-wrap break-all">
                                    {selectedFinding?.request || "No request data available."}
                                </pre>
                            </ScrollArea>
                        </TabsContent>

                        <TabsContent value="response" className="mt-4">
                            <ScrollArea className="h-[400px] w-full rounded-md border border-border bg-black/50 p-4">
                                <pre className="text-xs font-mono text-orange-300 whitespace-pre-wrap break-all">
                                    {selectedFinding?.response || "No response data available."}
                                </pre>
                            </ScrollArea>
                        </TabsContent>

                        <TabsContent value="raw" className="mt-4">
                            <ScrollArea className="h-[400px] w-full rounded-md border border-border bg-black/50 p-4">
                                <pre className="text-xs font-mono text-emerald-400 whitespace-pre-wrap break-all">
                                    {JSON.stringify(selectedFinding, null, 2)}
                                </pre>
                            </ScrollArea>
                        </TabsContent>
                    </Tabs>
                </DialogContent>
            </Dialog>
        </div>
    );
}

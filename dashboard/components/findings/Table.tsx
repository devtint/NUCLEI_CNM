"use client";

import { useEffect, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, RefreshCw, Filter, Trash2, Sparkles } from "lucide-react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Finding {
    "template-id": string;
    "template-path"?: string;
    info: {
        name: string;
        severity: string;
        description?: string;
        tags?: string[];
    };
    "matched-at": string; // url
    timestamp: string;
    host?: string;
    _sourceFile?: string; // For deletion
    _status?: string; // Status from database
    _dbId?: number; // Database ID
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
                        // Prevent dropdown from closing when clicking input
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

    const exportData = async () => {
        setLoading(true);
        try {
            // Dynamically import exceljs to avoid server-side issues
            const ExcelJS = (await import('exceljs')).default;
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Findings');

            // Define columns
            worksheet.columns = [
                { header: 'ID', key: 'id', width: 25 },
                { header: 'Name', key: 'name', width: 40 },
                { header: 'Severity', key: 'severity', width: 15 },
                { header: 'URL', key: 'url', width: 40 },
                { header: 'Time', key: 'time', width: 25 },
                { header: 'Status', key: 'status', width: 20 }
            ];

            // Define colors (ARGB format)
            const severityColors: Record<string, string> = {
                critical: 'FFFFCCCC', // Light Red
                high: 'FFFFE5CC',     // Light Orange
                medium: 'FFFFFFCC',   // Light Yellow
                low: 'FFE5F2FF',      // Light Blue
                info: 'FFFFFFFF',     // White
                unknown: 'FFF2F2F2'   // Light Gray
            };

            // Add rows and style them
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

                // Apply fill to each cell in the row
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

            // Style header row
            worksheet.getRow(1).eachCell((cell) => {
                cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FF333333' }
                };
            });

            // Generate buffer
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
                fetchFindings(); // Refresh the list
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
            fetchFindings(); // Refresh list
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
                fetchFindings(); // Refresh list
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

    // Get unique hosts
    const uniqueHosts = Array.from(new Set(findings.map(f => f.host || f["matched-at"] || "Unknown").filter(Boolean))).sort();

    // Toggle severity filter
    const toggleSeverityFilter = (severity: string) => {
        setSeverityFilters(prev =>
            prev.includes(severity)
                ? prev.filter(s => s !== severity)
                : [...prev, severity]
        );
    };

    // Toggle status filter
    const toggleStatusFilter = (status: string) => {
        setStatusFilters(prev =>
            prev.includes(status)
                ? prev.filter(s => s !== status)
                : [...prev, status]
        );
    };

    // Toggle host filter
    const toggleHostFilter = (host: string) => {
        setHostFilters(prev =>
            prev.includes(host)
                ? prev.filter(h => h !== host)
                : [...prev, host]
        );
    };

    // Filter findings by severity, status, and host
    const filteredFindings = findings.filter(f => {
        const matchesSeverity = severityFilters.length === 0 || severityFilters.includes(f.info.severity.toLowerCase());
        const matchesStatus = statusFilters.length === 0 || statusFilters.includes(f._status || "New");
        const host = f.host || f["matched-at"] || "Unknown";
        const matchesHost = hostFilters.length === 0 || hostFilters.includes(host);
        return matchesSeverity && matchesStatus && matchesHost;
    });

    const [summary, setSummary] = useState<string | null>(null);
    const [summaryLoading, setSummaryLoading] = useState(false);
    const [aiEnabled, setAiEnabled] = useState(true);

    useEffect(() => {
        const stored = localStorage.getItem("nuclei_settings");
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                if (parsed.aiSummary !== undefined) {
                    setAiEnabled(parsed.aiSummary);
                }
            } catch (e) {
                console.error("Failed to parse settings", e);
            }
        }
    }, [findings]); // Re-check when findings change (implied refresh usually) or just once on mount/interaction if we had a global event. For now, simple check.

    const summarizeFindings = async () => {
        if (filteredFindings.length === 0) {
            alert("No findings to summarize.");
            return;
        }

        setSummaryLoading(true);
        try {
            const res = await fetch("/api/summarize", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ findings: filteredFindings })
            });
            const data = await res.json();

            if (data.success) {
                setSummary(data.summary);
            } else {
                alert("Summary failed: " + data.message);
            }
        } catch (e) {
            console.error(e);
            alert("Failed to generate summary.");
        } finally {
            setSummaryLoading(false);
        }
    };

    const exportToPDF = async () => {
        setLoading(true);
        try {
            const jsPDF = (await import('jspdf')).default;
            const autoTable = (await import('jspdf-autotable')).default;

            const doc = new jsPDF();

            // Add title
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
                headStyles: { fillColor: [22, 163, 74] }, // Emerald-600
                didParseCell: (data) => {
                    if (data.section === 'body' && data.column.index === 2) {
                        const severity = data.cell.raw?.toString().toLowerCase();
                        if (severity === 'critical') {
                            data.cell.styles.textColor = [220, 38, 38]; // Red
                            data.cell.styles.fontStyle = 'bold';
                        } else if (severity === 'high') {
                            data.cell.styles.textColor = [234, 88, 12]; // Orange
                            data.cell.styles.fontStyle = 'bold';
                        } else if (severity === 'medium') {
                            data.cell.styles.textColor = [234, 179, 8]; // Yellow
                        } else if (severity === 'low') {
                            data.cell.styles.textColor = [37, 99, 235]; // Blue
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
        <div className="space-y-4 bg-card p-4 rounded-xl border border-border shadow-sm">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-foreground">Vulnerability Feed</h3>
                <div className="flex gap-2">
                    {aiEnabled && (
                        <Button
                            variant="default"
                            size="sm"
                            onClick={summarizeFindings}
                            disabled={summaryLoading}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-500/50"
                        >
                            <Sparkles className={`mr-2 h-4 w-4 ${summaryLoading ? 'animate-spin' : ''}`} />
                            {summaryLoading ? "Thinking..." : "Summarize"}
                        </Button>
                    )}
                    {/* Severity Filter */}
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

                    {/* Status Filter */}
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

                    {/* Host Filter */}
                    <HostFilter
                        hosts={uniqueHosts}
                        selectedHosts={hostFilters}
                        onToggle={toggleHostFilter}
                        onClear={() => setHostFilters([])}
                    />

                    <Button variant="outline" size="sm" onClick={fetchFindings} disabled={loading}>
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>

                    <Button variant="outline" size="sm" onClick={exportToPDF} title="Export current view to PDF">
                        <Download className="mr-2 h-4 w-4" /> PDF
                    </Button>

                    <Button variant="outline" size="sm" onClick={exportData} title="Export current view to Excel">
                        <Download className="mr-2 h-4 w-4" /> XLS
                    </Button>
                </div>
            </div>


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

            <Dialog open={!!summary} onOpenChange={(open) => !open && setSummary(null)}>
                <DialogContent className="max-w-2xl bg-card border-border text-foreground max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-indigo-400">
                            <Sparkles className="w-5 h-5" />
                            AI Security Summary
                        </DialogTitle>
                    </DialogHeader>
                    <div className="mt-4 prose prose-invert prose-sm max-w-none">
                        {/* Simple markdown rendering */}
                        {summary?.split('\n').map((line, i) => (
                            <p key={i} className={line.startsWith('#') ? "font-bold text-lg mt-4 mb-2 text-black" : "mb-2 text-zinc-900 font-medium"}>
                                {line.replace(/^#+\s/, '').replace(/\*\*/g, '')}
                            </p>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>

            <div className="rounded-md border border-white/10 overflow-hidden">
                <Table>
                    <TableHeader className="bg-white/5">
                        <TableRow className="hover:bg-transparent border-white/10">
                            <TableHead className="text-black font-bold">Severity</TableHead>
                            <TableHead className="text-black font-bold">Status</TableHead>
                            <TableHead className="text-black font-bold">Vulnerability</TableHead>
                            <TableHead className="text-black font-bold">Host</TableHead>
                            <TableHead className="text-black font-bold">Template ID</TableHead>
                            <TableHead className="text-black font-bold">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredFindings.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center h-24 text-zinc-500">
                                    {loading ? "Loading..." : severityFilters.length > 0 ? `No findings matching selected severities.` : "No findings found yet."}
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredFindings.map((f, i) => (
                                <TableRow key={i} className="border-white/10 hover:bg-white/5 group cursor-pointer" onClick={() => setSelectedFinding(f)}>
                                    <TableCell>
                                        <Badge variant="outline" className={`${getSeverityColor(f.info.severity)} uppercase text-[10px] tracking-wider`}>
                                            {f.info.severity}
                                        </Badge>
                                    </TableCell>
                                    <TableCell onClick={(e) => e.stopPropagation()}>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Badge className={`${getStatusColor(f._status)} border cursor-pointer hover:opacity-80 uppercase text-[10px] tracking-wider`}>
                                                    {f._status || "New"}
                                                </Badge>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="start" className="bg-black/90 border-white/10 text-zinc-300">
                                                <DropdownMenuLabel>Change Status</DropdownMenuLabel>
                                                <DropdownMenuSeparator className="bg-white/10" />
                                                <DropdownMenuItem onClick={() => updateStatus(f, "New")}>
                                                    New
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => updateStatus(f, "Confirmed")}>
                                                    Confirmed
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => updateStatus(f, "False Positive")}>
                                                    False Positive
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => updateStatus(f, "Fixed")}>
                                                    Fixed
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => updateStatus(f, "Closed")}>
                                                    Closed
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                    <TableCell className="font-bold text-black group-hover:text-emerald-700 transition-colors">
                                        {f.info.name}
                                    </TableCell>
                                    <TableCell className="text-black font-mono text-xs">{f["matched-at"] || f.host}</TableCell>
                                    <TableCell className="text-zinc-900 font-mono text-xs">{f["template-id"]}</TableCell>
                                    <TableCell>
                                        <div className="flex gap-2">
                                            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); rescan(f); }} className="text-emerald-400 hover:text-emerald-300">
                                                Rescan
                                            </Button>
                                            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); deleteFinding(f); }} className="text-red-400 hover:text-red-300">
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}

"use client";

import { useEffect, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, RefreshCw, Filter, Trash2 } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
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
}

export function FindingsTable() {
    const [findings, setFindings] = useState<Finding[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);

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

    const exportData = (filterSeverity?: string) => {
        const filtered = filterSeverity
            ? findings.filter(f => f.info.severity.toLowerCase() === filterSeverity.toLowerCase())
            : findings;

        const headers = ["ID", "Name", "Severity", "URL", "Time"];
        const rows = filtered.map(f => [
            f["template-id"],
            f.info.name,
            f.info.severity,
            f["matched-at"] || f.host,
            f.timestamp
        ]);
        const csv = [
            headers.join(","),
            ...rows.map(r => r.map(c => `"${c}"`).join(","))
        ].join("\n");

        const blob = new Blob([csv], { type: "text/csv" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `findings_${filterSeverity || 'all'}_${Date.now()}.csv`;
        a.click();
    };

    const rescan = async (f: Finding) => {
        try {
            await fetch("/api/scan", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    target: f["matched-at"] || f.host,
                    templateId: f["template-path"] || f["template-id"]
                }),
            });
            alert(`Rescan started for ${f["template-id"]}`);
        } catch (e) {
            console.error(e);
        }
    };

    const deleteFinding = async (f: Finding) => {
        if (!f._sourceFile) {
            alert("Error: Source file information is missing. Please refresh the vulnerability feed to update the data.");
            return;
        }
        if (!confirm("Are you sure you want to delete this finding? This cannot be undone.")) return;

        try {
            await fetch("/api/findings", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sourceFile: f._sourceFile,
                    templateId: f["template-id"],
                    matchedAt: f["matched-at"] || f.host
                }),
            });
            fetchFindings(); // Refresh list
        } catch (e) {
            alert("Failed to delete finding");
            console.error(e);
        }
    };

    return (
        <div className="space-y-4 bg-card p-4 rounded-xl border border-border shadow-sm">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-foreground">Vulnerability Feed</h3>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={fetchFindings} disabled={loading}>
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm">
                                <Download className="mr-2 h-4 w-4" /> Export
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-black/90 border-white/10 text-zinc-300">
                            <DropdownMenuLabel>Export Options</DropdownMenuLabel>
                            <DropdownMenuSeparator className="bg-white/10" />
                            <DropdownMenuItem onClick={() => exportData()}>
                                All Findings (CSV)
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => exportData("critical")} className="text-red-400">
                                Critical Only
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => exportData("high")} className="text-orange-400">
                                High Only
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => exportData("medium")} className="text-yellow-400">
                                Medium Only
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => exportData("low")} className="text-blue-400">
                                Low Only
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => exportData("info")}>
                                Info Only
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
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
                    <div className="mt-4 space-y-4">
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

                        <div className="pt-4 border-t border-border mt-4 flex justify-between items-center">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Full Raw Data</p>
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
                        <ScrollArea className="h-[200px] w-full rounded-md border border-border bg-black/50 p-4">
                            <pre className="text-xs font-mono text-emerald-400 whitespace-pre-wrap break-all">
                                {JSON.stringify(selectedFinding, null, 2)}
                            </pre>
                        </ScrollArea>
                    </div>
                </DialogContent>
            </Dialog>

            <div className="rounded-md border border-white/10 overflow-hidden">
                <Table>
                    <TableHeader className="bg-white/5">
                        <TableRow className="hover:bg-transparent border-white/10">
                            <TableHead className="text-zinc-400">Severity</TableHead>
                            <TableHead className="text-zinc-400">Vulnerability</TableHead>
                            <TableHead className="text-zinc-400">Host</TableHead>
                            <TableHead className="text-zinc-400">Template ID</TableHead>
                            <TableHead className="text-zinc-400">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {findings.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center h-24 text-zinc-500">
                                    {loading ? "Loading..." : "No findings found yet."}
                                </TableCell>
                            </TableRow>
                        ) : (
                            findings.map((f, i) => (
                                <TableRow key={i} className="border-white/10 hover:bg-white/5 group cursor-pointer" onClick={() => setSelectedFinding(f)}>
                                    <TableCell>
                                        <Badge variant="outline" className={`${getSeverityColor(f.info.severity)} uppercase text-[10px] tracking-wider`}>
                                            {f.info.severity}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="font-medium text-zinc-200 group-hover:text-emerald-400 transition-colors">
                                        {f.info.name}
                                    </TableCell>
                                    <TableCell className="text-zinc-400 font-mono text-xs">{f["matched-at"] || f.host}</TableCell>
                                    <TableCell className="text-muted-foreground font-mono text-xs">{f["template-id"]}</TableCell>
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

"use client";

import { useEffect, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Download, FileText, FileJson, Clock, Trash2 } from "lucide-react";

interface ScanRecord {
    id: string;
    filename: string;
    size: number;
    date: string;
    hasLog: boolean;
    // New database fields
    target?: string;
    startTime?: number;
    endTime?: number;
    status?: string;
    findingCount?: number;
}

export function ScanHistory() {
    const [history, setHistory] = useState<ScanRecord[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchHistory = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/history");
            const data = await res.json();
            console.log("History data received:", data); // Debug log
            setHistory(data);
        } catch (e) { console.error(e) }
        finally { setLoading(false); }
    };

    useEffect(() => {
        fetchHistory();
    }, []);

    const download = (filename: string) => {
        window.open(`/api/history/download?file=${filename}`, "_blank");
    };

    const deleteScan = async (id: string, filename: string) => {
        if (!confirm(`Are you sure you want to delete scan "${filename}"? This will delete all associated findings and cannot be undone.`)) {
            return;
        }

        try {
            const res = await fetch(`/api/history?id=${id}`, {
                method: "DELETE"
            });

            if (res.ok) {
                alert("Scan deleted successfully");
                fetchHistory(); // Refresh list
            } else {
                const error = await res.json();
                alert(`Failed to delete scan: ${error.error || "Unknown error"}`);
            }
        } catch (e) {
            console.error(e);
            alert("Failed to delete scan");
        }
    };

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return bytes + " B";
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
        return (bytes / (1024 * 1024)).toFixed(1) + " MB";
    };

    return (
        <div className="space-y-4 bg-card p-4 rounded-xl border border-border shadow-sm">
            <div className="flex items-center justify-between">
                <p className="text-muted-foreground">Archive of all past scans.</p>
                <Button variant="outline" size="sm" onClick={fetchHistory} disabled={loading}>
                    Refresh
                </Button>
            </div>

            <div className="rounded-md border border-border overflow-hidden">
                <Table>
                    <TableHeader className="bg-muted">
                        <TableRow className="hover:bg-transparent border-border">
                            <TableHead className="text-muted-foreground">Date</TableHead>
                            <TableHead className="text-muted-foreground">Scan Results</TableHead>
                            <TableHead className="text-muted-foreground">Size</TableHead>
                            <TableHead className="text-muted-foreground text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {history.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center h-24 text-muted-foreground">
                                    {loading ? "Loading..." : "No history found."}
                                </TableCell>
                            </TableRow>
                        ) : (
                            history.map((record) => (
                                <TableRow key={record.id} className="border-border hover:bg-muted/50">
                                    <TableCell className="text-muted-foreground font-mono text-xs">
                                        <div className="flex items-center gap-2">
                                            <Clock className="h-3 w-3 text-muted-foreground" />
                                            {new Date(record.date).toLocaleString()}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-foreground font-medium">
                                        {record.filename}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-xs">
                                        {formatSize(record.size)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-8 border-emerald-900/50 text-emerald-500 hover:bg-emerald-900/20"
                                                onClick={() => download(record.filename)}
                                            >
                                                <FileJson className="mr-2 h-3 w-3" /> JSON
                                            </Button>
                                            {record.hasLog && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-8 border-zinc-700 text-zinc-400 hover:bg-zinc-800"
                                                    onClick={() => download(`${record.id}.log`)}
                                                >
                                                    <FileText className="mr-2 h-3 w-3" /> Log
                                                </Button>
                                            )}
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-8 border-red-900/50 text-red-500 hover:bg-red-900/20"
                                                onClick={() => deleteScan(record.id, record.filename)}
                                            >
                                                <Trash2 className="mr-2 h-3 w-3" /> Delete
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

"use client";

import { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Download, Search, Globe, Loader2, ArrowUpDown, Target } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface SubdomainResult {
    subdomain: string;
    first_seen: string;
    last_seen: string;
}

interface SubdomainTableProps {
    scanId?: string | null;
    onScan?: (target: string) => void;
}

export function SubdomainTable({ scanId, onScan }: SubdomainTableProps) {
    const [results, setResults] = useState<SubdomainResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState("");
    const [sortAsc, setSortAsc] = useState(true);

    const fetchResults = async () => {
        if (!scanId) {
            setResults([]);
            return;
        }

        setLoading(true);
        try {
            const res = await fetch(`/api/subfinder?id=${scanId}`);
            const data = await res.json();

            // API currently returns string[] or objects? 
            // The API returns strings for legacy reasons? 
            // Let's check db.ts: getSubfinderResults returns string[] currently. 
            // Better to normalize here.
            if (Array.isArray(data)) {
                // Convert string[] to SubdomainResult[]
                const mapped = data.map((d: any) =>
                    typeof d === 'string'
                        ? { subdomain: d, first_seen: new Date().toISOString(), last_seen: new Date().toISOString() }
                        : d
                );
                setResults(mapped);
            }
        } catch (e) {
            console.error("Failed to load results", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (scanId) {
            fetchResults();
        } else {
            setResults([]);
        }
    }, [scanId]);

    const filtered = results
        .filter(r => r.subdomain.toLowerCase().includes(filter.toLowerCase()))
        .sort((a, b) => {
            return sortAsc
                ? a.subdomain.localeCompare(b.subdomain)
                : b.subdomain.localeCompare(a.subdomain);
        });

    const copyToClipboard = () => {
        if (filtered.length === 0) return;
        const text = filtered.map(r => r.subdomain).join("\n");
        navigator.clipboard.writeText(text);
        toast.success(`Copied ${filtered.length} subdomains`);
    };

    const download = (format: 'txt' | 'json') => {
        if (filtered.length === 0) return;

        const content = format === 'json'
            ? JSON.stringify(filtered.map(r => r.subdomain), null, 2)
            : filtered.map(r => r.subdomain).join("\n");

        const blob = new Blob([content], { type: format === 'json' ? 'application/json' : 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `subdomains.${format}`;
        a.click();
        URL.revokeObjectURL(url);
    };

    if (!scanId) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground border rounded-lg border-dashed">
                <Globe className="h-8 w-8 mb-2 opacity-50" />
                <p>Select a scan from history to view results.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4 animate-in fade-in duration-500">
            <div className="flex items-center justify-between gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Filter subdomains..."
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        className="pl-9 h-9"
                    />
                </div>
                <div className="flex gap-2">
                    <Badge variant="outline" className="h-9 px-3">
                        {filtered.length} found
                    </Badge>
                    <Button variant="outline" size="sm" onClick={() => download('json')}>
                        JSON
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => download('txt')}>
                        TXT
                    </Button>
                    <Button variant="outline" size="sm" onClick={copyToClipboard}>
                        <Copy className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            <div className="rounded-md border border-border bg-card">
                <Table>
                    <TableHeader>
                        <TableRow className="hover:bg-transparent">
                            <TableHead className="w-[50px]">#</TableHead>
                            <TableHead className="cursor-pointer hover:text-foreground" onClick={() => setSortAsc(!sortAsc)}>
                                <div className="flex items-center gap-1">
                                    Subdomain
                                    <ArrowUpDown className="h-3 w-3" />
                                </div>
                            </TableHead>
                            <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={3} className="h-48 text-center text-muted-foreground">
                                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                                    Loading results...
                                </TableCell>
                            </TableRow>
                        ) : filtered.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={3} className="h-48 text-center text-muted-foreground">
                                    No subdomains found matching your filter.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filtered.map((r, i) => (
                                <TableRow key={i} className="group">
                                    <TableCell className="text-muted-foreground text-xs font-mono">
                                        {i + 1}
                                    </TableCell>
                                    <TableCell className="font-mono text-sm text-foreground">
                                        <a
                                            href={`http://${r.subdomain}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="hover:underline hover:text-emerald-400 transition-colors"
                                        >
                                            {r.subdomain}
                                        </a>
                                    </TableCell>
                                    <TableCell className="text-right flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {onScan && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 w-6 p-0 hover:text-emerald-500 hover:bg-emerald-500/10"
                                                onClick={() => onScan(r.subdomain)}
                                                title="Scan with Nuclei"
                                            >
                                                <Target className="h-3 w-3" />
                                            </Button>
                                        )}
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 w-6 p-0"
                                            onClick={() => {
                                                navigator.clipboard.writeText(r.subdomain);
                                                toast.success("Copied");
                                            }}
                                            title="Copy subdomain"
                                        >
                                            <Copy className="h-3 w-3" />
                                        </Button>
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

"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, ChevronRight, Globe, Calendar, ArrowLeft, RefreshCw, LayoutList, Trash2, Copy, Crosshair, Target, Activity } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Target {
    id: number;
    target: string;
    last_scan_date: number;
    total_count: number;
    created_at: number;
}

interface Subdomain {
    id: number;
    subdomain: string;
    first_seen: number;
    last_seen: number;
    is_new: number; // 1 or 0
    // derived
    status?: 'active' | 'inactive' | 'new';
}

export function ResultsFeed({ initialTarget, onScanTarget }: { initialTarget?: string, onScanTarget?: (target: string) => void }) {
    const [targets, setTargets] = useState<Target[]>([]);
    const [filteredTargets, setFilteredTargets] = useState<Target[]>([]);
    const [selectedTarget, setSelectedTarget] = useState<Target | null>(null);
    const [subdomains, setSubdomains] = useState<Subdomain[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState("");
    const [filterStatus, setFilterStatus] = useState<string[]>([]); // Empty = All
    const [targetToDelete, setTargetToDelete] = useState<Target | null>(null);

    // Fetch Targets (Inventory)
    const fetchTargets = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/subfinder/inventory");
            const data = await res.json();
            setTargets(data);
            setFilteredTargets(data);

            // Handle initialTarget
            if (initialTarget && data.length > 0) {
                const target = data.find((t: Target) => t.target === initialTarget);
                if (target) {
                    fetchSubdomains(target);
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    // Fetch Subdomains for Target
    const fetchSubdomains = async (target: Target) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/subfinder/inventory?targetId=${target.id}`);
            const data = await res.json();

            // Process badges
            const rawSubdomains = data.subdomains || [];
            const processed = rawSubdomains.map((s: Subdomain) => {
                const isNew = s.first_seen === s.last_seen; // Or use is_new flag
                const isActive = s.last_seen >= target.last_scan_date;
                return {
                    ...s,
                    status: isNew ? 'new' : (isActive ? 'active' : 'inactive')
                };
            });

            setSubdomains(processed);
            setSubdomains(processed);
            // Use the fresh target data from the API to show updated counts/dates
            if (data.target) {
                setSelectedTarget(data.target);
            } else {
                setSelectedTarget(target);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTargets();
    }, [initialTarget]);

    useEffect(() => {
        if (!search) {
            setFilteredTargets(targets);
        } else {
            setFilteredTargets(targets.filter(t => t.target.toLowerCase().includes(search.toLowerCase())));
        }
    }, [search, targets]);

    const formatDate = (ts: number) => {
        if (!ts) return "Never";
        return new Date(ts * 1000).toLocaleString();
    };

    const StatusBadge = ({ status }: { status: string }) => {
        switch (status) {
            case 'new':
                return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/50 uppercase text-[10px]">New</Badge>;
            case 'active':
                return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/50 uppercase text-[10px]">Active</Badge>;
            case 'inactive':
                return <Badge className="bg-zinc-500/20 text-zinc-500 border-zinc-500/50 uppercase text-[10px]">Inactive</Badge>;
            default:
                return null;
        }
    };

    if (selectedTarget) {
        // Detail View (Subdomains)
        return (
            <div className="space-y-4 animate-in fade-in slide-in-from-right duration-300">
                <div className="flex items-center gap-4 mb-4">
                    <Button variant="ghost" size="sm" onClick={() => setSelectedTarget(null)}>
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Inventory
                    </Button>
                    <div className="flex-1">
                        <h2 className="text-xl font-bold flex items-center gap-2 text-emerald-600">
                            <Globe className="h-5 w-5 text-emerald-600" />
                            {selectedTarget.target}
                        </h2>
                        <p className="text-muted-foreground text-xs">
                            Last Scanned: {formatDate(selectedTarget.last_scan_date)} • Total: {subdomains.length}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => fetchSubdomains(selectedTarget)}>
                            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
                        </Button>
                        <Button
                            variant="default"
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700"
                            onClick={() => {
                                const activeSubs = subdomains
                                    .filter(s => {
                                        if (filterStatus.length > 0 && s.status && !filterStatus.includes(s.status)) return false;
                                        return s.subdomain.includes(search);
                                    })
                                    .map(s => s.subdomain);

                                if (activeSubs.length === 0) {
                                    toast.error("No subdomains to copy");
                                    return;
                                }
                                navigator.clipboard.writeText(activeSubs.join("\n"));
                                toast.success(`Copied ${activeSubs.length} subdomains to clipboard`);
                            }}
                        >
                            <Copy className="mr-2 h-4 w-4" /> Copy Subdomains
                        </Button>

                    </div>
                </div>

                <div className="flex items-center gap-2 mb-4">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search subdomains..."
                            className="pl-8"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="w-[140px] justify-between border-dashed">
                                Status {filterStatus.length > 0 ? `(${filterStatus.length})` : ""}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[150px]">
                            <DropdownMenuLabel>Filter Status</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {['new', 'active', 'inactive'].map((status) => (
                                <DropdownMenuCheckboxItem
                                    key={status}
                                    checked={filterStatus.includes(status)}
                                    onCheckedChange={(checked) => {
                                        if (checked) setFilterStatus([...filterStatus, status]);
                                        else setFilterStatus(filterStatus.filter(s => s !== status));
                                    }}
                                    onSelect={(e) => e.preventDefault()}
                                    className="capitalize"
                                >
                                    {status}
                                </DropdownMenuCheckboxItem>
                            ))}
                            {filterStatus.length > 0 && (
                                <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuCheckboxItem
                                        checked={false}
                                        onCheckedChange={() => setFilterStatus([])}
                                        onSelect={(e) => e.preventDefault()}
                                        className="justify-center text-center text-xs font-medium"
                                    >
                                        Clear Filter
                                    </DropdownMenuCheckboxItem>
                                </>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                <div className="rounded-md border border-white/10 overflow-hidden bg-card">
                    <Table>
                        <TableHeader className="bg-white/5">
                            <TableRow className="border-border hover:bg-transparent">
                                <TableHead className="w-[100px] text-foreground font-bold">Status</TableHead>
                                <TableHead className="text-foreground font-bold">Subdomain</TableHead>
                                <TableHead className="text-right text-foreground font-bold">First Seen</TableHead>
                                <TableHead className="text-right text-foreground font-bold">Last Seen</TableHead>
                                <TableHead className="text-right text-foreground font-bold w-[100px]">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {subdomains.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center h-24 text-muted-foreground">
                                        No subdomains found in database.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                subdomains
                                    .filter(s => {
                                        if (filterStatus.length > 0 && s.status && !filterStatus.includes(s.status)) return false;
                                        // Support comma separated search
                                        const terms = search.split(',').map(t => t.trim()).filter(t => t);
                                        if (terms.length === 0) return true;
                                        return terms.some(term => s.subdomain.toLowerCase().includes(term.toLowerCase()));
                                    })
                                    .map((sub) => (
                                        <TableRow key={sub.id} className="border-white/10 hover:bg-white/5">
                                            <TableCell>
                                                <StatusBadge status={sub.status || 'inactive'} />
                                            </TableCell>
                                            <TableCell className="font-mono text-sm">{sub.subdomain}</TableCell>
                                            <TableCell className="text-right text-xs text-muted-foreground font-mono">
                                                {formatDate(sub.first_seen)}
                                            </TableCell>
                                            <TableCell className="text-right text-xs text-muted-foreground font-mono">
                                                {formatDate(sub.last_seen)}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6"
                                                        onClick={() => {
                                                            navigator.clipboard.writeText(sub.subdomain);
                                                            toast.success("Subdomain copied");
                                                        }}
                                                        title="Copy Subdomain"
                                                    >
                                                        <Copy className="h-3 w-3" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6"
                                                        onClick={() => {
                                                            if (onScanTarget) {
                                                                onScanTarget(sub.subdomain);
                                                            } else {
                                                                navigator.clipboard.writeText(sub.subdomain);
                                                                toast.info("Copied for scanning (Scanner not linked)");
                                                            }
                                                        }}
                                                        title="Start Nuclei Scan"
                                                    >
                                                        <Target className="h-3 w-3" />
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

    // List View (Inventory Targets)
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <LayoutList className="h-5 w-5 text-emerald-400" />
                        Asset Inventory
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        Tracked domains and their subdomains history.
                    </p>
                </div>
                <div className="relative w-64">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search targets..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-8 bg-black/20"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredTargets.map((target) => (
                    <Card
                        key={target.id}
                        className="bg-card/50 border-white/10 hover:bg-card/80 transition-colors cursor-pointer group"
                        onClick={() => fetchSubdomains(target)}
                    >
                        <CardHeader className="p-4">
                            <div className="flex justify-between items-start">
                                <div>
                                    <CardTitle className="text-base font-bold text-emerald-600 group-hover:text-emerald-700 transition-colors">
                                        {target.target}
                                    </CardTitle>
                                    <CardDescription className="text-xs mt-1 text-muted-foreground">
                                        Updated: {formatDate(target.last_scan_date)}
                                    </CardDescription>
                                </div>
                                <div className="text-right">
                                    <span className="text-2xl font-bold text-foreground">{target.total_count}</span>
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Subdomains</p>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 w-6 p-0 mt-2 text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setTargetToDelete(target);
                                        }}
                                    >
                                        <Trash2 className="h-3 w-3" />
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                    </Card>
                ))}

                {filteredTargets.length === 0 && !loading && (
                    <div className="col-span-full text-center py-12 text-muted-foreground">
                        No targets found. Run a Subfinder scan to populate the inventory.
                    </div>
                )}
            </div>

            <AlertDialog open={!!targetToDelete} onOpenChange={(open) => !open && setTargetToDelete(null)}>
                <AlertDialogContent className="bg-card border-border">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-foreground">Delete Target</AlertDialogTitle>
                        <AlertDialogDescription className="text-muted-foreground">
                            Are you sure you want to delete <span className="font-mono text-emerald-400">{targetToDelete?.target}</span> and all its subdomain history? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="bg-background hover:bg-muted">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={async () => {
                                if (targetToDelete) {
                                    await fetch(`/api/subfinder/inventory?targetId=${targetToDelete.id}`, { method: 'DELETE' });
                                    toast.success("Target deleted successfully");
                                    fetchTargets();
                                    setTargetToDelete(null);
                                }
                            }}
                            className="bg-red-500 hover:bg-red-600 text-white"
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ShieldAlert, ServerCrash, Cpu, Loader2, AlertTriangle } from "lucide-react";

interface TopVuln {
    name: string;
    count: number;
    severity: string;
}

interface TopTarget {
    host: string;
    score: number;
    critical: number;
    high: number;
    medium: number;
}

interface TopTech {
    name: string;
    count: number;
}

// Fetch functions (shared queryKey with Stats.tsx)
const fetchFindings = async () => {
    const res = await fetch("/api/findings");
    if (!res.ok) throw new Error("Failed to fetch findings");
    return res.json();
};

const fetchHttpx = async () => {
    const res = await fetch("/api/httpx?view=all");
    if (!res.ok) throw new Error("Failed to fetch httpx");
    return res.json();
};

export function AnalysisRow() {
    // Use React Query for cached data fetching
    const { data: findings = [], isLoading: loadingFindings } = useQuery({
        queryKey: ["findings"],
        queryFn: fetchFindings,
        staleTime: 60 * 1000,
        gcTime: 5 * 60 * 1000,
    });

    const { data: httpxData = [], isLoading: loadingHttpx } = useQuery({
        queryKey: ["httpx", "all"],
        queryFn: fetchHttpx,
        staleTime: 60 * 1000,
        gcTime: 5 * 60 * 1000,
    });

    const loading = loadingFindings || loadingHttpx;

    // Process findings for analysis (computed from cached data)
    const vulnMap = new Map<string, { count: number, severity: string }>();
    const targetMap = new Map<string, { score: number, critical: number, high: number, medium: number }>();

    findings.forEach((f: any) => {
        const name = f.info?.name || "Unknown Issue";
        const sev = f.info?.severity?.toLowerCase() || "info";
        if (sev === 'info') return;

        const currentVuln = vulnMap.get(name) || { count: 0, severity: sev };
        currentVuln.count++;
        vulnMap.set(name, currentVuln);

        const url = f.host || "";
        let host = url;
        try { host = new URL(url).hostname; } catch { }
        if (!host) host = "Unknown Target";

        const currentTarget = targetMap.get(host) || { score: 0, critical: 0, high: 0, medium: 0 };
        if (sev === 'critical') { currentTarget.score += 10; currentTarget.critical++; }
        else if (sev === 'high') { currentTarget.score += 5; currentTarget.high++; }
        else if (sev === 'medium') { currentTarget.score += 2; currentTarget.medium++; }
        targetMap.set(host, currentTarget);
    });

    const vulns: TopVuln[] = Array.from(vulnMap.entries())
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

    const targets: TopTarget[] = Array.from(targetMap.entries())
        .map(([host, data]) => ({ host, ...data }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

    // Process HTTPX for tech stack
    const techMap = new Map<string, number>();
    httpxData.forEach((h: any) => {
        if (h.technologies) {
            try {
                const tList = JSON.parse(h.technologies);
                tList.forEach((t: string) => {
                    techMap.set(t, (techMap.get(t) || 0) + 1);
                });
            } catch { }
        }
    });

    const techs: TopTech[] = Array.from(techMap.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20);

    const getSevColor = (sev: string) => {
        switch (sev.toLowerCase()) {
            case 'critical': return 'text-red-500 bg-red-500/10 border-red-500/20';
            case 'high': return 'text-orange-500 bg-orange-500/10 border-orange-500/20';
            case 'medium': return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
            case 'low': return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
            default: return 'text-zinc-500 bg-zinc-500/10 border-zinc-500/20';
        }
    };

    if (loading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[1, 2, 3].map(i => (
                    <Card key={i} className="bg-card border-border shadow-sm h-[300px] flex items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </Card>
                ))}
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* 1. Top Vulnerabilities */}
            <Card className="bg-card border-border shadow-sm flex flex-col h-[320px]">
                <CardHeader className="pb-2">
                    <CardTitle className="text-base font-medium flex items-center gap-2">
                        <ShieldAlert className="h-4 w-4 text-red-400" />
                        Top Vulnerabilities
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 overflow-hidden p-0">
                    {vulns.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-sm">
                            <ShieldAlert className="h-8 w-8 mb-2 opacity-20" />
                            No findings yet
                        </div>
                    ) : (
                        <ScrollArea className="h-full">
                            <div className="divide-y divide-border/30">
                                {vulns.map((v, i) => (
                                    <div key={i} className="p-3 hover:bg-muted/10 transition-colors flex items-center justify-between text-sm">
                                        <div className="flex items-center gap-2 truncate">
                                            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${v.severity === 'critical' ? 'bg-red-500' : v.severity === 'high' ? 'bg-orange-500' : v.severity === 'medium' ? 'bg-yellow-500' : 'bg-blue-500'}`} />
                                            <span className="truncate" title={v.name}>{v.name}</span>
                                        </div>
                                        <Badge variant="secondary" className="px-1.5 h-5 text-[10px] font-mono shrink-0">
                                            {v.count}
                                        </Badge>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    )}
                </CardContent>
            </Card>

            {/* 2. Top Risk Targets */}
            <Card className="bg-card border-border shadow-sm flex flex-col h-[320px]">
                <CardHeader className="pb-2">
                    <CardTitle className="text-base font-medium flex items-center gap-2">
                        <ServerCrash className="h-4 w-4 text-orange-400" />
                        Highest Risk Targets
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 overflow-hidden p-0">
                    {targets.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-sm">
                            <ServerCrash className="h-8 w-8 mb-2 opacity-20" />
                            No targets assessed
                        </div>
                    ) : (
                        <ScrollArea className="h-full">
                            <div className="divide-y divide-border/30">
                                {targets.map((t, i) => (
                                    <div key={i} className="p-3 hover:bg-muted/10 transition-colors flex flex-col gap-1.5">
                                        <div className="flex items-center justify-between text-sm font-medium">
                                            <span className="truncate max-w-[180px]" title={t.host}>{t.host}</span>
                                            {t.score > 0 && <span className="text-xs text-orange-500 font-mono">Risk: {t.score}</span>}
                                        </div>

                                        {/* Break bar */}
                                        <div className="h-1.5 w-full bg-muted/30 rounded-full overflow-hidden flex">
                                            {t.critical > 0 && (
                                                <div className="h-full bg-red-500" style={{ width: `${(t.critical / (t.critical + t.high + t.medium + 1)) * 100}%` }} />
                                            )}
                                            {t.high > 0 && (
                                                <div className="h-full bg-orange-500" style={{ width: `${(t.high / (t.critical + t.high + t.medium + 1)) * 100}%` }} />
                                            )}
                                            {t.medium > 0 && (
                                                <div className="h-full bg-yellow-500" style={{ width: `${(t.medium / (t.critical + t.high + t.medium + 1)) * 100}%` }} />
                                            )}
                                        </div>

                                        <div className="flex gap-2 text-[10px] text-muted-foreground">
                                            {t.critical > 0 && <span className="text-red-400">{t.critical} Crit</span>}
                                            {t.high > 0 && <span className="text-orange-400">{t.high} High</span>}
                                            {t.medium > 0 && <span className="text-yellow-400">{t.medium} Med</span>}
                                            {t.critical === 0 && t.high === 0 && t.medium === 0 && <span>No major issues</span>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    )}
                </CardContent>
            </Card>

            {/* 3. Tech Stack */}
            <Card className="bg-card border-border shadow-sm flex flex-col h-[320px]">
                <CardHeader className="pb-2">
                    <CardTitle className="text-base font-medium flex items-center gap-2">
                        <Cpu className="h-4 w-4 text-blue-400" />
                        Technology Fingerprint
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-4 flex-1 overflow-y-auto">
                    {techs.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-sm">
                            <Cpu className="h-8 w-8 mb-2 opacity-20" />
                            No technologies detected
                        </div>
                    ) : (
                        <div className="flex flex-wrap gap-2 content-start">
                            {techs.map((t, i) => (
                                <Badge
                                    key={i}
                                    variant="secondary"
                                    className="px-2 py-1 text-xs hover:bg-primary/10 transition-colors cursor-default"
                                    title={`${t.count} hosts`}
                                >
                                    {t.name}
                                    <span className="ml-1.5 opacity-50 text-[10px] border-l border-foreground/10 pl-1.5">
                                        {t.count}
                                    </span>
                                </Badge>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

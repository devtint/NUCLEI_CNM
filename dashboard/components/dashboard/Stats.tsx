"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, AlertTriangle, Shield, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface SeverityCounts {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
    total: number;
}

export function DashboardStats({ totalScans = 0, lastScan = "Never" }) {
    const [severityCounts, setSeverityCounts] = useState<SeverityCounts>({
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        info: 0,
        total: 0
    });

    useEffect(() => {
        // Fetch severity counts from findings
        fetch("/api/findings")
            .then(res => res.json())
            .then((findings: any[]) => {
                const counts = {
                    critical: 0,
                    high: 0,
                    medium: 0,
                    low: 0,
                    info: 0,
                    total: findings.length
                };

                findings.forEach(f => {
                    const severity = f.info?.severity?.toLowerCase();
                    if (severity === "critical") counts.critical++;
                    else if (severity === "high") counts.high++;
                    else if (severity === "medium") counts.medium++;
                    else if (severity === "low") counts.low++;
                    else if (severity === "info") counts.info++;
                });

                setSeverityCounts(counts);
            })
            .catch(err => console.error("Failed to fetch findings:", err));
    }, []);

    return (
        <div className="space-y-6">
            {/* Top Stats */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card className="bg-card border-border shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-foreground">Total Scans</CardTitle>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-foreground">{totalScans}</div>
                        <p className="text-xs text-muted-foreground">+0 from last hour</p>
                    </CardContent>
                </Card>

                <Card className="bg-card border-border shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-foreground">Total Findings</CardTitle>
                        <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-foreground">{severityCounts.total}</div>
                        <p className="text-xs text-muted-foreground">Across all scans</p>
                    </CardContent>
                </Card>

                <Card className="bg-card border-border shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-foreground">Last Activity</CardTitle>
                        <Activity className="h-4 w-4 text-emerald-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-xl font-bold text-foreground truncate">{lastScan}</div>
                        <p className="text-xs text-muted-foreground">System status: Ready</p>
                    </CardContent>
                </Card>
            </div>

            {/* Severity Breakdown */}
            <Card className="bg-card border-border shadow-sm">
                <CardHeader>
                    <CardTitle className="text-lg font-medium text-foreground flex items-center gap-2">
                        <Shield className="h-5 w-5" />
                        Findings by Severity
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <div className="flex flex-col items-center p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                            <Badge className="bg-red-500/20 text-red-500 border-red-500/50 mb-2 uppercase text-[10px]">Critical</Badge>
                            <div className="text-3xl font-bold text-red-500">{severityCounts.critical}</div>
                        </div>
                        <div className="flex flex-col items-center p-4 rounded-lg bg-orange-500/10 border border-orange-500/20">
                            <Badge className="bg-orange-500/20 text-orange-500 border-orange-500/50 mb-2 uppercase text-[10px]">High</Badge>
                            <div className="text-3xl font-bold text-orange-500">{severityCounts.high}</div>
                        </div>
                        <div className="flex flex-col items-center p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                            <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/50 mb-2 uppercase text-[10px]">Medium</Badge>
                            <div className="text-3xl font-bold text-yellow-500">{severityCounts.medium}</div>
                        </div>
                        <div className="flex flex-col items-center p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                            <Badge className="bg-blue-500/20 text-blue-500 border-blue-500/50 mb-2 uppercase text-[10px]">Low</Badge>
                            <div className="text-3xl font-bold text-blue-500">{severityCounts.low}</div>
                        </div>
                        <div className="flex flex-col items-center p-4 rounded-lg bg-zinc-500/10 border border-zinc-500/20">
                            <Badge className="bg-zinc-500/20 text-zinc-500 border-zinc-500/50 mb-2 uppercase text-[10px]">Info</Badge>
                            <div className="text-3xl font-bold text-zinc-500">{severityCounts.info}</div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, AlertTriangle, FileText } from "lucide-react";

export function DashboardStats({ totalScans = 0, criticals = 0, lastScan = "Never" }) {
    return (
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
                    <CardTitle className="text-sm font-medium text-red-400">Critical Findings</CardTitle>
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-red-400">{criticals}</div>
                    <p className="text-xs text-muted-foreground">Across all recent scans</p>
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
    );
}

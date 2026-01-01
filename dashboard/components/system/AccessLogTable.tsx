"use client";

import { useEffect, useState } from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatDistanceToNow } from "date-fns";

interface AccessLog {
    id: number;
    timestamp: number;
    ip_address: string;
    user_agent: string;
    event_type: string;
}

export function AccessLogTable() {
    const [logs, setLogs] = useState<AccessLog[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/system/access-logs')
            .then(res => res.json())
            .then(data => {
                setLogs(data);
                setLoading(false);
            })
            .catch(err => {
                console.error("Failed to fetch logs", err);
                setLoading(false);
            });
    }, []);

    return (
        <Card className="border-border shadow-none bg-card">
            <CardHeader>
                <CardTitle>Security Audit Log</CardTitle>
                <CardDescription>Recent administrative access events.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="rounded-md border border-border">
                    <Table>
                        <TableHeader>
                            <TableRow className="hover:bg-muted/50">
                                <TableHead>Time</TableHead>
                                <TableHead>Event</TableHead>
                                <TableHead>IP Address</TableHead>
                                <TableHead>Device / Browser</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center">Loading logs...</TableCell>
                                </TableRow>
                            ) : logs.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">No logs found.</TableCell>
                                </TableRow>
                            ) : (
                                logs.map((log) => (
                                    <TableRow key={log.id} className="hover:bg-muted/50">
                                        <TableCell className="font-mono text-xs">
                                            {new Date(log.timestamp).toLocaleString()}
                                            <span className="text-muted-foreground ml-2">
                                                ({formatDistanceToNow(log.timestamp, { addSuffix: true })})
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                                                {log.event_type}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="font-mono">{log.ip_address}</TableCell>
                                        <TableCell className="max-w-[300px] truncate" title={log.user_agent}>
                                            {log.user_agent}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}

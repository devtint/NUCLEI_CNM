"use client";

import { useEffect, useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { RefreshCw, Download, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { stripAnsiCodes } from "@/lib/ansi";

interface LogViewerProps {
    scanId: string;
    isRunning: boolean;
    open: boolean;
    onClose: () => void;
}

export function LogViewer({ scanId, isRunning, open, onClose }: LogViewerProps) {
    const [logs, setLogs] = useState("");
    const [loading, setLoading] = useState(false);
    const [fileSize, setFileSize] = useState(0);
    const [lastModified, setLastModified] = useState("");
    const [copied, setCopied] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    const fetchLogs = async () => {
        try {
            setLoading(true);
            const res = await fetch(`/api/scan/logs?id=${scanId}`);

            if (!res.ok) {
                const error = await res.json();
                setLogs(`Error: ${error.error || 'Failed to load logs'}`);
                return;
            }

            const data = await res.json();
            const cleanLogs = stripAnsiCodes(data.logs || "No logs available yet...");
            setLogs(cleanLogs);
            setFileSize(data.fileSize || 0);
            setLastModified(data.lastModified || "");

            // Auto-scroll to bottom
            setTimeout(() => {
                if (scrollRef.current) {
                    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
                }
            }, 100);
        } catch (e) {
            console.error("Failed to fetch logs:", e);
            setLogs("Error: Failed to fetch logs");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (open) {
            fetchLogs();

            // Poll every 2 seconds if scan is running
            if (isRunning) {
                const interval = setInterval(fetchLogs, 2000);
                return () => clearInterval(interval);
            }
        }
    }, [open, isRunning, scanId]);

    const downloadLogs = () => {
        const blob = new Blob([logs], { type: "text/plain" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `scan_${scanId}_logs.txt`;
        a.click();
        window.URL.revokeObjectURL(url);
        toast.success("Logs downloaded");
    };

    const copyToClipboard = async () => {
        try {
            await navigator.clipboard.writeText(logs);
            setCopied(true);
            toast.success("Logs copied to clipboard");
            setTimeout(() => setCopied(false), 2000);
        } catch (e) {
            toast.error("Failed to copy logs");
        }
    };

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-5xl h-[85vh] flex flex-col">
                <DialogHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <DialogTitle className="flex items-center gap-2">
                                <span>Scan Logs</span>
                                {isRunning && (
                                    <span className="flex items-center gap-1 text-xs font-normal text-emerald-500">
                                        <span className="relative flex h-2 w-2">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                        </span>
                                        Live
                                    </span>
                                )}
                            </DialogTitle>
                            <p className="text-xs text-muted-foreground mt-1">
                                {fileSize > 0 && `${formatFileSize(fileSize)} • `}
                                {lastModified && `Updated: ${new Date(lastModified).toLocaleTimeString()}`}
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={copyToClipboard}
                                disabled={!logs || logs.startsWith("Error:")}
                            >
                                {copied ? (
                                    <>
                                        <Check className="h-4 w-4 mr-2" />
                                        Copied
                                    </>
                                ) : (
                                    <>
                                        <Copy className="h-4 w-4 mr-2" />
                                        Copy
                                    </>
                                )}
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={downloadLogs}
                                disabled={!logs || logs.startsWith("Error:")}
                            >
                                <Download className="h-4 w-4 mr-2" />
                                Download
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={fetchLogs}
                                disabled={loading}
                            >
                                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                            </Button>
                        </div>
                    </div>
                </DialogHeader>
                <div className="flex-1 mt-4 overflow-hidden">
                    <ScrollArea className="h-full w-full" ref={scrollRef}>
                        <div className="pr-4">
                            <pre className="bg-black/90 text-green-400 p-4 rounded-md font-mono text-xs whitespace-pre-wrap wrap-break-word">
                                {logs || "Loading logs..."}
                            </pre>
                        </div>
                    </ScrollArea>
                </div>
            </DialogContent>
        </Dialog>
    );
}

"use client";

import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Upload, CheckCircle, Database, AlertCircle, FileJson, HardDrive, FileUp } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface BackupRestorePanelProps {
    onRestoreComplete?: () => void;
}

export function BackupRestorePanel({ onRestoreComplete }: BackupRestorePanelProps) {
    const [restoring, setRestoring] = useState(false);
    const [backing, setBacking] = useState(false);
    const [importing, setImporting] = useState(false);
    const [lastRestore, setLastRestore] = useState<{ filename: string; stats: any } | null>(null);
    const [lastImport, setLastImport] = useState<{ filename: string; count: number; scanId: string } | null>(null);
    const restoreFileInputRef = useRef<HTMLInputElement>(null);
    const importFileInputRef = useRef<HTMLInputElement>(null);

    const handleBackup = async () => {
        setBacking(true);
        try {
            const res = await fetch("/api/backup/export");

            if (res.ok) {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;

                const contentDisposition = res.headers.get("Content-Disposition");
                const filename = contentDisposition
                    ? contentDisposition.split("filename=")[1].replace(/"/g, "")
                    : `nuclei-cc-backup_${new Date().toISOString().replace(/[:.]/g, "-")}.json`;

                a.download = filename;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);

                toast.success("Backup created successfully");
            } else {
                const data = await res.json();
                toast.error(data.error || "Failed to create backup");
            }
        } catch (e: any) {
            console.error(e);
            toast.error(e.message || "Failed to create backup");
        } finally {
            setBacking(false);
        }
    };

    const handleRestore = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setRestoring(true);
        try {
            const formData = new FormData();
            formData.append("file", file);

            const res = await fetch("/api/backup/restore", {
                method: "POST",
                body: formData,
            });

            const data = await res.json();

            if (res.ok) {
                toast.success(data.message || "Backup restored successfully");
                setLastRestore({
                    filename: file.name,
                    stats: data.stats
                });

                if (onRestoreComplete) {
                    onRestoreComplete();
                }
            } else {
                toast.error(data.error || "Failed to restore backup");
            }
        } catch (e: any) {
            console.error(e);
            toast.error(e.message || "Failed to restore backup");
        } finally {
            setRestoring(false);
            if (restoreFileInputRef.current) {
                restoreFileInputRef.current.value = "";
            }
        }
    };

    const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setImporting(true);
        try {
            const formData = new FormData();
            formData.append("file", file);

            const res = await fetch("/api/findings/import", {
                method: "POST",
                body: formData,
            });

            const data = await res.json();

            if (res.ok) {
                toast.success(data.message || `Imported ${data.imported} findings`);
                setLastImport({
                    filename: file.name,
                    count: data.imported,
                    scanId: data.scanId
                });

                if (onRestoreComplete) {
                    onRestoreComplete();
                }
            } else {
                toast.error(data.error || "Failed to import scan");
            }
        } catch (e: any) {
            console.error(e);
            toast.error(e.message || "Failed to import scan");
        } finally {
            setImporting(false);
            if (importFileInputRef.current) {
                importFileInputRef.current.value = "";
            }
        }
    };

    return (
        <div className="h-[calc(100vh-140px)] animate-in fade-in duration-500 flex flex-col gap-4">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">Backup & Restore</h2>
                <p className="text-muted-foreground text-sm">Manage data backups and import external scan results.</p>
            </div>

            <Tabs defaultValue="backup" className="flex-1 flex flex-col">
                <TabsList className="bg-muted border border-border w-fit">
                    <TabsTrigger value="backup">
                        <Download className="h-4 w-4 mr-2" />
                        Backup
                    </TabsTrigger>
                    <TabsTrigger value="restore">
                        <Upload className="h-4 w-4 mr-2" />
                        Restore
                    </TabsTrigger>
                    <TabsTrigger value="import">
                        <FileUp className="h-4 w-4 mr-2" />
                        Import Nuclei JSON
                    </TabsTrigger>
                </TabsList>

                {/* Backup Tab */}
                <TabsContent value="backup" className="flex-1 space-y-4">
                    <Card className="border-border bg-card">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Database className="h-5 w-5 text-emerald-500" />
                                Create Complete Backup
                            </CardTitle>
                            <CardDescription>
                                Export all findings and scan results from Nuclei, Subfinder, and HTTPX to a single file
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-emerald-500/50 transition-colors">
                                <Database className="h-16 w-16 mx-auto mb-4 text-emerald-500 opacity-50" />
                                <p className="text-sm text-muted-foreground mb-4">
                                    Download a complete backup of all your data
                                </p>
                                <Button
                                    onClick={handleBackup}
                                    disabled={backing}
                                    size="lg"
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                >
                                    <Download className="mr-2 h-5 w-5" />
                                    {backing ? "Creating Backup..." : "Download Backup"}
                                </Button>
                            </div>

                            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                                <p className="text-xs font-medium text-muted-foreground">Backup includes:</p>
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <CheckCircle className="h-3 w-3 text-emerald-500" />
                                        Nuclei vulnerability findings
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <CheckCircle className="h-3 w-3 text-emerald-500" />
                                        Subfinder subdomain discoveries
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <CheckCircle className="h-3 w-3 text-emerald-500" />
                                        HTTPX live asset data
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <CheckCircle className="h-3 w-3 text-emerald-500" />
                                        Scan history and metadata
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Restore Tab */}
                <TabsContent value="restore" className="flex-1 space-y-4">
                    <Card className="border-border bg-card">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Upload className="h-5 w-5 text-blue-500" />
                                Restore from Backup
                            </CardTitle>
                            <CardDescription>
                                Import data from a Nuclei CC backup file (only accepts files created by this system)
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-blue-500/50 transition-colors">
                                <FileJson className="h-16 w-16 mx-auto mb-4 text-blue-500 opacity-50" />
                                <p className="text-sm text-muted-foreground mb-4">
                                    Select a Nuclei CC backup file to restore your data
                                </p>
                                <Button
                                    onClick={() => restoreFileInputRef.current?.click()}
                                    disabled={restoring}
                                    size="lg"
                                    variant="outline"
                                    className="border-blue-500/20 hover:border-blue-500/50 hover:bg-blue-500/5"
                                >
                                    <Upload className="mr-2 h-5 w-5 text-blue-500" />
                                    {restoring ? "Restoring..." : "Select Backup File"}
                                </Button>
                                <input
                                    ref={restoreFileInputRef}
                                    type="file"
                                    accept=".json"
                                    onChange={handleRestore}
                                    className="hidden"
                                />
                            </div>

                            {lastRestore && (
                                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                                    <div className="flex items-start gap-3">
                                        <CheckCircle className="h-5 w-5 text-blue-500 mt-0.5" />
                                        <div className="flex-1 space-y-2">
                                            <p className="text-sm font-medium text-blue-400">Last Restore Successful</p>
                                            <p className="text-xs text-muted-foreground font-mono truncate">
                                                {lastRestore.filename}
                                            </p>
                                            <div className="grid grid-cols-3 gap-2 mt-2">
                                                <Badge variant="outline" className="text-emerald-400 border-emerald-500/30 text-[10px]">
                                                    {lastRestore.stats?.nuclei?.findings || 0} findings
                                                </Badge>
                                                <Badge variant="outline" className="text-blue-400 border-blue-500/30 text-[10px]">
                                                    {lastRestore.stats?.subfinder?.subdomains || 0} subdomains
                                                </Badge>
                                                <Badge variant="outline" className="text-purple-400 border-purple-500/30 text-[10px]">
                                                    {lastRestore.stats?.httpx?.results || 0} assets
                                                </Badge>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
                                <div className="flex items-start gap-2">
                                    <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5" />
                                    <div className="space-y-1 text-xs text-muted-foreground">
                                        <p><strong className="text-foreground">Format Validation:</strong> Only files created by this system's backup function will be accepted.</p>
                                        <p><strong className="text-foreground">Data Safety:</strong> Uses INSERT OR IGNORE to prevent duplicates. Existing data will not be overwritten.</p>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Import Nuclei JSON Tab */}
                <TabsContent value="import" className="flex-1 space-y-4">
                    <Card className="border-border bg-card">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <FileUp className="h-5 w-5 text-purple-500" />
                                Import Nuclei Scan Results
                            </CardTitle>
                            <CardDescription>
                                Upload Nuclei JSON output files from external scans (e.g., from other devices or CI/CD pipelines)
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-purple-500/50 transition-colors">
                                <FileJson className="h-16 w-16 mx-auto mb-4 text-purple-500 opacity-50" />
                                <p className="text-sm text-muted-foreground mb-4">
                                    Select a Nuclei JSON output file to import findings
                                </p>
                                <Button
                                    onClick={() => importFileInputRef.current?.click()}
                                    disabled={importing}
                                    size="lg"
                                    variant="outline"
                                    className="border-purple-500/20 hover:border-purple-500/50 hover:bg-purple-500/5"
                                >
                                    <FileUp className="mr-2 h-5 w-5 text-purple-500" />
                                    {importing ? "Importing..." : "Select JSON File"}
                                </Button>
                                <input
                                    ref={importFileInputRef}
                                    type="file"
                                    accept=".json"
                                    onChange={handleImport}
                                    className="hidden"
                                />
                            </div>

                            {lastImport && (
                                <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4">
                                    <div className="flex items-start gap-3">
                                        <CheckCircle className="h-5 w-5 text-purple-500 mt-0.5" />
                                        <div className="flex-1 space-y-1">
                                            <p className="text-sm font-medium text-purple-400">Last Import Successful</p>
                                            <p className="text-xs text-muted-foreground font-mono truncate">
                                                {lastImport.filename}
                                            </p>
                                            <div className="flex items-center gap-2 mt-2">
                                                <Badge variant="outline" className="text-purple-400 border-purple-500/30">
                                                    {lastImport.count} findings
                                                </Badge>
                                                <Badge variant="outline" className="text-blue-400 border-blue-500/30 font-mono text-[10px]">
                                                    {lastImport.scanId.slice(0, 8)}
                                                </Badge>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                                <p className="text-xs font-medium text-muted-foreground">Supported Format:</p>
                                <ul className="text-xs text-muted-foreground space-y-1">
                                    <li className="flex items-center gap-2">
                                        <CheckCircle className="h-3 w-3 text-purple-500" />
                                        Nuclei JSON output (array of findings)
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <CheckCircle className="h-3 w-3 text-purple-500" />
                                        Automatic duplicate detection
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <CheckCircle className="h-3 w-3 text-purple-500" />
                                        Appears in Vulnerability Feed
                                    </li>
                                </ul>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}

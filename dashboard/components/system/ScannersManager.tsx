"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Download, Terminal, CheckCircle2, AlertCircle, Globe, Search } from "lucide-react";
import { toast } from "sonner";

interface ScannersState {
    versions: {
        nuclei_engine: string;
        nuclei_templates: string;
        subfinder: string;
        httpx: string;
    };
    loading: boolean;
    error: string | null;
}

type UpdateType = "nuclei" | "templates" | "subfinder" | "httpx";

export function ScannersManager() {
    const [state, setState] = useState<ScannersState>({
        versions: { nuclei_engine: "Checking...", nuclei_templates: "Checking...", subfinder: "Checking...", httpx: "Checking..." },
        loading: true,
        error: null
    });

    const [updating, setUpdating] = useState<Record<string, boolean>>({});
    const [updateLog, setUpdateLog] = useState<string | null>(null);

    const fetchVersions = async () => {
        setState(prev => ({ ...prev, loading: true, error: null }));
        try {
            const res = await fetch("/api/system/scanners");
            if (!res.ok) throw new Error("Failed to fetch versions");
            const data = await res.json();
            setState({
                versions: data.versions,
                loading: false,
                error: null
            });
        } catch (error: any) {
            setState(prev => ({
                ...prev,
                loading: false,
                error: error.message
            }));
        }
    };

    useEffect(() => {
        fetchVersions();
    }, []);

    const handleUpdate = async (type: UpdateType) => {
        setUpdating(prev => ({ ...prev, [type]: true }));
        setUpdateLog(null);

        try {
            const res = await fetch("/api/system/scanners", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: `update-${type}` })
            });

            const data = await res.json();

            if (data.success) {
                const output = data.output || "";
                setUpdateLog(output);

                // Smart feedback logic: Detect "already updated" messages
                const isAlreadyUpdated = output.includes("already updated") ||
                    output.includes("No new updates");

                if (isAlreadyUpdated) {
                    toast.info(`${type} is already up to date`);
                } else {
                    toast.success(`${type} updated successfully`);
                    fetchVersions();
                }
            } else {
                throw new Error(data.error || "Update failed");
            }
        } catch (error: any) {
            toast.error(`Update failed: ${error.message}`);
            setUpdateLog(`Error: ${error.message}\n${error.details || ""}`);
        } finally {
            setUpdating(prev => ({ ...prev, [type]: false }));
        }
    };

    const ScannerCard = ({ title, version, type, icon: Icon, colorClass }: any) => (
        <Card className="bg-card border-border shadow-none">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                <Icon className={`h-4 w-4 ${colorClass}`} />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{version}</div>
                <div className="mt-4">
                    <Button
                        className="w-full"
                        variant="secondary"
                        onClick={() => handleUpdate(type)}
                        disabled={updating[type] || state.loading}
                    >
                        {updating[type] ? (
                            <>
                                <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Updating...
                            </>
                        ) : (
                            <>
                                <Download className="mr-2 h-4 w-4" /> Update
                            </>
                        )}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );

    return (
        <div className="space-y-6 max-w-4xl mx-auto p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-foreground">Scanners</h2>
                    <p className="text-muted-foreground">Manage scanner versions and updates.</p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchVersions}
                    disabled={state.loading}
                >
                    <RefreshCw className={`mr-2 h-4 w-4 ${state.loading ? "animate-spin" : ""}`} />
                    Refresh Versions
                </Button>
            </div>

            {state.error && (
                <div className="bg-destructive/15 text-destructive p-4 rounded-md flex items-center gap-3">
                    <AlertCircle className="h-5 w-5" />
                    <div>
                        <h4 className="font-semibold">Error</h4>
                        <p className="text-sm">{state.error}</p>
                    </div>
                </div>
            )}

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <ScannerCard
                    title="Nuclei Engine"
                    version={state.versions.nuclei_engine}
                    type="nuclei"
                    icon={Terminal}
                    colorClass="text-blue-500"
                />

                {/* Customized Templates Card */}
                <Card className="bg-card border-border shadow-none">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Nuclei Templates</CardTitle>
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{state.versions.nuclei_templates}</div>

                        <div className="mt-4">
                            <Button
                                className="w-full"
                                variant="secondary"
                                onClick={() => handleUpdate("templates")}
                                disabled={updating["templates"] || state.loading}
                            >
                                {updating["templates"] ? (
                                    <>
                                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Updating...
                                    </>
                                ) : (
                                    <>
                                        <Download className="mr-2 h-4 w-4" /> Update
                                    </>
                                )}
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                <ScannerCard
                    title="Subfinder"
                    version={state.versions.subfinder}
                    type="subfinder"
                    icon={Search}
                    colorClass="text-purple-500"
                />
                <ScannerCard
                    title="HTTPX"
                    version={state.versions.httpx}
                    type="httpx"
                    icon={Globe}
                    colorClass="text-orange-500"
                />
            </div>

            {updateLog && (
                <Card className="bg-muted/50 border-dashed border-border">
                    <CardHeader>
                        <CardTitle className="text-sm font-mono">Process Output</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <pre className="text-xs font-mono whitespace-pre-wrap text-muted-foreground bg-black/80 p-4 rounded-md overflow-x-auto max-h-64">
                            {updateLog}
                        </pre>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

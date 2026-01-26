"use client";

import { useState } from "react";
import { DashboardStats } from "@/components/dashboard/Stats";
import { ScanWizard } from "@/components/scan/Wizard";
import { LiveConsole } from "@/components/scan/LiveConsole";
import { FindingsTable } from "@/components/findings/Table";
import { TemplateManager } from "@/components/templates/Manager";
import { Sidebar } from "@/components/layout/Sidebar";
import { ScanHistory } from "@/components/scan/History";
import { TemplateList } from "@/components/templates/List";
import { SubfinderPanel } from "@/components/subfinder/SubfinderPanel";
import { HttpxPanel } from "@/components/httpx/HttpxPanel";
import { SystemStatus } from "@/components/dashboard/SystemStatus";
import { SystemPanel } from "@/components/system/SystemPanel";
import { BackupRestorePanel } from "@/components/import/ImportPanel";
import { AnalysisRow } from "@/components/dashboard/AnalysisRow";

export function DashboardClient({ initialStats }: { initialStats: any }) {
    const [activeScanId, setActiveScanId] = useState<string | null>(null);
    const [selectedTemplate, setSelectedTemplate] = useState<string>("");
    const [scanTarget, setScanTarget] = useState<string>("");
    const [activeView, setActiveView] = useState("overview");
    const [templateRefresh, setTemplateRefresh] = useState(0);
    const [statsRefresh, setStatsRefresh] = useState(0);

    const startScan = (id: string) => {
        setActiveScanId(id);
        setActiveView("activity");
        // Refresh stats when scan starts to update count immediately
        setStatsRefresh(prev => prev + 1);
    };

    const startMainScan = (target: string) => {
        setScanTarget(target);
        setActiveView("scan");
    };

    return (
        <div className="flex bg-background min-h-screen text-foreground font-sans selection:bg-emerald-500/30">
            <Sidebar activeView={activeView} onChangeView={setActiveView} />

            <div className="pl-64 w-full">
                <div className="p-8 max-w-7xl mx-auto min-h-screen">
                    <header className="flex justify-between items-center mb-8 border-b border-border pb-4">
                        <h1 className="text-2xl font-bold tracking-tight text-foreground capitalize">
                            {activeView.replace("-", " ")}
                        </h1>
                        <div className="flex items-center gap-2">
                            <SystemStatus />
                        </div>
                    </header>

                    {/* ... Overview ... */}
                    {activeView === "overview" && (
                        <div className="space-y-8 animate-in fade-in duration-500">
                            {/* ... Stats ... */}
                            <DashboardStats
                                refreshTrigger={statsRefresh}
                            />
                            {/* ... Content ... */}
                            {/* Analysis Row */}
                            <AnalysisRow />

                            {activeScanId && (
                                <div className="p-6 rounded-xl border border-emerald-500/20 bg-emerald-500/5 mt-6">
                                    <div className="flex justify-between items-center mb-2">
                                        <h3 className="text-lg font-medium text-emerald-400">Scan Running</h3>
                                        <span className="animate-pulse h-2 w-2 bg-emerald-500 rounded-full"></span>
                                    </div>
                                    <button onClick={() => setActiveView("activity")} className="text-sm underline text-muted-foreground hover:text-foreground">View Details &rarr;</button>
                                </div>
                            )}
                        </div>
                    )}

                    {activeView === "scan" && (
                        <div className="max-w-3xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <ScanWizard
                                onScanStart={startScan}
                                initialTemplate={selectedTemplate}
                                initialTarget={scanTarget}
                            />
                        </div>
                    )}

                    {activeView === "vulnerabilities" && (
                        <div className="animate-in fade-in duration-500">
                            <FindingsTable />
                        </div>
                    )}

                    {activeView === "activity" && (
                        <div className="animate-in fade-in duration-500 h-[calc(100vh-200px)]">
                            <LiveConsole scanId={activeScanId} />
                        </div>
                    )}

                    {activeView === "templates" && (
                        <div className="animate-in fade-in duration-500">
                            <TemplateManager onSaved={() => setTemplateRefresh(prev => prev + 1)} />
                            <div className="mt-6"></div>
                            <TemplateList
                                refreshTrigger={templateRefresh}
                                onRun={(path) => {
                                    setSelectedTemplate(path);
                                    setActiveView("scan");
                                }}
                            />
                        </div>
                    )}

                    {activeView === "history" && (
                        <div className="animate-in fade-in duration-500">
                            <ScanHistory />
                        </div>
                    )}

                    {activeView === "subfinder" && (
                        <SubfinderPanel onScanTarget={startMainScan} />
                    )}

                    {activeView === "httpx" && (
                        <div className="animate-in fade-in duration-500">
                            <HttpxPanel onScanTarget={startMainScan} />
                        </div>
                    )}

                    {activeView === "system" && (
                        <div className="animate-in fade-in duration-500">
                            <SystemPanel />
                        </div>
                    )}

                    {activeView === "backup" && (
                        <BackupRestorePanel onRestoreComplete={() => {
                            setStatsRefresh(prev => prev + 1);
                        }} />
                    )}
                </div>
            </div>
        </div>
    );
}

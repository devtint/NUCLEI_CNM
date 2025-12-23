"use client";

import { useState } from "react";
import { DashboardStats } from "@/components/dashboard/Stats";
import { ScanWizard } from "@/components/scan/Wizard";
import { LiveConsole } from "@/components/scan/LiveConsole";
import { FindingsTable } from "@/components/findings/Table";
import { TemplateManager } from "@/components/templates/Manager";
import { Sidebar } from "@/components/layout/Sidebar";
import { ScanHistory } from "@/components/scan/History";
import { Settings } from "@/components/settings/Settings";
import { TemplateList } from "@/components/templates/List";
import { SubfinderPanel } from "@/components/subfinder/SubfinderPanel";

export function DashboardClient({ initialStats }: { initialStats: any }) {
    const [activeScanId, setActiveScanId] = useState<string | null>(null);
    const [selectedTemplate, setSelectedTemplate] = useState<string>("");
    const [scanTarget, setScanTarget] = useState<string>("");
    const [activeView, setActiveView] = useState("overview");
    const [templateRefresh, setTemplateRefresh] = useState(0);

    const startScan = (id: string) => {
        setActiveScanId(id);
        setActiveView("activity");
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
                            {/* ... System Status ... */}
                            <div className="text-right mr-4">
                                <div className="text-[10px] text-zinc-500 uppercase tracking-widest">System Status</div>
                                <div className="text-emerald-400 font-medium text-xs flex items-center justify-end gap-2">
                                    <span className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                    </span>
                                    Online
                                </div>
                            </div>
                        </div>
                    </header>

                    {/* ... Overview ... */}
                    {activeView === "overview" && (
                        <div className="space-y-8 animate-in fade-in duration-500">
                            {/* ... Stats ... */}
                            <DashboardStats
                                totalScans={initialStats.totalScans}
                                lastScan={initialStats.lastScan}
                            />
                            {/* ... Content ... */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="p-6 rounded-xl border border-border bg-card shadow-sm">
                                    <h3 className="text-lg font-medium text-foreground mb-2">Quick Actions</h3>
                                    <p className="text-zinc-400 text-sm mb-4">Start a new scan or manage templates.</p>
                                    <div className="flex gap-2">
                                        <button onClick={() => setActiveView("scan")} className="text-sm bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-md">Start Scan</button>
                                        <button onClick={() => setActiveView("templates")} className="text-sm border border-zinc-700 hover:bg-zinc-800 text-zinc-300 px-4 py-2 rounded-md">Manage Templates</button>
                                    </div>
                                </div>

                                {activeScanId && (
                                    <div className="p-6 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
                                        <div className="flex justify-between items-center mb-2">
                                            <h3 className="text-lg font-medium text-emerald-400">Scan Running</h3>
                                            <span className="animate-pulse h-2 w-2 bg-emerald-500 rounded-full"></span>
                                        </div>
                                        <button onClick={() => setActiveView("activity")} className="text-sm underline text-muted-foreground hover:text-foreground">View Details &rarr;</button>
                                    </div>
                                )}
                            </div>
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

                    {activeView === "settings" && (
                        <div className="animate-in fade-in duration-500">
                            <Settings />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

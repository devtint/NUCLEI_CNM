"use client";

import { useState, useCallback, useEffect } from "react";
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
import { SchedulerPanel } from "@/components/system/SchedulerPanel";
import { useKeyboardShortcuts } from "@/components/layout/KeyboardShortcuts";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { ShortcutHelp } from "@/components/layout/ShortcutHelp";
import { AIPage } from "@/components/ai/AIPage";
import { Command } from "lucide-react";

export function DashboardClient({ initialStats }: { initialStats: any }) {
    const [activeScanId, setActiveScanId] = useState<string | null>(null);
    const [selectedTemplate, setSelectedTemplate] = useState<string>("");
    const [scanTarget, setScanTarget] = useState<string>("");
    
    // Start with overview for SSR to prevent hydration mismatch
    const [activeView, setActiveView] = useState("overview");
    const [previousView, setPreviousView] = useState("overview");
    const [templateRefresh, setTemplateRefresh] = useState(0);
    const [statsRefresh, setStatsRefresh] = useState(0);
    const [isMounted, setIsMounted] = useState(false);

    // Sync activeView with URL hash after mount
    useEffect(() => {
        setIsMounted(true);
        if (window.location.hash) {
            const hashView = window.location.hash.slice(1);
            const validViews = ['overview', 'vulnerabilities', 'scan', 'activity', 'history', 'templates', 'subfinder', 'httpx', 'automation', 'ai', 'backup', 'system'];
            if (validViews.includes(hashView)) {
                setActiveView(hashView);
                setPreviousView('overview');
            }
        }
    }, []);

    // Keyboard shortcuts state
    const [paletteOpen, setPaletteOpen] = useState(false);
    const [helpOpen, setHelpOpen] = useState(false);

    const handleRefresh = useCallback(() => {
        setStatsRefresh(prev => prev + 1);
    }, []);

    const navigateToView = useCallback((view: string) => {
        setActiveView(prev => {
            if (view !== prev) {
                setPreviousView(prev);
                window.location.hash = view; // Update URL hash for persistence across refreshes
            }
            return view;
        });
    }, []);

    useKeyboardShortcuts({
        onNavigate: navigateToView,
        onOpenCommandPalette: () => setPaletteOpen(true),
        onOpenHelp: () => setHelpOpen(true),
        onRefresh: handleRefresh,
        activeView,
    });

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
            <Sidebar activeView={activeView} onChangeView={navigateToView} />

            <div className="pl-64 w-full">
                <div className="p-8 max-w-7xl mx-auto min-h-screen">
                    <header className="flex justify-between items-center mb-8 border-b border-border pb-4">
                        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-3">
                            <span className="capitalize">{activeView.replace("-", " ")}</span>
                            {activeView === "overview" && (
                                <button
                                    onClick={() => {
                                        const event = new CustomEvent('open-ai-chat', { 
                                            detail: { message: `Summarize my entire Nuclei environment, including overall stats, recent runs, and current risk level.` }
                                        });
                                        window.dispatchEvent(event);
                                    }}
                                    className="px-2 py-1 flex items-center gap-1.5 text-[10px] font-semibold tracking-wider uppercase text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 rounded-md transition-colors"
                                >
                                    AI Summary
                                </button>
                            )}
                        </h1>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPaletteOpen(true)}
                                className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground bg-muted/50 border border-border rounded-lg hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                            >
                                <Command className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">Search...</span>
                                <kbd className="ml-1 px-1.5 py-0.5 text-[10px] bg-background border border-border rounded font-mono">Ctrl+K</kbd>
                            </button>
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
                            <LiveConsole scanId={activeScanId} onNavigate={setActiveView} />
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

                    {activeView === "automation" && (
                        <div className="animate-in fade-in duration-500">
                            <SchedulerPanel />
                        </div>
                    )}

                    {activeView === "ai" && (
                        <div className="animate-in fade-in duration-500" style={{ height: 'calc(100vh - 10rem)' }}>
                            <AIPage previousView={previousView} onNavigate={(view: string) => { setPreviousView(activeView); setActiveView(view); }} />
                        </div>
                    )}

                    {activeView === "backup" && (
                        <BackupRestorePanel onRestoreComplete={() => {
                            setStatsRefresh(prev => prev + 1);
                        }} />
                    )}
                </div>
            </div>

            {/* Command Palette & Shortcut Help */}
            <CommandPalette
                open={paletteOpen}
                onClose={() => setPaletteOpen(false)}
                onNavigate={navigateToView}
                onOpenHelp={() => { setPaletteOpen(false); setHelpOpen(true); }}
            />
            <ShortcutHelp
                open={helpOpen}
                onClose={() => setHelpOpen(false)}
            />
        </div>
    );
}

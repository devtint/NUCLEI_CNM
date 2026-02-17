"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
    LayoutDashboard, ShieldAlert, Play, Activity,
    History, FileCode, Network, Settings,
    Database, Zap, Search, ArrowRight,
    FileDown, RefreshCw, LogOut, Command,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────

interface CommandItem {
    id: string;
    label: string;
    description?: string;
    icon: React.ReactNode;
    shortcut?: string;
    action: () => void;
    section: "navigation" | "actions" | "shortcuts";
}

interface CommandPaletteProps {
    open: boolean;
    onClose: () => void;
    onNavigate: (view: string) => void;
    onOpenHelp: () => void;
}

// ─── Component ──────────────────────────────────────────

export function CommandPalette({ open, onClose, onNavigate, onOpenHelp }: CommandPaletteProps) {
    const [query, setQuery] = useState("");
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    // Reset on open
    useEffect(() => {
        if (open) {
            setQuery("");
            setSelectedIndex(0);
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [open]);

    // Build command list
    const commands: CommandItem[] = useMemo(() => {
        const nav = (id: string, label: string, icon: React.ReactNode, shortcut: string) => ({
            id: `nav-${id}`,
            label,
            description: `Navigate to ${label}`,
            icon,
            shortcut,
            action: () => { onNavigate(id); onClose(); },
            section: "navigation" as const,
        });

        const act = (id: string, label: string, description: string, icon: React.ReactNode, action: () => void) => ({
            id: `act-${id}`,
            label,
            description,
            icon,
            action: () => { action(); onClose(); },
            section: "actions" as const,
        });

        return [
            // Navigation
            nav("overview", "Dashboard", <LayoutDashboard className="h-4 w-4" />, "g d"),
            nav("vulnerabilities", "Vulnerabilities", <ShieldAlert className="h-4 w-4" />, "g v"),
            nav("scan", "New Operation", <Play className="h-4 w-4" />, "g n"),
            nav("activity", "Activity Monitor", <Activity className="h-4 w-4" />, "g a"),
            nav("history", "Scan History", <History className="h-4 w-4" />, "g h"),
            nav("templates", "Templates", <FileCode className="h-4 w-4" />, "g t"),
            nav("subfinder", "Subfinder", <Network className="h-4 w-4" />, "g s"),
            nav("httpx", "Live Assets", <Activity className="h-4 w-4" />, "g l"),
            nav("automation", "Automation", <Zap className="h-4 w-4" />, "g z"),
            nav("backup", "Backup & Restore", <Database className="h-4 w-4" />, "g b"),
            nav("system", "System", <Settings className="h-4 w-4" />, "g x"),
            // Actions
            act("refresh", "Refresh Current View", "Reload data in the current view", <RefreshCw className="h-4 w-4" />, () => { window.dispatchEvent(new CustomEvent("app:refresh")); }),
            act("export-pdf", "Export Findings as PDF", "Export vulnerability findings to PDF", <FileDown className="h-4 w-4" />, () => { onNavigate("vulnerabilities"); }),
            act("new-scan", "Start New Scan", "Launch the scan wizard", <Play className="h-4 w-4" />, () => { onNavigate("scan"); }),
            act("shortcuts", "Keyboard Shortcuts", "Show all keyboard shortcuts", <Command className="h-4 w-4" />, () => { onOpenHelp(); }),
            act("logout", "Log Out", "Sign out of the dashboard", <LogOut className="h-4 w-4" />, () => { window.location.href = "/login"; }),
        ];
    }, [onNavigate, onClose, onOpenHelp]);

    // Filter commands
    const filtered = useMemo(() => {
        if (!query.trim()) return commands;
        const q = query.toLowerCase();
        return commands.filter(
            (cmd) =>
                cmd.label.toLowerCase().includes(q) ||
                cmd.description?.toLowerCase().includes(q) ||
                cmd.section.toLowerCase().includes(q)
        );
    }, [commands, query]);

    // Clamp selectedIndex when filtered list changes
    useEffect(() => {
        if (selectedIndex >= filtered.length) {
            setSelectedIndex(Math.max(0, filtered.length - 1));
        }
    }, [filtered.length, selectedIndex]);

    // Group commands by section
    const grouped = useMemo(() => {
        const sections: Record<string, CommandItem[]> = {};
        for (const cmd of filtered) {
            if (!sections[cmd.section]) sections[cmd.section] = [];
            sections[cmd.section].push(cmd);
        }
        return sections;
    }, [filtered]);

    // Keyboard navigation
    const handleKeyDown = (e: React.KeyboardEvent) => {
        switch (e.key) {
            case "ArrowDown":
                e.preventDefault();
                setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
                break;
            case "ArrowUp":
                e.preventDefault();
                setSelectedIndex((i) => Math.max(i - 1, 0));
                break;
            case "Enter":
                e.preventDefault();
                if (filtered[selectedIndex]) {
                    filtered[selectedIndex].action();
                }
                break;
            case "Escape":
                e.preventDefault();
                onClose();
                break;
        }
    };

    // Scroll selected item into view
    useEffect(() => {
        const el = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
        if (el) {
            el.scrollIntoView({ block: "nearest" });
        }
    }, [selectedIndex]);

    const sectionLabels: Record<string, string> = {
        navigation: "Navigate",
        actions: "Actions",
        shortcuts: "Shortcuts",
    };

    let flatIndex = -1;

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent
                className="p-0 overflow-hidden"
                style={{
                    maxWidth: "560px",
                    width: "90vw",
                    borderRadius: "16px",
                }}
                onKeyDown={handleKeyDown}
            >
                {/* Search input */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
                    <Search className="h-5 w-5 text-muted-foreground shrink-0" />
                    <Input
                        ref={inputRef}
                        value={query}
                        onChange={(e) => {
                            setQuery(e.target.value);
                            setSelectedIndex(0);
                        }}
                        placeholder="Type a command or search..."
                        className="border-0 shadow-none focus-visible:ring-0 px-0 text-base h-auto bg-transparent"
                    />
                    <kbd className="hidden sm:flex items-center gap-1 px-1.5 py-0.5 text-xs text-muted-foreground bg-muted rounded border border-border font-mono shrink-0">
                        Esc
                    </kbd>
                </div>

                {/* Results */}
                <div ref={listRef} className="max-h-[360px] overflow-y-auto py-2">
                    {filtered.length === 0 ? (
                        <div className="px-4 py-8 text-center text-muted-foreground text-sm">
                            No results found for &quot;{query}&quot;
                        </div>
                    ) : (
                        Object.entries(grouped).map(([section, items]) => (
                            <div key={section}>
                                <div className="px-4 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                    {sectionLabels[section] || section}
                                </div>
                                {items.map((cmd) => {
                                    flatIndex++;
                                    const idx = flatIndex;
                                    return (
                                        <button
                                            key={cmd.id}
                                            data-index={idx}
                                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${idx === selectedIndex
                                                    ? "bg-emerald-500/10 text-emerald-600"
                                                    : "text-foreground hover:bg-muted/50"
                                                }`}
                                            onClick={cmd.action}
                                            onMouseEnter={() => setSelectedIndex(idx)}
                                        >
                                            <span className={`shrink-0 ${idx === selectedIndex ? "text-emerald-500" : "text-muted-foreground"
                                                }`}>
                                                {cmd.icon}
                                            </span>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-medium truncate">
                                                    {cmd.label}
                                                </div>
                                                {cmd.description && (
                                                    <div className="text-xs text-muted-foreground truncate">
                                                        {cmd.description}
                                                    </div>
                                                )}
                                            </div>
                                            {cmd.shortcut && (
                                                <div className="flex items-center gap-1 shrink-0">
                                                    {cmd.shortcut.split(" ").map((k, i) => (
                                                        <kbd
                                                            key={i}
                                                            className="px-1.5 py-0.5 text-xs bg-muted rounded border border-border font-mono text-muted-foreground"
                                                        >
                                                            {k}
                                                        </kbd>
                                                    ))}
                                                </div>
                                            )}
                                            {idx === selectedIndex && (
                                                <ArrowRight className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        ))
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-4 py-2 border-t border-border text-xs text-muted-foreground">
                    <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                            <kbd className="px-1 py-0.5 bg-muted rounded border border-border font-mono">↑↓</kbd>
                            navigate
                        </span>
                        <span className="flex items-center gap-1">
                            <kbd className="px-1 py-0.5 bg-muted rounded border border-border font-mono">↵</kbd>
                            select
                        </span>
                        <span className="flex items-center gap-1">
                            <kbd className="px-1 py-0.5 bg-muted rounded border border-border font-mono">esc</kbd>
                            close
                        </span>
                    </div>
                    <span className="flex items-center gap-1">
                        <kbd className="px-1 py-0.5 bg-muted rounded border border-border font-mono">Ctrl</kbd>
                        <kbd className="px-1 py-0.5 bg-muted rounded border border-border font-mono">K</kbd>
                    </span>
                </div>
            </DialogContent>
        </Dialog>
    );
}

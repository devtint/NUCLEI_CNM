"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ShortcutHelpProps {
    open: boolean;
    onClose: () => void;
}

const SECTIONS = [
    {
        title: "Global",
        shortcuts: [
            { keys: ["Ctrl", "K"], description: "Command palette" },
            { keys: ["?"], description: "Show this help" },
            { keys: ["Esc"], description: "Close modal / dialog" },
            { keys: ["/"], description: "Focus search in current view" },
            { keys: ["r"], description: "Refresh current data" },
            { keys: ["n"], description: "New scan" },
        ],
    },
    {
        title: "Navigation (press g, then key)",
        shortcuts: [
            { keys: ["g", "d"], description: "Dashboard" },
            { keys: ["g", "v"], description: "Vulnerabilities" },
            { keys: ["g", "n"], description: "New Operation" },
            { keys: ["g", "a"], description: "Activity Monitor" },
            { keys: ["g", "h"], description: "Scan History" },
            { keys: ["g", "t"], description: "Templates" },
            { keys: ["g", "s"], description: "Subfinder" },
            { keys: ["g", "l"], description: "Live Assets" },
            { keys: ["g", "z"], description: "Automation" },
            { keys: ["g", "b"], description: "Backup & Restore" },
            { keys: ["g", "x"], description: "System" },
        ],
    },
    {
        title: "Log Viewer",
        shortcuts: [
            { keys: ["Ctrl", "F"], description: "Search in logs" },
            { keys: ["Enter"], description: "Next search match" },
            { keys: ["Shift", "Enter"], description: "Previous search match" },
            { keys: ["Ctrl", "C"], description: "Copy logs to clipboard" },
            { keys: ["Ctrl", "Shift", "S"], description: "Download logs" },
            { keys: ["Home"], description: "Jump to first line" },
            { keys: ["End"], description: "Jump to last line" },
            { keys: ["m"], description: "Toggle navigation menu" },
            { keys: ["Esc"], description: "Close search / close viewer" },
        ],
    },
];

export function ShortcutHelp({ open, onClose }: ShortcutHelpProps) {
    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent
                className="p-0 overflow-hidden"
                style={{
                    maxWidth: "640px",
                    width: "90vw",
                    borderRadius: "16px",
                }}
            >
                <DialogHeader className="flex flex-row items-center justify-between px-6 pt-5 pb-3 border-b border-border">
                    <DialogTitle className="text-lg font-semibold">
                        Keyboard Shortcuts
                    </DialogTitle>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onClose}
                        className="h-8 w-8 p-0"
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </DialogHeader>

                <div className="max-h-[65vh] overflow-y-auto px-6 py-4 space-y-6">
                    {SECTIONS.map((section) => (
                        <div key={section.title}>
                            <h3 className="text-xs font-semibold text-emerald-500 uppercase tracking-wider mb-3">
                                {section.title}
                            </h3>
                            <div className="space-y-1">
                                {section.shortcuts.map((shortcut) => (
                                    <div
                                        key={shortcut.description}
                                        className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-muted/50 transition-colors"
                                    >
                                        <span className="text-sm text-foreground">
                                            {shortcut.description}
                                        </span>
                                        <div className="flex items-center gap-1">
                                            {shortcut.keys.map((key, i) => (
                                                <span key={i} className="flex items-center gap-1">
                                                    <kbd className="inline-flex items-center justify-center min-w-[24px] px-1.5 py-0.5 text-xs bg-muted rounded-md border border-border font-mono text-muted-foreground">
                                                        {key}
                                                    </kbd>
                                                    {i < shortcut.keys.length - 1 && (
                                                        <span className="text-xs text-muted-foreground mx-0.5">
                                                            +
                                                        </span>
                                                    )}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="px-6 py-3 border-t border-border text-xs text-muted-foreground text-center">
                    Press <kbd className="px-1.5 py-0.5 bg-muted rounded border border-border font-mono">?</kbd> anytime to show this help
                </div>
            </DialogContent>
        </Dialog>
    );
}

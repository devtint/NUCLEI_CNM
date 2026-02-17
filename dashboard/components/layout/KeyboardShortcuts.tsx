"use client";

import { useEffect, useCallback, useRef } from "react";

// ─── Navigation map for g+key combos ────────────────────

const NAV_MAP: Record<string, string> = {
    d: "overview",       // Dashboard
    v: "vulnerabilities", // Vulnerabilities
    n: "scan",           // New Operation
    a: "activity",       // Activity Monitor
    h: "history",        // Scan History
    t: "templates",      // Templates
    s: "subfinder",      // Subfinder
    l: "httpx",          // Live Assets
    z: "automation",     // Automation
    b: "backup",         // Backup & Restore
    x: "system",         // System
};

interface KeyboardShortcutsProps {
    onNavigate: (view: string) => void;
    onOpenCommandPalette: () => void;
    onOpenHelp: () => void;
    onRefresh?: () => void;
    activeView: string;
}

export function useKeyboardShortcuts({
    onNavigate,
    onOpenCommandPalette,
    onOpenHelp,
    onRefresh,
}: KeyboardShortcutsProps) {
    const gPending = useRef(false);
    const gTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const isInputFocused = useCallback(() => {
        const el = document.activeElement;
        if (!el) return false;
        const tag = el.tagName.toLowerCase();
        if (tag === "input" || tag === "textarea" || tag === "select") return true;
        if ((el as HTMLElement).isContentEditable) return true;
        return false;
    }, []);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            // ── Ctrl/Cmd combos (work even in inputs) ──
            if ((e.ctrlKey || e.metaKey) && e.key === "k") {
                e.preventDefault();
                onOpenCommandPalette();
                return;
            }

            // Don't handle single-key shortcuts when typing in an input
            if (isInputFocused()) return;

            // ── "g" prefix navigation ──
            if (gPending.current) {
                const target = NAV_MAP[e.key.toLowerCase()];
                if (target) {
                    e.preventDefault();
                    onNavigate(target);
                }
                gPending.current = false;
                if (gTimer.current) clearTimeout(gTimer.current);
                return;
            }

            if (e.key === "g" && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
                gPending.current = true;
                gTimer.current = setTimeout(() => {
                    gPending.current = false;
                }, 1000);
                return;
            }

            // ── Single-key shortcuts ──
            switch (e.key) {
                case "?":
                    e.preventDefault();
                    onOpenHelp();
                    break;
                case "/":
                    e.preventDefault();
                    // Focus any search input in the current view
                    const searchInput = document.querySelector<HTMLInputElement>(
                        'input[type="search"], input[placeholder*="Search"], input[placeholder*="search"], input[placeholder*="Filter"]'
                    );
                    if (searchInput) {
                        searchInput.focus();
                        searchInput.select();
                    }
                    break;
                case "r":
                    if (!e.ctrlKey && !e.metaKey) {
                        e.preventDefault();
                        onRefresh?.();
                    }
                    break;
                case "n":
                    if (!e.ctrlKey && !e.metaKey) {
                        e.preventDefault();
                        onNavigate("scan");
                    }
                    break;
                case "Escape":
                    // Close any open dialog by clicking backdrop
                    const overlay = document.querySelector('[data-radix-dialog-overlay]');
                    if (overlay) {
                        (overlay as HTMLElement).click();
                    }
                    break;
            }
        };

        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [onNavigate, onOpenCommandPalette, onOpenHelp, onRefresh, isInputFocused]);
}

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Terminal, Zap } from "lucide-react";
import { PREDEFINED_COMMANDS } from "@/lib/nuclei/presets";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TargetListManager } from "./TargetListManager";

interface WizardProps {
    onScanStart: (scanId: string) => void;
    initialTemplate?: string;
    initialTarget?: string;
}

export function ScanWizard({ onScanStart, initialTemplate, initialTarget }: WizardProps) {
    const [target, setTarget] = useState(initialTarget || "");
    const [targetMode, setTargetMode] = useState<'url' | 'list'>('url');
    const [customArgs, setCustomArgs] = useState(initialTemplate ? `-t "${initialTemplate}"` : "");
    const [loading, setLoading] = useState(false);

    const startScan = async (config: any) => {
        if (!target) return;
        setLoading(true);
        try {
            // Read settings from localStorage
            let settings = {};
            const storedSettings = localStorage.getItem("nuclei_settings");
            if (storedSettings) {
                try {
                    settings = JSON.parse(storedSettings);
                } catch (e) {
                    console.error("Failed to parse settings", e);
                }
            }

            const res = await fetch("/api/scan", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ target, targetMode, ...config, ...settings }),
            });
            const data = await res.json();
            if (data.scanId) {
                onScanStart(data.scanId);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card className="bg-card border-border shadow-none">
            <CardContent className="p-6 space-y-4">
                <div className="space-y-4">
                    <div className="flex items-center space-x-4">
                        <button
                            onClick={() => setTargetMode('url')}
                            className={`text-sm font-medium transition-colors ${targetMode === 'url' ? 'text-emerald-500' : 'text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            Single Target
                        </button>
                        <div className="h-4 w-[1px] bg-border" />
                        <button
                            onClick={() => setTargetMode('list')}
                            className={`text-sm font-medium transition-colors ${targetMode === 'list' ? 'text-emerald-500' : 'text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            Target List
                        </button>
                    </div>

                    <div className="space-y-2">
                        <div className="flex gap-2">
                            <Input
                                placeholder={targetMode === 'url' ? "Enter target URL (e.g. example.com)" : "Select a target list via Manage Lists ->"}
                                value={target}
                                onChange={(e) => setTarget(e.target.value)}
                                readOnly={targetMode === 'list'}
                                className={`bg-input border-border text-foreground font-mono ${targetMode === 'list' ? 'cursor-default opacity-80 focus-visible:ring-0 text-emerald-500' : 'placeholder:text-muted-foreground'}`}
                            />
                            {targetMode === 'list' && (
                                <TargetListManager onSelect={(path) => setTarget(path)} />
                            )}
                        </div>
                        {targetMode === 'list' && (
                            null
                        )}
                    </div>
                </div>

                <Tabs defaultValue={initialTemplate ? "custom" : "presets"} className="w-full">
                    <TabsList className="bg-muted border border-border">
                        <TabsTrigger value="presets">One-Click Presets</TabsTrigger>
                        <TabsTrigger value="custom">Custom Command</TabsTrigger>
                    </TabsList>

                    <TabsContent value="presets" className="mt-4 grid grid-cols-2 gap-2">
                        {PREDEFINED_COMMANDS.map((cmd, i) => (
                            <Button
                                key={i}
                                variant="outline"
                                size="sm"
                                disabled={!target || loading}
                                onClick={() => startScan(cmd.config)}
                                className="justify-start border-border text-muted-foreground hover:bg-muted hover:text-foreground h-auto py-2 px-3"
                            >
                                <div className="flex flex-col items-start text-left w-full">
                                    <div className="flex items-center justify-between w-full">
                                        <span className="flex items-center text-sm font-medium">
                                            <Zap className="mr-2 h-3 w-3 text-emerald-500" />
                                            {cmd.name}
                                        </span>
                                        <code className="text-[9px] px-1.5 py-0.5 rounded bg-muted/50 text-emerald-500 font-mono border border-emerald-500/20">
                                            {cmd.flags}
                                        </code>
                                    </div>
                                    <span className="text-[10px] text-muted-foreground mt-0.5">{cmd.description}</span>
                                </div>
                            </Button>
                        ))}
                    </TabsContent>

                    <TabsContent value="custom" className="mt-4 space-y-2">
                        <div className="flex gap-2">
                            <Input
                                placeholder="-t cves -s critical (Flags only, target is auto-added)"
                                value={customArgs}
                                onChange={(e) => setCustomArgs(e.target.value)}
                                className="bg-input border-border text-emerald-500/80 font-mono text-sm"
                            />
                            <Button
                                disabled={!target || !customArgs || loading}
                                onClick={() => startScan({ customArgs })}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                            >
                                <Terminal className="mr-2 h-4 w-4" /> Run
                            </Button>
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                            * The target (-u) and output (-json-export) flags are handled automatically.
                        </p>
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
}

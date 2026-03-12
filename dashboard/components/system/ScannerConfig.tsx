"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Save, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";

// Default values as per Nuclei documentation/recommendation
const DEFAULTS = {
    rateLimit: 150,
    concurrency: 25,
    bulkSize: 25,
};

export function ScannerConfig() {
    const [config, setConfig] = useState(DEFAULTS);
    const [savedConfig, setSavedConfig] = useState(DEFAULTS);
    const [hasChanges, setHasChanges] = useState(false);
    const [saving, setSaving] = useState(false);
    const [loadingSettings, setLoadingSettings] = useState(true);

    // Load from server (database) on mount
    useEffect(() => {
        fetch("/api/scan-settings")
            .then(res => res.json())
            .then(data => {
                const loaded = { ...DEFAULTS, ...data };
                setConfig(loaded);
                setSavedConfig(loaded);
            })
            .catch(() => {
                toast.error("Failed to load settings");
            })
            .finally(() => setLoadingSettings(false));
    }, []);

    const handleChange = (key: string, value: number | boolean) => {
        setConfig(prev => {
            const next = { ...prev, [key]: value };
            setHasChanges(JSON.stringify(next) !== JSON.stringify(savedConfig));
            return next;
        });
    };

    const saveSettings = async () => {
        setSaving(true);
        try {
            const res = await fetch("/api/scan-settings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(config),
            });
            if (!res.ok) throw new Error("Save failed");
            setSavedConfig(config);
            setHasChanges(false);
            toast.success("Settings saved to database");
        } catch {
            toast.error("Failed to save settings");
        } finally {
            setSaving(false);
        }
    };

    const resetDefaults = () => {
        setConfig(DEFAULTS);
        setHasChanges(JSON.stringify(DEFAULTS) !== JSON.stringify(savedConfig));
    };

    return (
        <div className="space-y-6 max-w-4xl mx-auto p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-foreground">Settings</h2>
                    <p className="text-muted-foreground">Configure global scan performance and limits.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={resetDefaults} className="border-border text-muted-foreground hover:text-foreground">
                        <RefreshCw className="mr-2 h-4 w-4" /> Reset
                    </Button>
                    <Button
                        size="sm"
                        onClick={saveSettings}
                        disabled={!hasChanges || saving}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        {saving ? "Saving..." : "Save Changes"}
                    </Button>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-1">
                <Card className="bg-card border-border shadow-none">
                    <CardHeader>
                        <CardTitle className="text-xl text-foreground">Performance & Rate Limiting</CardTitle>
                        <CardDescription className="text-muted-foreground">
                            Control how aggressive the scanner behaves. Lower values are safer but slower.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-8">

                        {/* Rate Limit */}
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <div className="space-y-1">
                                    <Label className="text-base text-foreground">Rate Limit (Requests/Sec)</Label>
                                    <p className="text-xs text-muted-foreground">Max HTTP requests sent per second per host.</p>
                                </div>
                                <div className="w-20">
                                    <Input
                                        type="number"
                                        value={config.rateLimit}
                                        onChange={(e) => handleChange("rateLimit", parseInt(e.target.value) || 0)}
                                        className="bg-input border-border text-right font-mono"
                                    />
                                </div>
                            </div>
                            <Slider
                                value={[config.rateLimit]}
                                min={1}
                                max={2000}
                                step={10}
                                onValueChange={(vals) => handleChange("rateLimit", vals[0])}
                                className="py-2"
                            />
                        </div>

                        <div className="h-px bg-border" />

                        {/* Concurrency */}
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <div className="space-y-1">
                                    <Label className="text-base text-foreground">Concurrency (Templates)</Label>
                                    <p className="text-xs text-muted-foreground">Number of templates to run in parallel.</p>
                                </div>
                                <div className="w-20">
                                    <Input
                                        type="number"
                                        value={config.concurrency}
                                        onChange={(e) => handleChange("concurrency", parseInt(e.target.value) || 0)}
                                        className="bg-input border-border text-right font-mono"
                                    />
                                </div>
                            </div>
                            <Slider
                                value={[config.concurrency]}
                                min={1}
                                max={200}
                                step={1}
                                onValueChange={(vals) => handleChange("concurrency", vals[0])}
                                className="py-2"
                            />
                        </div>

                        <div className="h-px bg-border" />

                        {/* Bulk Size */}
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <div className="space-y-1">
                                    <Label className="text-base text-foreground">Bulk Size (Hosts)</Label>
                                    <p className="text-xs text-muted-foreground">Number of hosts to scan in parallel.</p>
                                </div>
                                <div className="w-20">
                                    <Input
                                        type="number"
                                        value={config.bulkSize}
                                        onChange={(e) => handleChange("bulkSize", parseInt(e.target.value) || 0)}
                                        className="bg-input border-border text-right font-mono"
                                    />
                                </div>
                            </div>
                            <Slider
                                value={[config.bulkSize]}
                                min={1}
                                max={100}
                                step={1}
                                onValueChange={(vals) => handleChange("bulkSize", vals[0])}
                                className="py-2"
                            />
                        </div>



                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

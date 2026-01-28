"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Send, CheckCircle2, AlertCircle, Save, Bell, BellOff, Lock } from "lucide-react";

export function SettingsPanel() {
    const [token, setToken] = useState("");
    const [chatId, setChatId] = useState("");
    const [enabled, setEnabled] = useState(false);
    const [loading, setLoading] = useState(true);
    const [testing, setTesting] = useState(false);
    const [isConfigured, setIsConfigured] = useState(false);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const res = await fetch("/api/settings");
            const data = await res.json();
            if (data) {
                setToken(data.telegram_bot_token || "");
                setChatId(data.telegram_chat_id || "");
                setEnabled(data.notifications_enabled || false);
                setIsConfigured(data.is_configured);
            }
        } catch (e) {
            console.error("Failed to load settings", e);
        } finally {
            setLoading(false);
        }
    };

    const handleTest = async () => {
        if (!token || !chatId) {
            toast.error("Enter Token and Chat ID first");
            return;
        }

        setTesting(true);
        // If token is masked (••••), we can't test unless we have the real value or the backend handles it.
        // For security, if veiled, we assume the backend has it. 
        // BUT the verify endpoint expects the RAW token to test with what's in the input.
        // So this "Test" button is best used when entering NEW credentials.
        // If credentials are saved and masked, we might need a way to test "Saved Credentials".

        // Logic: If token includes "••••", we warn user: "Enter full token to test new connection"
        if (token.includes("••••")) {
            toast.info("Token is masked. Test is verifying NEW inputs.");
            // We can't really test with masked token. 
            // We'll rely on Save to persist, then maybe a "Test Saved" endpoint?
            // Since verify endpoint is stateless, we need raw token.
            toast.error("Please enter the full token to test the connection.");
            setTesting(false);
            return;
        }

        try {
            const res = await fetch("/api/settings/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, chatId }),
            });
            const data = await res.json();

            if (data.success) {
                toast.success("Connection Successful!", {
                    description: "Test message sent to Telegram."
                });
                setIsConfigured(true);
            } else {
                toast.error("Connection Failed", {
                    description: data.error
                });
                setIsConfigured(false);
            }
        } catch (e) {
            toast.error("Test Request Failed");
        } finally {
            setTesting(false);
        }
    };

    const handleSave = async () => {
        try {
            const res = await fetch("/api/settings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    telegram_bot_token: token,
                    telegram_chat_id: chatId,
                    notifications_enabled: enabled
                }),
            });

            if (res.ok) {
                toast.success("Settings Saved");
                fetchSettings(); // Refresh to get mask back
            } else {
                toast.error("Failed to save settings");
            }
        } catch (e) {
            toast.error("Error saving settings");
        }
    };

    if (loading) return <div>Loading settings...</div>;

    return (
        <Card className="border-border bg-card">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Send className="h-5 w-5 text-blue-400" />
                    Telegram Notifications
                </CardTitle>
                <CardDescription>
                    Receive instant alerts when scans complete or vulnerabilities are found.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">

                <div className="space-y-4">
                    <div className="rounded-lg border bg-blue-500/10 border-blue-500/20 p-4 text-blue-200">
                        <div className="flex items-center gap-2 mb-1">
                            <AlertCircle className="h-4 w-4" />
                            <h5 className="font-medium leading-none tracking-tight">Setup Instructions</h5>
                        </div>
                        <div className="text-xs mt-2 space-y-1 pl-6">
                            <p>1. Create a bot via <b>@BotFather</b> on Telegram.</p>
                            <p>2. Start the bot.</p>
                            <p>3. Enter the Token and your Chat ID below.</p>
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="token">Bot Token</Label>
                        <div className="relative">
                            <Input
                                id="token"
                                type="password"
                                placeholder="123456:ABC-DEF..."
                                value={token}
                                onChange={(e) => setToken(e.target.value)}
                                className="pr-10 font-mono"
                            />
                            <Lock className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground opacity-50" />
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="chat_id">Chat ID</Label>
                        <Input
                            id="chat_id"
                            placeholder="123456789"
                            value={chatId}
                            onChange={(e) => setChatId(e.target.value)}
                            className="font-mono"
                        />
                    </div>
                </div>

                <div className="flex items-center justify-between border-t border-border pt-4">
                    <div className="flex items-center space-x-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleTest}
                            disabled={testing || !token || !chatId || token.includes("••••")}
                        >
                            {testing ? "Testing..." : "Test Connection"}
                        </Button>
                        {isConfigured && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                    </div>

                    <div className="flex items-center space-x-4">
                        <Button
                            variant={enabled ? "default" : "outline"}
                            size="sm"
                            onClick={() => setEnabled(!enabled)}
                            className={enabled ? "bg-green-600 hover:bg-green-700" : "text-muted-foreground"}
                            disabled={!token || !chatId}
                        >
                            {enabled ? <Bell className="mr-2 h-4 w-4" /> : <BellOff className="mr-2 h-4 w-4" />}
                            {enabled ? "Notifications ON" : "Notifications OFF"}
                        </Button>
                    </div>
                </div>

            </CardContent>
            <CardFooter className="bg-muted/50 border-t border-border flex justify-end py-3">
                <Button onClick={handleSave} className="gap-2">
                    <Save className="h-4 w-4" /> Save Settings
                </Button>
            </CardFooter>
        </Card>
    );
}

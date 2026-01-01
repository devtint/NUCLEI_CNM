"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScannerConfig } from "./ScannerConfig";
import { AccessLogTable } from "./AccessLogTable";
import { Shield, Settings } from "lucide-react";

export function SystemPanel() {
    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">System & Security</h2>
                    <p className="text-muted-foreground">Manage global configuration and monitor security events.</p>
                </div>
            </div>

            <Tabs defaultValue="config" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="config" className="flex items-center gap-2">
                        <Settings className="h-4 w-4" />
                        Scanner Config
                    </TabsTrigger>
                    <TabsTrigger value="security" className="flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        Security Audit
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="config" className="space-y-4">
                    <ScannerConfig />
                </TabsContent>

                <TabsContent value="security" className="space-y-4">
                    <AccessLogTable />
                </TabsContent>
            </Tabs>
        </div>
    );
}

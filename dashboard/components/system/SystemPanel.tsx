"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScannerConfig } from "./ScannerConfig";
import { AccessLogTable } from "./AccessLogTable";
import { ScannersManager } from "./ScannersManager";
import { SettingsPanel } from "./SettingsPanel";
import { Settings, ShieldAlert, Cpu } from "lucide-react";

export function SystemPanel() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-foreground">System & Security</h1>
                <p className="text-muted-foreground">Manage global configuration and monitor security events.</p>
            </div>

            <Tabs defaultValue="config" className="w-full">
                <TabsList className="bg-muted">
                    <TabsTrigger value="config" className="data-[state=active]:bg-background">
                        <Settings className="mr-2 h-4 w-4" />
                        Scanner Config
                    </TabsTrigger>
                    <TabsTrigger value="scanners" className="data-[state=active]:bg-background">
                        <Cpu className="mr-2 h-4 w-4" />
                        Scanners
                    </TabsTrigger>
                    <TabsTrigger value="audit" className="data-[state=active]:bg-background">
                        <ShieldAlert className="mr-2 h-4 w-4" />
                        Security Audit
                    </TabsTrigger>
                    <TabsTrigger value="general" className="data-[state=active]:bg-background">
                        <Settings className="mr-2 h-4 w-4" />
                        General
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="config" className="mt-6">
                    <ScannerConfig />
                </TabsContent>

                <TabsContent value="scanners" className="mt-6">
                    <ScannersManager />
                </TabsContent>

                <TabsContent value="audit" className="mt-6">
                    <AccessLogTable />
                </TabsContent>

                <TabsContent value="general" className="mt-6">
                    <SettingsPanel />
                </TabsContent>
            </Tabs>
        </div>
    );
}

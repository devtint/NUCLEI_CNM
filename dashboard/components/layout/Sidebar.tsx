"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    LayoutDashboard,
    ShieldAlert,
    Play,
    Activity,
    FileCode,
    Settings,
    History
} from "lucide-react";

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
    activeView: string;
    onChangeView: (view: string) => void;
}

export function Sidebar({ className, activeView, onChangeView }: SidebarProps) {
    const items = [
        { id: "overview", label: "Dashboard", icon: LayoutDashboard },
        { id: "vulnerabilities", label: "Vulnerabilities", icon: ShieldAlert },
        { id: "scan", label: "New Operation", icon: Play },
        { id: "activity", label: "Activity Monitor", icon: Activity },
        { id: "history", label: "Scan History", icon: History },
        { id: "templates", label: "Templates", icon: FileCode },
        { id: "settings", label: "Settings", icon: Settings },
    ];

    return (
        <div className={cn("pb-12 w-64 border-r border-sidebar-border h-screen fixed left-0 top-0 bg-sidebar", className)}>
            <div className="space-y-4 py-4">
                <div className="px-4 py-2">
                    <h2 className="mb-2 px-2 text-lg font-semibold tracking-tight text-foreground">
                        Nuclei <span className="text-emerald-500">CC</span>
                    </h2>
                    <div className="space-y-1">
                        {items.map((item) => (
                            <Button
                                key={item.id}
                                variant={activeView === item.id ? "secondary" : "ghost"}
                                className={cn(
                                    "w-full justify-start",
                                    activeView === item.id ? "bg-emerald-900/20 text-emerald-600 hover:bg-emerald-900/30" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                                )}
                                onClick={() => onChangeView(item.id)}
                            >
                                <item.icon className="mr-2 h-4 w-4" />
                                {item.label}
                            </Button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

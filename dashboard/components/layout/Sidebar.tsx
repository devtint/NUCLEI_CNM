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
    History,
    Star,
    Network
} from "lucide-react";

import { handleSignOut } from "@/app/lib/actions";
import { LogOut } from "lucide-react";

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
        { id: "subfinder", label: "Subfinder", icon: Network },
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
                                    activeView === item.id ? "bg-emerald-900/20 text-emerald-600 hover:bg-emerald-900/30" : "text-black hover:text-foreground hover:bg-muted"
                                )}
                                onClick={() => onChangeView(item.id)}
                            >
                                <item.icon className="mr-2 h-4 w-4" />
                                {item.label}
                            </Button>
                        ))}
                    </div>
                </div>

                {/* Bottom Actions Container */}
                <div className="absolute bottom-4 left-4 right-4 space-y-2">
                    <form action={handleSignOut}>
                        <Button
                            variant="ghost"
                            className="w-full justify-start text-red-400 hover:text-red-300 hover:bg-red-900/10 group"
                        >
                            <LogOut className="mr-2 h-4 w-4 group-hover:scale-110 transition-transform" />
                            Log Out
                        </Button>
                    </form>

                    <a
                        href="https://github.com/devtint/NUCLEI_CNM"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block"
                    >
                        <Button
                            variant="outline"
                            className="w-full justify-center gap-2 border-emerald-500/30 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 hover:text-emerald-400 hover:border-emerald-500/50 transition-all duration-300 group"
                        >
                            <Star className="h-4 w-4 group-hover:fill-emerald-400 group-hover:scale-110 transition-all duration-300" />
                            <span className="font-medium">Star the Repo ⭐</span>
                        </Button>
                    </a>
                </div>
            </div>
        </div>
    );
}

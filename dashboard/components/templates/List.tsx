"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { FileCode, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Template {
    id: string;
    name: string;
    path: string;
    lastModified: string;
}

export function TemplateList({ refreshTrigger, onRun }: { refreshTrigger: number, onRun?: (path: string) => void }) {
    const [templates, setTemplates] = useState<Template[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchTemplates = async () => {
            setLoading(true);
            try {
                const res = await fetch("/api/templates");
                const data = await res.json();
                if (Array.isArray(data)) {
                    setTemplates(data);
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetchTemplates();
    }, [refreshTrigger]);

    if (loading) {
        return <div className="text-muted-foreground text-sm">Loading templates...</div>;
    }

    if (templates.length === 0) {
        return (
            <div className="col-span-3 border border-dashed border-border rounded-lg p-8 flex flex-col items-center justify-center text-muted-foreground">
                <FileCode className="h-8 w-8 mb-4 opacity-50" />
                <span className="mb-2 font-medium">No Custom Templates Found</span>
                <span className="text-xs">Create one to see it here.</span>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {templates.map((t) => (
                <Card key={t.id} className="bg-card border-border hover:border-emerald-500/50 transition-colors shadow-sm flex flex-col justify-between">
                    <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between">
                            <div className="p-2 bg-emerald-500/10 rounded-md text-emerald-500">
                                <FileCode className="h-5 w-5" />
                            </div>
                            <div className="flex gap-2">
                                <Badge variant="outline" className="text-xs font-mono border-border text-muted-foreground">
                                    YAML
                                </Badge>
                                {onRun && (
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        className="h-6 text-[10px] px-2"
                                        onClick={(e: React.MouseEvent) => {
                                            e.stopPropagation();
                                            onRun(t.path);
                                        }}
                                    >
                                        Run
                                    </Button>
                                )}
                            </div>
                        </div>
                        <div>
                            <h4 className="font-semibold text-foreground truncate" title={t.name}>{t.id}</h4>
                            <p className="text-xs text-muted-foreground truncate" title={t.path}>{t.name}</p>
                        </div>
                        <div className="pt-2 border-t border-border flex items-center text-xs text-muted-foreground">
                            <Calendar className="mr-1 h-3 w-3" />
                            {new Date(t.lastModified).toLocaleDateString()}
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}

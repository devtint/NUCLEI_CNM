"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea"; // Need to add textarea
import { Save, Upload } from "lucide-react";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

export function TemplateManager({ onSaved }: { onSaved?: () => void }) {
    const [name, setName] = useState("");
    const [content, setContent] = useState("id: custom-template\ninfo:\n  name: Custom Template\n  severity: info\nrequests:\n  - method: GET\n    path:\n      - \"{{BaseURL}}\"\n");
    const [open, setOpen] = useState(false);

    const saveTemplate = async () => {
        try {
            await fetch("/api/templates", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, content }),
            });
            setOpen(false);
            toast.success("Template Saved!");
            if (onSaved) onSaved();
        } catch (e) {
            toast.error("Error saving: " + e);
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;
            setContent(text);
            // Auto-fill name if empty
            if (!name) {
                setName(file.name.replace(".yaml", "").replace(".yml", ""));
            }
        };
        reader.readAsText(file);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="border-border text-foreground hover:bg-muted">
                    + New Template
                </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border text-foreground max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Create Custom Template</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="flex items-center gap-4">
                        <Button
                            variant="secondary"
                            className="w-full relative"
                            onClick={() => document.getElementById("template-upload")?.click()}
                        >
                            <Upload className="mr-2 h-4 w-4" /> Import from File
                            <input
                                id="template-upload"
                                type="file"
                                accept=".yaml,.yml"
                                className="hidden"
                                onChange={handleFileUpload}
                            />
                        </Button>
                        <span className="text-xs text-muted-foreground w-full text-center">OR manually edit below</span>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">Template Name (ID)</label>
                        <Input
                            placeholder="my-custom-check"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="bg-input border-border"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">YAML Content</label>
                        <textarea
                            className="w-full h-64 p-3 rounded-md bg-input border border-border font-mono text-sm focus:outline-none focus:ring-1 focus:ring-ring text-foreground"
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                        />
                    </div>
                    <Button onClick={saveTemplate} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                        <Save className="mr-2 h-4 w-4" /> Save Template
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

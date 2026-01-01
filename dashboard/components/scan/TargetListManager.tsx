"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Upload, Plus, Check } from "lucide-react";

interface TargetListManagerProps {
    onSelect: (filepath: string) => void;
    children?: React.ReactNode;
    defaultTab?: "select" | "upload" | "create";
}

export function TargetListManager({ onSelect, children, defaultTab = "select" }: TargetListManagerProps) {
    const [open, setOpen] = useState(false);
    const [files, setFiles] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    // Create Mode State
    const [newContent, setNewContent] = useState("");
    const [newName, setNewName] = useState("");
    const [isDragging, setIsDragging] = useState(false);
    const [activeTab, setActiveTab] = useState("select");

    const fetchFiles = async () => {
        try {
            const res = await fetch("/api/upload");
            const data = await res.json();
            if (data.success) {
                setFiles(data.files);
            }
        } catch (e) {
            console.error("Failed to fetch files", e);
        }
    };

    useEffect(() => {
        if (open) {
            fetchFiles();
            setActiveTab(defaultTab);
        }
    }, [open, defaultTab]);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setLoading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
            });
            const data = await res.json();
            if (data.success) {
                await fetchFiles();
                setActiveTab("select");
                // Optional: Auto-select but keep open? 
                // onSelect(data.filepath); 
                // Let's letting user select it explicitly to avoid confusion.
            }
        } catch (error) {
            console.error('Upload failed:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async () => {
        if (!newContent || !newName) return;
        setLoading(true);

        try {
            const res = await fetch('/api/upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: newContent, name: newName }),
            });
            const data = await res.json();
            if (data.success) {
                await fetchFiles();
                setActiveTab("select");
                setNewContent("");
                setNewName("");
            }
        } catch (error) {
            console.error('Creation failed:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {children || <Button variant="outline">Manage Lists</Button>}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Target List Manager</DialogTitle>
                    <DialogDescription>
                        Select an existing list, upload a file, or create a new one.
                    </DialogDescription>
                </DialogHeader>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="select">Select</TabsTrigger>
                        <TabsTrigger value="upload">Upload</TabsTrigger>
                        <TabsTrigger value="create">Create</TabsTrigger>
                    </TabsList>

                    <TabsContent value="select" className="mt-4">
                        <ScrollArea className="h-[300px] rounded-md border p-4">
                            {files.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm">
                                    <FileText className="h-8 w-8 mb-2 opacity-50" />
                                    No lists found. Upload or create one.
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {files.map((file: any) => (
                                        <div
                                            key={file.name}
                                            className="flex items-center justify-between p-3 rounded-md border hover:bg-muted/50 cursor-pointer transition-colors"
                                            onClick={() => {
                                                onSelect(file.path);
                                                setOpen(false);
                                            }}
                                        >
                                            <div className="flex items-center gap-3">
                                                <FileText className="h-4 w-4 text-emerald-500" />
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-medium">{file.name}</span>
                                                    <span className="text-[10px] text-muted-foreground">
                                                        {new Date(file.createdAt).toLocaleString()}
                                                    </span>
                                                </div>
                                            </div>
                                            <Button size="icon" variant="ghost" className="h-6 w-6">
                                                <Check className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </ScrollArea>
                    </TabsContent>

                    <TabsContent value="upload" className="mt-4">
                        <div
                            className={`flex flex-col items-center justify-center h-[300px] border-2 border-dashed rounded-md relative transition-colors ${isDragging ? 'border-emerald-500 bg-emerald-500/10' : 'hover:bg-muted/10'}`}
                            onDragOver={(e) => {
                                e.preventDefault();
                                setIsDragging(true);
                            }}
                            onDragLeave={() => setIsDragging(false)}
                            onDrop={async (e) => {
                                e.preventDefault();
                                setIsDragging(false);
                                const file = e.dataTransfer.files?.[0];
                                if (!file) return;

                                // Reuse logic
                                setLoading(true);
                                const formData = new FormData();
                                formData.append('file', file);

                                try {
                                    const res = await fetch('/api/upload', {
                                        method: 'POST',
                                        body: formData,
                                    });
                                    const data = await res.json();
                                    if (data.success) {
                                        await fetchFiles();
                                        setActiveTab("select");
                                    }
                                } catch (error) {
                                    console.error('Upload failed:', error);
                                } finally {
                                    setLoading(false);
                                }
                            }}
                        >
                            <Input
                                type="file"
                                accept=".txt"
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                onChange={handleUpload}
                                disabled={loading}
                            />
                            <Upload className={`h-10 w-10 mb-4 ${isDragging ? 'text-emerald-500' : 'text-muted-foreground'}`} />
                            <p className="text-sm font-medium">Click or Drag file here</p>
                            <p className="text-xs text-muted-foreground mt-2">.txt files only (one target per line)</p>
                            {loading && <p className="text-xs text-emerald-500 mt-4 animate-pulse">Uploading...</p>}
                        </div>
                    </TabsContent>

                    <TabsContent value="create" className="mt-4 space-y-4">
                        <div className="space-y-2">
                            <label className="text-xs font-medium uppercase text-muted-foreground">List Name</label>
                            <Input
                                placeholder="e.g. bug_bounty_program"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-medium uppercase text-muted-foreground">Targets (One per line)</label>
                            <Textarea
                                placeholder="example.com&#10;test.com&#10;staging.site.com"
                                className="h-[180px] font-mono"
                                value={newContent}
                                onChange={(e) => setNewContent(e.target.value)}
                            />
                        </div>
                        <Button
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                            onClick={handleCreate}
                            disabled={!newName || !newContent || loading}
                        >
                            {loading ? "Saving..." : <><Plus className="mr-2 h-4 w-4" /> Save List</>}
                        </Button>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}

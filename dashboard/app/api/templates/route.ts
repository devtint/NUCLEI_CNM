import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";
import { auth } from "@/auth";

export async function POST(req: NextRequest) {
    // Check authentication
    const session = await auth();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { name, content } = await req.json();
        if (!name || !content) return NextResponse.json({ error: "Missing name or content" }, { status: 400 });

        // Ensure custom-templates directory exists
        const home = os.homedir();
        const customDir = path.join(home, "nuclei-custom-templates");

        if (!fs.existsSync(customDir)) {
            fs.mkdirSync(customDir, { recursive: true });
        }

        // Save file
        // Sanitize name to avoid traversal
        const safeName = name.replace(/[^a-zA-Z0-9-_]/g, "") + ".yaml";
        const filePath = path.join(customDir, safeName);

        fs.writeFileSync(filePath, content);

        return NextResponse.json({ success: true, path: filePath });
    } catch (e) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
export async function GET(req: NextRequest) {
    // Check authentication
    const session = await auth();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const home = os.homedir();
        const customDir = path.join(home, "nuclei-custom-templates");

        if (!fs.existsSync(customDir)) {
            return NextResponse.json([]);
        }

        const files = fs.readdirSync(customDir)
            .filter(f => f.endsWith(".yaml") || f.endsWith(".yml"))
            .map(f => {
                const stats = fs.statSync(path.join(customDir, f));
                return {
                    id: f.replace(".yaml", "").replace(".yml", ""),
                    name: f,
                    path: path.join(customDir, f),
                    lastModified: stats.mtime
                };
            });

        return NextResponse.json(files);
    } catch (e) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}

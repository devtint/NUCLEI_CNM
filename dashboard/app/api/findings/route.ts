import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(req: NextRequest) {
    const scansDir = path.join(process.cwd(), "scans");
    const findings: any[] = [];

    if (fs.existsSync(scansDir)) {
        const files = fs.readdirSync(scansDir).filter(f => f.endsWith(".json"));

        for (const file of files) {
            try {
                const filePath = path.join(scansDir, file);
                const content = fs.readFileSync(filePath, "utf-8");
                const json = JSON.parse(content);

                // Nuclei -json output is an array of findings
                if (Array.isArray(json)) {
                    // Inject source filename for deletion tracking
                    const withSource = json.map(f => ({ ...f, _sourceFile: file }));
                    findings.push(...withSource);
                } else if (typeof json === 'object') {
                    // Single object or line-delimited (if we handled it differently, but we used -json-export logic or standard json array)
                    // If -json-export output [{}, {} ...]
                    findings.push({ ...json, _sourceFile: file }); // if single
                } else {
                    // It might be line-delimited JSON? If so, we need to parse line by line.
                    // But our API `constructCommand` used `-json`.
                    // Wait, standard `nuclei -o file.json -json` creates a file where EACH LINE is a JSON object.
                    // It is NOT a JSON array [].
                    // `nuclei -json-export file.json` creates a JSON array.
                    // My `config.ts` used `args.push("-o", outputFile); args.push("-json");`
                    // This creates Line-Delimited JSON (NDJSON).
                    // Example:
                    // {"template-id":...}
                    // {"template-id":...}

                    // So reading it as `JSON.parse(content)` will FAIL if >1 finding.
                    // I need to fix `constructCommand` to use `-json-export` OR fix this reader to split by newline.

                    // Let's safe-fix the reader to handle NDJSON.
                    const lines = content.trim().split("\n");
                    lines.forEach(line => {
                        if (line.trim()) findings.push(JSON.parse(line));
                    });
                }
            } catch (e) {
                // ignore parse errors or partial files
            }
        }
    }

    return NextResponse.json(findings);
}

export async function DELETE(req: NextRequest) {
    try {
        const { sourceFile, templateId, matchedAt } = await req.json();

        if (!sourceFile) {
            return NextResponse.json({ error: "Source file required" }, { status: 400 });
        }

        const matches = (f: any) =>
            f["template-id"] === templateId &&
            (f["matched-at"] === matchedAt || f["host"] === matchedAt || !matchedAt);

        const filePath = path.join(process.cwd(), "scans", sourceFile);
        if (!fs.existsSync(filePath)) {
            return NextResponse.json({ error: "File not found" }, { status: 404 });
        }

        const content = fs.readFileSync(filePath, "utf-8");
        let json = JSON.parse(content);

        // Filter out the finding
        // Handle array vs single object
        if (Array.isArray(json)) {
            const originalLen = json.length;
            json = json.filter((f: any) => !matches(f));
            if (json.length === originalLen) {
                return NextResponse.json({ error: "Finding not found in file" }, { status: 404 });
            }
        } else {
            if (matches(json)) {
                json = []; // 'Delete' the single finding by making it empty array? Or empty object?
                // Better to make it empty array as that's our standard for "empty scan"
                json = [];
            } else {
                return NextResponse.json({ error: "Finding not found" }, { status: 404 });
            }
        }

        fs.writeFileSync(filePath, JSON.stringify(json, null, 2));
        return NextResponse.json({ success: true });

    } catch (e: any) {
        console.error(e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

import { NextRequest, NextResponse } from "next/server";
import { insertScan, insertFindings, FindingRecord } from "@/lib/db";
import { auth } from "@/auth";

export async function POST(req: NextRequest) {
    // Check authentication
    const session = await auth();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const formData = await req.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        // Validate file type
        if (!file.name.endsWith(".json")) {
            return NextResponse.json({ error: "Only JSON files are supported" }, { status: 400 });
        }

        // Read file content
        const fileContent = await file.text();
        let findings: any[];

        // Parse JSON
        try {
            findings = JSON.parse(fileContent);
        } catch (e) {
            return NextResponse.json({ error: "Invalid JSON format" }, { status: 400 });
        }

        // Validate it's an array
        if (!Array.isArray(findings)) {
            return NextResponse.json({ error: "JSON must be an array of findings" }, { status: 400 });
        }

        if (findings.length === 0) {
            return NextResponse.json({ error: "No findings found in JSON file" }, { status: 400 });
        }

        // Validate Nuclei format (check first finding has required fields)
        const firstFinding = findings[0];
        if (!firstFinding.info || !firstFinding['template-id']) {
            return NextResponse.json({
                error: "Invalid Nuclei format. Required fields: 'info', 'template-id'"
            }, { status: 400 });
        }

        // Generate scan ID
        const scanId = crypto.randomUUID();
        const timestamp = Date.now();

        // Extract target from findings (use first finding's host or matched-at)
        const target = findings[0].host || findings[0]['matched-at'] || "imported-scan";

        // Insert scan record
        insertScan({
            id: scanId,
            target: `Imported: ${target}`,
            config: JSON.stringify({ source: "json_import", filename: file.name }),
            start_time: timestamp,
            end_time: timestamp,
            status: 'completed'
        });

        // Convert findings to database format
        const findingRecords: FindingRecord[] = findings.map((f: any) => ({
            scan_id: scanId,
            template_id: f['template-id'] || f.templateId,
            template_path: f['template-path'] || f.templatePath,
            name: f.info?.name,
            severity: f.info?.severity,
            type: f.type,
            host: f.host,
            matched_at: f['matched-at'] || f.matchedAt,
            matcher_name: f['matcher-name'] || f.matcherName,
            request: f.request,
            response: f.response,
            timestamp: f.timestamp || new Date().toISOString(),
            raw_json: JSON.stringify(f)
        }));

        // Insert findings (with automatic deduplication via generateFindingHash)
        const result = insertFindings(findingRecords);

        return NextResponse.json({
            success: true,
            scanId,
            imported: findingRecords.length,
            message: `Successfully imported ${findingRecords.length} findings from ${file.name}`
        });

    } catch (error: any) {
        console.error("Import error:", error);
        return NextResponse.json({
            error: error.message || "Failed to import scan"
        }, { status: 500 });
    }
}

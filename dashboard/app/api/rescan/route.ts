import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import { constructCommand, NUCLEI_BINARY } from "@/lib/nuclei/config";
import { getDatabase, FindingRecord } from "@/lib/db";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { findingId, target, templateId } = body;

        if (!findingId || !target || !templateId) {
            return NextResponse.json({
                error: "findingId, target, and templateId are required"
            }, { status: 400 });
        }

        // Create temporary output file for rescan
        const tempId = crypto.randomUUID();
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const filename = `rescan_${tempId}_${timestamp}.json`;
        const outputPath = path.join(process.cwd(), "scans", filename);

        // Construct nuclei command for single template
        const args = constructCommand({
            target,
            templateId
        }, outputPath);

        console.log(`Starting rescan for finding ${findingId}: ${NUCLEI_BINARY} ${args.join(" ")}`);

        // Run nuclei synchronously
        const child = spawn(NUCLEI_BINARY, args);
        child.stdin.end();

        return new Promise((resolve) => {
            let output = '';

            child.stdout.on("data", (data) => {
                output += data.toString();
            });

            child.stderr.on("data", (data) => {
                output += data.toString();
            });

            child.on("close", (code) => {
                console.log(`Rescan completed with code ${code}`);

                try {
                    // Read the rescan results
                    if (fs.existsSync(outputPath)) {
                        const jsonContent = fs.readFileSync(outputPath, 'utf-8');
                        const findings = JSON.parse(jsonContent);

                        if (Array.isArray(findings) && findings.length > 0) {
                            // Update the existing finding in database
                            const newFinding = findings[0]; // Take first result
                            const db = getDatabase();

                            const stmt = db.prepare(`
                                UPDATE findings 
                                SET template_id = ?,
                                    template_path = ?,
                                    name = ?,
                                    severity = ?,
                                    type = ?,
                                    host = ?,
                                    matched_at = ?,
                                    request = ?,
                                    response = ?,
                                    timestamp = ?,
                                    raw_json = ?,
                                    created_at = strftime('%s', 'now')
                                WHERE id = ?
                            `);

                            stmt.run(
                                newFinding['template-id'] || newFinding.templateId,
                                newFinding['template-path'] || newFinding.templatePath,
                                newFinding.info?.name,
                                newFinding.info?.severity,
                                newFinding.type,
                                newFinding.host,
                                newFinding['matched-at'] || newFinding.matchedAt,
                                newFinding.request,
                                newFinding.response,
                                newFinding.timestamp,
                                JSON.stringify(newFinding),
                                parseInt(findingId)
                            );

                            console.log(`Updated finding ${findingId} with new rescan results`);

                            // Clean up temp file
                            fs.unlinkSync(outputPath);

                            resolve(NextResponse.json({
                                success: true,
                                message: "Finding updated with rescan results",
                                updated: true
                            }));
                        } else {
                            // No findings in rescan - vulnerability might be fixed
                            console.log(`Rescan found no vulnerabilities for finding ${findingId}`);

                            // Clean up temp file
                            if (fs.existsSync(outputPath)) {
                                fs.unlinkSync(outputPath);
                            }

                            resolve(NextResponse.json({
                                success: true,
                                message: "Rescan completed - no vulnerabilities found (possibly fixed)",
                                updated: false,
                                fixed: true
                            }));
                        }
                    } else {
                        resolve(NextResponse.json({
                            success: false,
                            message: "Rescan failed - no output generated"
                        }, { status: 500 }));
                    }
                } catch (error: any) {
                    console.error("Error processing rescan results:", error);
                    resolve(NextResponse.json({
                        success: false,
                        message: error.message
                    }, { status: 500 }));
                }
            });

            child.on("error", (err) => {
                console.error("Rescan process error:", err);
                resolve(NextResponse.json({
                    success: false,
                    message: err.message
                }, { status: 500 }));
            });
        });

    } catch (error: any) {
        return NextResponse.json({
            success: false,
            message: error.message
        }, { status: 500 });
    }
}

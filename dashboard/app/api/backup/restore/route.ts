import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";
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
        let backup: any;

        // Parse JSON
        try {
            backup = JSON.parse(fileContent);
        } catch (e) {
            return NextResponse.json({ error: "Invalid JSON format" }, { status: 400 });
        }

        // Validate backup format
        if (!backup.metadata || backup.metadata.format !== "nuclei-cc-backup") {
            return NextResponse.json({
                error: "Invalid backup format. Only files created by Nuclei CC Backup System are supported."
            }, { status: 400 });
        }

        if (!backup.metadata.version) {
            return NextResponse.json({
                error: "Backup file is missing version information"
            }, { status: 400 });
        }

        const db = getDatabase();
        let stats = {
            nuclei: { scans: 0, findings: 0 },
            subfinder: { scans: 0, results: 0, monitored_targets: 0, monitored_subdomains: 0 },
            httpx: { scans: 0, results: 0 }
        };

        // Begin transaction
        db.prepare("BEGIN").run();

        try {
            // Restore Nuclei data
            if (backup.nuclei) {
                const scanInsert = db.prepare(`
                    INSERT OR IGNORE INTO scans (id, target, config, start_time, end_time, status, exit_code, json_file_path, json_file_size, log_file_path, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `);

                for (const scan of backup.nuclei.scans || []) {
                    scanInsert.run(
                        scan.id, scan.target, scan.config, scan.start_time, scan.end_time,
                        scan.status, scan.exit_code, scan.json_file_path, scan.json_file_size,
                        scan.log_file_path, scan.created_at
                    );
                    stats.nuclei.scans++;
                }

                const findingInsert = db.prepare(`
                    INSERT OR IGNORE INTO findings (scan_id, template_id, template_path, name, severity, type, host, matched_at, request, response, timestamp, raw_json, finding_hash, status, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `);

                for (const finding of backup.nuclei.findings || []) {
                    findingInsert.run(
                        finding.scan_id, finding.template_id, finding.template_path, finding.name,
                        finding.severity, finding.type, finding.host, finding.matched_at,
                        finding.request, finding.response, finding.timestamp,
                        finding.raw_json, finding.finding_hash, finding.status, finding.created_at
                    );
                    stats.nuclei.findings++;
                }
            }

            // Restore Subfinder data
            if (backup.subfinder) {
                const subfinderScanInsert = db.prepare(`
                    INSERT OR IGNORE INTO subfinder_scans (id, target, start_time, end_time, status, count)
                    VALUES (?, ?, ?, ?, ?, ?)
                `);

                for (const scan of backup.subfinder.scans || []) {
                    subfinderScanInsert.run(
                        scan.id, scan.target, scan.start_time, scan.end_time, scan.status, scan.count
                    );
                    stats.subfinder.scans++;
                }

                // Restore subfinder_results (may have FK constraints, skip invalid ones)
                const resultInsert = db.prepare(`
                    INSERT OR IGNORE INTO subfinder_results (scan_id, subdomain, first_seen, last_seen, is_new)
                    VALUES (?, ?, ?, ?, ?)
                `);

                for (const result of backup.subfinder.results || []) {
                    try {
                        resultInsert.run(
                            result.scan_id, result.subdomain, result.first_seen,
                            result.last_seen, result.is_new
                        );
                        stats.subfinder.results++;
                    } catch (e: any) {
                        // Skip records with invalid foreign key references
                        if (!e.message.includes('FOREIGN KEY')) {
                            throw e;
                        }
                    }
                }

                // Restore monitored_targets
                const monitoredTargetInsert = db.prepare(`
                    INSERT OR IGNORE INTO monitored_targets (target, last_scan_date, total_count, created_at)
                    VALUES (?, ?, ?, ?)
                `);

                for (const target of backup.subfinder.monitored_targets || []) {
                    monitoredTargetInsert.run(
                        target.target, target.last_scan_date, target.total_count, target.created_at
                    );
                    stats.subfinder.monitored_targets++;
                }

                // Restore monitored_subdomains (may have FK constraints, skip invalid ones)
                const monitoredSubdomainInsert = db.prepare(`
                    INSERT OR IGNORE INTO monitored_subdomains (target_id, subdomain, first_seen, last_seen)
                    VALUES (?, ?, ?, ?)
                `);

                for (const subdomain of backup.subfinder.monitored_subdomains || []) {
                    try {
                        monitoredSubdomainInsert.run(
                            subdomain.target_id, subdomain.subdomain, subdomain.first_seen, subdomain.last_seen
                        );
                        stats.subfinder.monitored_subdomains++;
                    } catch (e: any) {
                        // Skip records with invalid foreign key references
                        if (!e.message.includes('FOREIGN KEY')) {
                            throw e;
                        }
                    }
                }
            }

            // Restore HTTPX data
            if (backup.httpx) {
                const httpxScanInsert = db.prepare(`
                    INSERT OR IGNORE INTO httpx_scans (id, target, start_time, end_time, status, count, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `);

                for (const scan of backup.httpx.scans || []) {
                    httpxScanInsert.run(
                        scan.id, scan.target, scan.start_time, scan.end_time, scan.status, scan.count, scan.created_at
                    );
                    stats.httpx.scans++;
                }

                const httpxResultInsert = db.prepare(`
                    INSERT OR IGNORE INTO httpx_results (id, scan_id, url, host, port, scheme, title, status_code, subdomain, technologies, web_server, content_type, content_length, response_time, ip, cname, cdn_name, timestamp, is_new, change_status, screenshot_path)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `);

                for (const result of backup.httpx.results || []) {
                    httpxResultInsert.run(
                        result.id, result.scan_id, result.url, result.host, result.port, result.scheme,
                        result.title, result.status_code, result.subdomain, result.technologies,
                        result.web_server, result.content_type, result.content_length, result.response_time,
                        result.ip, result.cname, result.cdn_name, result.timestamp, result.is_new,
                        result.change_status, result.screenshot_path
                    );
                    stats.httpx.results++;
                }
            }

            // Commit transaction
            db.prepare("COMMIT").run();

            return NextResponse.json({
                success: true,
                message: "Backup restored successfully",
                stats,
                backupInfo: {
                    version: backup.metadata.version,
                    exportedAt: backup.metadata.exportedAt
                }
            });

        } catch (error) {
            // Rollback on error
            db.prepare("ROLLBACK").run();
            throw error;
        }

    } catch (error: any) {
        console.error("Restore error:", error);
        return NextResponse.json({
            error: error.message || "Failed to restore backup"
        }, { status: 500 });
    }
}

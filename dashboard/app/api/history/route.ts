import { NextRequest, NextResponse } from "next/server";
import { getAllScans, getFindingCount, deleteScan } from "@/lib/db";
import { withCache, cache } from "@/lib/cache";
import { handleApiError, dbOperation, ErrorType, ApiError } from "@/lib/errors";
import fs from "fs";
import path from "path";

export async function GET() {
    try {
        // Use cache with 30-second TTL
        const history = withCache("scan-history", 30000, () => {
            return dbOperation(() => {
                const scans = getAllScans();
                const scansDir = path.join(process.cwd(), "scans");

                // Map database records to frontend format
                return scans.map((scan: any) => {
                    const findingCount = getFindingCount(scan.id);

                    // Fallback: Check filesystem if database doesn't have file metadata
                    let jsonFilePath = scan.json_file_path;
                    let jsonFileSize = scan.json_file_size || 0;
                    let logFilePath = scan.log_file_path;

                    if (!jsonFilePath || jsonFileSize === 0 || !logFilePath) {
                        // Read from filesystem for old scans
                        if (fs.existsSync(scansDir)) {
                            const files = fs.readdirSync(scansDir);

                            // Find JSON file
                            const jsonFile = files.find(f => f.startsWith(scan.id) && f.endsWith('.json'));
                            if (jsonFile) {
                                jsonFilePath = jsonFile;
                                const fullPath = path.join(scansDir, jsonFile);
                                if (fs.existsSync(fullPath)) {
                                    jsonFileSize = fs.statSync(fullPath).size;
                                }
                            }

                            // Find log file
                            const logFile = files.find(f => f.startsWith(scan.id) && f.endsWith('.log'));
                            if (logFile) {
                                logFilePath = logFile;
                            }
                        }
                    }

                    return {
                        // Database fields (new)
                        id: scan.id,
                        target: scan.target,
                        config: scan.config ? JSON.parse(scan.config) : {},
                        startTime: scan.start_time,
                        endTime: scan.end_time,
                        status: scan.status,
                        exitCode: scan.exit_code,
                        findingCount,
                        duration: scan.end_time ? scan.end_time - scan.start_time : null,

                        // Legacy fields for frontend compatibility
                        filename: jsonFilePath || `${scan.id}.json`,
                        size: jsonFileSize,
                        date: new Date(scan.start_time).toISOString(),
                        hasLog: !!logFilePath
                    };
                });
            }, "Failed to fetch scan history");
        });

        return NextResponse.json(history);
    } catch (error) {
        return handleApiError(error);
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const scanId = searchParams.get("id");

        if (!scanId) {
            throw new ApiError(
                ErrorType.VALIDATION_ERROR,
                "Scan ID is required",
                400
            );
        }

        // Delete from database (cascade deletes findings)
        dbOperation(() => {
            deleteScan(scanId);
        }, "Failed to delete scan from database");

        // Delete associated files
        const scansDir = path.join(process.cwd(), "scans");
        const files = fs.existsSync(scansDir) ? fs.readdirSync(scansDir) : [];

        files.forEach(file => {
            if (file.startsWith(scanId)) {
                const filePath = path.join(scansDir, file);
                try {
                    fs.unlinkSync(filePath);
                    console.log(`Deleted file: ${file}`);
                } catch (e) {
                    console.error(`Failed to delete file ${file}:`, e);
                }
            }
        });

        // Invalidate cache
        cache.invalidate("scan-history");
        cache.invalidatePattern("findings");

        return NextResponse.json({
            success: true,
            message: "Scan deleted successfully"
        });
    } catch (error) {
        return handleApiError(error);
    }
}

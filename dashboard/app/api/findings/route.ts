import { NextRequest, NextResponse } from "next/server";
import { getFindingsByScan, deleteFinding, updateFinding, getDatabase } from "@/lib/db";
import { withCache, cache } from "@/lib/cache";
import { handleApiError, dbOperation, ErrorType, ApiError } from "@/lib/errors";
import { auth } from "@/auth";

export async function GET(req: NextRequest) {
    // Check authentication
    const session = await auth();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(req.url);
        const scanId = searchParams.get("scanId");

        const findings = withCache(
            scanId ? `findings-${scanId}` : "findings-all",
            20000, // 20-second TTL
            () => {
                return dbOperation(() => {
                    let results;

                    if (scanId) {
                        // Get findings for specific scan
                        results = getFindingsByScan(scanId);
                    } else {
                        // Get ALL findings from all scans
                        const db = getDatabase();
                        const stmt = db.prepare('SELECT * FROM findings ORDER BY created_at DESC');
                        results = stmt.all();
                    }

                    // Parse raw_json for each finding and map to expected format
                    return results.map((f: any) => {
                        const rawData = JSON.parse(f.raw_json);
                        return {
                            ...rawData,
                            id: f.id,
                            _sourceFile: `${f.scan_id}.json`,
                            _dbId: f.id,
                            _status: f.status || 'New', // Include status
                            request: f.request,
                            response: f.response
                        };
                    });
                }, "Failed to fetch findings");
            }
        );

        return NextResponse.json(findings);
    } catch (error) {
        return handleApiError(error);
    }
}

export async function PATCH(req: NextRequest) {
    // Check authentication
    const session = await auth();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { id, status } = body;

        if (!id) {
            throw new ApiError(
                ErrorType.VALIDATION_ERROR,
                "Finding ID is required",
                400
            );
        }

        const validStatuses = ['New', 'False Positive', 'Confirmed', 'Closed', 'Fixed', 'Regression'];
        if (status && !validStatuses.includes(status)) {
            throw new ApiError(
                ErrorType.VALIDATION_ERROR,
                `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
                400
            );
        }

        dbOperation(() => {
            updateFinding(parseInt(id), { status });
        }, "Failed to update finding status");

        // Invalidate cache
        cache.invalidatePattern("findings");

        return NextResponse.json({
            success: true,
            message: "Finding status updated"
        });
    } catch (error) {
        return handleApiError(error);
    }
}

export async function DELETE(req: NextRequest) {
    // Check authentication
    const session = await auth();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const id = body.id || body._dbId;

        if (!id) {
            throw new ApiError(
                ErrorType.VALIDATION_ERROR,
                "Finding ID is required",
                400
            );
        }

        dbOperation(() => {
            deleteFinding(parseInt(id));
        }, "Failed to delete finding");

        // Invalidate cache
        cache.invalidatePattern("findings");

        return NextResponse.json({ success: true, message: "Finding deleted" });
    } catch (error) {
        return handleApiError(error);
    }
}

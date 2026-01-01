import { NextRequest, NextResponse } from "next/server";
import { getFindingsByScan, getFindingsPaginated, getFindingsTotalCount, deleteFinding, updateFinding, getDatabase } from "@/lib/db";
import { withCache, cache } from "@/lib/cache";
import { handleApiError, dbOperation, ErrorType, ApiError } from "@/lib/errors";

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const scanId = searchParams.get("scanId");
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "100");

        // Validate pagination params
        if (page < 1 || limit < 1 || limit > 500) {
            throw new ApiError(
                ErrorType.VALIDATION_ERROR,
                "Invalid pagination parameters (page >= 1, 1 <= limit <= 500)",
                400
            );
        }

        const cacheKey = scanId 
            ? `findings-${scanId}-p${page}-l${limit}` 
            : `findings-all-p${page}-l${limit}`;

        const result = withCache(
            cacheKey,
            20000, // 20-second TTL
            () => {
                return dbOperation(() => {
                    // Get paginated findings
                    const findings = getFindingsPaginated({
                        page,
                        limit,
                        scanId: scanId || undefined
                    });

                    // Get total count
                    const total = getFindingsTotalCount(scanId || undefined);

                    // Parse raw_json for each finding and map to expected format
                    const data = findings.map((f: any) => {
                        const rawData = JSON.parse(f.raw_json);
                        return {
                            ...rawData,
                            id: f.id,
                            _sourceFile: `${f.scan_id}.json`,
                            _dbId: f.id,
                            _status: f.status || 'New',
                            request: f.request,
                            response: f.response
                        };
                    });

                    return {
                        data,
                        pagination: {
                            page,
                            limit,
                            total,
                            totalPages: Math.ceil(total / limit)
                        }
                    };
                }, "Failed to fetch findings");
            }
        );

        return NextResponse.json(result);
    } catch (error) {
        return handleApiError(error);
    }
}

export async function PATCH(req: NextRequest) {
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

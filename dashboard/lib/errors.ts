import { NextResponse } from "next/server";

// Error types
export enum ErrorType {
    DATABASE_ERROR = "DATABASE_ERROR",
    FILE_NOT_FOUND = "FILE_NOT_FOUND",
    VALIDATION_ERROR = "VALIDATION_ERROR",
    PROCESS_ERROR = "PROCESS_ERROR",
    UNKNOWN_ERROR = "UNKNOWN_ERROR"
}

// Custom error class
export class ApiError extends Error {
    constructor(
        public type: ErrorType,
        message: string,
        public statusCode: number = 500,
        public details?: any
    ) {
        super(message);
        this.name = "ApiError";
    }
}

// Error handler wrapper
export function handleApiError(error: unknown): NextResponse {
    console.error("API Error:", error);

    if (error instanceof ApiError) {
        return NextResponse.json({
            error: error.message,
            type: error.type,
            details: error.details
        }, { status: error.statusCode });
    }

    if (error instanceof Error) {
        return NextResponse.json({
            error: error.message,
            type: ErrorType.UNKNOWN_ERROR
        }, { status: 500 });
    }

    return NextResponse.json({
        error: "An unknown error occurred",
        type: ErrorType.UNKNOWN_ERROR
    }, { status: 500 });
}

// Try-catch wrapper for async functions
export async function tryCatch<T>(
    fn: () => Promise<T>,
    errorType: ErrorType = ErrorType.UNKNOWN_ERROR
): Promise<T> {
    try {
        return await fn();
    } catch (error) {
        if (error instanceof ApiError) {
            throw error;
        }
        throw new ApiError(
            errorType,
            error instanceof Error ? error.message : "Unknown error occurred",
            500,
            error
        );
    }
}

// Database operation wrapper
export function dbOperation<T>(
    operation: () => T,
    errorMessage: string = "Database operation failed"
): T {
    try {
        return operation();
    } catch (error) {
        console.error("Database error:", error);
        throw new ApiError(
            ErrorType.DATABASE_ERROR,
            errorMessage,
            500,
            error instanceof Error ? error.message : error
        );
    }
}

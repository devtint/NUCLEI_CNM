import { NextResponse } from 'next/server';
import { getAccessLogs } from '@/lib/db';
import { auth } from '@/auth';

export async function GET() {
    const session = await auth();
    if (!session) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    try {
        const logs = getAccessLogs(50); // Get last 50 logs
        return NextResponse.json(logs);
    } catch (error) {
        console.error("Failed to fetch access logs:", error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}

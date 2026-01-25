import { NextRequest, NextResponse } from 'next/server';

export function proxy(req: NextRequest) {
    const pathname = req.nextUrl.pathname;
    const host = req.headers.get('host') || '';

    // SECURITY: Force HTTPS in production (Skip for localhost/IP access)
    const isLocal = host.includes('localhost') || host.includes('127.0.0.1') ||
        host.startsWith('192.168.') || host.startsWith('10.') || host.startsWith('172.');

    // Explicitly allow disabling HTTPS redirect via env var
    const forceHttps = process.env.FORCE_HTTPS === 'true';
    const disableHttpsRedirect = process.env.DISABLE_HTTPS_REDIRECT === 'true';

    if (process.env.NODE_ENV === 'production' && !disableHttpsRedirect) {
        const proto = req.headers.get('x-forwarded-proto');
        const shouldRedirect = (forceHttps || !isLocal) && proto && proto !== 'https';

        if (shouldRedirect) {
            return NextResponse.redirect(
                `https://${host}${pathname}`,
                301
            );
        }
    }

    return NextResponse.next();
}

export const config = {
    // Match strict subset to avoid unneccessary invocations
    matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico).*)'],
};

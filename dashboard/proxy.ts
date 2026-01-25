import NextAuth from 'next-auth';
import { authConfig } from './auth.config';
import { NextRequest, NextResponse } from 'next/server';
import { isSetupRequired } from './lib/setup';

const { auth } = NextAuth(authConfig);

// Next.js 16 requires exporting a function named 'proxy'
export async function proxy(req: NextRequest) {
    const pathname = req.nextUrl.pathname;

    // SECURITY: Force HTTPS in production
    if (process.env.NODE_ENV === 'production') {
        const proto = req.headers.get('x-forwarded-proto');
        if (proto && proto !== 'https') {
            return NextResponse.redirect(
                `https://${req.headers.get('host')}${pathname}`,
                301
            );
        }
    }

    // Check if initial setup is required
    const setupRequired = isSetupRequired();
    const isOnSetup = pathname === '/setup';
    const isSetupApi = pathname === '/api/setup';

    // If setup is required, redirect to setup page (except for setup routes)
    if (setupRequired) {
        if (!isOnSetup && !isSetupApi) {
            return NextResponse.redirect(new URL('/setup', req.url));
        }
        return NextResponse.next();
    }

    // If setup is complete, block access to setup page
    if (isOnSetup) {
        return NextResponse.redirect(new URL('/login', req.url));
    }

    // Get session using NextAuth
    const session = await auth();
    const isLoggedIn = !!session?.user;
    const isOnLogin = pathname === '/login';

    // If on login page and already logged in, redirect to dashboard
    if (isOnLogin && isLoggedIn) {
        return NextResponse.redirect(new URL('/', req.url));
    }

    // Allow access to login page when not logged in
    if (isOnLogin) {
        return NextResponse.next();
    }

    // All other routes require authentication
    if (!isLoggedIn) {
        return NextResponse.redirect(new URL('/login', req.url));
    }

    return NextResponse.next();
}

export const config = {
    // Protect all routes except: auth API, static assets, and favicon
    matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico).*)'],
};

import NextAuth from 'next-auth';
import { authConfig } from './auth.config';
import { NextRequest, NextResponse } from 'next/server';

const { auth } = NextAuth(authConfig);

// Next.js 16 requires exporting a function named 'proxy'
export async function proxy(req: NextRequest) {
    // SECURITY: Force HTTPS in production
    if (process.env.NODE_ENV === 'production') {
        const proto = req.headers.get('x-forwarded-proto');
        if (proto && proto !== 'https') {
            return NextResponse.redirect(
                `https://${req.headers.get('host')}${req.nextUrl.pathname}`,
                301
            );
        }
    }

    // Get session using NextAuth
    const session = await auth();
    const isLoggedIn = !!session?.user;
    const isOnLogin = req.nextUrl.pathname === '/login';

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

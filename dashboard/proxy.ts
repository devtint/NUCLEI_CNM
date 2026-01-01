import NextAuth from 'next-auth';
import { authConfig } from './auth.config';
import { NextResponse } from 'next/server';

const { auth } = NextAuth(authConfig);

export default auth((req) => {
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
});

export const config = {
    // Use matcher from proxy.ts to exclude assets and API
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};

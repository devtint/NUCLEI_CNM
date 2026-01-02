import NextAuth from 'next-auth';
import { authConfig } from './auth.config';

const { auth } = NextAuth(authConfig);

// Export auth middleware directly - it handles the authorized callback
export default auth;

export const config = {
    // Use matcher from proxy.ts to exclude assets and API
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};

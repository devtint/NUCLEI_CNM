import type { NextAuthConfig } from 'next-auth';

export const authConfig = {
    pages: {
        signIn: '/login',
    },
    callbacks: {
        // Note: Redirect logic is handled in proxy.ts for Next.js 16
        // This callback is kept minimal - just return auth status
        authorized({ auth }) {
            return !!auth?.user;
        },
    },
    providers: [], // Providers are added in auth.ts
} satisfies NextAuthConfig;


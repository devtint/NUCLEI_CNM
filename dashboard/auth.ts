import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { authConfig } from './auth.config';
import { z } from 'zod';
import { env } from './lib/env';
import bcrypt from 'bcrypt';

import { logAccess } from './lib/db';
import { headers } from 'next/headers';

export const { handlers, auth, signIn, signOut } = NextAuth({
    ...authConfig,
    secret: env.AUTH_SECRET,
    trustHost: true,
    providers: [
        Credentials({
            async authorize(credentials) {
                const parsedCredentials = z
                    .object({ password: z.string().min(6) })
                    .safeParse(credentials);

                if (parsedCredentials.success) {
                    const { password } = parsedCredentials.data;
                    const hash = env.ADMIN_PASSWORD_HASH;

                    try {
                        const match = await bcrypt.compare(password, hash);
                        if (match) {
                            // Phase 7: Log successful login
                            try {
                                const headersList = await headers();
                                const ip = headersList.get('x-forwarded-for') || '127.0.0.1';
                                const userAgent = headersList.get('user-agent') || 'Unknown';
                                logAccess(ip, userAgent, 'LOGIN');
                            } catch (logErr) {
                                console.error("Failed to log access:", logErr);
                            }

                            return { id: '1', name: 'Admin', email: 'admin@local' };
                        }
                    } catch (e) {
                        console.error("Auth error:", e);
                    }
                }

                console.log("Invalid credentials");
                return null;
            },
        }),
    ],
});

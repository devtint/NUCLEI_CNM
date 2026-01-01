import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { authConfig } from './auth.config';
import { z } from 'zod';
import { env } from './lib/env';
import bcrypt from 'bcrypt';

export const { auth, signIn, signOut } = NextAuth({
    ...authConfig,
    providers: [
        Credentials({
            async authorize(credentials) {
                const parsedCredentials = z
                    .object({ password: z.string().min(6) })
                    .safeParse(credentials);

                if (parsedCredentials.success) {
                    const { password } = parsedCredentials.data;
                    const hash = env.ADMIN_PASSWORD_HASH;

                    // console.log("🔐 [Auth] Hash loaded:", hash); // Be careful logging actual hash

                    try {
                        // Secure Check: Compare against HASHED password in env
                        // We use env.ADMIN_PASSWORD_HASH which guarantees existence
                        const match = await bcrypt.compare(password, hash);

                        if (match) {
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

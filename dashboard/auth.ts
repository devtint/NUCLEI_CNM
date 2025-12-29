import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { authConfig } from './auth.config';
import { z } from 'zod';

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
                    // Simple single-user check against env
                    // In production with multiple users, use bcrypt.compare here
                    if (password === process.env.ADMIN_PASSWORD) {
                        return { id: '1', name: 'Admin', email: 'admin@local' };
                    }
                }

                console.log('Invalid credentials');
                return null;
            },
        }),
    ],
});

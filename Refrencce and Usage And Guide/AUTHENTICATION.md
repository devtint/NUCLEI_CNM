# Authentication & Security Documentation

## Overview
NUCLEI_CNM implements a robust, multifaceted security model designed to protect sensitive vulnerability data. It leverages **NextAuth v5 (Beta)** for session management and **Next.js Middleware** for edge-level access control.

## 1. Authentication System

### Core Components
- **Library**: `next-auth` (v5.0.0-beta.16)
- **Strategy**: Credentials Provider (Username/Password)
- **Session**: Encrypted JWT (JWE) in HTTP-only cookies
- **Encryption**: AES-256-GCM (via `jose`)

### Configuration (`dashboard/auth.ts`)
```typescript
export const { auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      async authorize(credentials) {
        // 1. Validate input
        const { password } = credentials;
        
        // 2. Compare against environment hash
        const isValid = await bcrypt.compare(
          password, 
          process.env.ADMIN_PASSWORD_HASH
        );
        
        // 3. Return user object or null
        if (isValid) return { id: "admin", name: "Administrator" };
        return null;
      },
    }),
  ],
});
```

### Password Management
Passwords are **never stored in plaintext**.
- **Storage**: `ADMIN_PASSWORD_HASH` in `.env.local`
- **Algorithm**: bcrypt (salt rounds: 10)
- **Verification**: `bcrypt.compare()` on login attempt

---

## 2. Middleware Protection (`dashboard/proxy.ts`)

We use Next.js Middleware to enforce security rules **before** requests reach your application logic.

### Rules Engine
The `proxy.ts` file acts as a firewall rule engine:

| Route Pattern | Access Rule | Action |
| :--- | :--- | :--- |
| `/login` | Public | Allow |
| `/api/auth/*` | Public | Allow |
| `/_next/*` | Public (Assets) | Allow |
| `/favicon.ico` | Public | Allow |
| `/api/*` | **Authenticated** | Return `401 Unauthorized` |
| `/*` (All Pages) | **Authenticated** | Redirect to `/login` |

### Implementation Details
```typescript
// dashboard/proxy.ts (Simplified)
export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isApiRoute = req.nextUrl.pathname.startsWith('/api');
  
  if (!isLoggedIn && !isPublicRoute) {
    if (isApiRoute) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    return Response.redirect(new URL('/login', req.nextUrl));
  }
});
```

### Protection Layers
1.  **Page Routes**: Unauthenticated users are redirected to login.
2.  **API Routes**: Unauthenticated AJAX requests receive opaque 401 errors.
3.  **HSTS**: In production (`NODE_ENV=production`), middleware adds `Strict-Transport-Security` headers only allowing HTTPS.

---

## 3. Data Protection

### Database Security
- **Isolation**: The `nuclei.db` file is stored outside the web root (`/app/data/`).
- **Git Exclusion**: `.gitignore` explicitly blocks `*.db`, `*.db-wal`, `*.db-shm`.
- **Injection Prevention**: All queries in `lib/db.ts` use **Prepared Statements** (`?` placeholders).

### File System Security
- **Traversal Protection**: Import/Restore endpoints validate filenames to prevent directory traversal attacks.
- **Sanitization**: Template names are sanitized before being used as file paths.

---

## 4. Operational Security (OpSec)

### Recommendations for Deployment
1.  **HTTPS is Mandatory**: Do not expose the dashboard over plain HTTP publically. Cloudflare Tunnel handles this automatically.
2.  **Strong Passwords**: Use a long, random passphrase for `ADMIN_PASSWORD_HASH`.
3.  **Rotation**: Periodically rotate the `AUTH_SECRET` and Admin Password.
4.  **Access Logs**: Monitor the `access_logs` table (viewable in System panel) for failed login attempts.

### Environment variables
Always keep `.env.local` secure.
```bash
# Critical Secrets
ADMIN_PASSWORD_HASH=...
AUTH_SECRET=...
TELEGRAM_BOT_TOKEN=...
```

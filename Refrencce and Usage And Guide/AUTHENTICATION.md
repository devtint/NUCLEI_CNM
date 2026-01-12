# Authentication & Security

## Overview

The Nuclei Dashboard now includes comprehensive authentication and authorization to protect all pages and API routes. This document details the security implementation.

---

## Architecture

### Technology Stack
- **Framework**: NextAuth v5 (Auth.js)
- **Password Hashing**: bcrypt (10 rounds)
- **Session Management**: NextAuth sessions
- **Middleware**: Next.js 16 `proxy.ts` (renamed from `middleware.ts`)

### Security Layers

```
┌─────────────────────────────────────┐
│   1. proxy.ts (Route Protection)    │
│   - Redirects unauthenticated users │
│   - HTTPS enforcement (production)  │
└─────────────────────────────────────┘
           ↓
┌─────────────────────────────────────┐
│   2. API Route Auth Checks          │
│   - Every API validates session     │
│   - Returns 401 if unauthorized     │
└─────────────────────────────────────┘
           ↓
┌─────────────────────────────────────┐
│   3. Database & Business Logic      │
│   - Access logging                  │
│   - Audit trail                     │
└─────────────────────────────────────┘
```

---

## Configuration

### Environment Variables

Required in `dashboard/.env.local`:

```env
# Admin Password Hash (bcrypt)
ADMIN_PASSWORD_HASH="$2b$10$..."

# NextAuth Secret (generate with: openssl rand -base64 32)
AUTH_SECRET="your-random-secret-key-here"
```

### Generating Password Hash

**Method 1: Node.js (Recommended)**
```bash
node -e "const bcrypt = require('bcrypt'); bcrypt.hash('your-password', 10).then(hash => console.log(hash));"
```

**Method 2: bcrypt-cli**
```bash
npm install -g bcrypt-cli
bcrypt-cli hash "your-password"
```

### Generating AUTH_SECRET

```bash
# Using OpenSSL
openssl rand -base64 32

# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

---

## Implementation Details

### 1. proxy.ts (Middleware)

**Purpose**: Protect all routes at the edge using Next.js 16 conventions.

```typescript
export async function proxy(req: NextRequest) {
    // 1. HTTPS enforcement (production only)
    if (process.env.NODE_ENV === 'production') {
        // Redirect HTTP → HTTPS
    }

    // 2. Get session
    const session = await auth();
    const isLoggedIn = !!session?.user;
    const isOnLogin = req.nextUrl.pathname === '/login';

    // 3. Redirect logic
    if (isOnLogin && isLoggedIn) {
        return NextResponse.redirect(new URL('/', req.url));
    }
    if (isOnLogin) {
        return NextResponse.next();
    }
    if (!isLoggedIn) {
        return NextResponse.redirect(new URL('/login', req.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico).*)'],
};
```

### 2. API Route Protection Pattern

**Every API route** follows this pattern:

```typescript
export async function POST(req: NextRequest) {
    // 1. Check authentication
    const session = await auth();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Business logic
    // ...
}
```

---

## Security Features

### ✅ Implemented

| Feature | Status | Description |
|---------|--------|-------------|
| Password Protection | ✅ | All routes require authentication |
| Bcrypt Hashing | ✅ | Passwords hashed with 10 rounds |
| Session Management | ✅ | NextAuth v5 sessions |
| HTTPS Enforcement | ✅ | Auto-redirect in production |
| Access Logging | ✅ | Login attempts logged to database |
| Input Validation | ✅ | Zod schema validation |

---

## Access Logging

### Database Table

```sql
CREATE TABLE access_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip TEXT,
    user_agent TEXT,
    action TEXT,
    timestamp INTEGER
);
```

### Viewing Logs

Navigate to **System** → **Access Logs** in the dashboard.

---

## Troubleshooting

### Cannot Login

**Symptom**: "Invalid credentials" error

**Fix**:
1. Regenerate hash using bcrypt.
2. Update `ADMIN_PASSWORD_HASH` in `.env.local`.
3. Restart server.

### 401 on API Routes

**Symptom**: API returns "Unauthorized"

**Cause**: Session not sent with request or middleware not running. Ensure `proxy.ts` is in the root directory.

---

**Last Updated**: 2026-01-12

# HTTPS Configuration Guide

## ✅ What Changed

Your Nuclei Command Center now runs with **HTTPS by default** using a self-signed SSL certificate.

## 🚀 Usage

### Building and Running

```powershell
# Build the image
docker build -t nuclei-dashboard:latest .

# Run with HTTPS
docker run -d \
  --name nuclei-command-center \
  -p 3000:3000 \
  -p 443:3000 \
  -e "DOCKER_ENV=true" \
  -e "AUTH_SECRET=CzrU6hLx3ASt5P500diNrFQSlvA+oucR9GPWrimD0dE=" \
  -e "ADMIN_PASSWORD_HASH=\$2b\$10\$oyK9UuBuL4EpuQLNpj.QvOOht8OIwcYEkXFjpxBjSxPzcnrBWy./O" \
  -e "AUTH_TRUST_HOST=true" \
  -v nuclei-data:/app/nuclei.db \
  -v ./scans:/app/scans \
  nuclei-dashboard:latest
```

### Access

**Primary:** https://localhost:3000  
**Alternative:** https://127.0.0.1:3000  
**Port 443:** https://localhost

### Browser Security Warning

Since this uses a **self-signed certificate**, your browser will show a security warning:

#### Firefox
1. Click "Advanced"
2. Click "Accept the Risk and Continue"

#### Chrome/Edge
1. Click "Advanced"
2. Click "Proceed to localhost (unsafe)"

#### Or Press
- `thisisunsafe` (type it anywhere on the warning page - it's a hidden Chrome command)

## 🔧 How It Works

1. **server.js** - Custom Node.js HTTPS server
2. **Dockerfile** - Generates self-signed certificate during build
3. **Certificates** - Stored in `/app/certs/` inside container
   - `localhost-key.pem` - Private key
   - `localhost.pem` - Certificate

## 🛠️ Development Without Docker

If you want to run locally with HTTPS:

```powershell
# Generate certificates
npm run generate-cert

# Start with HTTPS
npm run start

# Or start with HTTP only
npm run start:http
```

## 🔐 Production (Trusted Certificates)

For production, use a reverse proxy like **nginx** or **Traefik** with:
- Let's Encrypt SSL certificates (free, trusted)
- Automatic certificate renewal
- Better security and performance

### Quick Nginx Example

```yaml
services:
  nginx:
    image: nginx:alpine
    ports:
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./certs:/etc/nginx/certs
  
  nuclei-dashboard:
    build: .
    expose:
      - "3000"
```

## 🎯 Why Self-Signed for Development?

- **Quick setup** - No domain or DNS needed
- **Free** - No certificate costs
- **Local only** - Perfect for development/testing
- **No external dependencies** - Works offline

## ⚠️ Important Notes

- Self-signed certificates should **NEVER** be used in production
- Browsers will always show warnings for self-signed certs
- The certificate is valid for 365 days
- Each container rebuild generates a new certificate

## 📝 Login Credentials

- **Username:** admin
- **Password:** SuperSlowApi

## 🐛 Troubleshooting

### "NET::ERR_CERT_AUTHORITY_INVALID"
This is expected with self-signed certificates. Click "Advanced" → "Proceed".

### Port Already in Use
```powershell
# Stop existing container
docker rm -f nuclei-command-center

# Or use different port
docker run -p 8443:3000 ...
# Access: https://localhost:8443
```

### Certificate Errors in Logs
If you see "no matching decryption secret", verify AUTH_SECRET is set correctly in environment variables.

---

**Need help?** Check logs: `docker logs -f nuclei-command-center`

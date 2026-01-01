const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const certDir = path.join(__dirname, 'certs');

// Create certs directory if it doesn't exist
if (!fs.existsSync(certDir)) {
  fs.mkdirSync(certDir, { recursive: true });
  console.log('✓ Created certs directory');
}

console.log('Generating self-signed SSL certificate...');

try {
  // Generate private key and certificate using OpenSSL
  execSync(`openssl req -x509 -newkey rsa:2048 -nodes -sha256 -subj "/CN=localhost" -keyout certs/localhost-key.pem -out certs/localhost.pem -days 365`, {
    stdio: 'inherit',
    cwd: __dirname
  });
  
  console.log('✓ SSL certificate generated successfully!');
  console.log('  Key: certs/localhost-key.pem');
  console.log('  Cert: certs/localhost.pem');
  console.log('');
  console.log('Note: Your browser will show a security warning because this is a self-signed certificate.');
  console.log('This is normal for development. Click "Advanced" and "Proceed to localhost".');
} catch (error) {
  console.error('✗ Failed to generate certificate. Make sure OpenSSL is installed.');
  console.error('  Windows: Install Git for Windows (includes OpenSSL) or download from https://slproweb.com/products/Win32OpenSSL.html');
  console.error('  Or use Option 2 below (mkcert) for trusted certificates.');
  process.exit(1);
}

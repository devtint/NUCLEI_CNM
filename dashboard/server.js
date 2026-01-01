const { createServer } = require('https');
const { parse } = require('url');
const next = require('next');
const fs = require('fs');
const path = require('path');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = process.env.PORT || 3000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Check if certificates exist, otherwise create them
const certDir = path.join(__dirname, 'certs');
const keyPath = path.join(certDir, 'localhost-key.pem');
const certPath = path.join(certDir, 'localhost.pem');

let httpsOptions;

if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
  httpsOptions = {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath),
  };
  console.log('✓ Using existing SSL certificates');
} else {
  console.log('⚠ SSL certificates not found. Using HTTP instead.');
  console.log('Run: npm run generate-cert to create certificates');
  httpsOptions = null;
}

app.prepare().then(() => {
  if (httpsOptions) {
    createServer(httpsOptions, async (req, res) => {
      try {
        const parsedUrl = parse(req.url, true);
        await handle(req, res, parsedUrl);
      } catch (err) {
        console.error('Error occurred handling', req.url, err);
        res.statusCode = 500;
        res.end('internal server error');
      }
    }).listen(port, (err) => {
      if (err) throw err;
      console.log(`> Ready on https://${hostname}:${port}`);
    });
  } else {
    // Fallback to HTTP
    const { createServer: createHttpServer } = require('http');
    createHttpServer(async (req, res) => {
      try {
        const parsedUrl = parse(req.url, true);
        await handle(req, res, parsedUrl);
      } catch (err) {
        console.error('Error occurred handling', req.url, err);
        res.statusCode = 500;
        res.end('internal server error');
      }
    }).listen(port, (err) => {
      if (err) throw err;
      console.log(`> Ready on http://${hostname}:${port}`);
    });
  }
});

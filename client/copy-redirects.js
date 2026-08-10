const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, 'dist');
const publicDir = path.join(__dirname, 'public');

// Ensure dist directory exists
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Copy _redirects from public to dist
const redirectsSource = path.join(publicDir, '_redirects');
const redirectsDest = path.join(distDir, '_redirects');

if (fs.existsSync(redirectsSource)) {
  fs.copyFileSync(redirectsSource, redirectsDest);
  console.log('✅ _redirects copied to dist folder');
} else {
  // Create _redirects directly in dist
  fs.writeFileSync(redirectsDest, '/* /index.html 200');
  console.log('✅ _redirects created in dist folder');
}

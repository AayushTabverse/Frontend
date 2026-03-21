const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 8080;

const publicDir = path.join(__dirname, 'public');
const indexFile = path.join(publicDir, 'index.html');

// Health check
app.get('/health', (req, res) => res.send('OK'));

// Serve static files from the Angular build output
app.use(express.static(publicDir));

// SPA fallback — serve index.html for all unmatched routes
app.get('/*', (req, res) => {
  if (fs.existsSync(indexFile)) {
    res.sendFile(indexFile);
  } else {
    res.status(500).send('index.html not found. Build may have failed. Contents: ' + fs.readdirSync(__dirname).join(', '));
  }
});

app.listen(PORT, () => {
  console.log(`TabVerse frontend running on port ${PORT}`);
  console.log(`Serving from: ${publicDir}`);
  console.log(`index.html exists: ${fs.existsSync(indexFile)}`);
  console.log(`Directory contents: ${fs.readdirSync(__dirname).join(', ')}`);
  if (fs.existsSync(publicDir)) {
    console.log(`Public dir contents: ${fs.readdirSync(publicDir).join(', ')}`);
  }
});

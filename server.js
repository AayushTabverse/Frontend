const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;

// Serve static files from the Angular build output
app.use(express.static(path.join(__dirname, 'public')));

// SPA fallback — serve index.html for all unmatched routes
app.get('/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`TabVerse frontend running on port ${PORT}`);
});

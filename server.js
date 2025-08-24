import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve static assets (docs + sdk files) from "public"
app.use(express.static(path.join(__dirname, "public")));

// Explicit routes for sdk.js and sdk.css (optional, but clearer)
app.get("/web-bot-sdk.js", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "web-bot-sdk.js"));
});

app.get("/web-bot-sdk.css", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "web-bot-sdk.css"));
});

// Homepage docs (index.html)
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 SDK Docs running at http://localhost:${PORT}`);
});

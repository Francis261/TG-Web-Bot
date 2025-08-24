import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve sdk.js
app.get("/web-bot-sdk.js", (req, res) => {
  res.sendFile(path.join(__dirname, "sdk.js"));
});

// Serve sdk.css
app.get("/web-bot-sdk.css", (req, res) => {
  res.sendFile(path.join(__dirname, "sdk.css"));
});

// Optional homepage
app.get("/", (req, res) => {
  res.send("SDK is live! Use /sdk.js and /sdk.css");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

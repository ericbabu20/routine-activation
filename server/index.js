// Local / single-server entry point. Starts the Express app listening on a port.
// In development, Vite proxies /api to this server (see vite.config.ts).
// In production single-server mode (`npm start`), it also serves the built app.
import "dotenv/config";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
import express from "express";
import app from "./app.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;

// In production, serve the built client and support client-side routing.
const distDir = path.join(__dirname, "..", "dist");
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(distDir, "index.html"));
  });
}

app.listen(PORT, () => {
  console.log(`\n  cult.fit Routine Activation API running on http://localhost:${PORT}`);
  if (!fs.existsSync(distDir)) {
    console.log("  (dev mode: run the Vite client with `npm run dev`)\n");
  }
});

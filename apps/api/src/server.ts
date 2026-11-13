// API server entrypoint for Speed Trap AI dashboard/backend integration.

// We import path utilities for static artifact serving.
import path from "node:path";
import { fileURLToPath } from "node:url";

// Express provides HTTP server and routing.
import express from "express";

// CORS allows local dashboard origin access during development.
import cors from "cors";

// We import jobs router with all core API endpoints.
import { jobsRouter } from "./routes/jobs.js";
import { isAllowedOrigin } from "./services/origins.js";

// We create Express app instance.
const app = express();

// We parse JSON request bodies.
app.use(express.json());

// Reject disallowed browser origins before any job can be created or deleted.
app.use((req, res, next) => {
  if (!isAllowedOrigin(req.headers.origin)) {
    res.status(403).json({ error: "Browser origin is not allowed. Use the local dashboard." });
    return;
  }
  next();
});
app.use(cors({ origin: true }));

// We mount jobs API under /api namespace.
app.use("/api", jobsRouter);

// We compute current file path for stable root calculation.
const currentFilePath = fileURLToPath(import.meta.url);

// We compute directory path from current module.
const currentDir = path.dirname(currentFilePath);

// We compute workspace root path from source tree location.
const workspaceRoot = path.resolve(currentDir, "../../../");

// We serve generated artifacts as static files.
app.use("/artifacts", express.static(path.join(workspaceRoot, "data", "output")));

// Health route helps quick service checks.
app.get("/health", (_req, res) => {
  res.json({
    service: "speed-trap-api",
    status: "ok",
    disclaimer: "Doar pentru divertisment. Nu este masurare legala.",
  });
});

// We read port from env with sensible default.
const port = Number(process.env.PORT ?? 8787);

// We start listening for incoming requests.
// This is a local file-processing tool; expose it only on loopback by default.
const host = process.env.HOST ?? "127.0.0.1";
app.listen(port, host, () => {
  // We log startup info for local debugging.
  console.log(`[api] listening on http://localhost:${port}`);
});

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

// We create Express app instance.
const app = express();

// We parse JSON request bodies.
app.use(express.json());

// We allow cross-origin calls from local frontend.
app.use(cors());

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
    disclaimer: "Entertainment-only estimated speed output.",
  });
});

// We read port from env with sensible default.
const port = Number(process.env.PORT ?? 8787);

// We start listening for incoming requests.
app.listen(port, () => {
  // We log startup info for local debugging.
  console.log(`[api] listening on http://localhost:${port}`);
});

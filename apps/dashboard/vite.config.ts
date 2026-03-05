// Vite config for React dashboard application.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Export Vite config with React plugin enabled.
export default defineConfig({
  plugins: [react()],
  server: {
    // We use a fixed port for easier API CORS setup and demos.
    port: 5173,
  },
});

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { handleRequest } from "./server/router.mjs";
export default defineConfig({
  plugins: [
    react(),
    {
      name: "original-set-local-api",
      configureServer(server) {
        server.middlewares.use("/api/hockey", async (req, res) => {
          await handleRequest(req, res);
        });
      },
      configurePreviewServer(server) {
        server.middlewares.use("/api/hockey", async (req, res) => {
          await handleRequest(req, res);
        });
      },
    },
  ],
  server: {
    host: "0.0.0.0",
    allowedHosts: [".site", ".chatgpt.com", "localhost"],
  },
  build: { target: "es2022", sourcemap: false },
});

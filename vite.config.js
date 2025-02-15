import { resolve } from "path";
import { defineConfig } from "vite";

export default defineConfig({
    build: {
        lib: {
            entry: resolve(__dirname, "src/plugin.ts"),
            name: "Plugin",
            fileName: "plugin",
        },
        rollupOptions: {
            external: ["kaplay"],
        },
    },
})
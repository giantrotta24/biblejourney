import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@server": fileURLToPath(new URL("./supabase/functions/_shared", import.meta.url)), "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    exclude: [...configDefaults.exclude, "e2e/**", "supabase/functions/tests/**", "mobile/**"],
  },
});

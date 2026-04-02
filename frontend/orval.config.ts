import { defineConfig } from "orval";

export default defineConfig({
  api: {
    input: {
      target: "./openapi.json",
    },
    output: {
      target: "./src/api/generated.ts",
      client: "axios",
      httpClient: "axios",
      override: {
        mutator: {
          path: "./src/api/axios-instance.ts",
          name: "axiosInstance",
        },
      },
    },
  },
});

import vinext from "vinext";
import { defineConfig, loadEnv } from "vite";
import hostingConfig from "./.openai/hosting.json";
import { readExecutionProfile } from "./scripts/execution-profile.mjs";
import { configureToolEnvironment } from "./scripts/tool-environment.mjs";
import { sites } from "./scripts/vite/sites-vite-plugin";
import { connectorPreview } from "./scripts/vite/connector-preview-plugin.mjs";

const SITE_CREATOR_PLACEHOLDER_DATABASE_ID =
  "00000000-0000-4000-8000-000000000000";

const { d1, r2 } = hostingConfig;

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";
const managedLinux = readExecutionProfile() === "managed-linux";

const getLocalBindingConfig = (command: string) => ({
  main: "./worker/index.ts",
  compatibility_flags: ["nodejs_compat"],
  d1_databases:
    command === "serve" && d1
      ? [
        {
          binding: d1,
          database_name: "site-creator-d1",
          database_id: SITE_CREATOR_PLACEHOLDER_DATABASE_ID,
        },
      ]
      : [],
  r2_buckets: r2
    ? [
      {
        binding: r2,
        bucket_name: "site-creator-r2",
      },
    ]
    : [],
});

export default defineConfig(async ({ command, mode }) => {
  configureToolEnvironment(process.cwd());

  const envVars = loadEnv(mode ?? "development", process.cwd(), "");

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    server: {
      ...(managedLinux
        ? { host: "0.0.0.0", allowedHosts: ["terminal.local"] }
        : {}),
      ...(isCodexSeatbeltSandbox
        ? { watch: { useFsEvents: false, usePolling: true } }
        : {}),
    },
    plugins: [
      vinext(),
      sites({ mockAuth: !managedLinux }),
      connectorPreview(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        inspectorPort: false,
        config: {
          ...getLocalBindingConfig(command),
          vars: {
            SUPABASE_URL: envVars.SUPABASE_URL || process.env.SUPABASE_URL || "",
            SUPABASE_SERVICE_ROLE_KEY:
              envVars.SUPABASE_SERVICE_ROLE_KEY ||
              process.env.SUPABASE_SERVICE_ROLE_KEY ||
              "",
            SUPABASE_ANON_KEY:
              envVars.SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "",
            MASTER_PASSWORD:
              envVars.MASTER_PASSWORD || process.env.MASTER_PASSWORD || "",
          },
          ...(command === "serve"
            ? {
              services: [
                {
                  binding: "CONNECTORS",
                  service: "sites-connector-preview",
                  entrypoint: "ConnectorPreview",
                },
              ],
            }
            : {}),
        },
        ...(command === "serve"
          ? {
            auxiliaryWorkers: [
              {
                config: {
                  name: "sites-connector-preview",
                  main: "./scripts/connector-preview/worker.mjs",
                  compatibility_date: "2026-05-15",
                },
              },
            ],
          }
          : {}),
      }),
    ],
  };
});

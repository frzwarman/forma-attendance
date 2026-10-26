const { spawnSync } = require("node:child_process");

const projectRef = process.env.SUPABASE_PROJECT_REF;
if (!/^[a-z]{20}$/.test(projectRef || "")) {
  console.error("Set SUPABASE_PROJECT_REF in supabase/.env.cli.local before linking.");
  process.exit(1);
}
const result = spawnSync("supabase", ["link", "--project-ref", projectRef], {
  stdio: "inherit",
  env: process.env,
});
if (result.error) console.error("Could not start the Supabase CLI. Check that it is installed.");
process.exit(result.status ?? 1);

const { writeFileSync, renameSync } = require("node:fs");
const { spawnSync } = require("node:child_process");
const { resolve } = require("node:path");

const result = spawnSync("supabase", ["gen", "types", "--linked", "--schema", "public"], {
  encoding: "utf8",
  timeout: 60000,
});
if (result.status !== 0 || !result.stdout?.includes("export type Database")) {
  console.error(result.stderr || "Could not generate database types. Existing types were preserved.");
  process.exit(result.status || 1);
}
const destination = resolve(process.cwd(), "src/types/supabase.ts");
writeFileSync(`${destination}.tmp`, result.stdout);
renameSync(`${destination}.tmp`, destination);
console.log("Generated src/types/supabase.ts from the linked database.");

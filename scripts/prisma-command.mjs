import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const cwd = process.cwd();
const env = { ...process.env };

for (const fileName of [".env", ".env.local"]) {
  const filePath = path.join(cwd, fileName);
  if (!existsSync(filePath)) continue;
  applyEnvFile(filePath, env);
}

if ((!env.DIRECT_URL || env.DIRECT_URL.trim() === "") && env.DATABASE_URL) {
  env.DIRECT_URL = env.DATABASE_URL;
}

const args = process.argv.slice(2);
const result = spawnSync("npx", ["prisma", ...args], {
  cwd,
  env,
  stdio: "inherit"
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);

function applyEnvFile(filePath, target) {
  const contents = readFileSync(filePath, "utf8");

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) continue;

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    target[key] = value;
  }
}

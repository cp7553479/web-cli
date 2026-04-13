import fs from "node:fs";
import path from "node:path";

import dotenv from "dotenv";

const envLocal = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envLocal)) {
  dotenv.config({ path: envLocal, quiet: true });
}

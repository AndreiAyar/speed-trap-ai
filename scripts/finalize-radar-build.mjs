// Finish the standalone radar build using Node so this also works on Windows.
import { rename, writeFile } from "node:fs/promises";

// Resolve from this script, regardless of the shell's current working directory.
const output = new URL("../apps/dashboard/dist-radar/", import.meta.url);
await rename(new URL("radar.html", output), new URL("index.html", output));
await writeFile(new URL("_redirects", output), "/radar /index.html 200\n/* /index.html 200\n");

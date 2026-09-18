import assert from "node:assert/strict";
import { exec } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, test } from "node:test";
import { promisify } from "node:util";
import { EXPECTED_HELP_TEXT } from "./expected.js";
const execAsync = promisify(exec);
const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "../../..");
const { version } = JSON.parse(await readFile(resolve(projectRoot, "package.json"), { encoding: "utf8" }));
function normalizeLineEndings(text) {
    return text.replace(/\r\n/g, "\n");
}
function sequelizr(argsString) {
    return execAsync(`node "${resolve(projectRoot, "dist/bin/sequelizr.js")}" ${argsString}`, { cwd: __dirname });
}
describe("sequelizr", () => {
    test("should show help -h", async () => {
        const { stdout } = await sequelizr("-h");
        assert.equal(normalizeLineEndings(stdout), EXPECTED_HELP_TEXT);
    });
    test("should show help --help", async () => {
        const { stdout } = await sequelizr("--help");
        assert.equal(normalizeLineEndings(stdout), EXPECTED_HELP_TEXT);
    });
    test("should show version -v", async () => {
        const { stdout } = await sequelizr("-v");
        assert.equal(stdout.trim(), version);
    });
    test("should show version --version", async () => {
        const { stdout } = await sequelizr("--version");
        assert.equal(stdout.trim(), version);
    });
});

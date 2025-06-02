import {promisify} from "util";
import {exec} from "child_process";

const execAsync = promisify(exec);

function sequelizr(argsString: string) {
	return execAsync(`node ../../dist/bin/sequelizr.js ${argsString}`, {cwd: __dirname});
}
// eslint-disable-next-line @typescript-eslint/no-require-imports
const {version} = require("../../package.json");

describe("sequelizr", () => {
	test("should show help -h", async () => {
		const {stdout} = await sequelizr("-h");
		expect(stdout).toMatchSnapshot();
	});

	test("should show help --help", async () => {
		const {stdout} = await sequelizr("--help");
		expect(stdout).toMatchSnapshot();
	});

	test("should show version -v", async () => {
		const {stdout} = await sequelizr("-v");
		expect(stdout.trim()).toBe(version);
	});

	test("should show version --version", async () => {
		const {stdout} = await sequelizr("--version");
		expect(stdout.trim()).toBe(version);
	});
});

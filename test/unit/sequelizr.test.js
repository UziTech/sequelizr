const util = require("util");
const exec = util.promisify(require("child_process").exec);

function sequelizr(argsString) {
	return exec(`node ../../bin/sequelizr.js ${argsString}`, {cwd: __dirname});
}

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

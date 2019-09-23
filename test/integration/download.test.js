const Sequelize = require("sequelize");
const {downloadModels} = require("../../");
const {
	database,
	username,
	password,
	host,
	port,
	dialect,
	dialectOptions,
} = require("../config.js");

describe("download", () => {
	test("should be able to connect", async () => {
		const auto = await downloadModels({
			database,
			username,
			password,
			host,
			port,
			dialect,
			directory: false,
			dialectOptions,
		});

		expect(auto).toBeTruthy();
	});
});

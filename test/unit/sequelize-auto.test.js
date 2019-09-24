
jest.genMockFromModule("sequelize");
const AutoSequelize = require("../../src/sequelize-auto.js");
const dialect = process.env.DIALECT;

describe("sequelize-auto", () => {
	test("should load sequelize-auto", () => {
		const auto = new AutoSequelize("database", "username", "password", {
			dialect,
			quiet: true,
		});

		expect(auto).toBeTruthy();
	});
});

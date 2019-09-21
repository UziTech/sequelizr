
jest.genMockFromModule("sequelize");
const AutoSequelize = require("../../src/sequelize-auto.js");

describe("sequelize-auto", () => {
	test("should build tables", () => {
		const auto = new AutoSequelize("database", "username", "password", {
			dialect: process.env.DIALECT,
		});

		expect(auto).toBeTruthy();
	});
});

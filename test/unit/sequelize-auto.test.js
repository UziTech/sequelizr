
jest.genMockFromModule("sequelize");
const AutoSequelize = require("../../src/squelize-auto.js");

describe("sequelize-auto", () => {
	test("should build tables", () => {
		const auto = new AutoSequelize("database", "username", "password", {
			dialect: "mysql",
		});

		expect(auto).toBeTruthy();
	});
});

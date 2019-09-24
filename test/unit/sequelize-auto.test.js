class SequelizeMock {
	constructor(database, username, password, options) {
		this.database = database;
		this.username = username;
		this.password = password;
		this.options = options;
	}

	get getQueryInterface() {
		return jest.fn(() => {
			return {};
		});
	}
}
jest.doMock("sequelize", () => SequelizeMock);

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

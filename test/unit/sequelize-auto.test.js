class SequelizeMock {
	constructor(database, username, password, options) {
		this.database = database;
		this.username = username;
		this.password = password;
		this.options = options;

		this.getQueryInterface = jest.fn(() => {
			return {
				describeTable: jest.fn(),
				showAllTables: jest.fn(),
			};
		});

		this.query = jest.fn();

		this.close = jest.fn();
	}
}
SequelizeMock.QueryTypes = {
	SELECT: "SELECT",
	SHOWTABLES: "SHOWTABLES",
};
jest.doMock("sequelize", () => SequelizeMock);

const AutoSequelize = require("../../src/sequelize-auto.js");

describe("sequelize-auto", () => {
	test("should load sequelize-auto", () => {
		const auto = new AutoSequelize("database", "username", "password", {
			dialect: "mysql",
			quiet: true,
		});

		expect(auto).toBeTruthy();
	});
});

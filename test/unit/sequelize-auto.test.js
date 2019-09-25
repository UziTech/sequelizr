class SequelizeMock {
	constructor(database, username, password, options) {
		this.database = database;
		this.username = username;
		this.password = password;
		this.options = options;
		this.queryInterface = {
			describeTable: jest.fn(),
			showAllTables: jest.fn(),
		};

		this.getQueryInterface = jest.fn(() => this.queryInterface);

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
	describe("constructor", () => {
		test("should load sequelize-auto", () => {
			const auto = new AutoSequelize();

			expect(auto).toBeTruthy();
		});

		test("should load mssql", () => {
			const auto = new AutoSequelize("database", "username", "password", {
				dialect: "mssql",
			});

			expect(auto).toBeTruthy();
		});

		test("should load mysql", () => {
			const auto = new AutoSequelize("database", "username", "password", {
				dialect: "mysql",
			});

			expect(auto).toBeTruthy();
		});

		test("should allow passing sequelize instance", () => {
			const sequelize = new SequelizeMock();
			const auto = new AutoSequelize(sequelize, {
				dialect: "mysql",
				quiet: true,
			});

			expect(auto).toBeTruthy();
		});

		test("should ignore skipTables with tables", () => {
			jest.spyOn(console, "error").mockImplementation(() => {});

			new AutoSequelize("database", "username", "password", {
				tables: [],
				skipTables: [],
			});

			expect(console.error).toHaveBeenCalledWith("The 'skipTables' option will be ignored because the 'tables' option is given");
		});

		test("should allow tables as string", () => {
			jest.spyOn(console, "error").mockImplementation(() => {});

			const auto = new AutoSequelize("database", "username", "password", {
				tables: "table",
			});

			expect(auto.options.tables).toEqual(["table"]);
		});

		test("should allow skipTables as string", () => {
			jest.spyOn(console, "error").mockImplementation(() => {});

			const auto = new AutoSequelize("database", "username", "password", {
				skipTables: "skiptable",
			});

			expect(auto.options.skipTables).toEqual(["skiptable"]);
		});

		test("should lowercase tables", () => {
			jest.spyOn(console, "error").mockImplementation(() => {});

			const auto = new AutoSequelize("database", "username", "password", {
				tables: "Table",
			});

			expect(auto.options.tables).toEqual(["table"]);
		});

		test("should lowercase skipTables", () => {
			jest.spyOn(console, "error").mockImplementation(() => {});

			const auto = new AutoSequelize("database", "username", "password", {
				skipTables: "SkipTable",
			});

			expect(auto.options.skipTables).toEqual(["skiptable"]);
		});
	});

	describe("run", () => {
		test("should build tables", async () => {
			const sequelize = new SequelizeMock();
			sequelize.query.mockReturnValueOnce(["table"]);
			const describeTable = {
				id: {
					primaryKey: true,
					autoIncrement: true,
					defaultValue: null,
					type: "INT",
				},
			};
			sequelize.queryInterface.describeTable.mockReturnValueOnce(describeTable);
			const auto = new AutoSequelize(sequelize, {
				dialect: "mysql",
				directory: "test",
				foreignKeys: false,
				indexes: false,
				quiet: true,
			});

			await auto.run();

			expect(auto.tables.table).toBe(describeTable);
		});
	});
});

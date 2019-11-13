const tmp = require("tmp-promise");
tmp.setGracefulCleanup();
const path = require("path");
const {readdir, readFile} = require("fs");
const {promisify} = require("util");
const readdirAsync = promisify(readdir);
const readFileAsync = promisify(readFile);

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
				directory: false,
				foreignKeys: false,
				indexes: false,
				quiet: true,
			});

			await auto.run();

			expect(auto.tables.table).toBe(describeTable);
		});

		describe("writing files", () => {
			let tempDir;

			beforeEach(async () => {
				tempDir = await tmp.dir({unsafeCleanup: true});
			});

			afterEach(async () => {
				await tempDir.cleanup();
			});

			test("should write tables to directory", async () => {
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
					directory: tempDir.path,
					foreignKeys: false,
					indexes: false,
					quiet: true,
				});

				await auto.run();

				const files = await readdirAsync(tempDir.path);

				expect(files).toEqual(["table.js"]);

				const contents = await readFileAsync(path.join(tempDir.path, files[0]), {encoding: "utf8"});

				expect(contents).toMatchSnapshot();
			});
		});
	});

	describe("generateText", () => {
		test("should generate correct text", () => {
			const sequelize = new SequelizeMock();
			const auto = new AutoSequelize(sequelize, {
				dialect: "mysql",
				schema: "schema",
			});

			auto.foreignKeys.my_table = {
				unique: {
					isUnique: true,
				},
			};

			auto.tables.my_table = {
				createdAt: {
					type: "timestamp",
				},
				updatedAt: {
					type: "timestamp",
				},
				id: {
					type: "int",
				},
				autoIncrement: {
					autoIncrement: true,
					type: "int",
				},
				primaryKey: {
					primaryKey: true,
					type: "int",
				},
				"2field": {
					defaultValue: 2,
					type: "int",
				},
				stringDefault: {
					defaultValue: "hi",
					type: "varchar",
				},
				unique: {
					type: "int",
				},
				special: {
					special: true,
					type: "int",
				},
				allowNull: {
					allowNull: true,
					type: "int",
				},
				allowNullFalse: {
					allowNull: false,
					type: "int",
				},
				current_timestamp: {
					defaultValue: "current_timestamp",
					type: "timestamp",
				},
				current_date: {
					defaultValue: "current_date",
					type: "timestamp",
				},
				current_time: {
					defaultValue: "current_time",
					type: "timestamp",
				},
				localtime: {
					defaultValue: "localtime",
					type: "timestamp",
				},
				localtimestamp: {
					defaultValue: "localtimestamp",
					type: "timestamp",
				},
				otherdate: {
					defaultValue: "1970-01-01",
					type: "timestamp",
				},
				getdate: {
					defaultValue: "(getdate())",
					type: "datetime",
				},
				comment: {
					comment: "comment",
					type: "varchar",
				},
				commentnull: {
					comment: null,
					type: "varchar",
				},
				userDefined: {
					type: "USER-DEFINED",
					special: ["special1", "special2"],
				},
				weirdAttr: {
					weirdAttr: {
						string: "string",
						num: 1,
						bool: true,
					},
					type: "weird",
				},
				// types
				enum: {
					type: "ENUM('item1','item2')",
				},
				set: {
					type: "SET('item1','item2')",
				},
				varchar: {
					type: "VARCHAR(1)",
				},
				varcharbinary: {
					type: "VARCHAR(1) BINARY",
				},
				varcharmax: {
					type: "VARCHAR(MAX)",
				},
				string: {
					type: "string",
				},
				varying: {
					type: "varying",
				},
				nvarchar: {
					type: "nvarchar",
				},
				xml: {
					type: "xml",
				},
				nchar: {
					type: "nchar",
				},
				char: {
					type: "char(8)",
				},
				tinytext: {
					type: "tinytext",
				},
				mediumtext: {
					type: "mediumtext",
				},
				text: {
					type: "text",
				},
				longtext: {
					type: "longtext",
				},
				ntext: {
					type: "ntext",
				},
				tinyint: {
					type: "tinyint(1)",
				},
				smallint: {
					type: "smallint(4)",
				},
				mediumint: {
					type: "mediumint(8)",
				},
				int: {
					type: "int(32)",
				},
				bigint: {
					type: "bigint",
				},
				unsigned: {
					type: "int unsigned",
				},
				zerofill: {
					type: "int(10) zerofill",
				},
				float: {
					type: "float(4)",
				},
				float4: {
					type: "float4",
				},
				float8: {
					type: "float8",
				},
				double: {
					type: "double(10)",
				},
				numeric: {
					type: "numeric",
				},
				decimal: {
					type: "decimal(10,2)",
				},
				money: {
					type: "money",
				},
				real: {
					type: "real",
				},
				boolean: {
					type: "boolean",
				},
				bit1: {
					defaultValue: "b'1'",
					type: "bit(1)",
				},
				bit0: {
					defaultValue: "b'0'",
					type: "bit(1)",
				},
				bit: {
					type: "bit",
				},
				tinyblob: {
					type: "tinyblob",
				},
				mediumblob: {
					type: "mediumblob",
				},
				blob: {
					type: "blob",
				},
				longblob: {
					type: "longblob",
				},
				varbinary: {
					type: "varbinary",
				},
				image: {
					type: "image",
				},
				date: {
					type: "date",
				},
				smalldate: {
					type: "smalldate",
				},
				datetime: {
					type: "datetime",
				},
				datetime2: {
					type: "datetime2",
				},
				timestamp: {
					type: "timestamp",
				},
				time: {
					type: "time",
				},
				uuid: {
					type: "uuid",
				},
				uniqueidentifier: {
					type: "uniqueidentifier",
				},
				jsonb: {
					type: "jsonb",
				},
				json: {
					type: "json",
				},
				array: {
					type: "array",
				},
				geometry: {
					type: "geometry",
				},
				other: {
					type: "other",
				},
			};
			const text = auto.generateText("my_table", (level) => "  ".repeat(level));

			expect(text).toMatchSnapshot();
		});

		test("should sort fields and attributes", () => {
			const sequelize = new SequelizeMock();
			const auto = new AutoSequelize(sequelize, {
				dialect: "mysql",
				schema: "schema",
				sort: true,
			});

			auto.tables.my_table = {
				id: {
					type: "int",
					autoIncrement: true,
				},
				atest: {
					type: "int",
				},
			};
			const text = auto.generateText("my_table", (level) => "  ".repeat(level));

			expect(text).toMatchSnapshot();
		});
	});
});

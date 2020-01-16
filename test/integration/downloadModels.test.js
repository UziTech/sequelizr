const Sequelize = require("sequelize");
const {downloadModels} = require("../../");
const {resetDatabase, dialectMap} = require("../helpers.js");
const {
	database,
	username,
	password,
	host,
	port,
	dialect,
	dialectOptions,
} = require("../config.js");
const dm = dialectMap(dialect);

describe("downloadModels", () => {
	let sequelize, queryInterface;

	beforeEach(async () => {
		sequelize = new Sequelize(database, username, password, {
			host,
			port,
			dialect,
			logging: false,
			dialectOptions,
		});
		queryInterface = sequelize.getQueryInterface();
		await resetDatabase(sequelize, dialect, database);
	});

	afterEach(async () => {
		await sequelize.close();
	});

	test("should get tables and views", async () => {
		await queryInterface.createTable("my_table", {
			id: {
	      type: Sequelize.DataTypes.INTEGER,
				primaryKey: true,
	    },
		});
		await sequelize.query("CREATE VIEW my_view AS ( SELECT * FROM my_table )");

		const auto = await downloadModels({
			database,
			username,
			password,
			host,
			port,
			dialect,
			directory: false,
			dialectOptions,
			quiet: true,
		});

		expect(Object.keys(auto.tables)).toEqual(expect.arrayContaining(["my_table", "my_view"]));
	});

	test("should get only tables", async () => {
		await queryInterface.createTable("my_table", {
			id: {
	      type: Sequelize.DataTypes.INTEGER,
				primaryKey: true,
	    },
		});
		await sequelize.query("CREATE VIEW my_view AS ( SELECT * FROM my_table )");

		const auto = await downloadModels({
			database,
			username,
			password,
			host,
			port,
			dialect,
			directory: false,
			dialectOptions,
			includeViews: false,
			quiet: true,
		});

		expect(Object.keys(auto.tables)).toEqual(["my_table"]);
	});

	test("should use field info", async () => {
		await sequelize.query(`
			CREATE TABLE my_table (
				id INT ${dm.AUTO_INCREMENT} PRIMARY KEY,
				name VARCHAR(255) NOT NULL,
				date DATETIME DEFAULT CURRENT_TIMESTAMP
			)
		`);

		const auto = await downloadModels({
			database,
			username,
			password,
			host,
			port,
			dialect,
			directory: false,
			dialectOptions,
			quiet: true,
		});

		expect(auto.tables.my_table).toEqual(expect.objectContaining({
			id: expect.objectContaining({
				primaryKey: true,
				autoIncrement: true,
				defaultValue: null,
				type: "INT",
			}),
			name: expect.objectContaining({
				allowNull: false,
				defaultValue: null,
				type: "VARCHAR(255)",
			}),
			date: expect.objectContaining({
				allowNull: true,
				defaultValue: dm.CURRENT_TIMESTAMP,
				type: "DATETIME",
			}),
		}));
	});

	test("should use correct types", async () => {
		await sequelize.query(`
			CREATE TABLE my_table (
				id INT,
				string VARCHAR(255),
				date DATETIME,
				num FLOAT,
				${dm["dub DOUBLE"]}
				deci DECIMAL(10,2),
				tex TEXT
			)
		`);

		const auto = await downloadModels({
			database,
			username,
			password,
			host,
			port,
			dialect,
			directory: false,
			dialectOptions,
			quiet: true,
		});

		const {my_table} = auto.tables;
		expect(my_table.id.type).toBe("INT");
		expect(my_table.string.type).toBe("VARCHAR(255)");
		expect(my_table.date.type).toBe("DATETIME");
		expect(my_table.num.type).toBe("FLOAT");
		if (dialect === "mysql") {
			expect(my_table.dub.type).toBe("DOUBLE");
		}
		expect(my_table.deci.type).toBe(dm["DECIMAL(10,2)"]);
		expect(my_table.tex.type).toBe("TEXT");
	});
});

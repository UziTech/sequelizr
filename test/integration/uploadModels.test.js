const path = require("path");
const Sequelize = require("sequelize");
const {uploadModels} = require("../../");
const {resetDatabase} = require("../helpers.js");
const {
	database,
	username,
	password,
	host,
	port,
	dialect,
	dialectOptions,
} = require("../config.js");

describe("uploadModels", () => {
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

	test("should upload new table", async () => {
		await uploadModels({
			database,
			username,
			password,
			host,
			port,
			dialect,
			directory: path.resolve(__dirname, `../fixtures/models/${dialect}/no-views`),
			dialectOptions,
			quiet: true,
		});

		const showTablesQuery = require(`../../src/dialects/${dialect}.js`).showTablesQuery({
			database,
			includeViews: true,
		});

		const tables = (await sequelize.query(showTablesQuery, {
			raw: true,
			type: Sequelize.QueryTypes.SHOWTABLES,
		})).map(table => table.tableName || table);

		const myTable = await queryInterface.describeTable("my_table");

		expect(tables).toEqual(["my_table"]);
		expect(myTable.id.type).toBe("INT");
	});

	test("should alter table", async () => {
		await queryInterface.createTable("my_table", {
			id: {
	      type: Sequelize.DataTypes.INTEGER,
				allowNull: false,
				primaryKey: true,
	    },
		});

		await uploadModels({
			database,
			username,
			password,
			host,
			port,
			dialect,
			directory: path.resolve(__dirname, `../fixtures/models/${dialect}/two-cols`),
			dialectOptions,
			alter: true,
			quiet: true,
		});

		const myTable = await queryInterface.describeTable("my_table");

		expect(myTable.name).toBeTruthy();
	});

	test("should overwrite table", async () => {
		await queryInterface.createTable("my_table", {
			id: {
	      type: Sequelize.DataTypes.INTEGER,
				primaryKey: true,
	    },
		});

		await uploadModels({
			database,
			username,
			password,
			host,
			port,
			dialect,
			directory: path.resolve(__dirname, `../fixtures/models/${dialect}/two-cols`),
			dialectOptions,
			overwrite: true,
			quiet: true,
		});

		const myTable = await queryInterface.describeTable("my_table");

		expect(myTable.name).toBeTruthy();
	});

	test("should fail when existing table", async () => {
		await queryInterface.createTable("my_table", {
			id: {
	      type: Sequelize.DataTypes.INTEGER,
				allowNull: false,
				primaryKey: true,
	    },
		});

		await expect(uploadModels({
			database,
			username,
			password,
			host,
			port,
			dialect,
			directory: path.resolve(__dirname, `../fixtures/models/${dialect}/two-cols`),
			dialectOptions,
			quiet: true,
		})).rejects.toThrow(/'my_table\.name' not in db/);

		const myTable = await queryInterface.describeTable("my_table");

		expect(myTable.name).not.toBeTruthy();
	});
});

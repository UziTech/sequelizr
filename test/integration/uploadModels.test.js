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
	let sequelize;

	beforeEach(async () => {
		sequelize = new Sequelize(database, username, password, {
			host,
			port,
			dialect,
			logging: false,
			dialectOptions,
		});
		await resetDatabase(sequelize, dialect, database);
	});

	afterEach(async () => {
		await sequelize.close();
	});

	test("should upload tables", async () => {
		await uploadModels({
			database,
			username,
			password,
			host,
			port,
			dialect,
			directory: path.resolve(__dirname, `../fixtures/models/${dialect}/no-views`),
			dialectOptions,
			overwrite: true,
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

		const myTable = await sequelize.getQueryInterface().describeTable("my_table");

		expect(tables).toEqual(["my_table"]);
		expect(myTable.id.type).toEqual(expect.stringContaining("INT"));
	});
});

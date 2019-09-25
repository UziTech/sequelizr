const path = require("path");
const Sequelize = require("sequelize");
const {checkModels} = require("../../");
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

describe("checkModels", () => {
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

	test("should check tables and views", async () => {
		await queryInterface.createTable("my_table", {
			id: {
	      type: Sequelize.DataTypes.INTEGER,
				primaryKey: true,
	    },
		});
		await sequelize.query("CREATE VIEW my_view AS ( SELECT * FROM my_table )");

		const promise = checkModels({
			database,
			username,
			password,
			host,
			port,
			dialect,
			directory: path.resolve(__dirname, `../fixtures/models/${dialect}/with-views`),
			dialectOptions,
			output: false,
			quiet: true,
		});

		await expect(promise).resolves.toBe();
	});

	test("should just check tables", async () => {
		await queryInterface.createTable("my_table", {
			id: {
	      type: Sequelize.DataTypes.INTEGER,
				primaryKey: true,
	    },
		});
		await sequelize.query("CREATE VIEW my_view AS ( SELECT * FROM my_table )");

		const promise = checkModels({
			database,
			username,
			password,
			host,
			port,
			dialect,
			directory: path.resolve(__dirname, `../fixtures/models/${dialect}/no-views`),
			dialectOptions,
			output: false,
			includeViews: false,
			quiet: true,
		});

		await expect(promise).resolves.toBe();
	});
});

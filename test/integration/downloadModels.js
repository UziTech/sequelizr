const Sequelize = require("sequelize");
const {downloadModels} = require("../../");
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

module.exports = () => {
	test("should be able to connect", async () => {
		const auto = await downloadModels({
			database,
			username,
			password,
			host,
			port,
			dialect,
			directory: false,
			dialectOptions,
		});

		expect(auto).toBeTruthy();
	});

	describe("real tables", () => {
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
			await queryInterface.createTable("my_table", {id: Sequelize.DataTypes.STRING});
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
			});

			expect(Object.keys(auto.tables)).toEqual(expect.arrayContaining(["my_table", "my_view"]));
		});

		test("should get only tables", async () => {
			await queryInterface.createTable("my_table", {id: Sequelize.DataTypes.STRING});
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
			});

			expect(Object.keys(auto.tables)).toEqual(["my_table"]);
		});
	});
};

import path from "path";
import {Sequelize, QueryInterface, DataTypes} from "sequelize";
import {checkModels} from "../../src/index";
import {resetDatabase} from "../helpers";
import {getConfig} from "../config";

const {
	database,
	username,
	password,
	host,
	port,
	dialect,
	dialectOptions,
} = getConfig();

describe("checkModels", () => {
	let sequelize: Sequelize, queryInterface: QueryInterface;

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
	      type: DataTypes.INTEGER,
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

		await expect(promise).resolves.toBeUndefined();
	});

	test("should just check tables", async () => {
		await queryInterface.createTable("my_table", {
			id: {
	      type: DataTypes.INTEGER,
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

		await expect(promise).resolves.toBeUndefined();
	});
});

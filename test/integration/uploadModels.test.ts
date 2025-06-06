import {resolve} from "node:path";
import {Sequelize, QueryInterface, QueryTypes, DataTypes} from "sequelize";
import {uploadModels} from "../../src/index";
import {resetDatabase} from "../helpers";
import {getConfig} from "../config";
import {UnknownObject} from "../../src/types";
import dialects from "../../src/dialects";

const {
	database,
	username,
	password,
	host,
	port,
	dialect,
	dialectOptions,
} = getConfig();

describe("uploadModels", () => {
	let sequelize: Sequelize;
	let queryInterface: QueryInterface;

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
			directory: resolve(__dirname, `../fixtures/models/${dialect}/no-views`),
			extension: "cjs",
			dialectOptions,
			quiet: true,
		});

		const {showTablesQuery} = dialects[dialect];

		const tables = (await sequelize.query(showTablesQuery!({
			database,
			includeViews: true,
		}), {
			raw: true,
			type: QueryTypes.SHOWTABLES,
		})).map((table: string | UnknownObject) => (typeof table === "object" && "tableName" in table ? table.tableName : table) as string);

		const myTable = await queryInterface.describeTable("my_table");

		expect(tables).toEqual(["my_table"]);
		expect(myTable.id.type).toBe("INT");
	});

	test("should alter table", async () => {
		await queryInterface.createTable("my_table", {
			id: {
	      type: DataTypes.INTEGER,
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
			directory: resolve(__dirname, `../fixtures/models/${dialect}/two-cols`),
			extension: "cjs",
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
	      type: DataTypes.INTEGER,
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
			directory: resolve(__dirname, `../fixtures/models/${dialect}/two-cols`),
			extension: "cjs",
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
	      type: DataTypes.INTEGER,
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
			directory: resolve(__dirname, `../fixtures/models/${dialect}/two-cols`),
			extension: "cjs",
			dialectOptions,
			quiet: true,
		})).rejects.toThrow(/'my_table\.name' not in db/);

		const myTable = await queryInterface.describeTable("my_table");

		expect(myTable.name).not.toBeTruthy();
	});
});

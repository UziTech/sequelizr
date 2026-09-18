import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test } from "node:test";
import { Sequelize, DataTypes } from "sequelize";
import { downloadModels } from "../../src/index.js";
import { resetDatabase, dialectMap } from "../helpers.js";
import { getConfig } from "../config.js";
const { database, username, password, host, port, dialect, dialectOptions, } = getConfig();
const dm = dialectMap(dialect);
describe("downloadModels", () => {
    let sequelize;
    let queryInterface;
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
                type: DataTypes.INTEGER,
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
            dialectOptions,
            quiet: true,
            directory: undefined,
        });
        assert.ok("my_table" in auto.tables);
        assert.ok("my_view" in auto.tables);
    });
    test("should get only tables", async () => {
        await queryInterface.createTable("my_table", {
            id: {
                type: DataTypes.INTEGER,
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
            dialectOptions,
            includeViews: false,
            quiet: true,
            directory: undefined,
        });
        assert.deepEqual(Object.keys(auto.tables), ["my_table"]);
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
            dialectOptions,
            quiet: true,
            directory: undefined,
        });
        assert.deepEqual(auto.tables.my_table, {
            ...auto.tables.my_table,
            id: {
                ...auto.tables.my_table.id,
                primaryKey: true,
                autoIncrement: true,
                defaultValue: null,
                type: "INT",
            },
            name: {
                ...auto.tables.my_table.name,
                allowNull: false,
                defaultValue: null,
                type: "VARCHAR(255)",
            },
            date: {
                ...auto.tables.my_table.date,
                allowNull: true,
                defaultValue: dm.CURRENT_TIMESTAMP,
                type: "DATETIME",
            },
        });
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
            dialectOptions,
            quiet: true,
            directory: undefined,
        });
        const { my_table } = auto.tables;
        assert.equal(my_table.id.type, "INT");
        assert.equal(my_table.string.type, "VARCHAR(255)");
        assert.equal(my_table.date.type, "DATETIME");
        assert.equal(my_table.num.type, "FLOAT");
        if (dialect === "mysql") {
            assert.equal(my_table.dub.type, "DOUBLE");
        }
        assert.equal(my_table.deci.type, dm["DECIMAL(10,2)"]);
        assert.equal(my_table.tex.type, "TEXT");
    });
});

import assert from "node:assert/strict";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, test } from "node:test";
import { Sequelize, QueryTypes, DataTypes } from "sequelize";
import { uploadModels } from "../../src/index.js";
import { resetDatabase } from "../helpers.js";
import { getConfig } from "../config.js";
import dialects from "../../src/dialects/index.js";
const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "../../..");
const { database, username, password, host, port, dialect, dialectOptions, } = getConfig();
describe("uploadModels", () => {
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
    test("should upload new table", async () => {
        await uploadModels({
            database,
            username,
            password,
            host,
            port,
            dialect,
            directory: resolve(projectRoot, `test/fixtures/models/${dialect}/no-views`),
            extension: "cjs",
            dialectOptions,
            quiet: true,
        });
        const { showTablesQuery } = dialects[dialect];
        const tables = (await sequelize.query(showTablesQuery({
            database,
            includeViews: true,
        }), {
            raw: true,
            type: QueryTypes.SHOWTABLES,
        })).map((table) => (typeof table === "object" && "tableName" in table ? table.tableName : table));
        const myTable = await queryInterface.describeTable("my_table");
        assert.deepEqual(tables, ["my_table"]);
        assert.equal(myTable.id.type, "INT");
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
            directory: resolve(projectRoot, `test/fixtures/models/${dialect}/two-cols`),
            extension: "cjs",
            dialectOptions,
            alter: true,
            quiet: true,
        });
        const myTable = await queryInterface.describeTable("my_table");
        assert.ok(myTable.name);
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
            directory: resolve(projectRoot, `test/fixtures/models/${dialect}/two-cols`),
            extension: "cjs",
            dialectOptions,
            overwrite: true,
            quiet: true,
        });
        const myTable = await queryInterface.describeTable("my_table");
        assert.ok(myTable.name);
    });
    test("should fail when existing table", async () => {
        await queryInterface.createTable("my_table", {
            id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                primaryKey: true,
            },
        });
        await assert.rejects(() => uploadModels({
            database,
            username,
            password,
            host,
            port,
            dialect,
            directory: resolve(projectRoot, `test/fixtures/models/${dialect}/two-cols`),
            extension: "cjs",
            dialectOptions,
            quiet: true,
        }), /'my_table\.name' not in db/);
        const myTable = await queryInterface.describeTable("my_table");
        assert.ok(!myTable.name);
    });
});

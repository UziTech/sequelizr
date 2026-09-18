import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, test } from "node:test";
import { Sequelize, DataTypes } from "sequelize";
import { checkModels } from "../../src/index.js";
import { resetDatabase } from "../helpers.js";
import { getConfig } from "../config.js";
const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "../../..");
const { database, username, password, host, port, dialect, dialectOptions, } = getConfig();
describe("checkModels", () => {
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
    test("should check tables and views", async () => {
        await queryInterface.createTable("my_table", {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
            },
        });
        await sequelize.query("CREATE VIEW my_view AS ( SELECT * FROM my_table )");
        await checkModels({
            database,
            username,
            password,
            host,
            port,
            dialect,
            directory: resolve(projectRoot, `test/fixtures/models/${dialect}/with-views`),
            dialectOptions,
            extension: "cjs",
            output: false,
            quiet: true,
        });
    });
    test("should just check tables", async () => {
        await queryInterface.createTable("my_table", {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
            },
        });
        await sequelize.query("CREATE VIEW my_view AS ( SELECT * FROM my_table )");
        await checkModels({
            database,
            username,
            password,
            host,
            port,
            dialect,
            directory: resolve(projectRoot, `test/fixtures/models/${dialect}/no-views`),
            dialectOptions,
            extension: "cjs",
            output: false,
            includeViews: false,
            quiet: true,
        });
    });
});

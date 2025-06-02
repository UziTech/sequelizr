import mysqlDialect from "./mysql.js";
import postgresDialect from "./postgres.js";
import mssqlDialect from "./mssql.js";
import sqliteDialect from "./sqlite.js";
import type { DialectOperations } from "../types.js";
import type { Dialect } from "sequelize";

export default {
	sqlite: sqliteDialect,
	mysql: mysqlDialect,
	mariadb: mysqlDialect, // mariadb uses the mysql dialect operations
	postgres: postgresDialect,
	mssql: mssqlDialect,
} as Record<Dialect, DialectOperations>;

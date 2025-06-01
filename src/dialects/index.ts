import mysqlDialect from "./mysql";
import postgresDialect from "./postgres";
import mssqlDialect from "./mssql";
import sqliteDialect from "./sqlite";
import type { DialectOperations, DialectName } from "../types";

export default {
	sqlite: sqliteDialect,
	mysql: mysqlDialect,
	mariadb: mysqlDialect, // mariadb uses the mysql dialect operations
	postgres: postgresDialect,
	mssql: mssqlDialect,
} as Record<DialectName, DialectOperations>;

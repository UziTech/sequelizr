import mysqlDialect from "./mysql";
import postgresDialect from "./postgres";
import mssqlDialect from "./mssql";
import sqliteDialect from "./sqlite";
import type { DialectOperations } from "./types";


type DialectName = "sqlite" | "mysql" | "mariadb" | "postgres" | "mssql";

export const dialects: Record<DialectName, DialectOperations> = {
	sqlite: sqliteDialect,
	mysql: mysqlDialect,
	mariadb: mysqlDialect, // mariadb uses the mysql dialect operations
	postgres: postgresDialect,
	mssql: mssqlDialect,
};

import sqlite from "./sqlite.ts";
import mysql from "./mysql.ts";
import postgres from "./postgres.ts";
import mssql from "./mssql.ts";

// Placeholder type for the dialect modules.
// This should be refined based on the actual structure of these modules
// once they are converted to TypeScript.
interface Dialect {
	// Define common properties/methods expected from a dialect module
	// For example:
	// getName: () => string;
	// getVersion: () => string;
	// specificFunction?: (options: any) => any;
	[key: string]: any; // Allow any other properties for now
}

const dialects: {
	sqlite: Dialect;
	mysql: Dialect;
	mariadb: Dialect;
	postgres: Dialect;
	mssql: Dialect;
} = {
	sqlite,
	mysql,
	mariadb: mysql, // mariadb uses the mysql dialect
	postgres,
	mssql,
};

export default dialects;

// Optionally, export individual dialects if needed
export { sqlite, mysql, postgres, mssql };

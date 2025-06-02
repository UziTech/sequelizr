import type { DialectOperations } from "../types.js";

export default {

	/**
	 * Generates an SQL query that returns all foreign keys of a table.
	 */
	getForeignKeysQuery(tableName) {
		return `PRAGMA foreign_key_list(${tableName});`;
	},

	/**
	 * Generates an SQL query that returns all indexes of a table.
	 */
	getIndexesQuery(tableName) {
		return `SELECT name, sql sqlite_master WHERE type = 'index' and tbl_name = '${tableName}';`;
	},

	/**
	 * Determines if record entry from the getForeignKeysQuery
	 * results is an actual primary key
	 */
	isPrimaryKey(record) {
		return typeof record === "object" && ("primaryKey" in record) && record.primaryKey === true;
	},
} as DialectOperations;

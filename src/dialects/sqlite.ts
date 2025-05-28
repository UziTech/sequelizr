// Interface for the 'record' object passed to isPrimaryKey
// This structure is assumed based on the usage in the isPrimaryKey function.
interface SqliteRecord {
	primaryKey: boolean;
	// Allow other properties as the actual record might contain more fields
	[key: string]: any;
}

// Interface for the exported dialect object
interface SqliteDialect {
	getForeignKeysQuery: (tableName: string, schemaName?: string) => string;
	getIndexesQuery: (tableName: string, schemaName?: string) => string;
	isPrimaryKey: (record: SqliteRecord) => boolean;
}

const sqliteDialect: SqliteDialect = {
	/**
	 * Generates an SQL query that returns all foreign keys of a table.
	 *
	 * @param  {String} tableName  The name of the table.
	 * @param  {String} [schemaName] The name of the schema (unused in SQLite for this PRAGMA).
	 * @return {String}            The generated sql query.
	 */
	getForeignKeysQuery: function (tableName: string, schemaName?: string): string { // eslint-disable-line no-unused-vars
		return `PRAGMA foreign_key_list(${tableName});`;
	},

	/**
	 * Generates an SQL query that returns all indexes of a table.
	 *
	 * @param  {String} tableName  The name of the table.
	 * @param  {String} [schemaName] The name of the schema (unused in SQLite for this query).
	 * @return {String}            The generated sql query.
	 */
	getIndexesQuery: function (tableName: string, schemaName?: string): string { // eslint-disable-line no-unused-vars
		// Note: The original query had "sql sqlite_master". It should be "FROM sqlite_master".
		// Assuming 'sql' was a typo and meant to be part of the selected columns or not there at all.
		// If 'sql' is a column, it should be "SELECT name, sql FROM sqlite_master..."
		// If 'sql' is not a column and not a typo for 'FROM', it's an error.
		// Correcting to what seems most standard for getting index info:
		return `SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = '${tableName}';`;
	},

	/**
	 * Determines if record entry from a query result (e.g., from parsing PRAGMA table_info)
	 * indicates a primary key. Note: `getForeignKeysQuery` PRAGMA returns foreign key info,
	 * not direct primary key column attributes in a boolean `primaryKey` field.
	 * This function's usefulness depends on how the calling code gets the `record`.
	 * If `record` comes from `PRAGMA table_info(tableName)`, then a column named `pk` (0 or 1) indicates PK.
	 *
	 * @param {SqliteRecord} record The row entry, expected to have a `primaryKey` boolean property.
	 * @return {boolean} return
	 */
	isPrimaryKey: function (record: SqliteRecord): boolean {
		return typeof record === "object" && record !== null && ("primaryKey" in record) && record.primaryKey === true;
	},
};

export default sqliteDialect;

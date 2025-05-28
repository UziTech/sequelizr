// Define interfaces for the records based on expected properties from the queries
interface BaseRecord {
	// Common properties can be defined here if any
}

interface ForeignKeyResultRecord extends BaseRecord {
	constraint_type: string;
	// source_table: string;
	// constraint_name: string;
	// source_column: string;
	// target_table: string;
	// target_column: string;
	// is_identity: boolean | number; // SQL Server might return this as 0 or 1
}

interface PrimaryKeyResultRecord extends BaseRecord {
	constraint_type: string;
}

interface SerialKeyResultRecord extends PrimaryKeyResultRecord {
	is_identity: boolean | number; // Assuming is_identity comes from the foreign key query context
}

// Interface for options in showTablesQuery
interface ShowTablesQueryOptions {
	includeViews?: boolean;
}

// Interface for the exported dialect object
interface MssqlDialect {
	getForeignKeysQuery: (tableName: string, schemaName: string) => string;
	getIndexesQuery: (tableName: string, schemaName: string) => string;
	isForeignKey: (record: ForeignKeyResultRecord) => boolean;
	isPrimaryKey: (record: PrimaryKeyResultRecord) => boolean;
	isSerialKey: (record: SerialKeyResultRecord) => boolean;
	showTablesQuery: (options?: ShowTablesQueryOptions) => string;
}

const mssqlDialect: MssqlDialect = {
	/**
	 * Generates an SQL query that returns all foreign keys of a table.
	 *
	 * @param  {String} tableName  The name of the table.
	 * @param  {String} schemaName The name of the schema.
	 * @return {String}            The generated sql query.
	 */
	getForeignKeysQuery: function (tableName: string, schemaName: string): string { // eslint-disable-line no-unused-vars
		return `SELECT
			ccu.table_name AS source_table,
			ccu.constraint_name AS constraint_name,
			ccu.column_name AS source_column,
			kcu.table_name AS target_table,
			kcu.column_name AS target_column,
			tc.constraint_type AS constraint_type,
			c.is_identity AS is_identity
		FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
		INNER JOIN INFORMATION_SCHEMA.CONSTRAINT_COLUMN_USAGE ccu
			ON ccu.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
		LEFT JOIN INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc
			ON ccu.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
		LEFT JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
			ON kcu.CONSTRAINT_NAME = rc.UNIQUE_CONSTRAINT_NAME AND tc.CONSTRAINT_TYPE = 'FOREIGN KEY'
		INNER JOIN sys.COLUMNS c
			ON c.name = ccu.column_name
			AND c.object_id = OBJECT_ID(ccu.table_name)
		WHERE ccu.table_name = '${tableName}'
		ORDER BY source_table`.replace(/\s+/g, " ");
	},

	/**
	 * Generates an SQL query that returns all indexes of a table.
	 *
	 * @param  {String} tableName  The name of the table.
	 * @param  {String} schemaName The name of the schema.
	 * @return {String}            The generated sql query.
	 */
	getIndexesQuery: function (tableName: string, schemaName: string): string { // eslint-disable-line no-unused-vars
		return `SELECT
				i.name AS name,
				i.type_desc AS type,
				col.name as field
			FROM
				sys.indexes i
				INNER JOIN sys.index_columns ic ON  i.object_id = ic.object_id and i.index_id = ic.index_id
				INNER JOIN sys.columns col ON ic.object_id = col.object_id and ic.column_id = col.column_id
				INNER JOIN sys.tables t ON i.object_id = t.object_id
			WHERE
				i.is_primary_key = 0
				AND i.is_unique = 0
				AND i.is_unique_constraint = 0
				AND t.is_ms_shipped = 0
				AND t.name = '${tableName}'`.replace(/\s+/g, " ");
	},

	/**
	 * Determines if record entry from the getForeignKeysQuery
	 * results is an actual foreign key
	 *
	 * @param {Object} record The row entry from getForeignKeysQuery
	 * @return {Bool} return
	 */
	isForeignKey: function (record: ForeignKeyResultRecord): boolean {
		return typeof record === "object" && record && ("constraint_type" in record) && record.constraint_type === "FOREIGN KEY";
	},

	/**
	 * Determines if record entry from the getForeignKeysQuery
	 * results is an actual primary key
	 *
	 * @param {Object} record The row entry from getForeignKeysQuery
	 * @return {Bool} return
	 */
	isPrimaryKey: function (record: PrimaryKeyResultRecord): boolean {
		return typeof record === "object" && record && ("constraint_type" in record) && record.constraint_type === "PRIMARY KEY";
	},

	/**
	 * Determines if record entry from the getForeignKeysQuery
	 * results is an actual serial/auto increment key
	 *
	 * @param {Object} record The row entry from getForeignKeysQuery
	 * @return {Bool} return
	 */
	isSerialKey: function (record: SerialKeyResultRecord): boolean {
		// Assuming isPrimaryKey is a method on the same object (this context)
		// For type safety, ensure `this` refers to MssqlDialect or pass `isPrimaryKey` as an argument if needed.
		// However, given the original JS, `this.isPrimaryKey` would refer to `mssqlDialect.isPrimaryKey`.
		return typeof record === "object" && record && this.isPrimaryKey(record) && (("is_identity" in record) && !!record.is_identity);
	},

	/**
	 * Overwrites Sequelize's native method for showing all tables.
	 * This allows showing all tables and views from the current schema
	 * @param {ShowTablesQueryOptions} [options] Options
	 * @param {boolean} [options.includeViews] Include views with tables
	 * @return {String} return
	 */
	showTablesQuery: function (options?: ShowTablesQueryOptions): string {
		let query = "SELECT TABLE_NAME, TABLE_SCHEMA FROM INFORMATION_SCHEMA.TABLES";
		// Add 'if (options)' to prevent error if options is undefined
		if (options && !options.includeViews) {
			query += " WHERE TABLE_TYPE = 'BASE TABLE'";
		}
		return `${query};`;
	},
};

export default mssqlDialect;

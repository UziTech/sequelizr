// Interface for the 'record' object passed to helper functions
// This is likely a row from an INFORMATION_SCHEMA query
interface InformationSchemaRecord {
	constraint_name?: string; // Used in isPrimaryKey
	extra?: string;           // Used in isForeignKey and isSerialKey
	column_key?: string;      // Used in isUnique
	// Add other common fields from K.KEY_COLUMN_USAGE or C.COLUMNS if necessary
}

// Interface for options in showTablesQuery
interface ShowTablesQueryOptions {
	database?: string;
	includeViews?: boolean;
}

// Interface for the exported dialect object
interface MysqlDialect {
	getForeignKeysQuery: (tableName: string, schemaName: string) => string;
	getIndexesQuery: (tableName: string, schemaName: string) => string;
	isForeignKey: (record: InformationSchemaRecord) => boolean;
	isUnique: (record: InformationSchemaRecord) => boolean;
	isPrimaryKey: (record: InformationSchemaRecord) => boolean;
	isSerialKey: (record: InformationSchemaRecord) => boolean;
	showTablesQuery: (options?: ShowTablesQueryOptions) => string;
}

const mysqlDialect: MysqlDialect = {
	/**
	 * Generates an SQL query that returns all foreign keys of a table.
	 *
	 * @param  {String} tableName  The name of the table.
	 * @param  {String} schemaName The name of the schema.
	 * @return {String}            The generated sql query.
	 */
	getForeignKeysQuery: function (tableName: string, schemaName: string): string {
		return `SELECT
				K.CONSTRAINT_NAME as constraint_name
			, K.CONSTRAINT_SCHEMA as source_schema
			, K.TABLE_SCHEMA as source_table
			, K.COLUMN_NAME as source_column
			, K.REFERENCED_TABLE_SCHEMA AS target_schema
			, K.REFERENCED_TABLE_NAME AS target_table
			, K.REFERENCED_COLUMN_NAME AS target_column
			, C.EXTRA as extra
			, C.COLUMN_KEY AS column_key
			FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE AS K
			LEFT JOIN INFORMATION_SCHEMA.COLUMNS AS C
				ON C.TABLE_NAME = K.TABLE_NAME
				AND C.COLUMN_NAME = K.COLUMN_NAME
				AND C.TABLE_SCHEMA = K.CONSTRAINT_SCHEMA
			WHERE
				K.TABLE_NAME = '${tableName}'
				AND K.CONSTRAINT_SCHEMA = '${schemaName}'`.replace(/\s+/g, " ");
	},

	/**
	 * Generates an SQL query that returns all indexes without keys of a table.
	 *
	 * @param  {String} tableName  The name of the table.
	 * @param  {String} schemaName The name of the schema.
	 * @return {String}            The generated sql query.
	 */
	getIndexesQuery: function (tableName: string, schemaName: string): string {
		return `SELECT
				s.index_name AS name,
				s.column_name AS field,
				s.index_type AS type
			FROM INFORMATION_SCHEMA.STATISTICS AS s
				LEFT JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE AS u
					ON s.TABLE_SCHEMA = u.TABLE_SCHEMA
					AND s.TABLE_NAME = u.TABLE_NAME
					AND s.COLUMN_NAME = u.COLUMN_NAME
			WHERE
				s.TABLE_SCHEMA = '${schemaName}'
				AND s.TABLE_NAME = '${tableName}'
				AND s.NON_UNIQUE = 1
				AND u.REFERENCED_TABLE_SCHEMA IS NULL`.replace(/\s+/g, " ");
	},

	/**
	 * Determines if record entry from the getForeignKeysQuery
	 * results is an actual foreign key
	 *
	 * @param {InformationSchemaRecord} record The row entry from getForeignKeysQuery
	 * @return {boolean} return
	 */
	isForeignKey: function (record: InformationSchemaRecord): boolean {
		return typeof record === "object" && record && record.extra !== "auto_increment";
	},

	/**
	 * Determines if record entry from the getForeignKeysQuery
	 * results is a unique key
	 *
	 * @param {InformationSchemaRecord} record The row entry from getForeignKeysQuery
	 * @return {boolean} return
	 */
	isUnique: function (record: InformationSchemaRecord): boolean {
		return typeof record === "object" && record && !!record.column_key && record.column_key.toUpperCase() === "UNI";
	},

	/**
	 * Determines if record entry from the getForeignKeysQuery
	 * results is an actual primary key
	 *
	 * @param {InformationSchemaRecord} record The row entry from getForeignKeysQuery
	 * @return {boolean} return
	 */
	isPrimaryKey: function (record: InformationSchemaRecord): boolean {
		return typeof record === "object" && record && record.constraint_name === "PRIMARY";
	},

	/**
	 * Determines if record entry from the getForeignKeysQuery
	 * results is an actual serial/auto increment key
	 *
	 * @param {InformationSchemaRecord} record The row entry from getForeignKeysQuery
	 * @return {boolean} return
	 */
	isSerialKey: function (record: InformationSchemaRecord): boolean {
		return typeof record === "object" && record && record.extra === "auto_increment";
	},

	/**
	 * Overwrites Sequelize's native method for showing all tables.
	 * This allows showing all tables and views from the current schema
	 * @param {ShowTablesQueryOptions} [options] Options
	 * @return {String} return
	 */
	showTablesQuery: function (options?: ShowTablesQueryOptions): string {
		let query = "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES";
		const wheres: string[] = [];
		if (options) {
			if (!options.includeViews) {
				wheres.push("TABLE_TYPE = 'BASE TABLE'");
			}
			if (options.database) {
				wheres.push(`TABLE_SCHEMA = '${options.database}'`);
			} else {
				wheres.push("TABLE_SCHEMA NOT IN ('MYSQL', 'INFORMATION_SCHEMA', 'PERFORMANCE_SCHEMA')");
			}
		} else {
			// Default behavior if no options object is provided
			wheres.push("TABLE_TYPE = 'BASE TABLE'");
			wheres.push("TABLE_SCHEMA NOT IN ('MYSQL', 'INFORMATION_SCHEMA', 'PERFORMANCE_SCHEMA')");
		}


		if (wheres.length > 0) {
			query += ` WHERE ${wheres.join(" AND ")}`;
		}
		return `${query};`;
	},
};

export default mysqlDialect;

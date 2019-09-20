module.exports = {

	/**
	 * Generates an SQL query that returns all foreign keys of a table.
	 *
	 * @param  {String} tableName  The name of the table.
	 * @param  {String} schemaName The name of the schema.
	 * @return {String}            The generated sql query.
	 */
	getForeignKeysQuery: function (tableName, schemaName) {
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
	getIndexesQuery: function (tableName, schemaName) {
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
	 * @param {Object} record The row entry from getForeignKeysQuery
	 * @return {Bool} return
	 */
	isForeignKey: function (record) {
		return typeof record === "object" && ("extra" in record) && record.extra !== "auto_increment";
	},

	/**
	 * Determines if record entry from the getForeignKeysQuery
	 * results is a unique key
	 *
	 * @param {Object} record The row entry from getForeignKeysQuery
	 * @return {Bool} return
	 */
	isUnique: function (record) {
		return typeof record === "object" && ("column_key" in record) && record.column_key.toUpperCase() === "UNI";
	},

	/**
	 * Determines if record entry from the getForeignKeysQuery
	 * results is an actual primary key
	 *
	 * @param {Object} record The row entry from getForeignKeysQuery
	 * @return {Bool} return
	 */
	isPrimaryKey: function (record) {
		return typeof record === "object" && ("constraint_name" in record) && record.constraint_name === "PRIMARY";
	},

	/**
	 * Determines if record entry from the getForeignKeysQuery
	 * results is an actual serial/auto increment key
	 *
	 * @param {Object} record The row entry from getForeignKeysQuery
	 * @return {Bool} return
	 */
	isSerialKey: function (record) {
		return typeof record === "object" && ("extra" in record) && record.extra === "auto_increment";
	},

	/**
	 * Overwrites Sequelize's native method for showing all tables.
	 * This allows showing all tables and views from the current schema
	 * @param {String} options Options
	 * @param {String} [options.database] The database to list all tables from
	 * @param {String} [options.includeViews] Include views with tables
	 * @return {String} return
	 */
	showTablesQuery: function (options) {
		let query = "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES";
		const wheres = [];
		if (!options.includeViews) {
			wheres.push("TABLE_TYPE = 'BASE TABLE'");
		}
		if (options.database) {
			wheres.push(`TABLE_SCHEMA = '${options.database}'`);
		} else {
			wheres.push("TABLE_SCHEMA NOT IN ('MYSQL', 'INFORMATION_SCHEMA', 'PERFORMANCE_SCHEMA')");
		}

		if (wheres.length > 0) {
			query += ` WHERE ${wheres.join(" AND ")}`;
		}
		return `${query};`;
	},
};

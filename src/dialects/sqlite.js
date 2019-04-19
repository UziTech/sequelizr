module.exports = {

	/**
	 * Generates an SQL query that returns all foreign keys of a table.
	 *
	 * @param  {String} tableName  The name of the table.
	 * @param  {String} schemaName The name of the schema.
	 * @return {String}            The generated sql query.
	 */
	getForeignKeysQuery: function (tableName, schemaName) { // eslint-disable-line no-unused-vars
		return `PRAGMA foreign_key_list(${tableName});`;
	},

	/**
	 * Generates an SQL query that returns all indexes of a table.
	 *
	 * @param  {String} tableName  The name of the table.
	 * @param  {String} schemaName The name of the schema.
	 * @return {String}            The generated sql query.
	 */
	getIndexesQuery: function (tableName, schemaName) { // eslint-disable-line no-unused-vars
		return `SELECT name, sql sqlite_master WHERE type = 'index' and tbl_name = '${tableName}';`;
	},

	/**
	 * Determines if record entry from the getForeignKeysQuery
	 * results is an actual primary key
	 *
	 * @param {Object} record The row entry from getForeignKeysQuery
	 * @return {Bool} return
	 */
	isPrimaryKey: function (record) {
		return typeof record === "object" && ("primaryKey" in record) && record.primaryKey === true;
	},
};

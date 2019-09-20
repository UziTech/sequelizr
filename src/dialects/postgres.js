module.exports = {

	/**
	 * Generates an SQL query that returns all foreign keys of a table.
	 *
	 * @param  {String} tableName  The name of the table.
	 * @param  {String} schemaName The name of the schema.
	 * @return {String}            The generated sql query.
	 */
	getForeignKeysQuery: function (tableName, schemaName) { // eslint-disable-line no-unused-vars
		return `SELECT
			o.conname AS constraint_name,
			(SELECT nspname FROM pg_namespace WHERE oid=m.relnamespace) AS source_schema,
			m.relname AS source_table,
			(SELECT a.attname FROM pg_attribute a WHERE a.attrelid = m.oid AND a.attnum = o.conkey[1] AND a.attisdropped = false) AS source_column,
			(SELECT nspname FROM pg_namespace WHERE oid=f.relnamespace) AS target_schema,
			f.relname AS target_table,
			(SELECT a.attname FROM pg_attribute a WHERE a.attrelid = f.oid AND a.attnum = o.confkey[1] AND a.attisdropped = false) AS target_column,
			o.contype,
			(SELECT d.adsrc FROM pg_catalog.pg_attribute a LEFT JOIN pg_catalog.pg_attrdef d ON (a.attrelid, a.attnum) = (d.adrelid,  d.adnum)
				WHERE NOT a.attisdropped AND a.attnum > 0 AND a.attrelid = o.conrelid AND a.attnum = o.conkey[1]
				LIMIT 1) AS extra
		FROM pg_constraint o
		LEFT JOIN pg_class c ON c.oid = o.conrelid
		LEFT JOIN pg_class f ON f.oid = o.confrelid
		LEFT JOIN pg_class m ON m.oid = o.conrelid
		WHERE o.conrelid = (SELECT oid FROM pg_class WHERE relname = '${tableName}' LIMIT 1)`.replace(/\s+/g, " ");
	},

	/**
	 * Generates an SQL query that returns all indexes of a table.
	 *
	 * @param  {String} tableName  The name of the table.
	 * @param  {String} schemaName The name of the schema.
	 * @return {String}            The generated sql query.
	 */
	getIndexesQuery: function (tableName, schemaName) { // eslint-disable-line no-unused-vars
		return `select
				i.relname as name,
				a.attname as field
			from
				pg_class t,
				pg_class i,
				pg_index ix,
				pg_attribute a
			where
				t.oid = ix.indrelid
				and i.oid = ix.indexrelid
				and a.attrelid = t.oid
				and a.attnum = ANY(ix.indkey)
				and t.relkind = 'r'
				and t.relname like = '${tableName}'`.replace(/\s+/g, " ");
	},

	/**
	 * Determines if record entry from the getForeignKeysQuery
	 * results is an actual foreign key
	 *
	 * @param {Object} record The row entry from getForeignKeysQuery
	 * @return {Bool} return
	 */
	isForeignKey: function (record) {
		return typeof record === "object" && ("contype" in record) && record.contype === "f";
	},

	/**
	 * Determines if record entry from the getForeignKeysQuery
	 * results is a unique key
	 *
	 * @param {Object} record The row entry from getForeignKeysQuery
	 * @return {Bool} return
	 */
	isUnique: function (record) {
		return typeof record === "object" && ("contype" in record) && record.contype === "u";
	},

	/**
	 * Determines if record entry from the getForeignKeysQuery
	 * results is an actual primary key
	 *
	 * @param {Object} record The row entry from getForeignKeysQuery
	 * @return {Bool} return
	 */
	isPrimaryKey: function (record) {
		return typeof record === "object" && ("contype" in record) && record.contype === "p";
	},

	/**
	 * Determines if record entry from the getForeignKeysQuery
	 * results is an actual serial/auto increment key
	 *
	 * @param {Object} record The row entry from getForeignKeysQuery
	 * @return {Bool} return
	 */
	isSerialKey: function (record) {
		return typeof record === "object" && this.isPrimaryKey(record) && (("extra" in record) &&
					 record.extra.startsWith("nextval")
				&& record.extra.includes("_seq")
				&& record.extra.includes("::regclass"));
	},

	/**
	 * Overwrites Sequelize's native method for showing all tables.
	 * This allows custom schema support
	 * @param {String} options Options
	 * @param {String} [options.schema] The schema to list all tables from
	 * @return {String} return
	 */
	showTablesQuery: function (options) {
		return `SELECT table_name FROM information_schema.tables WHERE table_schema = '${options.schema}' AND table_type LIKE '%TABLE' AND table_name != 'spatial_ref_sys';`;
	},
};

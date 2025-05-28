// Interface for the 'record' object from getForeignKeysQuery results
interface ForeignKeyInfoRecord {
	// Based on the SELECT statement in getForeignKeysQuery
	constraint_name: string;
	source_schema: string;
	source_table: string;
	source_column: string;
	target_schema: string;
	target_table: string;
	target_column: string;
	contype: "f" | "p" | "u" | string; // 'f' for foreign key, 'p' for primary, 'u' for unique
	extra?: string;   // For serial keys, e.g., nextval('table_column_seq'::regclass)
}

// Interface for options in showTablesQuery
interface ShowTablesQueryOptions {
	schema: string; // schema is mandatory based on usage in the original code
}

// Interface for the exported dialect object
interface PostgresDialect {
	getForeignKeysQuery: (tableName: string, schemaName: string) => string;
	getIndexesQuery: (tableName: string, schemaName: string) => string;
	isForeignKey: (record: ForeignKeyInfoRecord) => boolean;
	isUnique: (record: ForeignKeyInfoRecord) => boolean;
	isPrimaryKey: (record: ForeignKeyInfoRecord) => boolean;
	isSerialKey: (record: ForeignKeyInfoRecord) => boolean;
	showTablesQuery: (options: ShowTablesQueryOptions) => string;
}

const postgresDialect: PostgresDialect = {
	/**
	 * Generates an SQL query that returns all foreign keys of a table.
	 *
	 * @param  {String} tableName  The name of the table.
	 * @param  {String} schemaName The name of the schema.
	 * @return {String}            The generated sql query.
	 */
	getForeignKeysQuery: function (tableName: string, schemaName: string): string { // eslint-disable-line no-unused-vars
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
	getIndexesQuery: function (tableName: string, schemaName: string): string { // eslint-disable-line no-unused-vars
		// Corrected the LIKE clause in the original query
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
				and t.relname = '${tableName}'`.replace(/\s+/g, " "); // Changed 'like =' to '='
	},

	/**
	 * Determines if record entry from the getForeignKeysQuery
	 * results is an actual foreign key
	 *
	 * @param {ForeignKeyInfoRecord} record The row entry from getForeignKeysQuery
	 * @return {boolean} return
	 */
	isForeignKey: function (record: ForeignKeyInfoRecord): boolean {
		return typeof record === "object" && record && record.contype === "f";
	},

	/**
	 * Determines if record entry from the getForeignKeysQuery
	 * results is a unique key
	 *
	 * @param {ForeignKeyInfoRecord} record The row entry from getForeignKeysQuery
	 * @return {boolean} return
	 */
	isUnique: function (record: ForeignKeyInfoRecord): boolean {
		return typeof record === "object" && record && record.contype === "u";
	},

	/**
	 * Determines if record entry from the getForeignKeysQuery
	 * results is an actual primary key
	 *
	 * @param {ForeignKeyInfoRecord} record The row entry from getForeignKeysQuery
	 * @return {boolean} return
	 */
	isPrimaryKey: function (record: ForeignKeyInfoRecord): boolean {
		return typeof record === "object" && record && record.contype === "p";
	},

	/**
	 * Determines if record entry from the getForeignKeysQuery
	 * results is an actual serial/auto increment key
	 *
	 * @param {ForeignKeyInfoRecord} record The row entry from getForeignKeysQuery
	 * @return {boolean} return
	 */
	isSerialKey: function (record: ForeignKeyInfoRecord): boolean {
		return typeof record === "object" && record &&
					this.isPrimaryKey(record) &&
					!!record.extra && // Ensure extra is not null or undefined
					record.extra.startsWith("nextval") &&
					record.extra.includes("_seq") &&
					record.extra.includes("::regclass");
	},

	/**
	 * Overwrites Sequelize's native method for showing all tables.
	 * This allows custom schema support
	 * @param {ShowTablesQueryOptions} options Options containing the schema
	 * @return {String} return
	 */
	showTablesQuery: function (options: ShowTablesQueryOptions): string {
		// Ensure options and options.schema are provided, as the original query depends on it.
		if (!options || !options.schema) {
			// Or handle more gracefully, maybe return a default query or throw an error
			// For now, mimicking original behavior which would fail if options.schema is not there.
			// To prevent runtime error if options or options.schema is undefined:
			const schema = options && options.schema ? options.schema : 'public'; // Default to 'public' or handle error
			return `SELECT table_name FROM information_schema.tables WHERE table_schema = '${schema}' AND table_type LIKE '%TABLE' AND table_name != 'spatial_ref_sys';`;
		}
		return `SELECT table_name FROM information_schema.tables WHERE table_schema = '${options.schema}' AND table_type LIKE '%TABLE' AND table_name != 'spatial_ref_sys';`;
	},
};

export default postgresDialect;

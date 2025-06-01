

/**
 * Options for the showTablesQuery function in dialect modules.
 */
export interface ShowTablesOptions {
	database?: string;
	schema?: string;
	includeViews?: boolean;
}

/**
 * Defines the common structure for dialect-specific operations.
 */
export interface DialectOperations {
	getForeignKeysQuery?: (tableName: string, schemaName: string) => string;
	getIndexesQuery?: (tableName: string, schemaName: string) => string;
	isPrimaryKey?: (record: object) => boolean;
	isForeignKey?: (record: object) => boolean;
	isUnique?: (record: object) => boolean;
	isSerialKey?: (record: object) => boolean;
	showTablesQuery?: (options: ShowTablesOptions) => string;
}

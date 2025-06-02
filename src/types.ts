import type {EventEmitter} from "events";
import type {Options as SequelizeOptions} from "sequelize";

export interface AdditionalOptions {
  timestamps?: boolean;
  createdAt?: string | boolean;
  updatedAt?: string | boolean;
  deletedAt?: string | boolean;
}

export interface SequelizeAutoOptions extends SequelizeOptions {
  directory?: string;
  extension?: string;
  spaces?: boolean;
  additional?: AdditionalOptions;
  indentation?: number;
  tables?: RegExp | string | string[] | null;
  skipTables?: RegExp | string | string[] | null;
  foreignKeys?: boolean;
  indexes?: boolean;
  includeViews?: boolean;
  overwrite?: boolean;
  quiet?: boolean;
  sort?: boolean;
  output?: boolean | EventEmitter;
}

export type DownloadModelsOptions = SequelizeAutoOptions

export type CheckModelsOptions = SequelizeAutoOptions

export interface UploadModelsOptions extends SequelizeAutoOptions {
  alter?: boolean;
}

/**
 * Options for the showTablesQuery function in dialect modules.
 */
export interface ShowTablesOptions {
	database?: string;
	schema?: string;
	includeViews?: boolean;
}

export interface Row {
  sql: string;
  name: string;
  type: string;
  field: string;
}

export interface Index {
  name: string;
  type?: string;
  fields: string[];
}

export type UnknownObject = {[key: string]: unknown};


/**
 * Defines the common structure for dialect-specific operations.
 */
export interface DialectOperations {
	getForeignKeysQuery: (tableName: string, schemaName: string) => string;
	getIndexesQuery: (tableName: string, schemaName: string) => string;
	isPrimaryKey?: (record: UnknownObject) => boolean;
	isForeignKey?: (record: UnknownObject) => boolean;
	isUnique?: (record: UnknownObject) => boolean;
	isSerialKey?: (record: UnknownObject) => boolean;
	showTablesQuery?: (options: ShowTablesOptions) => string;
}

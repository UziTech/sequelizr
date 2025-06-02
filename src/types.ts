import type { EventEmitter } from "events";
import type { Options as SequelizeOptions } from "sequelize";


export type DialectName = "sqlite" | "mysql" | "mariadb" | "postgres" | "mssql";

export interface AdditionalOptions {
  timestamps?: any,
  createdAt?: any,
  updatedAt?: any,
  deletedAt?: any,
}

export interface SequelizeAutoOptions extends SequelizeOptions {
  directory?: string;
  spaces?: boolean;
  additional?: AdditionalOptions;
  indentation?: number;
  tables?: RegExp | string[] | null;
  skipTables?: RegExp | string[] | null;
  foreignKeys?: boolean;
  indexes?: boolean;
  includeViews?: boolean;
  overwrite?: boolean;
  quiet?: boolean;
  sort?: boolean;
  output?: boolean | EventEmitter;
}

export interface DownloadModelsOptions extends SequelizeAutoOptions {
}

export interface CheckModelsOptions extends SequelizeAutoOptions {
}

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

export interface Index {
  name: string;
  type?: string;
  fields: string[];
}

/**
 * Defines the common structure for dialect-specific operations.
 */
export interface DialectOperations {
	getForeignKeysQuery: (tableName: string, schemaName: string) => string;
	getIndexesQuery: (tableName: string, schemaName: string) => string;
	isPrimaryKey?: (record: any) => boolean;
	isForeignKey?: (record: any) => boolean;
	isUnique?: (record: any) => boolean;
	isSerialKey?: (record: any) => boolean;
	showTablesQuery?: (options: ShowTablesOptions) => string;
}

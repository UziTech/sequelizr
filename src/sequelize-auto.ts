import fs from "fs";
import path from "path";
import util from "util";
import readline from "readline";
import { Sequelize, Dialect as SequelizeDialect, QueryTypes, Options as SequelizeOptions, QueryInterface, TableDescription, IndexField, IndexDescription } from "sequelize";
// Assuming dialects/index.ts exports the dialect specific objects correctly typed
import dialects from "./dialects"; // This should be an object of dialect-specific implementations
import SqlString from "./sql-string"; // Assuming this is a utility; may need its own types
import DeferredPool from "./defferred-pool"; // Note: filename might be deferred-pool.ts

const mkdirAsync = util.promisify(fs.mkdir);
const statAsync = util.promisify(fs.stat);
const writeFileAsync = util.promisify(fs.writeFile);
const readFileAsync = util.promisify(fs.readFile);

// Define an interface for the options SequelizeAuto accepts
// This should be comprehensive based on its usage.
export interface SequelizeAutoOptions extends SequelizeOptions {
	database?: string; // Also part of SequelizeOptions, but explicitly listed
	spaces?: boolean;
	indentation?: number;
	directory?: string | false; // false means don't write files
	additional?: Record<string, any>;
	overwrite?: boolean;
	tables?: string[] | RegExp | null;
	skipTables?: string[] | RegExp | null;
	foreignKeys?: boolean;
	indexes?: boolean;
	includeViews?: boolean; // maps to 'views' in some contexts
	quiet?: boolean;
	sort?: boolean; // Custom option, not standard Sequelize
	schema?: string; // For postgres, mssql
	// Options from Sequelize constructor if not passing an instance
	username?: string;
	password?: string;
	host?: string;
	port?: number;
	dialect?: SequelizeDialect;
	dialectOptions?: Record<string, any>;
	pool?: Record<string, any>;
	storage?: string; // For SQLite
	// specific to sequelize-auto text generation
	lang?: 'es6' | 'ts' | 'esm'; // Added lang option based on typical sequelize-auto usage
	caseModel?: 'c' | 'k' | 'l' | 'o' | 'p' | 'u';
	caseFile?: 'c' | 'k' | 'l' | 'o' | 'p' | 'u';
	caseProp?: 'c' | 'k' | 'l' | 'o' | 'p' | 'u';
	noAlias?: boolean;
	noIndexes?: boolean; // If true, skip index generation
	noInitModels?: boolean; // If true, skip writing index file
	noWrite?: boolean; // if true, skip writing files (same as directory: false)
	singularize?: boolean;
	useDefine?: boolean;
	logging?: boolean | ((sql: string, timing?: number) => void); // from SequelizeOptions
}

// Interface for the structure of foreign key details
interface ForeignKeyDetail {
	source_table: string;
	source_schema: string;
	target_schema: string;
	target_table: string;
	source_column: string;
	target_column: string;
	constraint_name?: string; // From DB
	isForeignKey?: boolean;
	isUnique?: boolean;
	isPrimaryKey?: boolean;
	isSerialKey?: boolean;
	foreignSources?: { // Structure for references attribute
		source_table: string;
		source_schema: string;
		target_schema: string;
		target_table: string;
		source_column: string;
		target_column: string;
	};
	// Raw fields from DB, dialect specific
	[key: string]: any;
}

// Interface for individual column description augmented with FK info
interface ColumnDescription extends TableDescription {
	[columnName: string]: any; // Original fields from describeTable
	foreignKey?: ForeignKeyDetail; // Augmented by buildForeignKeys
	special?: string[]; // For ENUMs in Postgres
}


// Interface for the structure of an index
interface IndexDefinition extends IndexDescription { // Sequelize's IndexDescription
	// name: string; // from IndexDescription
	// fields: IndexField[]; // from IndexDescription
	// unique?: boolean; // from IndexDescription
	// primary?: boolean; // from IndexDescription
	type?: string; // From DB query (e.g., BTREE) or custom
	method?: string; // Alternative for type (used in output)
}


class SequelizeAuto {
	public sequelize: Sequelize;
	public queryInterface: QueryInterface;
	public options: SequelizeAutoOptions;
	public text: Record<string, string>; // tableName: generatedModelText
	public tables: Record<string, ColumnDescription>; // tableName: describedTableDetails
	public indexes: Record<string, IndexDefinition[]>; // tableName: array of index definitions
	public foreignKeys: Record<string, Record<string, ForeignKeyDetail>>; // tableName: { columnName: fkDetail }
	private maxDefferredQueries: number;
	private dialect: any; // This will be one of the dialect objects from ./dialects
	private startedAt?: number;
	private finishedAt?: number;

	constructor(database: Sequelize | string, username?: string | SequelizeAutoOptions, password?: string, options?: SequelizeAutoOptions) {
		if (database instanceof Sequelize) {
			this.sequelize = database;
			if (typeof username === "object" && username !== null) {
				options = username as SequelizeAutoOptions;
			} else {
				options = options || {}; // Ensure options is an object if username is not options
			}
		} else {
			// database is a string (database name or connection string)
			options = options || {};
			if (typeof username === "string") {
				options.username = username;
			}
			if (typeof password === "string") {
				options.password = password;
			}

			if (options.dialect === "sqlite" && !options.storage) {
				options.storage = database as string; // The 'database' string is the storage path for SQLite
			} else if (options.dialect === "mssql") {
				const dialectOptions = options.dialectOptions || {};
				options.dialectOptions = {
					...dialectOptions,
					options: {
						requestTimeout: 0,
						connectTimeout: 1000 * 60 * 1,
						...(dialectOptions.options || {}),
					},
				};
				const pool = options.pool || {};
				options.pool = {
					max: 100,
					acquire: 1000 * 60 * 1,
					...pool,
				};
			} else if (options.dialect === "mysql") {
				const pool = options.pool || {};
				options.pool = {
					max: 10,
					acquire: 1000 * 60 * 1,
					...pool,
				};
			}
			// Ensure database name is provided if not using SQLite with storage path as db name
			const dbName = (options.dialect === "sqlite" && options.storage === database) ? undefined : database as string;
			this.sequelize = new Sequelize(dbName!, options.username!, options.password!, options as SequelizeOptions);
		}

		this.queryInterface = this.sequelize.getQueryInterface();
		this.text = {};
		this.tables = {};
		this.indexes = {};
		this.foreignKeys = {};
		// Use options.dialect from the resolved options
		this.maxDefferredQueries = (this.sequelize.getDialect() === "mysql" ? 10 : 100);
		// @ts-ignore
		this.dialect = dialects[this.sequelize.getDialect()];

		// Merge default options
		this.options = {
			database: this.sequelize.config.database, // Get database from Sequelize instance config
			spaces: false,
			indentation: 1,
			directory: "./models",
			additional: {},
			overwrite: false,
			tables: null,
			skipTables: null,
			foreignKeys: true,
			indexes: true, // defaults.indexes implies this
			includeViews: true, // defaults.views implies this
			quiet: false,
			sort: false,
			lang: 'es6', // Default language
			...options, // User-provided options override defaults
		};
		
		// Post-process options
		if (this.options.directory === false) {
			this.options.noWrite = true;
		}
		if (this.options.noWrite === true) {
		    this.options.directory = false; // Ensure consistency
		}


		if (this.options.tables && this.options.skipTables) {
			console.error("The 'skipTables' option will be ignored because the 'tables' option is given");
		}

		if (this.options.tables && typeof this.options.tables === "string") {
			this.options.tables = [this.options.tables as string];
		}
		if (Array.isArray(this.options.tables)) {
			this.options.tables = this.options.tables.map(t => t.toLowerCase());
		}

		if (this.options.skipTables && typeof this.options.skipTables === "string") {
			this.options.skipTables = [this.options.skipTables as string];
		}
		if (Array.isArray(this.options.skipTables)) {
			this.options.skipTables = this.options.skipTables.map(t => t.toLowerCase());
		}
	}

	async buildForeignKeys(table: string): Promise<void> {
		const sql = this.dialect.getForeignKeysQuery(table, this.options.database!);
		// Define a type for the raw result of the foreign key query, which can vary by dialect
		type RawForeignKeyResult = Record<string, any>;

		const results: RawForeignKeyResult[] = await this.sequelize.query(sql, {
			type: QueryTypes.SELECT,
			raw: true,
		});

		for (let ref of results) {
			let processedRef: Partial<ForeignKeyDetail> = {};
			if (this.sequelize.getDialect() === "sqlite") {
				// map sqlite's PRAGMA results
				processedRef = Object.keys(ref).reduce((acc, key) => {
					switch (key) {
						case "from":
							acc.source_column = ref[key];
							break;
						case "to":
							acc.target_column = ref[key];
							break;
						case "table":
							acc.target_table = ref[key];
							break;
						default:
							acc[key] = ref[key];
					}
					return acc;
				}, {} as Partial<ForeignKeyDetail>);
			} else {
				processedRef = { ...ref };
			}

			// Ensure essential properties are strings or provide defaults
			const sourceColumn = typeof processedRef.source_column === 'string' ? processedRef.source_column.trim() : '';
			const targetColumn = typeof processedRef.target_column === 'string' ? processedRef.target_column.trim() : '';
			const targetTable = typeof processedRef.target_table === 'string' ? processedRef.target_table.trim() : '';


			const fkDetail: ForeignKeyDetail = {
				source_table: table,
				source_schema: this.options.database!,
				target_schema: processedRef.target_schema || this.options.database!,
				target_table: targetTable,
				source_column: sourceColumn,
				target_column: targetColumn,
				constraint_name: processedRef.constraint_name,
				...processedRef, // Spread the rest of the properties
			};

			if (fkDetail.source_column && fkDetail.target_column && fkDetail.target_table) {
				fkDetail.isForeignKey = true; // Mark it as a foreign key if essential columns are present
				fkDetail.foreignSources = { // Structure for Sequelize model's 'references' attribute
					source_table: fkDetail.source_table,
					source_schema: fkDetail.source_schema,
					target_schema: fkDetail.target_schema,
					target_table: fkDetail.target_table,
					source_column: fkDetail.source_column,
					target_column: fkDetail.target_column,
				};
			}

			// Dialect-specific checks for unique, primary, serial key properties
			// These rely on methods defined in the dialect-specific objects
			if (this.dialect.isUnique && this.dialect.isUnique(ref)) { // pass original ref to dialect method
				fkDetail.isUnique = true;
			}
			if (this.dialect.isPrimaryKey && this.dialect.isPrimaryKey(ref)) { // pass original ref
				fkDetail.isPrimaryKey = true;
			}
			if (this.dialect.isSerialKey && this.dialect.isSerialKey(ref)) { // pass original ref
				fkDetail.isSerialKey = true;
			}

			this.foreignKeys[table] = this.foreignKeys[table] || {};
			if (fkDetail.source_column) { // Ensure source_column is valid before using as a key
				this.foreignKeys[table][fkDetail.source_column] = {
					...(this.foreignKeys[table][fkDetail.source_column] || {}),
					...fkDetail,
				};
			}
		}
	}

	async buildIndexes(table: string): Promise<void> {
		// Ensure options.database is non-null if dialect needs it; using non-null assertion.
		const sql = this.dialect.getIndexesQuery(table, this.options.database!);
		// Define a type for the raw result of the index query.
		type RawIndexResult = Record<string, any>; // e.g., { name: string, type: string, field: string, sql?: string for sqlite }

		const results: RawIndexResult[] = await this.sequelize.query(sql, {
			type: QueryTypes.SELECT,
			raw: true,
		});

		let indexes: IndexDefinition[] = [];
		if (this.sequelize.getDialect() === "sqlite") {
			// SQLite specific parsing from `sql` column in `sqlite_master`
			indexes = results.reduce((arr: IndexDefinition[], row: RawIndexResult) => {
				if (row.sql && typeof row.sql === 'string') { // Check if sql property exists and is a string
					// Regex to capture index name, uniqueness, table name (for verification), and fields
					// Adjusted regex to better handle optional `UNIQUE` and quoted identifiers
					const match = row.sql.match(/CREATE(\s+UNIQUE)?\s+INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:`?"?(\w+)"?`?)\s+ON\s+(?:`?"?(\w+)"?`?)\s*\(([^)]+)\)/i);
					if (match) {
						const name = match[2]; // Index name
						// const onTable = match[3]; // Table name from SQL, should match `table` parameter
						const fieldsString = match[4]; // Comma-separated fields
						const unique = !!match[1]; // Check if UNIQUE keyword was present

						const fields: IndexField[] = fieldsString.split(",").map(f => {
							const trimmed = f.trim().replace(/[`'"]/g, ""); // Remove quotes
							// TODO: Handle ASC/DESC and COLLATE if necessary from `f`
							return { attribute: trimmed }; // Sequelize's IndexField uses 'attribute'
						});

						arr.push({
							name,
							fields,
							unique,
							primary: false, // This query usually doesn't identify primary key indexes directly for SQLite like this
							// type: unique ? 'UNIQUE' : undefined, // 'type' in Sequelize IndexDefinition is for index type e.g. 'BTREE'
						} as IndexDefinition); // Cast to ensure it matches IndexDefinition
					}
				}
				return arr;
			}, []);
		} else {
			// General case for other dialects (MySQL, Postgres, MSSQL)
			const groupedIndexes = results.reduce((obj, row: RawIndexResult) => {
				const name = row.name as string;
				if (!obj[name]) {
					obj[name] = {
						name: name,
						type: row.type as string, // Index type (e.g., BTREE, GIN, etc.)
						fields: [], // Initialize as empty array of IndexField
						unique: !!row.unique || (typeof row.type === 'string' && row.type.toUpperCase() === 'UNIQUE'),
						primary: !!row.primary || (typeof row.name === 'string' && row.name.toUpperCase() === 'PRIMARY'),
					} as IndexDefinition; // Initializing with IndexDefinition type and ensuring fields is correctly typed
				}
				// Ensure fields is an array before pushing (it should be due to initialization)
				obj[name].fields.push({ attribute: row.field as string });
				return obj;
			}, {} as Record<string, IndexDefinition>);
			indexes = Object.values(groupedIndexes);
		}
		this.indexes[table] = indexes;
	}

	async buildTable(table: string): Promise<void> {
		// The schema option for describeTable is taken from this.options.schema
		// TableDescription is already a Sequelize type, but our ColumnDescription
		// is what we store, allowing for augmentation (e.g. with foreignKey details).
		const describedTable: TableDescription = await this.queryInterface.describeTable(table, this.options.schema);
		this.tables[table] = describedTable as ColumnDescription;
	}

	async build(): Promise<void> {
		let tableNames: string[] = [];

		// Determine how to get table names based on dialect and options
		if ((this.sequelize.getDialect() === "postgres" && this.options.schema) ||
			["mysql", "mssql"].includes(this.sequelize.getDialect())) {
			// Dialects that require a custom query via this.dialect.showTablesQuery
			const showTablesSql = this.dialect.showTablesQuery(this.options); // Pass relevant options
			// The result of showTablesQuery can be {tableName: string}[] or string[]
			const queryResult: (Record<string, string> | string)[] = await this.sequelize.query(showTablesSql, {
				raw: true,
				type: QueryTypes.SHOWTABLES, // SHOWTABLES type usually returns string[] or {tableName:string}[]
			});

			tableNames = queryResult.reduce((acc: string[], item: (Record<string, string> | string)) => {
				if (typeof item === 'string') {
					acc.push(item);
				} else if (item && typeof item.tableName === 'string') { // Check common Sequelize format
					acc.push(item.tableName);
				} else if (item && Object.values(item)[0] && typeof Object.values(item)[0] === 'string') {
					// Fallback for other { 'some_key_tables_in_db': 'table_name' } formats
					acc.push(Object.values(item)[0]);
				}
				return acc;
			}, []);

		} else {
			// Default for SQLite and other cases: use queryInterface.showAllTables()
			const result: string[] | {tableName: string}[] = await this.queryInterface.showAllTables();
			if (result.length > 0 && typeof result[0] === 'object' && result[0] !== null && 'tableName' in result[0]) {
				tableNames = (result as {tableName: string}[]).map(r => r.tableName);
			} else {
				tableNames = result as string[];
			}
		}

		// Filter tables based on options.tables or options.skipTables
		if (this.options.tables) {
			if (this.options.tables instanceof RegExp) {
				const tablesRegex = this.options.tables; // Type assertion for RegExp
				tableNames = tableNames.filter(tn => tablesRegex.test(tn));
			} else { // string[]
				const includeTables = this.options.tables as string[]; // Already toLowerCase in constructor
				tableNames = tableNames.filter(tn => includeTables.includes(tn.toLowerCase()));
			}
		} else if (this.options.skipTables) {
			if (this.options.skipTables instanceof RegExp) {
				const skipTablesRegex = this.options.skipTables; // Type assertion for RegExp
				tableNames = tableNames.filter(tn => !skipTablesRegex.test(tn));
			} else { // string[]
				const excludeTables = this.options.skipTables as string[]; // Already toLowerCase in constructor
				tableNames = tableNames.filter(tn => !excludeTables.includes(tn.toLowerCase()));
			}
		}

		if (tableNames.length > 0) {
			const pool = new DeferredPool<() => Promise<void>>({ max: this.maxDefferredQueries });
			// Type for the promise's resolve/reject functions
			type ResolveFn = () => void;
			type RejectFn = (reason?: any) => void;

			await new Promise<void>((resolve: ResolveFn, reject: RejectFn) => {
				let lastUpdate: number | null = null;
				const precision = Math.max(`${tableNames.length}`.length - 2, 0);

				pool.onUpdate(() => {
					if (pool.percent !== lastUpdate) {
						lastUpdate = pool.percent;
						if (pool.finished >= tableNames.length) { // Changed from successful to finished
							if (!this.options.quiet) {
								readline.clearLine(process.stdout, 0);
								readline.cursorTo(process.stdout, 0);
							}
							resolve();
						} else {
							if (!this.options.quiet) {
								const percent = pool.percent.toFixed(precision);
								process.stdout.write(`\rbuilding... ${percent}%`);
							}
						}
					}
				});
				pool.onError((ex: any, item: any) => { // Added item parameter
					if (!this.options.quiet) {
						readline.clearLine(process.stdout, 0);
						readline.cursorTo(process.stdout, 0);
						console.error(`\nError while processing item:`, item); // Log which item failed
					}
					reject(ex);
				});

				const tasks = tableNames.map((tableName) => async () => {
					if (this.options.foreignKeys) {
						await this.buildForeignKeys(tableName);
					}
					// Check for noIndexes option before building indexes
					if (this.options.indexes !== false && this.options.noIndexes !== true) {
						await this.buildIndexes(tableName);
					}
					await this.buildTable(tableName);
				});
				pool.add(tasks);
				// Check if pool is already done (e.g. if tableNames was empty after filter, though covered by tableNames.length > 0)
                if (pool.total === 0 || pool.finished === pool.total) {
                    resolve();
                }
			});
		}
	}

	generateText(table: string, indent: (level: number) => string): string {
		let text = "";
		const tableData = this.tables[table];
		if (!tableData) {
			console.error(`Table data for ${table} not found. Skipping text generation.`);
			return "";
		}

		// Language specific variations
		const isTypescript = this.options.lang === 'ts';
		const isESM = this.options.lang === 'esm';

		if (isTypescript) {
			text += "import * as Sequelize from 'sequelize';\n";
			text += "import { DataTypes, Model, Optional } from 'sequelize';\n\n";
			// TODO: Define Attributes and CreationAttributes interfaces for TS
		} else if (isESM) {
			text += "import { DataTypes, Model } from 'sequelize';\n\n";
		} else { // CommonJS (es6 default)
			text += "const { DataTypes, Model } = require('sequelize');\n\n";
			text += "module.exports = function (sequelize, DataTypes) {\n"; // Keep DataTypes for older versions, though Sequelize v6 uses static DataTypes
			text += `${indent(1)}class ${this.options.caseModel === 'p' ? table : SqlString.pascalCase(table)} extends Model {\n`;
			text += `${indent(2)}/**\n`;
			text += `${indent(2)} * Helper method for defining associations.\n`;
			text += `${indent(2)} * This method is not a part of Sequelize lifecycle.\n`;
			text += `${indent(2)} * The \`models/index\` file will call this method automatically.\n`;
			text += `${indent(2)} */\n`;
			text += `${indent(2)}static associate(models) {\n`;
			text += `${indent(3)}// define association here\n`;
			text += `${indent(2)}}\n`;
			text += `${indent(1)}}\n`;
			text += `${indent(1)}${this.options.caseModel === 'p' ? table : SqlString.pascalCase(table)}.init({\n`;
		}
		// For TS and ESM, the class and init are structured differently.
		// This simplified version focuses on the CommonJS structure from original code for now.
		// A full TS/ESM generation would require more significant changes to this function.
		// The original code generates a CommonJS module returning sequelize.define, not a class.
		// Reverting to closer to original output structure for model definition part.

		text = ""; // Reset text for original structure.
		if (isTypescript) {
			text += "import { Sequelize, DataTypes, Model, Optional } from 'sequelize';\n\n";
			// Basic interfaces - can be expanded
			text += `export interface ${SqlString.pascalCase(table)}Attributes {\n`;
			// TODO: Populate attributes here
			text += `${indent(1)}id?: number;\n`; // Example
			text += "}\n\n";
			text += `export type ${SqlString.pascalCase(table)}Pk = "id";\n`; // Example, needs to be dynamic
			text += `export type ${SqlString.pascalCase(table)}Id = ${SqlString.pascalCase(table)}[${SqlString.pascalCase(table)}Pk];\n`;
			text += `export type ${SqlString.pascalCase(table)}OptionalAttributes = "id";\n`; // Example
			text += `export type ${SqlString.pascalCase(table)}CreationAttributes = Optional<${SqlString.pascalCase(table)}Attributes, ${SqlString.pascalCase(table)}OptionalAttributes>;\n\n`;
			text += `export class ${SqlString.pascalCase(table)} extends Model<${SqlString.pascalCase(table)}Attributes, ${SqlString.pascalCase(table)}CreationAttributes> implements ${SqlString.pascalCase(table)}Attributes {\n`;
			// TODO: Populate class body with attributes
			text += `${indent(1)}// public id?: number;\n`; // Example
			text += `\n${indent(1)}static initModel(sequelize: Sequelize): typeof ${SqlString.pascalCase(table)} {\n`;
			text += `${indent(2)}return ${SqlString.pascalCase(table)}.init({\n`;
		} else if (isESM) {
			text += "import { DataTypes, Model } from 'sequelize';\n\n";
			text += `export default (sequelize) => {\n`; // Adjusted for ESM export default function
			text += `${indent(1)}class ${SqlString.pascalCase(table)} extends Model {}\n`;
			text += `${indent(1)}${SqlString.pascalCase(table)}.init({\n`;
		} else { // CommonJS
			text += "module.exports = function(sequelize, DataTypes) {\n";
			text += `${indent(1)}return sequelize.define("${SqlString.pascalCase(table)}", {\n`;
		}


		let createdAt = false;
		let updatedAt = false;
		const { additional } = this.options;

		const fields = Object.keys(tableData);
		if (this.options.sort) {
			fields.sort();
		}

		fields.forEach((field) => {
			const fieldValue: ColumnDescription = tableData[field] as ColumnDescription;
			if (field === "createdAt") createdAt = true;
			if (field === "updatedAt") updatedAt = true;

			if (additional && typeof additional.timestamps !== "undefined" && additional.timestamps) {
				const createdAtOpt = typeof additional.createdAt === 'string' ? additional.createdAt : 'createdAt';
				const updatedAtOpt = typeof additional.updatedAt === 'string' ? additional.updatedAt : 'updatedAt';
				const deletedAtOpt = typeof additional.deletedAt === 'string' ? additional.deletedAt : 'deletedAt';
				if (field === createdAtOpt || field === updatedAtOpt || field === deletedAtOpt) {
					return;
				}
			}

			const foreignKey = this.foreignKeys[table] && this.foreignKeys[table][field] ? this.foreignKeys[table][field] : null;

			// Augment fieldValue with foreignKey details if found
			if (foreignKey) {
				fieldValue.foreignKey = foreignKey;
			}

			if (field === "id" && !fieldValue.primaryKey) { // Ensure 'id' is PK, common convention
				fieldValue.primaryKey = true;
			}

			const fieldName = field.match(/^\d|\W/) || this.options.caseProp === 'o' ? `"${field}"` : SqlString.camelCase(field);
			text += `${indent(isTypescript || isESM ? 3 : 2)}${fieldName}: {\n`;

			let defaultVal = fieldValue.defaultValue;

			if (fieldValue.type === "USER-DEFINED" && fieldValue.special && fieldValue.special.length > 0) {
				fieldValue.type = `ENUM(${fieldValue.special.map((f) => `"${f}"`).join(", ")})`;
			}

			const isUnique = fieldValue.foreignKey && fieldValue.foreignKey.isUnique;
			let hasAutoIncrement = false;

			const attrs = Object.keys(fieldValue);
			if (this.options.sort) {
				attrs.sort();
			}

			attrs.forEach((attr) => {
				const attrValue = fieldValue[attr];
				const isSerialKey = fieldValue.foreignKey && this.dialect.isSerialKey && this.dialect.isSerialKey(fieldValue.foreignKey);

				if (attr === "special") return;

				if (attr === "autoIncrement") {
					if (attrValue && !hasAutoIncrement) {
						text += `${indent(isTypescript || isESM ? 4 : 3)}autoIncrement: true,\n`;
						hasAutoIncrement = true;
					}
					return;
				}

				if (attr === "foreignKey") {
					if (isSerialKey) {
						if (!hasAutoIncrement) {
							text += `${indent(isTypescript || isESM ? 4 : 3)}autoIncrement: true,\n`;
							hasAutoIncrement = true;
						}
					} else if (fieldValue.foreignKey && fieldValue.foreignKey.isForeignKey && fieldValue.foreignKey.foreignSources) {
						const fkSources = fieldValue.foreignKey.foreignSources;
						text += `${indent(isTypescript || isESM ? 4 : 3)}references: {\n`;
						if (this.options.schema) {
							text += `${indent(isTypescript || isESM ? 5 : 4)}model: {\n`;
							text += `${indent(isTypescript || isESM ? 6 : 5)}tableName: "${fkSources.target_table}",\n`;
							text += `${indent(isTypescript || isESM ? 6 : 5)}schema: "${fkSources.target_schema}"\n`;
							text += `${indent(isTypescript || isESM ? 5 : 4)}},\n`;
						} else {
							text += `${indent(isTypescript || isESM ? 5 : 4)}model: "${fkSources.target_table}",\n`;
						}
						text += `${indent(isTypescript || isESM ? 5 : 4)}key: "${fkSources.target_column}"\n`;
						text += `${indent(isTypescript || isESM ? 4 : 3)}},\n`;
					}
					return;
				}

				if (attr === "primaryKey") {
					if (attrValue === true && (!fieldValue.foreignKey || (fieldValue.foreignKey && fieldValue.foreignKey.isPrimaryKey))) {
						text += `${indent(isTypescript || isESM ? 4 : 3)}primaryKey: true,\n`;
					}
					return;
				}

				if (attr === "allowNull") {
					text += `${indent(isTypescript || isESM ? 4 : 3)}${attr}: ${attrValue},\n`;
					return;
				}
				
				if (attr === "defaultValue") {
					if (this.sequelize.getDialect() === "mssql" && defaultVal && typeof defaultVal === 'string' && defaultVal.toLowerCase() === "(newid())") {
						defaultVal = null; // Disable for MSSQL newid()
					}
					if (isSerialKey) return;

					let valOutput: string | number | boolean | null = defaultVal;

					if (fieldValue.type.toLowerCase() === "bit(1)") valOutput = defaultVal === "b'1'" ? 1 : 0;
					else if (this.sequelize.getDialect() === "mssql" && fieldValue.type.toLowerCase() === "bit") valOutput = defaultVal === "((1))" || defaultVal === "1" ? 1 : 0;

					if (typeof defaultVal === "string") {
						const fieldTypeLower = fieldValue.type.toLowerCase();
						if (defaultVal.match(/^\w+\(\)$/)) { // Functions like NOW()
							valOutput = `sequelize.fn("${defaultVal.replace(/[()]/g, "")}")`;
						} else if (fieldTypeLower.includes("date") || fieldTypeLower.includes("timestamp")) {
							if (["current_timestamp", "current_date", "current_time", "localtime", "localtimestamp"].includes(defaultVal.toLowerCase())) {
								valOutput = `sequelize.literal("${defaultVal}")`;
							} else {
								valOutput = `"${SqlString.escape(defaultVal).slice(1, -1)}"`; // Escape and remove outer quotes
							}
						} else {
							valOutput = `"${SqlString.escape(defaultVal).slice(1, -1)}"`;
						}
					}
					
					if (valOutput === null || typeof valOutput === "undefined") return;

					text += `${indent(isTypescript || isESM ? 4 : 3)}${attr}: ${valOutput},\n`;
					return;
				}

				if (attr === "type") {
					const attrType = (attrValue as string || "").toLowerCase();
					const L = () => { // Length function
						const match = (attrValue as string).match(/\((.+?)\)/);
						if (!match) return "";
						const lengths = match[1].split(",").map(n => n.trim().replace(/^'(.*)'$/, '"$1"').replace(/\\'/g, "'"));
						return `(${lengths.join(", ")})`;
					};
					let seqType = `"${attrValue}"`; // Default to string literal for unknown types
					let typeMatch;

					if (attrType.match(/^(enum|set)/)) seqType = `DataTypes.ENUM${L()}`;
					else if (attrType.match(/^varchar(?:acter)?/)) seqType = `DataTypes.STRING${L()}` + (attrType.includes("binary") ? ".BINARY" : "");
					else if (attrType.match(/^(string|varying|nvarchar|xml|character varying)/)) seqType = `DataTypes.STRING`;
					else if (attrType.match(/^(?:n)?char/)) seqType = `DataTypes.CHAR${L()}`;
					else if (typeMatch = attrType.match(/^(tinytext|mediumtext|longtext|ntext|text)/)) seqType = `DataTypes.TEXT` + (typeMatch[1] && typeMatch[1] !== 'text' ? `("${typeMatch[1]}")` : "");
					else if (typeMatch = attrType.match(/^(tinyint|smallint|mediumint|bigint|int(?:eger)?)/)) {
						const typeMap: Record<string, string> = { tinyint: "TINYINT", smallint: "SMALLINT", mediumint: "MEDIUMINT", int: "INTEGER", integer: "INTEGER", bigint: "BIGINT" };
						seqType = `DataTypes.${typeMap[typeMatch[1]]}${L()}`;
						if (attrType.includes("unsigned")) seqType += ".UNSIGNED";
						if (attrType.includes("zerofill")) seqType += ".ZEROFILL";
					}
					else if (attrType.match(/^(float8|double precision|numeric|float)/)) seqType = `DataTypes.DOUBLE${L()}`; // float can be double
					else if (attrType.match(/^float4?/)) seqType = `DataTypes.FLOAT${L()}`; // float4 in pg
					else if (attrType.match(/^(decimal|money|smallmoney)/)) seqType = `DataTypes.DECIMAL${L()}`;
					else if (attrType.match(/^real/)) seqType = `DataTypes.REAL${L()}`;
					else if (attrType.match(/^(boolean|bit(?:\(1\))?)/)) seqType = "DataTypes.BOOLEAN";
					else if (typeMatch = attrType.match(/^(tinyblob|mediumblob|longblob|blob|varbinary|binary(?: varying)?|image)/)) seqType = `DataTypes.BLOB` + (typeMatch[1] && typeMatch[1] !== 'blob' ? `("${typeMatch[1]}")` : "");
					else if (attrType.match(/^date$/)) seqType = "DataTypes.DATEONLY";
					else if (attrType.match(/^(datetime2?|smalldatetime|timestamp(?:tz)?)/)) seqType = "DataTypes.DATE";
					else if (attrType.match(/^time(?:tz)?/)) seqType = "DataTypes.TIME";
					else if (attrType.match(/^(?:uuid|uniqueidentifier)/)) seqType = "DataTypes.UUID"; // Note: UUIDV4 is a default value, type is UUID
					else if (attrType.match(/^jsonb/)) seqType = "DataTypes.JSONB";
					else if (attrType.match(/^json/)) seqType = "DataTypes.JSON";
					else if (attrType.match(/^array/)) seqType = "DataTypes.ARRAY"; // Needs subtype, e.g. DataTypes.ARRAY(DataTypes.INTEGER)
					else if (attrType.match(/^geometry/)) seqType = "DataTypes.GEOMETRY";
					// TODO: Handle other specific types like HSTORE, RANGE, CIDR, INET, MACADDR for Postgres etc.

					text += `${indent(isTypescript || isESM ? 4 : 3)}${attr}: ${seqType},\n`;
					return;
				}
				
				if (attr === "comment" && attrValue === null) return;

				try {
					text += `${indent(isTypescript || isESM ? 4 : 3)}${attr}: ${JSON.stringify(attrValue)},\n`;
				} catch (ex) {
					console.error(`Skipping attribute ${attr} for field ${field} in table ${table} due to stringify error:`, ex);
				}
			});

			if (isUnique) {
				text += `${indent(isTypescript || isESM ? 4 : 3)}unique: true,\n`;
			}
			// Remove trailing comma from last attribute
			if (text.endsWith(",\n")) {
				text = text.substring(0, text.length - 2) + "\n";
			}
			text += `${indent(isTypescript || isESM ? 3 : 2)}},\n`;
		});
		// Remove trailing comma from last field
		if (text.endsWith(",\n")) {
			text = text.substring(0, text.length - 2) + "\n";
		}

		text += `${indent(isTypescript || isESM ? 2 : 1)}}`; // End of fields object

		// Table options
		if (isTypescript) {
			text += `, {\n${indent(3)}sequelize,\n`;
		} else if (isESM) {
			text += `);\n\n${indent(1)}// Table options here\n`;
			text += `${indent(1)}return ${SqlString.pascalCase(table)};\n`;
			text += `};`; // End of export default function
			return text; // ESM structure is different, return early
		} else { // CommonJS
			text += `, {\n`;
		}

		text += `${indent(isTypescript ? 3 : 2)}tableName: '${table}',\n`;
		if (this.options.schema) {
			text += `${indent(isTypescript ? 3 : 2)}schema: '${this.options.schema}',\n`;
		}
		if ((!additional || typeof additional.timestamps === "undefined") && !createdAt && !updatedAt) {
			text += `${indent(isTypescript ? 3 : 2)}timestamps: false,\n`;
		}
		if (additional) {
			for (const key in additional) {
				if (key === 'name' || key === 'comment' || key === 'timestamps' || key === 'charset' || key === 'collate') { // Standard options
					text += `${indent(isTypescript ? 3 : 2)}${key}: ${JSON.stringify(additional[key])},\n`;
				} else { // Other non-standard options
					try {
						const keyName = key.match(/^\d|\W/) ? `"${key}"` : key;
						text += `${indent(isTypescript ? 3 : 2)}${keyName}: ${JSON.stringify(additional[key])},\n`;
					} catch (ex) {
						console.error(`Can't add additional property '${key}' for table ${table}:`, ex);
					}
				}
			}
		}

		const tableIndexes = this.indexes[table];
		if (tableIndexes && tableIndexes.length > 0) {
			text += `${indent(isTypescript ? 3 : 2)}indexes: [\n`;
			tableIndexes.forEach((idx) => {
				text += `${indent(isTypescript ? 4 : 3)}{\n`;
				text += `${indent(isTypescript ? 5 : 4)}name: "${idx.name}",\n`;
				if (idx.unique) {
					text += `${indent(isTypescript ? 5 : 4)}unique: true,\n`;
				}
				// 'type' could be 'UNIQUE', 'FULLTEXT', 'SPATIAL' for some dialects, or index method like 'BTREE'
				// Sequelize uses 'using' for method (BTREE, HASH, GIN, GIST), and 'type' for UNIQUE/FULLTEXT/SPATIAL.
				if (idx.type && ['UNIQUE', 'FULLTEXT', 'SPATIAL'].includes(idx.type.toUpperCase())) {
					text += `${indent(isTypescript ? 5 : 4)}type: "${idx.type.toUpperCase()}",\n`;
				} else if (idx.type) { // Assume it's an index method if not one of the standard types
					text += `${indent(isTypescript ? 5 : 4)}using: "${idx.type}",\n`;
				}
				// original code had `method: "${index.type}"` which is ambiguous.
				// Sequelize `IndexOptions` has `fields: (string | { name: string; order?: string; collate?: string; length?: number })[];`
				text += `${indent(isTypescript ? 5 : 4)}fields: [\n`;
				idx.fields.forEach(field => {
					// field is IndexField { attribute: string; collate?: string; order?: string; length?: string; }
					text += `${indent(isTypescript ? 6 : 5)}{ name: "${field.attribute}"`;
					if (field.order) text += `, order: "${field.order}"`;
					if (field.collate) text += `, collate: "${field.collate}"`;
					// length is not a standard IndexField property in Sequelize's base IndexField, but might be used by some dialects
					text += ` },\n`;
				});
				if (text.endsWith(",\n")) text = text.substring(0, text.length - 2) + "\n"; // remove last comma
				text += `${indent(isTypescript ? 5 : 4)}]\n`;
				text += `${indent(isTypescript ? 4 : 3)}},\n`;
			});
			if (text.endsWith(",\n")) text = text.substring(0, text.length - 2) + "\n"; // remove last comma
			text += `${indent(isTypescript ? 3 : 2)}]\n`;
		}
		
		// Remove trailing comma from last table option
		if (text.endsWith(",\n")) {
			text = text.substring(0, text.length - 2) + "\n";
		}

		if (isTypescript) {
			text += `${indent(2)}});\n`; // End of init options
			text += `${indent(1)}}\n`; // End of static initModel
			text += "}\n"; // End of class
		} else { // CommonJS
			text += `${indent(1)}});\n`; // End of define options
			text += "};\n"; // End of module.exports function
		}
		return text;
	}

	async run(): Promise<void> {
		this.startedAt = Date.now();
		await this.build();

		let spaces = "";
		for (let x = 0; x < this.options.indentation!; ++x) { // Added non-null assertion for indentation
			spaces += (this.options.spaces === true ? " " : "\t");
		}
		const indent = (level: number): string => spaces.repeat(level);

		const tableNames = Object.keys(this.tables);
		const precision = Math.max(`${tableNames.length}`.length - 2, 0);

		for (let i = 0; i < tableNames.length; i++) {
			const table = tableNames[i];
			if (!this.options.quiet) {
				const percent = (i / tableNames.length * 100).toFixed(precision);
				// Ensure process.stdout.write exists (it might not in all JS environments, though typical in Node)
				if (process.stdout && process.stdout.write) {
					process.stdout.write(`\rgenerating... ${percent}%`);
				}
			}
			this.text[table] = this.generateText(table, indent);
		}

		if (!this.options.quiet && process.stdout && process.stdout.clearLine) {
			readline.clearLine(process.stdout, 0);
			readline.cursorTo(process.stdout, 0);
		}

		await this.sequelize.close();

		if (this.options.directory && !this.options.noWrite) { // Check noWrite as well
			await this.write();
		}
		this.finishedAt = Date.now();
		if (!this.options.quiet) {
			console.log("Done", `${(this.finishedAt - this.startedAt!) / 1000}s`); // Added non-null for startedAt
		}
	}

	async write(): Promise<void> {
		// Ensure directory is a string before proceeding
		if (typeof this.options.directory !== 'string') {
			if(!this.options.quiet) {
				console.warn("Directory option is not a string or is false. Skipping file writing.");
			}
			return;
		}
		const resolvedDirectory = path.resolve(this.options.directory);

		// mkdirp utility function (recursive directory creation)
		const mkdirp = async (dirPath: string): Promise<void> => {
			try {
				await mkdirAsync(dirPath, { recursive: true }); // Use recursive option if available (Node.js v10.12.0+)
			} catch (err: any) {
				// For older Node versions or if recursive fails, try manual mkdirp
				if (err.code === "ENOENT") {
					await mkdirp(path.dirname(dirPath));
					try {
						await mkdirAsync(dirPath);
					} catch (mkdirErr: any) {
                        // If it still fails (e.g. race condition or file exists), check if it's a directory
                        const stats = await statAsync(dirPath).catch(() => null);
                        if (!stats || !stats.isDirectory()) {
                            throw mkdirErr; // Re-throw if not a directory or other error
                        }
                    }
				} else {
					const stats = await statAsync(dirPath).catch(() => null);
					if (!stats || !stats.isDirectory()) {
						throw err; // Re-throw if not a directory or other error
					}
					// If it's already a directory, that's fine.
				}
			}
		};

		await mkdirp(resolvedDirectory);

		const tableNames = Object.keys(this.text);

		if (tableNames.length > 0) {
			const pool = new DeferredPool<() => Promise<void>>({ retry: 0 });
			type ResolveFn = () => void;
			type RejectFn = (reason?: any) => void;

			await new Promise<void>((resolve: ResolveFn, reject: RejectFn) => {
				let lastUpdate: number | null = null;
				const precision = Math.max(`${tableNames.length}`.length - 2, 0);

				pool.onUpdate(() => {
					if (pool.percent !== lastUpdate) {
						lastUpdate = pool.percent;
						if (pool.finished >= tableNames.length) {
							if (!this.options.quiet && process.stdout && process.stdout.clearLine) {
								readline.clearLine(process.stdout, 0);
								readline.cursorTo(process.stdout, 0);
							}
							resolve();
						} else {
							if (!this.options.quiet && process.stdout && process.stdout.write) {
								const percent = pool.percent.toFixed(precision);
								process.stdout.write(`\rwriting... ${percent}%`);
							}
						}
					}
				});
				pool.onError((ex: any, item: any) => {
					if (!this.options.quiet && process.stdout && process.stdout.clearLine) {
						readline.clearLine(process.stdout, 0);
						readline.cursorTo(process.stdout, 0);
						console.error(`\nError while writing item:`, item);
					}
					reject(ex);
				});

				const tasks = tableNames.map((tableName) => async () => {
					// Determine file extension based on lang option
					let ext = '.js';
					if (this.options.lang === 'ts') ext = '.ts';
					else if (this.options.lang === 'esm') ext = '.mjs'; // Or could still be .js for ESM

					// Handle caseFile option for filename
					let fileName = tableName;
					if (this.options.caseFile === 'c') fileName = SqlString.camelCase(tableName);
					else if (this.options.caseFile === 'k') fileName = SqlString.kebabCase(tableName);
					else if (this.options.caseFile === 'l') fileName = tableName.toLowerCase();
					else if (this.options.caseFile === 'p') fileName = SqlString.pascalCase(tableName);
					else if (this.options.caseFile === 'u') fileName = tableName.toUpperCase();
					// 'o' (original) is default if not specified or not one of above

					await this.writeTable(fileName + ext, this.text[tableName]); // Pass generated text for original table name
				});
				pool.add(tasks);
                if (pool.total === 0 || pool.finished === pool.total) {
                    resolve();
                }
			});
		}
	}

	async writeTable(fileNameWithExt: string, text: string): Promise<void> { // Changed first param to fileNameWithExt
		if (typeof this.options.directory !== 'string') {
			// This case should ideally be prevented by the check in write()
			throw new Error("Directory path is not a string. Cannot write table file.");
		}
		const filePath = path.resolve(path.join(this.options.directory, fileNameWithExt));
		const flag = this.options.overwrite ? "w" : "wx";
		try {
			await writeFileAsync(filePath, text, { flag, encoding: "utf8" });
		} catch (err: any) {
			if (err.code === "EEXIST") {
				const data = await readFileAsync(filePath, { encoding: "utf8" });
				if (data !== text) {
					// Making error message more specific by including filename
					throw new Error(`File ${fileNameWithExt} changed but already exists at ${filePath}`);
				}
				// If content is the same, EEXIST is fine, means no change needed.
			} else {
				throw err;
			}
		}
	}
}

// Export the class and its options interface
export { SequelizeAutoOptions };
export default SequelizeAuto;

import { mkdir, stat, writeFile, readFile } from "fs/promises";
import {resolve, dirname, join} from "path";
import {clearLine, cursorTo} from "readline";
import { QueryTypes, Sequelize } from "sequelize";
import dialects from "./dialects";
import { escape as escapeSqlString } from "./sql-string";
import {DeferredPool} from "./deferred-pool";
import { DialectOperations, SequelizeAutoOptions, Index, AdditionalOptions } from "./types";

export class AutoSequelize {
	sequelize: Sequelize;
	queryInterface: any;
	text: any;
	tables: any;
	indexes: Record<string, Index[]>;
	foreignKeys: any;
	maxDeferredQueries: number;
	dialect: DialectOperations;
	options: SequelizeAutoOptions;
	startedAt: number|undefined;
	finishedAt: number|undefined;

	constructor(databaseOrSequelize: Sequelize, usernameOrOptions: SequelizeAutoOptions);
	constructor(databaseOrSequelize: string, usernameOrOptions: string, password?: string, options?: SequelizeAutoOptions);
	constructor(databaseOrSequelize: string | Sequelize, usernameOrOptions: string | SequelizeAutoOptions, password?: string, options?: SequelizeAutoOptions) {
		let database: string | undefined;
		let username: string | undefined;
		if (databaseOrSequelize instanceof Sequelize) {
			this.sequelize = databaseOrSequelize;
			if (typeof usernameOrOptions === "object") {
				// eslint-disable-next-line no-param-reassign
				options = usernameOrOptions;
			}
			options ??= {};
		} else {
			database = databaseOrSequelize;
			username = usernameOrOptions as string;
			if (!options) {
				// eslint-disable-next-line no-param-reassign
				options = {};
			}

			options.dialect ??= 'mysql';

			if (options.dialect === "sqlite" && !options.storage) {
				options.storage = database;
			} else if (options.dialect === "mssql") {
				const dialectOptions: any = options.dialectOptions || {};
				options.dialectOptions = {
					...dialectOptions,
					options: {
						requestTimeout: 0,
						connectTimeout: 1000 * 60 * 1,
						...dialectOptions.options,
					},
				};
				const pool = options.pool || {};
				options.pool = {
					max: 100,
					// 1 min
					acquire: 1000 * 60 * 1,
					...pool,
				};
			} else if (options.dialect === "mysql") {
				const pool = options.pool || {};
				options.pool = {
					max: 10,
					// 1 min
					acquire: 1000 * 60 * 1,
					...pool,
				};
			}

			this.sequelize = new Sequelize(database, username, password, options);
		}

		options.dialect ??= 'mysql';
		this.queryInterface = this.sequelize.getQueryInterface();
		this.text = {};
		this.tables = {};
		this.indexes = {};
		this.foreignKeys = {};
		this.maxDeferredQueries = (options.dialect === "mysql" ? 10 : 100);
		this.dialect = dialects[options.dialect];

		this.options = {
			database,
			spaces: false,
			indentation: 1,
			directory: "./models",
			additional: {},
			overwrite: false,
			tables: null,
			skipTables: null,
			foreignKeys: true,
			indexes: true,
			quiet: false,
			sort: false,
			...options,
		};

		if (this.options.tables && this.options.skipTables) {
			// eslint-disable-next-line no-console
			console.error("The 'skipTables' option will be ignored because the 'tables' option is given");
		}

		if (this.options.tables && typeof this.options.tables === "string") {
			this.options.tables = [this.options.tables];
		}
		if (Array.isArray(this.options.tables)) {
			this.options.tables = this.options.tables.map(t => t.toLowerCase());
		}

		if (this.options.skipTables && typeof this.options.skipTables === "string") {
			this.options.skipTables = [this.options.skipTables];
		}
		if (Array.isArray(this.options.skipTables)) {
			this.options.skipTables = this.options.skipTables.map(t => t.toLowerCase());
		}
	}

	async buildForeignKeys(table: any) {

		const sql = this.dialect.getForeignKeysQuery(table, this.options.database ?? '');

		const results = await this.sequelize.query(sql, {
			type: QueryTypes.SELECT,
			raw: true,
		}) as Record<string, any>[];

		for (let ref of results) {
			if (this.options.dialect === "sqlite") {
				// map sqlite's PRAGMA results
				ref = Object.keys(ref).reduce((acc: any, key) => {
					switch (key) {
						case "from":
							acc["source_column"] = ref[key];
							break;
						case "to":
							acc["target_column"] = ref[key];
							break;
						case "table":
							acc["target_table"] = ref[key];
							break;
						default:
							acc[key] = ref[key];
					}

					return acc;
				}, {});
			}

			ref = {
				source_table: table,
				source_schema: this.options.database,
				target_schema: this.options.database,
				...ref,
			};

			if (ref.source_column && ref.source_column.trim() && ref.target_column && ref.target_column.trim()) {
				ref.isForeignKey = true;
				ref.foreignSources = {
					source_table: ref.source_table,
					source_schema: ref.source_schema,
					target_schema: ref.target_schema,
					target_table: ref.target_table,
					source_column: ref.source_column,
					target_column: ref.target_column,
				};
			}

			if (this.dialect.isUnique && this.dialect.isUnique(ref)) {
				ref.isUnique = true;
			}

			if (this.dialect.isPrimaryKey && this.dialect.isPrimaryKey(ref)) {
				ref.isPrimaryKey = true;
			}

			if (this.dialect.isSerialKey && this.dialect.isSerialKey(ref)) {
				ref.isSerialKey = true;
			}

			this.foreignKeys[table] = this.foreignKeys[table] || {};
			this.foreignKeys[table][ref.source_column] = {...this.foreignKeys[table][ref.source_column], ...ref};
		}
	}

	async buildIndexes(table: any) {
		const sql = this.dialect.getIndexesQuery(table, this.options.database ?? '');
		const results = await this.sequelize.query(sql, {
			type: QueryTypes.SELECT,
			raw: true,
		}) as Record<string, any>[];

		let indexes: Index[] = [];
		if (this.options.dialect === "sqlite") {
			indexes = results.reduce((arr: Index[], row) => {
				const match = row.sql.match(/CREATE(\s+UNIQUE)?\s+INDEX\s+(\S+)\s+ON\s+(\S+)\s*\(([^)]+)\)/i);
				const index: Index = {
					name: row.name,
					fields: match[3].split(",").map((f: string) => f.trim()),
				};
				arr.push(index);
				return arr;
			}, []);
		} else {

		 indexes = Object.values(results.reduce((obj, row) => {
				if (!obj[row.name]) {
					obj[row.name] = {
						name: row.name,
						type: row.type,
						fields: [],
					};
				}
				obj[row.name].fields.push(row.field);
				return obj;
			}, {}));
		}

		this.indexes[table] = indexes;
	}

	async buildTable(table: any) {
		this.tables[table] = await this.queryInterface.describeTable(table, this.options.schema);
	}

	async build() {
		let tables = [];
		if ((this.options.dialect === "postgres" && this.options.schema) || ["mysql", "mssql"].includes(this.options.dialect ?? '')) {
			const showTablesSql = this.dialect.showTablesQuery!(this.options);
			tables = await this.sequelize.query(showTablesSql, {
				raw: true,
				type: QueryTypes.SHOWTABLES,
			});
		} else {
			tables = await this.queryInterface.showAllTables();
		}

		tables = tables.reduce((acc: string[], i: any) => {
			if (i.tableName) {
				return acc.concat(i.tableName);
			}
			return acc.concat(i);
		}, []);

		if (this.options.tables) {
			if (this.options.tables instanceof RegExp) {
				tables = tables.filter((tn: string) => (this.options.tables as RegExp).test(tn));
			} else {
				tables = tables.filter((tn: string) => (this.options.tables as string[]).includes(tn.toLowerCase()));
			}
		} else if (this.options.skipTables) {
			if (this.options.skipTables instanceof RegExp) {
				tables = tables.filter((tn: string) => !(this.options.skipTables as RegExp).test(tn));
			} else {
				tables = tables.filter((tn: string) => !(this.options.skipTables as string[]).includes(tn.toLowerCase()));
			}
		}

		if (tables.length > 0) {
			await new Promise<void>((resolve, reject) => {
				let lastUpdate: number|undefined;
				const precision = Math.max(`${tables.length}`.length - 2, 0);
				const pool = new DeferredPool({max: this.maxDeferredQueries});
				pool.onUpdate(() => {
					if (pool.percent !== lastUpdate) {
						lastUpdate = pool.percent;
						if (pool.successful >= tables.length) {
							if (!this.options.quiet) {
								clearLine(process.stdout, 0);
								cursorTo(process.stdout, 0);
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
				pool.onError((ex: Error) => {
					if (!this.options.quiet) {
						clearLine(process.stdout, 0);
						cursorTo(process.stdout, 0);
					}
					reject(ex);
				});
				pool.add(tables.map((t: any) => async () => {
					if (this.options.foreignKeys) {
						await this.buildForeignKeys(t);
					}
					if (this.options.indexes) {
						await this.buildIndexes(t);
					}
					await this.buildTable(t);
				}));
			});
		}
	}

	generateText(table : string, indent: any) {
		let text = "";

		text += "module.exports = function (sequelize, DataTypes) {\n";
		text += `${indent(1)}return sequelize.define("${table}", {\n`;

		let createdAt = false;
		let updatedAt = false;
		const {additional} = this.options;

		const fields = Object.keys(this.tables[table]);
		if (this.options.sort) {
			fields.sort();
		}
		fields.forEach((field) => {
			const fieldValue = this.tables[table][field];
			if (field === "createdAt") {
				createdAt = true;
			}
			if (field === "updatedAt") {
				updatedAt = true;
			}
			if (additional && typeof additional.timestamps !== "undefined" && additional.timestamps) {
				if ((additional.createdAt && field === "createdAt" || additional.createdAt === field)
            || (additional.updatedAt && field === "updatedAt" || additional.updatedAt === field)
            || (additional.deletedAt && field === "deletedAt" || additional.deletedAt === field)) {
					return;
				}
			}
			// Find foreign key
			const foreignKey = this.foreignKeys[table] && this.foreignKeys[table][field] ? this.foreignKeys[table][field] : null;

			if (typeof foreignKey === "object") {
				fieldValue.foreignKey = foreignKey;
			}

			if (field === "id") {
				// 'id' field must be a primary key
				// this fixes view models with an id column
				fieldValue.primaryKey = true;
			}

			// column's attributes
			const fieldName = field.match(/^\d|\W/) ? `"${field}"` : field;
			text += `${indent(2)}${fieldName}` + ": {\n";

			// Serial key for postgres...
			let defaultVal = fieldValue.defaultValue;

			// ENUMs for postgres...
			if (fieldValue.type === "USER-DEFINED" && !!fieldValue.special) {
				fieldValue.type = `ENUM(${fieldValue.special.map((f: string) => `"${f}"`).join(", ")})`;
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
				// We don't need the special attribute from postgresql describe table..
				if (attr === "special") {
					return;
				} else if (attr === "autoIncrement") {
					if (!hasAutoIncrement && attrValue) {
						hasAutoIncrement = true;
						text += `${indent(3)}autoIncrement: true`;
					} else {
						return;
					}
				} else if (attr === "foreignKey") {
					if (isSerialKey) {
						if (!hasAutoIncrement) {
							hasAutoIncrement = true;
							text += `${indent(3)}autoIncrement: true`;
						} else {
							return;
						}
					} else if (foreignKey && foreignKey.isForeignKey) {
						text += `${indent(3)}references: {\n`;
						if (this.options.schema) {
							text += `${indent(4)}model: {\n`;
							text += `${indent(5)}tableName: "${attrValue.foreignSources.target_table}",\n`;
							text += `${indent(5)}schema: "${attrValue.foreignSources.target_schema}"\n`;
							text += `${indent(4)}},\n`;
						} else {
							text += `${indent(4)}model: "${attrValue.foreignSources.target_table}",\n`;
						}
						text += `${indent(4)}key: "${attrValue.foreignSources.target_column}"\n`;
						text += `${indent(3)}}`;
					} else {
						return;
					}
				} else if (attr === "primaryKey") {
					if (attrValue === true && (!fieldValue.foreignKey || (fieldValue.foreignKey && fieldValue.foreignKey.isPrimaryKey))) {
						text += `${indent(3)}primaryKey: true`;
					} else {
						return;
					}
				} else if (attr === "allowNull") {
					text += `${indent(3)}${attr}: ${attrValue}`;
				} else if (attr === "defaultValue") {
					if (this.options.dialect === "mssql" && defaultVal && defaultVal.toLowerCase() === "(newid())") {
						// disable adding "default value" attribute for UUID fields if generating for MS SQL
						defaultVal = null;
					}

					let val = defaultVal;

					if (isSerialKey) {
						return;
					}

					// mySql Bit fix
					if (fieldValue.type.toLowerCase() === "bit(1)") {
						val = defaultVal === "b'1'" ? 1 : 0;
					} else if (this.options.dialect === "mssql" && fieldValue.type.toLowerCase() === "bit") {
						// mssql bit fix
						val = defaultVal === "((1))" ? 1 : 0;
					}

					if (typeof defaultVal === "string") {
						const fieldType = fieldValue.type.toLowerCase();
						if (defaultVal.match(/^\(?\w+\(\)\)?$/)) {
							val = `sequelize.fn("${defaultVal.replace(/[()]/g, "")}")`;
						} else if (fieldType.indexOf("date") === 0 || fieldType.indexOf("timestamp") === 0) {
							if (["current_timestamp", "current_date", "current_time", "localtime", "localtimestamp"].includes(defaultVal.toLowerCase())) {
								val = `sequelize.literal("${defaultVal}")`;
							} else {
								val = `"${val}"`;
							}
						} else {
							val = `"${val}"`;
						}
					}

					if (defaultVal === null || typeof defaultVal === "undefined") {
						return;
					}

					if (typeof val === "string") {
						if (!val.match(/^sequelize\.[^(]+\(.*\)$/)) {
							val = escapeSqlString(val.replace(/^"+|"+$/g, ""), null, this.options.dialect ?? '');
						}

						// don't prepend N for MSSQL when building models...
						val = val.replace(/^N/, "");
						// use double quotes
						val = val.replace(/^'(.*)'$/, "\"$1\"");
					}

					text += `${indent(3)}${attr}: ${val}`;

				} else if (attr === "type") {
					const _attr = (attrValue || "").toLowerCase();
					const length = () => {
						const l = attrValue.match(/\((.+?)\)/);
						if (!l) {
							return "";
						}

						const lengths = l[1].split(",").map((n: string) => {
							const len = n.trim().replace(/^'(.*)'$/, "\"$1\"").replace(/\\'/g, "'");
							if (len.match(/[^-.\d]/) && len.match(/^[^"]/)) {
								return `"${len}"`;
							}
							return len;
						});

						return `(${lengths.join(", ")})`;
					};
					let val = `"${attrValue}"`;
					let match = null;

					if (_attr.match(/^(?:enum|set)/)) {
						val = `DataTypes.ENUM${length()}`;
					} else if (_attr.match(/^varchar/)) {
						val = `DataTypes.STRING${length()}`;

						if (_attr.match(/binary/)) {
							val += ".BINARY";
						}
					} else if (_attr.match(/^(string|varying|nvarchar|xml)/)) {
						val = "DataTypes.STRING";
					} else if (_attr.match(/^(?:n)?char/)) {
						val = `DataTypes.CHAR${length()}`;
					} else if (match = _attr.match(/^(?:(tiny|medium|long)?text|ntext$)/)) { // eslint-disable-line no-cond-assign
						const size = match[1] ? `("${match[1]}")` : "";
						val = `DataTypes.TEXT${size}`;
					} else if (match = _attr.match(/^(?:tiny|small|medium|big)?int/)) { // eslint-disable-line no-cond-assign
						const int = {
							tinyint: "TINYINT",
							smallint: "SMALLINT",
							mediumint: "MEDIUMINT",
							int: "INTEGER",
							bigint: "BIGINT",
						};
						val = `DataTypes.${int[match[0] as keyof typeof int]}${length()}`;

						if (_attr.match(/unsigned/)) {
							val += ".UNSIGNED";
						}

						if (_attr.match(/zerofill/)) {
							val += ".ZEROFILL";
						}
					} else if (_attr.match(/^(?:float8|double|numeric)/)) {
						val = `DataTypes.DOUBLE${length()}`;
					} else if (_attr.match(/^float4?/)) {
						val = `DataTypes.FLOAT${length()}`;
					} else if (_attr.match(/^(?:decimal|money)/)) {
						val = `DataTypes.DECIMAL${length()}`;
					} else if (_attr.match(/^real/)) {
						val = `DataTypes.REAL${length()}`;
					} else if (_attr.match(/^(?:boolean|bit(?:\(1\))?)$/)) {
						val = "DataTypes.BOOLEAN";
					} else if (match = _attr.match(/^(?:(tiny|medium|long)?blob|(?:var)?binary|image)/)) { // eslint-disable-line no-cond-assign
						const size = match[1] ? `("${match[1]}")` : "";
						val = `DataTypes.BLOB${size}`;
					} else if (_attr.match(/^date$/)) {
						val = "DataTypes.DATEONLY";
					} else if (_attr.match(/^(?:(?:small)?date|timestamp)/)) {
						val = "DataTypes.DATE";
					} else if (_attr.match(/^time/)) {
						val = "DataTypes.TIME";
					} else if (_attr.match(/^(?:uuid|uniqueidentifier)/)) {
						val = "DataTypes.UUIDV4";
					} else if (_attr.match(/^jsonb/)) {
						val = "DataTypes.JSONB";
					} else if (_attr.match(/^json/)) {
						val = "DataTypes.JSON";
					} else if (_attr.match(/^array/)) {
						val = "DataTypes.ARRAY";
					} else if (_attr.match(/^geometry/)) {
						val = "DataTypes.GEOMETRY";
					}
					text += `${indent(3)}${attr}: ${val}`;
				} else if (attr === "comment" && attrValue === null) {
					return;
				} else {
					try {
						text += `${indent(3)}${attr}: ${JSON.stringify(attrValue)}`;
					} catch (ex) { // eslint-disable-line no-unused-vars
						// skip attr
					}
				}

				text += ",";
				text += "\n";
			});

			if (isUnique) {
				text += `${indent(3)}unique: true,\n`;
			}

			text += `${indent(2)}},\n`;
		});

		text += `${indent(1)}}, {\n`;

		text += `${indent(2)}tableName: "${table}",\n`;

		if (this.options.schema) {
			text += `${indent(2)}schema: "${this.options.schema}",\n`;
		}

		// if additional does not exist or timestamps is not set and timestamp columns do not exist
		if ((!additional || typeof additional.timestamps === "undefined") && !createdAt && !updatedAt) {
			text += `${indent(2)}timestamps: false,\n`;
		}

		// conditionally add additional options to tag on to orm objects
		if (additional) {
			for (const key in additional) {
				try {
					const keyName = key.match(/^\d|\W/) ? `"${key}"` : key;
					const value = JSON.stringify(additional[key as keyof AdditionalOptions]);
					text += `${indent(2)}${keyName}: ${value},\n`;
				} catch (ex) { // eslint-disable-line no-unused-vars
					// eslint-disable-next-line no-console
					console.error(`Can't add additional property '${key}'`);
					// JSON.stringify failed, Don't add this property. Should this throw an error?
				}
			}
		}

		if (this.indexes[table] && this.indexes[table].length > 0) {
			text += `${indent(2)}indexes: [\n`;
			this.indexes[table].forEach((index) => {
				text += `${indent(3)}{\n`;
				text += `${indent(4)}name: "${index.name}",\n`;
				if (index.type) {
					text += `${indent(4)}type: "${index.type}",\n`;
				} else {
					text += `${indent(4)}method: "${index.type}",\n`;
				}
				text += `${indent(4)}fields: [${index.fields.map(f => `"${f.trim()}"`).join(", ")}],\n`;
				text += `${indent(3)}},\n`;
			});
			text += `${indent(2)}],\n`;
		}

		text += `${indent(1)}});\n`;
		text += "};\n";

		return text;
	}

	async run() {
		this.startedAt = Date.now();
		await this.build();

		let spaces = "";
		for (let x = 0; x < (this.options.indentation ?? 1); ++x) {
			spaces += (this.options.spaces === true ? " " : "\t");
		}
		const indent = (level: number) => spaces.repeat(level);

		const tables = Object.keys(this.tables);
		const precision = Math.max(`${tables.length}`.length - 2, 0);
		for (let i = 0; i < tables.length; i++) {
			const table = tables[i];
			if (!this.options.quiet) {
				const percent = (i / tables.length * 100).toFixed(precision);
				process.stdout.write(`\rgenerating... ${percent}%`);
			}
			this.text[table] = this.generateText(table, indent);
		}
		if (!this.options.quiet) {
			clearLine(process.stdout, 0);
			cursorTo(process.stdout, 0);
		}

		await this.sequelize.close();

		if (this.options.directory) {
			await this.write();
		}
		this.finishedAt = Date.now();
		if (!this.options.quiet) {
			// eslint-disable-next-line no-console
			console.log("Done", `${(this.finishedAt - this.startedAt) / 1000}s`);
		}
	}

	async write() {

		const mkdirp = async (directory: string) => {
			// eslint-disable-next-line no-param-reassign
			directory = resolve(directory);
			try {
				await mkdir(directory);
			} catch (ex: any) {
				if (ex.code === "ENOENT") {
					await mkdirp(dirname(directory));
					await mkdirp(directory);
				} else {
					const stats = await stat(directory);
					if (!stats.isDirectory()) {
						throw ex;
					}
				}
			}
		};

		await mkdirp(this.options.directory ?? '');

		const tables = Object.keys(this.text);

		if (tables.length > 0) {
			await new Promise<void>((resolve, reject) => {
				let lastUpdate: number | null = null;
				const precision = Math.max(`${tables.length}`.length - 2, 0);
				const pool = new DeferredPool({retry: 0});
				pool.onUpdate(() => {
					if (pool.percent !== lastUpdate) {
						lastUpdate = pool.percent;
						if (pool.successful >= tables.length) {
							if (!this.options.quiet) {
								clearLine(process.stdout, 0);
								cursorTo(process.stdout, 0);
							}
							resolve();
						} else {
							if (!this.options.quiet) {
								const percent = pool.percent.toFixed(precision);
								process.stdout.write(`\rwriting... ${percent}%`);
							}
						}
					}
				});
				pool.onError((ex: Error) => {
					if (!this.options.quiet) {
						clearLine(process.stdout, 0);
						cursorTo(process.stdout, 0);
					}
					reject(ex);
				});
				pool.add(tables.map((t) => async () => {
					await this.writeTable(t, this.text[t]);
				}));
			});
		}
	}

	async writeTable(table: string, text: string) {
		const file = resolve(join(this.options.directory ?? '', `${table}.js`));
		const flag = this.options.overwrite ? "w" : "wx";
		try {
			await writeFile(file, text, {flag, encoding: "utf8"});
		} catch (err: any) {
			if (err.code === "EEXIST") {
				const data = await readFile(file, {encoding: "utf8"});
				if (data !== text) {
					throw new Error(`${table} changed but already exists`);
				}
			} else {
				throw err;
			}
		}
	}
}

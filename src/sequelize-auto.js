const fs = require("fs");
const path = require("path");
const util = require("util");
const readline = require("readline");
const Sequelize = require("sequelize");
const {QueryTypes} = Sequelize;
const dialects = require("./dialects");
const SqlString = require("./sql-string");
const DefferredPool = require("./defferred-pool");

const mkdirAsync = util.promisify(fs.mkdir);
const statAsync = util.promisify(fs.stat);
const writeFileAsync = util.promisify(fs.writeFile);
const readFileAsync = util.promisify(fs.readFile);

class AutoSequelize {

	constructor(database, username, password, options) {
		if (database instanceof Sequelize) {
			this.sequelize = database;
			if (typeof username === "object") {
				// eslint-disable-next-line no-param-reassign
				options = username;
			}
		} else {
			if (!options) {
				// eslint-disable-next-line no-param-reassign
				options = {};
			}

			if (options.dialect === "sqlite" && !options.storage) {
				options.storage = database;
			} else if (options.dialect === "mssql") {
				const dialectOptions = options.dialectOptions || {};
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

		this.queryInterface = this.sequelize.getQueryInterface();
		this.text = {};
		this.tables = {};
		this.indexes = {};
		this.foreignKeys = {};
		this.maxDefferredQueries = (options.dialect === "mysql" ? 10 : 100);
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
			includeViews: true,
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

	async buildForeignKeys(table) {

		const sql = this.dialect.getForeignKeysQuery(table, this.options.database);

		const results = await this.sequelize.query(sql, {
			type: QueryTypes.SELECT,
			raw: true,
		});

		for (let ref of results) {
			if (this.options.dialect === "sqlite") {
				// map sqlite's PRAGMA results
				ref = Object.keys(ref).reduce((acc, key) => {
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

	async buildIndexes(table) {
		const sql = this.dialect.getIndexesQuery(table, this.options.database);
		const results = await this.sequelize.query(sql, {
			type: QueryTypes.SELECT,
			raw: true,
		});

		let indexes = [];
		if (this.options.dialect === "sqlite") {
			indexes = results.reduce((arr, row) => {
				const match = row.sql.match(/CREATE(\s+UNIQUE)?\s+INDEX\s+(\S+)\s+ON\s+(\S+)\s*\(([^)]+)\)/i);
				const index = {
					name: row.name,
					fields: match[3].split(",").map(f => f.trim()),
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

	async buildTable(table) {
		this.tables[table] = await this.queryInterface.describeTable(table, this.options.schema);
	}

	async build() {
		let tables = [];
		if ((this.options.dialect === "postgres" && this.options.schema) || ["mysql", "mssql"].includes(this.options.dialect)) {
			const showTablesSql = this.dialect.showTablesQuery(this.options);
			tables = await this.sequelize.query(showTablesSql, {
				raw: true,
				type: QueryTypes.SHOWTABLES,
			});
		} else {
			tables = await this.queryInterface.showAllTables();
		}

		tables = tables.reduce((acc, i) => {
			if (i.tableName) {
				return acc.concat(i.tableName);
			}
			return acc.concat(i);
		}, []);

		if (this.options.tables) {
			if (this.options.tables instanceof RegExp) {
				tables = tables.filter(tn => this.options.tables.test(tn));
			} else {
				tables = tables.filter(tn => this.options.tables.includes(tn.toLowerCase()));
			}
		} else if (this.options.skipTables) {
			if (this.options.skipTables instanceof RegExp) {
				tables = tables.filter(tn => !this.options.skipTables.test(tn));
			} else {
				tables = tables.filter(tn => !this.options.skipTables.includes(tn.toLowerCase()));
			}
		}

		if (tables.length > 0) {
			await new Promise((resolve, reject) => {
				let lastUpdate = null;
				const precision = Math.max(`${tables.length}`.length - 2, 0);
				const pool = new DefferredPool({max: this.maxDefferredQueries});
				pool.onUpdate(() => {
					if (pool.percent !== lastUpdate) {
						lastUpdate = pool.percent;
						if (pool.successful >= tables.length) {
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
				pool.onError((ex) => {
					if (!this.options.quiet) {
						readline.clearLine(process.stdout, 0);
						readline.cursorTo(process.stdout, 0);
					}
					reject(ex);
				});
				pool.add(tables.map((t) => async () => {
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

	generateText(table, indent) {
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
							val = SqlString.escape(val.replace(/^"+|"+$/g, ""), null, this.options.dialect);
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

						const lengths = l[1].split(",").map(n => {
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
						val = `DataTypes.${int[match[0]]}${length()}`;

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
					} catch (ex) {
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
					const value = JSON.stringify(additional[key]);
					text += `${indent(2)}${keyName}: ${value},\n`;
				} catch (ex) {
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
		for (let x = 0; x < this.options.indentation; ++x) {
			spaces += (this.options.spaces === true ? " " : "\t");
		}
		const indent = (level) => spaces.repeat(level);

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
			readline.clearLine(process.stdout, 0);
			readline.cursorTo(process.stdout, 0);
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

		const mkdirp = async (directory) => {
			// eslint-disable-next-line no-param-reassign
			directory = path.resolve(directory);
			try {
				await mkdirAsync(directory);
			} catch (err) {
				if (err.code === "ENOENT") {
					await mkdirp(path.dirname(directory));
					await mkdirp(directory);
				} else {
					const stats = await statAsync(directory);
					if (!stats.isDirectory()) {
						throw err;
					}
				}
			}
		};

		await mkdirp(this.options.directory);

		const tables = Object.keys(this.text);

		if (tables.length > 0) {
			await new Promise((resolve, reject) => {
				let lastUpdate = null;
				const precision = Math.max(`${tables.length}`.length - 2, 0);
				const pool = new DefferredPool({retry: 0});
				pool.onUpdate(() => {
					if (pool.percent !== lastUpdate) {
						lastUpdate = pool.percent;
						if (pool.successful >= tables.length) {
							if (!this.options.quiet) {
								readline.clearLine(process.stdout, 0);
								readline.cursorTo(process.stdout, 0);
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
				pool.onError((ex) => {
					if (!this.options.quiet) {
						readline.clearLine(process.stdout, 0);
						readline.cursorTo(process.stdout, 0);
					}
					reject(ex);
				});
				pool.add(tables.map((t) => async () => {
					await this.writeTable(t, this.text[t]);
				}));
			});
		}
	}

	async writeTable(table, text) {
		const file = path.resolve(path.join(this.options.directory, `${table}.js`));
		const flag = this.options.overwrite ? "w" : "wx";
		try {
			await writeFileAsync(file, text, {flag, encoding: "utf8"});
		} catch (err) {
			if (err.code === "EEXIST") {
				const data = await readFileAsync(file, {encoding: "utf8"});
				if (data !== text) {
					throw new Error(`${table} changed but already exists`);
				}
			} else {
				throw err;
			}
		}
	}
}

module.exports = AutoSequelize;

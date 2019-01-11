const fs = require("fs");
const path = require("path");
const util = require("util");
const Sequelize = require("sequelize");
const dialects = require("./dialects");
const SqlString = require("./sql-string");
const DefferredPool = require("./defferred-pool");

const mkdirAsync = util.promisify(fs.mkdir);
const statAsync = util.promisify(fs.stat);
const writeFileAsync = util.promisify(fs.writeFile);
const readFileAsync = util.promisify(fs.readFile);

class AutoSequelize {

	constructor(database, username, password, options = {}) {
		this.maxDefferredQueries = 100;
		if (options.dialect === "sqlite" && !options.storage) {
			options.storage = database;
		} else if (options.dialect === "mssql") {
			const dialectOptions = options.dialectOptions || {};
			options.dialectOptions = {
				requestTimeout: 0,
				connectTimeout: 1000 * 60 * 1,
				...dialectOptions,
			};
			const pool = options.pool || {};
			options.pool = {
				max: 100,
				// 1 min
				acquire: 1000 * 60 * 1,
				...pool,
			};
		} else if (options.dialect === "mysql") {
			this.maxDefferredQueries = 10;
			const pool = options.pool || {};
			options.pool = {
				max: 10,
				// 1 min
				acquire: 1000 * 60 * 1,
				...pool,
			};
		}

		if (database instanceof Sequelize) {
			this.sequelize = database;
		} else {
			this.sequelize = new Sequelize(database, username, password, options);
		}

		this.queryInterface = this.sequelize.getQueryInterface();
		this.text = {};
		this.tables = {};
		this.indexes = {};
		this.foreignKeys = {};
		this.dialect = dialects[this.sequelize.options.dialect];

		this.options = {
			spaces: false,
			indentation: 1,
			directory: "./models",
			additional: {},
			overwrite: false,
			tables: null,
			skipTables: null,
			foreignKeys: true,
			indexes: true,
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

		const sql = this.dialect.getForeignKeysQuery(table, this.sequelize.config.database);

		const results = await this.sequelize.query(sql, {
			type: this.sequelize.QueryTypes.SELECT,
			raw: true
		});

		for (let ref of results) {
			if (this.sequelize.options.dialect === "sqlite") {
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
				source_schema: this.sequelize.options.database,
				target_schema: this.sequelize.options.database,
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
		const sql = this.dialect.getIndexesQuery(table, this.sequelize.config.database);
		const results = await this.sequelize.query(sql, {
			type: this.sequelize.QueryTypes.SELECT,
			raw: true
		});

		let indexes = [];
		if (this.sequelize.options.dialect === "sqlite") {
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
		if (this.options.dialect === "postgres" && this.options.schema) {
			const showTablesSql = this.dialect.showTablesQuery(this.options.schema);
			tables = await this.sequelize.query(showTablesSql, {
				raw: true,
				type: this.sequelize.QueryTypes.SHOWTABLES
			});
			tables = tables.reduce((acc, i) => {
				return acc.concat(i);
			}, []);
		} else {
			tables = await this.queryInterface.showAllTables();
		}

		if (this.sequelize.options.dialect === "mssql") {
			tables = tables.map(t => t.tableName);
		}

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
							process.stdout.clearLine();
							process.stdout.cursorTo(0);
							resolve();
						} else {
							const percent = pool.percent.toFixed(precision);
							process.stdout.write(`\rbuilding... ${percent}%`);
						}
					}
				});
				pool.onError((ex) => {
					process.stdout.clearLine();
					process.stdout.cursorTo(0);
					reject(ex);
				});
				pool.add(tables.map((t) => async () => {
					if (this.options.foreignKeys) {
						// FIXME: mysql foreign keys query takes about 10s per table
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

		text += "module.exports = function(sequelize, DataTypes) {\n";
		text += `${indent(1)}return sequelize.define("${table}", {\n`;

		let createdAt = false;
		let updatedAt = false;
		const {additional} = this.options;

		const fields = Object.keys(this.tables[table]);
		fields.forEach((field) => {
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
				this.tables[table][field].foreignKey = foreignKey;
			}

			if (field === "id") {
				// 'id' field must be a primary key
				// this fixes view models with an id column
				this.tables[table][field].primaryKey = true;
			}

			// column's attributes
			const fieldName = field.match(/^\d|\W/) ? `"${field}"` : field;
			text += `${indent(2)}${fieldName}` + ": {\n";

			// Serial key for postgres...
			let defaultVal = this.tables[table][field].defaultValue;

			// ENUMs for postgres...
			if (this.tables[table][field].type === "USER-DEFINED" && !!this.tables[table][field].special) {
				this.tables[table][field].type = `ENUM(${this.tables[table][field].special.map((f) => `"${f}"`).join(", ")})`;
			}

			const isUnique = this.tables[table][field].foreignKey && this.tables[table][field].foreignKey.isUnique;

			let hasAutoIncrement = false;

			const attrs = Object.keys(this.tables[table][field]);
			attrs.forEach((attr) => {
				const isSerialKey = this.tables[table][field].foreignKey && this.dialect.isSerialKey && this.dialect.isSerialKey(this.tables[table][field].foreignKey);

				// We don't need the special attribute from postgresql describe table..
				if (attr === "special") {
					return;
				} else if (attr === "autoIncrement") {
					if (!hasAutoIncrement && this.tables[table][field][attr]) {
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
							text += `${indent(5)}tableName: "${this.tables[table][field][attr].foreignSources.target_table}",\n`;
							text += `${indent(5)}schema: "${this.tables[table][field][attr].foreignSources.target_schema}"\n`;
							text += `${indent(4)}},\n`;
						} else {
							text += `${indent(4)}model: "${this.tables[table][field][attr].foreignSources.target_table}",\n`;
						}
						text += `${indent(4)}key: "${this.tables[table][field][attr].foreignSources.target_column}"\n`;
						text += `${indent(3)}}`;
					} else {
						return;
					}
				} else if (attr === "primaryKey") {
					if (this.tables[table][field][attr] === true && (!this.tables[table][field].foreignKey || (this.tables[table][field].foreignKey && this.tables[table][field].foreignKey.isPrimaryKey))) {
						text += `${indent(3)}primaryKey: true`;
					} else {
						return;
					}
				} else if (attr === "allowNull") {
					text += `${indent(3)}${attr}: ${this.tables[table][field][attr]}`;
				} else if (attr === "defaultValue") {
					if (this.sequelize.options.dialect === "mssql" && defaultVal && defaultVal.toLowerCase() === "(newid())") {
						// disable adding "default value" attribute for UUID fields if generating for MS SQL
						defaultVal = null;
					}

					let val_text = defaultVal;

					if (isSerialKey) {
						return;
					}

					// mySql Bit fix
					if (this.tables[table][field].type.toLowerCase() === "bit(1)") {
						val_text = defaultVal === "b'1'" ? 1 : 0;
					} else if (this.sequelize.options.dialect === "mssql" && this.tables[table][field].type.toLowerCase() === "bit") {
						// mssql bit fix
						val_text = defaultVal === "((1))" ? 1 : 0;
					}

					if (typeof defaultVal === "string") {
						const field_type = this.tables[table][field].type.toLowerCase();
						if (defaultVal.endsWith("()")) {
							val_text = `sequelize.fn("${defaultVal.replace(/\(\)$/, "")}")`;
						} else if (field_type.indexOf("date") === 0 || field_type.indexOf("timestamp") === 0) {
							if (["current_timestamp", "current_date", "current_time", "localtime", "localtimestamp"].includes(defaultVal.toLowerCase())) {
								val_text = `sequelize.literal("${defaultVal}")`;
							} else {
								val_text = `"${val_text}"`;
							}
						} else {
							val_text = `"${val_text}"`;
						}
					}

					if (defaultVal === null || typeof defaultVal === "undefined") {
						return;
					}

					if (typeof val_text === "string" && !val_text.match(/^sequelize\.[^(]+\(.*\)$/)) {
						val_text = SqlString.escape(val_text.replace(/^"+|"+$/g, ""), null, this.options.dialect);
					}

					// don't prepend N for MSSQL when building models...
					val_text = val_text.replace(/^N/, "");
					// use double quotes
					val_text = val_text.replace(/^'(.*)'$/, "\"$1\"");
					text += `${indent(3)}${attr}: ${val_text}`;

				} else if (attr === "type" && this.tables[table][field][attr].indexOf("ENUM") === 0) {
					text += `${indent(3)}${attr}: DataTypes.${this.tables[table][field][attr]}`;
				} else {
					const _attr = (this.tables[table][field][attr] || "").toLowerCase();
					const length = (reg, m = 0) => {
						const l = _attr.match(reg);
						return l ? l[m] : "";
					};
					let val = `"${this.tables[table][field][attr]}"`;
					let match = null;

					if (_attr.match(/^varchar/)) {
						val = `DataTypes.STRING${length(/\(\d+\)/)}`;

						if (_attr.match(/binary/)) {
							val += ".BINARY";
						}
					} else if (_attr.match(/^string|varying|nvarchar/)) {
						val = "DataTypes.STRING";
					} else if (_attr.match(/^char/)) {
						val = `DataTypes.CHAR${length(/\(\d+\)/)}`;
					} else if (_attr.match(/text|ntext$/)) {
						val = "DataTypes.TEXT";
					} else if (match = _attr.match(/^(tinyint|smallint|mediumint|int|bigint)/)) { // eslint-disable-line no-cond-assign
						const int = {
							tinyint: "TINYINT",
							smallint: "SMALLINT",
							mediumint: "MEDIUMINT",
							int: "INTEGER",
							bigint: "BIgINT",
						};
						val = `DataTypes.${int[match[0]]}${length(/\(\d+\)/)}`;

						if (_attr.match(/unsigned/)) {
							val += ".UNSIGNED";
						}

						if (_attr.match(/zerofill/)) {
							val += ".ZEROFILL";
						}
					} else if (_attr.match(/^(float|float4)/)) {
						val = `DataTypes.FLOAT${/\(\d+(,\s?\d+)?\)/}`;
					} else if (_attr.match(/^(float8|double precision|numeric)/)) {
						val = `DataTypes.DOUBLE${/\(\d+(,\s?\d+)?\)/}`;
					} else if (_attr.match(/^decimal/)) {
						val = `DataTypes.DECIMAL${/\(\d+,\s?\d+\)/}`;
					} else if (_attr.match(/^real/)) {
						val = `DataTypes.REAL${/\(\d+(,\s?\d+)?\)/}`;
					} else if (_attr === "boolean" || _attr === "bit(1)" || _attr === "bit") {
						val = "DataTypes.BOOLEAN";
					} else if (match = _attr.match(/^(tiny|medium|long)?blob/)) { // eslint-disable-line no-cond-assign
						const l = match[1] ? `(${match[1]})` : "";
						val = `DataTypes.BLOB${l}`;
					} else if (_attr === "date") {
						val = "DataTypes.DATEONLY";
					} else if (_attr.match(/^(date|timestamp)/)) {
						val = "DataTypes.DATE";
					} else if (_attr.match(/^(time)/)) {
						val = "DataTypes.TIME";
					} else if (_attr.match(/^uuid|uniqueidentifier/)) {
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
			const percent = (i / tables.length * 100).toFixed(precision);
			process.stdout.write(`\rgenerating... ${percent}%`);
			this.text[table] = this.generateText(table, indent);
		}
		process.stdout.clearLine();
		process.stdout.cursorTo(0);

		this.sequelize.close();

		if (this.options.directory) {
			await this.write();
		}
		this.finishedAt = Date.now();
		// eslint-disable-next-line no-console
		console.log("Done", `${(this.finishedAt - this.startedAt) / 1000}s`);
	}

	async write() {

		async function mkdirp(directory) {
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
		}

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
							process.stdout.clearLine();
							process.stdout.cursorTo(0);
							resolve();
						} else {
							const percent = pool.percent.toFixed(precision);
							process.stdout.write(`\rwriting... ${percent}%`);
						}
					}
				});
				pool.onError((ex) => {
					process.stdout.clearLine();
					process.stdout.cursorTo(0);
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

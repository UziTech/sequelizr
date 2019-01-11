const SequelizeAuto = require("./sequelize-auto.js");
const Sequelize = require("sequelize");
const path = require("path");
const fs = require("fs");
const util = require("util");
const readdirAsync = util.promisify(fs.readdir);
const readFileAsync = util.promisify(fs.readFile);

/**
 * Convert type string to generic type
 * @param  {string} type Type string
 * @return {string} Generic type string
 */
function convertToGenericType(type) {
	switch (type) {
		case "DATETIME2":
		case "TIMESTAMP":
		case "DATETIMEOFFSET":
			return "DATETIME";
		case "DOUBLE PRECISION":
			return "NUMERIC";
		case "INTEGER":
		case "TINYINT":
		case "SMALLINT":
			return "INT";
		case "NVARCHAR(MAX)":
			return "TEXT";
		case "NVARCHAR":
			return "VARCHAR";
		case "UUIDV4":
			return "UNIQUEIDENTIFIER";
		default:
			if (type.match(/^NVARCHAR(\(\d+\))?$/)) {
				return "VARCHAR";
			} else if (type.match(/^CHAR(\(\d+\))?$/)) {
				return "CHAR";
			}
	}
	return type;
}

/**
 * Check if models match database tables
 * @param  {Object} [options={}] Options
 * @param  {string} [options.database] Database name
 * @param  {string} [options.username] Datbase username
 * @param  {string} [options.password] Database password
 * @param  {string} [options.host] Database host
 * @param  {int} [options.port] Database port
 * @param  {string} [options.dialect] Database dialect ("mysql"|"mssql")
 * @param  {string} [options.directory] Model directory
 * @param  {Array<string>} [options.tables] Database tables
 * @param  {Object} [options.dialectOptions] Database options
 * @param  {bool|EventEmitter} [options.output] FALSE = Reject error string, TRUE(default) = Output errors to console, EventEmitter = emit "error" for each error
 * @return {Promise<void>} Resolves on success
 */
async function checkModels(options = {}) {
	const {
		database,
		username,
		password,
		host,
		port,
		dialect,
		directory,
		tables,
		dialectOptions,
	} = options;
	const output = options.output || options.output !== false;

	const auto = await downloadModels({
		database,
		username,
		password,
		host,
		port,
		dialect,
		directory: false,
		tables,
		dialectOptions,
	});


	let log = "";

	function logError(msg) {
		if (typeof output === "object" && "emit" in output) {
			if (msg.trim()) {
				output.emit("error", msg);
			}
		} else if (output) {
			// eslint-disable-next-line no-console
			console.error(msg);
		} else {
			log += msg;
		}
	}

	logError("\n");
	let isError = false;

	for (const table in auto.tables) {
		const file = path.resolve(directory, `${table}.js`);

		try {
			const text = auto.text[table];
			const data = await readFileAsync(file, {encoding: "utf8"});

			if (text !== data) {
				try {
					const dbModel = auto.tables[table];
					const model = auto.sequelize.import(file);

					const dbColumns = Object.keys(dbModel);
					dbColumns.push("id");
					dbColumns.push("createdAt");
					dbColumns.push("updatedAt");
					const columns = Object.keys(model.rawAttributes);

					columns.forEach(col => {
						if (!dbColumns.includes(col)) {
							logError(`'${table}.${col}' not in db`);
							isError = true;
						}
					});

					for (const col in dbModel) {
						if (!columns.includes(col)) {
							logError(`'${table}.${col}' not in model`);
							isError = true;
						} else {
							const type = convertToGenericType(model.rawAttributes[col].type.toString());
							const dbType = convertToGenericType(dbModel[col].type);
							if (type !== dbType) {
								logError(`'${table}.${col}' types not equal '${type}' !== '${dbType}'`);
								isError = true;
							}
						}
					}

				} catch (ex) {
					isError = true;
					if (ex.message.match(/^Cannot find module/)) {
						logError(`No model for '${table}'`);
					} else {
						logError(`'${table}' Error: ${ex.message}`);
					}
				}
				if (!isError) {
					isError = true;
					logError(`'${table}' text has changed`);
				}
			}
		} catch (ex) {
			isError = true;
			if (ex.code === "ENOENT") {
				logError(`No model for '${table}'`);
			} else {
				logError(`'${table}' Error: ${ex.message}`);
			}
		}
	}

	if (isError) {
		logError("\n");
		if (log) {
			throw new Error(log);
		}
	}
}

/**
 * Sync models with database
 * @param  {Object} [options={}] Options
 * @param  {string} [options.server] Server name
 * @param  {string} [options.database] Database name
 * @param  {string} [options.username] Datbase username
 * @param  {string} [options.password] Database password
 * @param  {string} [options.host] Database host
 * @param  {int} [options.port] Database port
 * @param  {string} [options.dialect] Database dialect ("mysql"|"mssql")
 * @param  {string} [options.directory] Model directory
 * @param  {Array<string>} [options.tables] Database tables
 * @param  {Object} [options.dialectOptions] Database options
 * @param  {bool} [options.overwrite] Drop tables before create
 * @return {Promise<void>} Resolves on success
 */
async function uploadModels(options = {}) {
	const {
		server,
		database,
		username,
		password,
		host,
		port,
		dialect,
		directory,
		tables,
		dialectOptions,
		overwrite,
	} = options;

	let files;
	try {
		files = await readdirAsync(directory);
	} catch (err) {
		if (err.code === "ENOENT") {
			throw new Error(`No models for '${server}.${database}'`);
		}
		throw new Error(`Cannot sync '${server}.${database}' models`);
	}

	const db = new Sequelize(database, username, password, {
		host,
		dialect,
		port,
		operatorsAliases: false,
		logging: false,
		dialectOptions,
	});

	try {
		for (const file of files) {
			const table = file.replace(/\.js$/, "");
			if (!tables || tables.includes(table)) {
				const model = db.import(path.resolve(directory, file));
				await model.sync({force: overwrite});
				if (!overwrite) {
					let error = null;
					try {
						await checkModels({
							database,
							username,
							password,
							host,
							port,
							dialect,
							directory,
							tables: [table],
							dialectOptions,
							output: false,
						});
					} catch (ex) {
						error = ex;
					}
					if (error) {
						throw new Error(`Cannot sync '${server}.${database}.${table}' model\n         ${error.message.trim()}`);
					}
				}
			}
		}
		await db.close();
		process.exit();
	} catch (err) {
		await db.close();
		throw err;
	}
}

/**
 * Create models from database tables
 * @param  {Object} [options={}] Options
 * @param  {string} [options.database] Database name
 * @param  {string} [options.username] Datbase username
 * @param  {string} [options.password] Database password
 * @param  {string} [options.host] Database host
 * @param  {int} [options.port] Database port
 * @param  {string} [options.dialect] Database dialect ("mysql"|"mssql")
 * @param  {bool|string} [options.directory] Model directory. FALSE = Don't create files
 * @param  {Array<string>} [options.tables] Database tables
 * @param  {Object} [options.dialectOptions] Database options
 * @param  {bool} [options.overwrite] Overwrite files if exist
 * @return {Promise<SequelizeAuto|Object>} Resolves to SequelizeAuto on success
 */
async function downloadModels(options = {}) {
	const {
		database,
		username,
		password,
		host,
		port,
		dialect,
		directory,
		tables,
		dialectOptions,
		overwrite,
	} = options;

	const auto = new SequelizeAuto(database, username, password, {
		host,
		dialect,
		directory,
		port,
		tables,
		operatorsAliases: false,
		logging: false,
		dialectOptions,
		overwrite,
	});

	await auto.run();
	return auto;
}

module.exports = {
	downloadModels,
	uploadModels,
	checkModels,
};

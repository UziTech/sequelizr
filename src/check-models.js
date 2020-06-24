const path = require("path");
const fs = require("fs");
const util = require("util");
const readFileAsync = util.promisify(fs.readFile);
const {DataTypes} = require("sequelize");
const downloadModels = require("./download-models.js");

/**
 * Convert type string to generic type
 * @param  {string} type Type string
 * @return {string} Generic type string
 */
function convertToGenericType(type) {
	const genericType = type.replace(/\(\d+\)$/, "");
	switch (genericType) {
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
			return genericType;
	}
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
 * @param  {bool} [options.includeViews] Include views along with tables
 * @param  {bool} [options.quiet] Don't output to stdout
 * @param  {bool} [options.sort] Sort fields and attributes
 * @param  {bool|EventEmitter} [options.output] FALSE = Reject error string, TRUE(default) = Output errors to console, EventEmitter = emit "error" for each error
 * @return {Promise<void>} Resolves on success
 */
async function checkModels(options = {}) {
	const {directory, ...opts} = options;
	const output = options.output || options.output !== false;
	delete opts.output;

	const auto = await downloadModels({
		...opts,
		directory: false,
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
					const model = require(file)(auto.sequelize, DataTypes);

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

module.exports = checkModels;

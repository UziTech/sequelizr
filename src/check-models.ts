import {resolve} from "node:path";
import {readFile} from "node:fs/promises";
import {DataTypes} from "sequelize";
import {downloadModels} from "./download-models.js";
import type {CheckModelsOptions, UnknownObject} from "./types.js";

/**
 * Convert type string to generic type
 */
function convertToGenericType(type: string) {
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
 */
export async function checkModels(options: CheckModelsOptions = {}) {
	const {directory, extension, ...opts} = options;
	const output = options.output || options.output !== false;
	delete opts.output;

	const auto = await downloadModels({
		...opts,
		directory: undefined,
	});


	let log = "";

	function logError(msg: string) {
		if (typeof output === "object" && "emit" in output) {
			if (msg.trim()) {
				output.emit("error", msg);
			}
		} else if (output) {
			console.error(msg);
		} else {
			log += msg;
		}
	}

	logError("\n");
	let isError = false;

	for (const table in auto.tables) {
		const file = resolve(directory ?? "", `${table}.${extension ? extension.replace(/^\./, "") : "js"}`);

		try {
			const text = auto.text[table];
			const data = await readFile(file, {encoding: "utf8"});

			if (text !== data) {
				try {
					const dbModel = auto.tables[table];
					const {default: modelFunc} = await import(file);
					const model = modelFunc(auto.sequelize, DataTypes);

					const dbColumns = Object.keys(dbModel);
					dbColumns.push("id");
					dbColumns.push("createdAt");
					dbColumns.push("updatedAt");
					const columns = Object.keys(model.rawAttributes);
					const realNameColumns = columns.map(col => {
						return "field" in model.rawAttributes[col] ? model.rawAttributes[col].field : col;
					});

					realNameColumns.forEach(col => {
						const originalColumnName = columns[realNameColumns.indexOf(col)];
						const type = convertToGenericType(model.rawAttributes[originalColumnName].type.toString());
						if (type !== "VIRTUAL") {
							if (!dbColumns.includes(col)) {
								logError(`'${table}.${col}' not in db`);
								isError = true;
							}
						}
					});

					for (const col in dbModel) {
						if (!realNameColumns.includes(col)) {
							logError(`'${table}.${col}' not in model`);
							isError = true;
						} else {
							const originalColumnName = columns[realNameColumns.indexOf(col)];
							const type = convertToGenericType(model.rawAttributes[originalColumnName].type.toString());
							const dbType = convertToGenericType((dbModel[col] as UnknownObject).type as string);
							if (type !== dbType) {
								logError(`'${table}.${col}' types not equal '${type}' !== '${dbType}'`);
								isError = true;
							}
						}
					}

				} catch (ex) {
					const err = ex instanceof Error ? ex : new Error(String(ex));
					isError = true;
					if (err.message.match(/^Cannot find module/)) {
						logError(`No model for '${table}'`);
					} else {
						logError(`'${table}' Error: ${err.message}`);
					}
				}
				if (!isError) {
					isError = true;
					logError(`'${table}' text has changed`);
				}
			}
		} catch (ex) {
			isError = true;
			if (ex instanceof Error && "code" in ex && (ex as NodeJS.ErrnoException).code === "ENOENT") {
				logError(`No model for '${table}'`);
			} else {
				logError(`'${table}' Error: ${ex instanceof Error ? ex.message : String(ex)}`);
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

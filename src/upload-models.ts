import { Sequelize, DataTypes } from "sequelize";
import {resolve} from "path";
import {readdir} from "fs/promises";
import {checkModels} from "./check-models";
import type { UploadModelsOptions } from "./types";

/**
 * Sync models with database
 */
export async function uploadModels(options: UploadModelsOptions = {}) {
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
		alter,
	} = options;

	const opts: UploadModelsOptions = {};
	const copyToOpts = [
		"quiet",
		"sort",
	] as const;
	for (const prop of copyToOpts) {
		if (prop in options) {
			opts[prop] = options[prop];
		}
	}

	let files;
	try {
		files = await readdir(directory ?? '');
	} catch (ex: any) {
		if (ex.code === "ENOENT") {
			throw new Error(`No models for '${host}.${database}'`);
		}
		throw new Error(`Cannot sync '${host}.${database}' models`);
	}

	const db = new Sequelize(database ?? '', username ?? '', password, {
		host,
		dialect,
		port,
		logging: false,
		dialectOptions,
	});

	try {
		for (const file of files) {
			const table = file.replace(/\.js$/, "");
			if (!tables || (tables instanceof RegExp && tables.test(table)) || (Array.isArray(tables) && tables.includes(table))) {
				const modelPath = resolve(directory ?? '', file);
				const {default: modelFactory} = await import(`file://${modelPath}`);
				const model = modelFactory(db, DataTypes);
				await model.sync({alter, force: overwrite});
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
							...opts,
						});
					} catch (ex: any) {
						error = ex;
					}
					if (error) {
						throw new Error(`Cannot sync '${host}.${database}.${table}' model\n         ${error.message.trim()}`);
					}
				}
			}
		}
	} finally {
		await db.close();
	}
}

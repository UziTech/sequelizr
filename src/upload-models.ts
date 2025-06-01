import { Sequelize, DataTypes } from "sequelize";
import path from "path";
import fs from "fs";
const {readdir: readdirAsync} = fs.promises;
import checkModels from "./check-models";
import type { UploadModelsOptions } from "./types";

/**
 * Sync models with database
 */
export default async function uploadModels(options = {} as UploadModelsOptions) {
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

	const opts = {} as UploadModelsOptions;
	const copyToOpts = [
		"quiet",
		"sort",
	];
	for (const prop of copyToOpts) {
		if (prop in options) {
			opts[prop as keyof UploadModelsOptions] = options[prop as keyof UploadModelsOptions];
		}
	}

	let files;
	try {
		files = await readdirAsync(directory!);
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
				const modelPath = path.resolve(directory!, file);
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
							includeViews: true,
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

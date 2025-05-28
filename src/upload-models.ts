import { Sequelize, Dialect as SequelizeDialect, Options as SequelizeOptions, DataTypes, ModelCtor, Model } from "sequelize";
import path from "path";
import fs from "fs";
import util from "util";
import checkModels, { CheckModelsOptions } from "./check-models.ts"; // Assuming CheckModelsOptions is exported

const readdirAsync = util.promisify(fs.readdir);

// Define an interface for the options accepted by uploadModels
interface UploadModelsOptions {
	database?: string;
	username?: string;
	password?: string;
	host?: string;
	port?: number;
	dialect?: SequelizeDialect;
	directory: string; // directory is mandatory
	tables?: string[];
	dialectOptions?: SequelizeOptions['dialectOptions'];
	overwrite?: boolean; // Maps to `force` in sync options
	alter?: boolean;     // Maps to `alter` in sync options
	quiet?: boolean;     // For checkModels
	sort?: boolean;      // For checkModels
	includeViews?: boolean; // For checkModels
}

// Define the type for a Sequelize model definition function
type SequelizeModelDefineCall = (sequelize: Sequelize, dataTypes: typeof DataTypes) => ModelCtor<Model<any, any>>;


/**
 * Sync models with database
 * @param  {UploadModelsOptions} [options={}] Options
 * @return {Promise<void>} Resolves on success
 */
async function uploadModels(options: UploadModelsOptions): Promise<void> {
	const {
		database,
		username,
		password,
		host,
		port,
		dialect,
		directory, // Mandatory, so should exist
		tables,
		dialectOptions,
		overwrite, // for model.sync({ force: overwrite })
		alter,     // for model.sync({ alter: alter })
	} = options;

	// Options to be passed to checkModels
	const checkModelsOpts: Partial<CheckModelsOptions> = {};
	const copyToOpts: (keyof Pick<UploadModelsOptions, "quiet" | "sort" | "includeViews">)[] = [
		"quiet",
		"sort",
		"includeViews" // includeViews is used by checkModels
	];
	for (const prop of copyToOpts) {
		if (prop in options && options[prop] !== undefined) {
			checkModelsOpts[prop] = options[prop] as any; // Cast as any, will be validated by CheckModelsOptions
		}
	}
	
	if (!directory) {
        throw new Error("Model directory must be specified.");
    }

	let files: string[];
	try {
		files = await readdirAsync(directory);
	} catch (err: any) {
		if (err.code === "ENOENT") {
			throw new Error(`No models found in directory '${directory}' for '${host || 'localhost'}.${database || ''}'.`);
		}
		throw new Error(`Cannot read directory '${directory}' to sync models for '${host || 'localhost'}.${database || ''}': ${err.message}`);
	}

	// Ensure essential DB connection options are provided if not already in dialectOptions
	const sequelizeOptions: SequelizeOptions = {
		host: host,
		dialect: dialect,
		port: port,
		logging: false, // Default to false, can be overridden by dialectOptions.logging
		dialectOptions: dialectOptions,
		... (dialectOptions || {}) // Spread dialectOptions again to ensure its logging overrides the default false
	};


	const db = new Sequelize(database || '', username || '', password || '', sequelizeOptions);

	try {
		for (const file of files) {
			// Assuming model files end with .js, as per original code.
			// If they are .ts, they'd need compilation or ts-node.
			if (!file.endsWith(".js")) {
				if(!options.quiet) console.log(`Skipping non-JS file: ${file}`);
				continue;
			}
			const table = file.replace(/\.js$/, "");
			if (!tables || tables.includes(table)) {
				// Dynamically require the model definition
				const modelDefineCall: SequelizeModelDefineCall = require(path.resolve(directory, file));
				const model = modelDefineCall(db, DataTypes); // Sequelize.DataTypes is static in v5/v6
				
				await model.sync({ alter: alter, force: overwrite });

				if (!overwrite) {
					let checkError: Error | null = null;
					try {
						const currentCheckOpts: CheckModelsOptions = {
							// These must be passed as they are part of CheckModelsOptions if not optional there
							database: database!, // Non-null assertion, assuming they are provided if check is run
							username: username,
							password: password,
							host: host,
							port: port,
							dialect: dialect,
							directory: directory, // Pass the same model directory
							tables: [table],      // Check only the current table
							dialectOptions: dialectOptions,
							output: false,        // Explicitly false to capture error programmatically
							includeViews: checkModelsOpts.includeViews === undefined ? true : checkModelsOpts.includeViews, // Default to true
							quiet: checkModelsOpts.quiet,
							sort: checkModelsOpts.sort,
						};
						await checkModels(currentCheckOpts);
					} catch (ex: any) {
						checkError = ex;
					}
					if (checkError) {
						throw new Error(`Cannot sync '${host || 'localhost'}.${database || ''}.${table}' model. Schema check failed:\n         ${checkError.message.trim()}`);
					}
				}
			}
		}
	} finally {
		await db.close();
	}
}

export default uploadModels;

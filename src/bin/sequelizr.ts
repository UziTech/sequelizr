#!/usr/bin/env node

import yargs, {Options} from "yargs";
import {hideBin} from "yargs/helpers";
import {checkModels, downloadModels, uploadModels} from "../index.js";
import {createRequire} from "node:module";
import {CheckModelsOptions, DownloadModelsOptions, UploadModelsOptions} from "../types.js";

const require = createRequire(import.meta.url);

const args = {
	host: {
		alias: ["s", "server"],
		type: "string",
		default: "localhost",
		description: "Server",
		group: "Command Options:",
	},
	database: {
		alias: ["d"],
		type: "string",
		description: "Database",
		group: "Command Options:",
	},
	tables: {
		alias: ["t"],
		type: "array",
		description: "Tables",
		group: "Command Options:",
	},
	username: {
		alias: ["u", "user"],
		type: "string",
		description: "User",
		group: "Command Options:",
	},
	password: {
		alias: ["p"],
		type: "string",
		description: "Password",
		group: "Command Options:",
	},
	port: {
		alias: ["r"],
		type: "number",
		description: "Port",
		group: "Command Options:",
	},
	dialect: {
		alias: ["l"],
		type: "string",
		choices: ["mysql", "mssql"],
		description: "Dialect",
		group: "Command Options:",
	},
	models: {
		alias: ["m", "directory"],
		type: "string",
		default: ".",
		normalize: true,
		description: "Model Directory",
		group: "Command Options:",
	},
	overwrite: {
		alias: ["o"],
		type: "boolean",
		default: false,
		group: "Command Options:",
	},
	alter: {
		alias: ["a"],
		type: "boolean",
		default: false,
		description: "Alters existing tables to fit models",
		group: "Command Options:",
	},
	quiet: {
		alias: ["q"],
		type: "boolean",
		default: false,
		description: "Build Models Silently",
		group: "Command Options:",
	},
	sort: {
		alias: ["x"],
		type: "boolean",
		default: false,
		description: "Sort fields and attributes",
		group: "Command Options:",
	},
	config: {
		alias: ["c"],
		type: "string",
		normalize: true,
		description: "Config File",
		group: "Command Options:",
	},
} as {[key: string]: Options};

yargs(hideBin(process.argv))
	.scriptName("sequelizr")
	.usage("sequelizr <cmd> [opts]")
	.command("check [opts]", "Check if models match the database tables.", (cmd) => {
		const {
			host,
			database,
			tables,
			username,
			password,
			port,
			dialect,
			models,
			quiet,
			sort,
			config,
		} = args;

		cmd
			.options({
				host,
				database,
				tables,
				username,
				password,
				port,
				dialect,
				models,
				quiet,
				sort,
				config,
			})
			.hide("version");
	}, function (argv) {
		const {
			host,
			database,
			tables,
			username,
			password,
			port,
			dialect,
			directory,
			quiet,
			sort,
			config,
		} = argv;

		const options: CheckModelsOptions = {
			host,
			database,
			tables,
			username,
			password,
			port,
			dialect,
			directory,
			quiet,
			sort,
			...(config ? require(config as string) : {}),
		};

		checkModels(options);
	})
	.command("download [opts]", "Save tables to models.", (cmd) => {
		const {
			host,
			database,
			tables,
			username,
			password,
			port,
			dialect,
			models,
			overwrite,
			quiet,
			sort,
			config,
		} = args;
		overwrite.description = "Overwrite files if they exist.";

		cmd
			.options({
				host,
				database,
				tables,
				username,
				password,
				port,
				dialect,
				models,
				overwrite,
				quiet,
				sort,
				config,
			})
			.hide("version");
	}, function (argv) {
		const {
			host,
			database,
			tables,
			username,
			password,
			port,
			dialect,
			directory,
			overwrite,
			quiet,
			sort,
			config,
		} = argv;

		const options: DownloadModelsOptions = {
			host,
			database,
			tables,
			username,
			password,
			port,
			dialect,
			directory,
			overwrite,
			quiet,
			sort,
			...(config ? require(config as string) : {}),
		};

		downloadModels(options);
	})
	.command("upload [opts]", "Create tables from models.", (cmd) => {
		const {
			host,
			database,
			tables,
			username,
			password,
			port,
			dialect,
			models,
			overwrite,
			alter,
			quiet,
			sort,
			config,
		} = args;
		overwrite.description = "Drop tables before creating them.";

		cmd
			.options({
				host,
				database,
				tables,
				username,
				password,
				port,
				dialect,
				models,
				overwrite,
				alter,
				quiet,
				sort,
				config,
			})
			.hide("version");
	}, function (argv) {
		const {
			host,
			database,
			tables,
			username,
			password,
			port,
			dialect,
			directory,
			overwrite,
			alter,
			quiet,
			sort,
			config,
		} = argv;

		const options: UploadModelsOptions = {
			host,
			database,
			tables,
			username,
			password,
			port,
			dialect,
			directory,
			overwrite,
			alter,
			quiet,
			sort,
			...(config ? require(config as string) : {}),
		};

		uploadModels(options);
	})
	.alias("help", "h")
	.alias("version", "v")
	.group(["help", "version"], "Global Options:")
	.example("sequelizr <cmd> --help", "Show args for a command.")
	.showHidden(false)
	.wrap(yargs().terminalWidth())
	.parse();

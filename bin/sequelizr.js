#!/usr/bin/env node

const yargs = require("yargs");
const sequelizr = require("../");

const args = {
	server: {
		alias: ["s", "host"],
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
};

yargs
	.scriptName("sequelizr")
	.usage("sequelizr <cmd> [opts]")
	.command("check [opts]", "Check if models match the database tables.", () => {
		const {
			server,
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
		yargs
			.options({
				server,
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
			server,
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

		const options = {
			server,
			database,
			tables,
			username,
			password,
			port,
			dialect,
			directory,
			quiet,
			sort,
			...(config ? require(config) : {}),
		};

		sequelizr.checkModels(options);
	})
	.command("download [opts]", "Save tables to models.", () => {
		const {
			server,
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
		yargs
			.options({
				server,
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
			server,
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

		const options = {
			server,
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
			...(config ? require(config) : {}),
		};

		sequelizr.downloadModels(options);
	})
	.command("upload [opts]", "Create tables from models.", () => {
		const {
			server,
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
		yargs
			.options({
				server,
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
			server,
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

		const options = {
			server,
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
			...(config ? require(config) : {}),
		};

		sequelizr.uploadModels(options);
	})
	.alias("help", "h")
	.alias("version", "v")
	.group(["help", "version"], "Global Options:")
	.example("sequelizr <cmd> --help", "Show args for a command.")
	.showHidden(false)
	.wrap(yargs.terminalWidth())
	.parse();

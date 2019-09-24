const Sequelize = require("sequelize");
const path = require("path");
const fs = require("fs");
const util = require("util");
const readdirAsync = util.promisify(fs.readdir);
const checkModels = require("./check-models.js");

/**
 * Sync models with database
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
 * @param  {bool} [options.overwrite] Drop tables before create
 * @param  {bool} [options.quiet] Don't output to stdout
 * @return {Promise<void>} Resolves on success
 */
async function uploadModels(options = {}) {
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
		quiet,
	} = options;

	let files;
	try {
		files = await readdirAsync(directory);
	} catch (err) {
		if (err.code === "ENOENT") {
			throw new Error(`No models for '${host}.${database}'`);
		}
		throw new Error(`Cannot sync '${host}.${database}' models`);
	}

	const db = new Sequelize(database, username, password, {
		host,
		dialect,
		port,
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
							quiet,
						});
					} catch (ex) {
						error = ex;
					}
					if (error) {
						throw new Error(`Cannot sync '${host}.${database}.${table}' model\n         ${error.message.trim()}`);
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

module.exports = uploadModels;

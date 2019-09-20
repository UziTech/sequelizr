const SequelizeAuto = require("./sequelize-auto.js");

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
 * @param  {bool} [options.includeViews] Include views along with tables
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
		includeViews,
	} = options;

	const auto = new SequelizeAuto(database, username, password, {
		host,
		dialect,
		directory,
		port,
		tables,
		logging: false,
		dialectOptions,
		overwrite,
		includeViews,
	});

	await auto.run();
	return auto;
}

module.exports = downloadModels;

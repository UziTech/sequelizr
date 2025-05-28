import SequelizeAuto, { SequelizeAutoOptions } from "./sequelize-auto.ts"; // Assuming SequelizeAutoOptions is exported from sequelize-auto.ts

// Define a more specific options interface for downloadModels,
// which largely overlaps with SequelizeAutoOptions but can be tailored if needed.
// For now, let's make it closely mirror what SequelizeAuto expects,
// plus the JSDoc parameters.
interface DownloadModelsOptions extends Partial<SequelizeAutoOptions> {
	// Properties explicitly mentioned in original JSDoc for downloadModels
	database?: string;
	username?: string;
	password?: string;
	host?: string;
	port?: number;
	// dialect is part of SequelizeAutoOptions
	// directory is part of SequelizeAutoOptions (as 'directory' or 'outDir')
	// tables is part of SequelizeAutoOptions
	// dialectOptions is part of SequelizeAutoOptions
	// overwrite is part of SequelizeAutoOptions
	// includeViews is part of SequelizeAutoOptions (as 'views')
	// quiet is not a direct SequelizeAuto option, but affects logging which can be controlled.
	// sort is not a direct SequelizeAuto option. This might be a custom pre/post processing step
	// or a misunderstanding of SequelizeAuto features. For now, keep it.
	quiet?: boolean; // This might translate to `logging: false` or a custom wrapper logic.
	sort?: boolean;  // This is not a standard Sequelize-Auto option.
}


/**
 * Create models from database tables
 * @param  {DownloadModelsOptions} [options={}] Options
 * @return {Promise<SequelizeAuto>} Resolves to SequelizeAuto instance on success
 */
async function downloadModels(options: DownloadModelsOptions = {}): Promise<SequelizeAuto> {
	const {
		database,
		username,
		password,
		// 'quiet' and 'sort' are not directly used by SequelizeAuto constructor in this manner.
		// 'quiet' could imply logging: false. 'sort' is not standard.
		// We should pass only valid SequelizeAutoOptions to its constructor.
		quiet, // Will be handled by setting `logging` option
		sort,  // Not a standard option, will be ignored by SequelizeAuto if passed in ...opts
		...otherOptions // These are the remaining options that should align with SequelizeAutoOptions
	} = options;

	// Construct options for SequelizeAuto, ensuring only valid ones are passed.
	const autoOptions: SequelizeAutoOptions = {
		...otherOptions, // Pass through all other relevant options
		logging: options.quiet === undefined ? console.log : (options.quiet ? false : console.log), // Default to console.log if quiet is undefined, else true/false
		// `sort` is not a standard option for SequelizeAuto constructor.
		// If it were meant to sort tables or fields, that logic would be inside SequelizeAuto or done separately.
	};

	// The SequelizeAuto constructor typically expects (database, username, password, options)
	// Or it can take a single connection URI or a Sequelize instance.
	// Let's stick to the explicit parameters for now.
	const auto = new SequelizeAuto(database, username, password, autoOptions);

	await auto.run();
	return auto;
}

export default downloadModels;

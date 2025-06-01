import SequelizeAuto from "./sequelize-auto.js";
import type { DownloadModelsOptions } from "./types";

/**
 * Create models from database tables
 */
export default async function downloadModels(options = {} as DownloadModelsOptions) {
	const {
		database,
		username,
		password,
		...opts
	} = options;

	const auto = new SequelizeAuto(database ?? '', username ?? '', password ?? '', {
		...opts,
		logging: false,
	});

	await auto.run();
	return auto;
}

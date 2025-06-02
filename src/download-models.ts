import {AutoSequelize} from "./sequelize-auto";
import type { DownloadModelsOptions } from "./types";

/**
 * Create models from database tables
 */
export async function downloadModels(options: DownloadModelsOptions = {}) {
	const {
		database,
		username,
		password,
		...opts
	} = options;

	const auto = new AutoSequelize(database ?? '', username ?? '', password, {
		...opts,
		logging: false,
	});

	await auto.run();
	return auto;
}

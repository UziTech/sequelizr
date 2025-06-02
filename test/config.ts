import { Dialect } from "sequelize";

export function getConfig(dialect?: Dialect) {
	const {env} = process;
	const seqDb = env.SEQ_DB;
	const seqUser = env.SEQ_USER;
	const seqPw = env.SEQ_PW;
	const seqHost = env.SEQ_HOST;
	const seqPort = env.SEQ_PORT ? parseInt(env.SEQ_PORT) : undefined;
	const seqPoolMax = env.SEQ_POOL_MAX ? parseInt(env.SEQ_POOL_MAX) : undefined;
	const seqPoolIdle = env.SEQ_POOL_IDLE ? parseInt(env.SEQ_POOL_IDLE) : undefined;


	switch (dialect ?? env.DIALECT) {
		case "mysql": {
			return {
				database: seqDb || "sequelizr_test",
				username: seqUser || "sequelizr_test",
				password: seqPw || "sequelizr_test",
				host: seqHost || "localhost",
				port: seqPort || 3306,
				dialect: "mysql" as Dialect,
				pool: {
					max: seqPoolMax || 5,
					idle: seqPoolIdle || 3000,
				},
			};
			break;
		}
		case "mssql": {
			return {
				database: seqDb || "sequelizr_test",
				username: seqUser || "sequelizr_test",
				password: seqPw || "sequelizr_test",
				host: seqHost || "localhost",
				port: seqPort || 1433,
				dialect: "mssql" as Dialect,
				dialectOptions: {
					options: {
						requestTimeout: 60000,
						trustServerCertificate: true,
					},
				},
				pool: {
					max: seqPoolMax || 5,
					idle: seqPoolIdle || 3000,
				},
			};
			break;
		}
		default: {
			return {
				username: seqUser || "sequelizr_test",
				password: seqPw || "sequelizr_test",
				database: seqDb || "sequelizr_test",
				host: seqHost || "localhost",
				port: seqPort,
				dialect: dialect ?? env.DIALECT as Dialect,
				pool: {
					max: seqPoolMax || 5,
					idle: seqPoolIdle || 30000,
				},
			};
		}
	}
}

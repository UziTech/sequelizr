const {env} = process;

switch (env.dialect) {
	case "mysql": {
		module.exports = {
			database: env.SEQ_MYSQL_DB || env.SEQ_DB || "sequelizr_test",
			username: env.SEQ_MYSQL_USER || env.SEQ_USER || "root",
			password: env.SEQ_MYSQL_PW || env.SEQ_PW || null,
			host: env.MYSQL_PORT_3306_TCP_ADDR || env.SEQ_MYSQL_HOST || env.SEQ_HOST || "127.0.0.1",
			port: env.MYSQL_PORT_3306_TCP_PORT || env.SEQ_MYSQL_PORT || env.SEQ_PORT || 3306,
			dialect: "mysql",
			pool: {
				max: env.SEQ_MYSQL_POOL_MAX || env.SEQ_POOL_MAX || 5,
				idle: env.SEQ_MYSQL_POOL_IDLE || env.SEQ_POOL_IDLE || 3000,
			},
		};
		break;
	}
	case "mssql": {
		const fs = require("fs");
		let mssqlConfig;
		try {
			mssqlConfig = JSON.parse(fs.readFileSync(`${__dirname}/mssql.json`, "utf8"));
		} catch (e) {
			// ignore
		}

		module.exports = mssqlConfig || {
			database: env.SEQ_MSSQL_DB || env.SEQ_DB || "sequelizr_test",
			username: env.SEQ_MSSQL_USER || env.SEQ_USER || "sequelize",
			password: env.SEQ_MSSQL_PW || env.SEQ_PW || "nEGkLma26gXVHFUAHJxcmsrK",
			host: env.SEQ_MSSQL_HOST || env.SEQ_HOST || "127.0.0.1",
			port: env.SEQ_MSSQL_PORT || env.SEQ_PORT || 1433,
			dialect: "mssql",
			dialectOptions: {
				options: {
					requestTimeout: 60000,
				},
			},
			pool: {
				max: env.SEQ_MSSQL_POOL_MAX || env.SEQ_POOL_MAX || 5,
				idle: env.SEQ_MSSQL_POOL_IDLE || env.SEQ_POOL_IDLE || 3000,
			},
		};
		break;
	}
	default: {
		module.exports = {
			username: env.SEQ_USER || "root",
			password: env.SEQ_PW || null,
			database: env.SEQ_DB || "sequelizr_test",
			host: env.SEQ_HOST || "127.0.0.1",
			pool: {
				max: env.SEQ_POOL_MAX || 5,
				idle: env.SEQ_POOL_IDLE || 30000,
			},
		};
	}
}

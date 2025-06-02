import {Dialect, Sequelize} from "sequelize";

export async function resetDatabase(sequelize: Sequelize, dialect: Dialect, database: string) {
	if (dialect === "mssql") {
		await sequelize.query("USE master;");
		await sequelize.query(`ALTER DATABASE ${database} SET SINGLE_USER WITH ROLLBACK IMMEDIATE;`);
	}

	await sequelize.query(`DROP DATABASE ${database};`);
	await sequelize.query(`CREATE DATABASE ${database};`);
	await sequelize.query(`USE ${database};`);
}

export function dialectMap(dialect: Dialect) {
	const isMysql = dialect === "mysql";
	return {
		"AUTO_INCREMENT": isMysql ? "AUTO_INCREMENT" : "IDENTITY",
		"CURRENT_TIMESTAMP": isMysql ? "CURRENT_TIMESTAMP" : "(getdate())",
		"dub DOUBLE": isMysql ? "dub DOUBLE," : "",
		"DECIMAL(10,2)": isMysql ? "DECIMAL(10,2)" : "DECIMAL",
	};
}

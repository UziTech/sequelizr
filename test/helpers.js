module.exports = {
	async resetDatabase(sequelize, dialect, database) {
		if (dialect === "mssql") {
			await sequelize.query("USE master;");
			await sequelize.query(`ALTER DATABASE ${database} SET SINGLE_USER WITH ROLLBACK IMMEDIATE;`);
		}

		await sequelize.query(`DROP DATABASE ${database};`);
		await sequelize.query(`CREATE DATABASE ${database};`);
		await sequelize.query(`USE ${database};`);
	},

	dialectMap(dialect) {
		return {
			"AUTO_INCREMENT": dialect === "mysql" ? "AUTO_INCREMENT" : "IDENTITY",
			"CURRENT_TIMESTAMP": dialect === "mysql" ? "CURRENT_TIMESTAMP" : "(getdate())",
			"INT(11)": dialect === "mysql" ? "INT(11)" : "INT",
		};
	},
};

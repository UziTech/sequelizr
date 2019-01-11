const sqlite = require("./sqlite");
const mysql = require("./mysql");
const postgres = require("./postgres");
const mssql = require("./mssql");


module.exports = {
	sqlite,
	mysql,
	mariadb: mysql,
	postgres,
	mssql,
};

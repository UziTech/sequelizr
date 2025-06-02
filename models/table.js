module.exports = function (sequelize, DataTypes) {
	return sequelize.define("table", {
		id: {
			primaryKey: true,
			autoIncrement: true,
			type: DataTypes.INTEGER,
		},
	}, {
		tableName: "table",
		timestamps: false,
	});
};

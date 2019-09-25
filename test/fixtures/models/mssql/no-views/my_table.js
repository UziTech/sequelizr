module.exports = function (sequelize, DataTypes) {
	return sequelize.define("my_table", {
		id: {
			type: DataTypes.INTEGER,
			allowNull: true,
			primaryKey: true,
		},
	}, {
		tableName: "my_table",
		timestamps: false,
	});
};

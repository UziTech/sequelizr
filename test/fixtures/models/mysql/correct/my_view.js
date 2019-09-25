module.exports = function (sequelize, DataTypes) {
	return sequelize.define("my_view", {
		id: {
			type: DataTypes.INTEGER(11),
			allowNull: true,
			primaryKey: true,
		},
	}, {
		tableName: "my_view",
		timestamps: false,
	});
};

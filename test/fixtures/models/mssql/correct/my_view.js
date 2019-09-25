module.exports = function (sequelize, DataTypes) {
	return sequelize.define("my_view", {
		id: {
			type: DataTypes.INTEGER,
			allowNull: true,
			primaryKey: true,
		},
	}, {
		tableName: "my_view",
		timestamps: false,
	});
};

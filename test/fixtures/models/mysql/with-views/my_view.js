module.exports = function (sequelize, DataTypes) {
	return sequelize.define("my_view", {
		id: {
			type: DataTypes.INTEGER,
			allowNull: false,
			primaryKey: true,
		},
	}, {
		tableName: "my_view",
		timestamps: false,
	});
};

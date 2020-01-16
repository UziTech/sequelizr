module.exports = function (sequelize, DataTypes) {
	return sequelize.define("my_table", {
		id: {
			type: DataTypes.INTEGER,
			allowNull: false,
			primaryKey: true,
		},
		name: {
			type: DataTypes.STRING(255),
			allowNull: true,
		},
	}, {
		tableName: "my_table",
		timestamps: false,
	});
};

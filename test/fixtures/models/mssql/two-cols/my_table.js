module.exports = function (sequelize, DataTypes) {
	return sequelize.define("my_table", {
		id: {
			type: DataTypes.INTEGER,
			allowNull: false,
			primaryKey: true,
		},
		name: {
			type: DataTypes.STRING,
			allowNull: false,
		},
	}, {
		tableName: "my_table",
		timestamps: false,
	});
};

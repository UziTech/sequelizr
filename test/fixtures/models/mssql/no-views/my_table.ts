import { Sequelize } from "sequelize";

export default function (sequelize: Sequelize, DataTypes: any) {
	return sequelize.define("my_table", {
		id: {
			type: DataTypes.INTEGER,
			allowNull: false,
			primaryKey: true,
		},
	}, {
		tableName: "my_table",
		timestamps: false,
	});
};

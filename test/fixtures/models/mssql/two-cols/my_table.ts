import { Sequelize } from "sequelize";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function (sequelize: Sequelize, DataTypes: any) {
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

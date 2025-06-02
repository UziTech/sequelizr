import { Sequelize } from "sequelize";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function (sequelize: Sequelize, DataTypes: any) {
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

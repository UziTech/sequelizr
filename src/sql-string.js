// https://github.com/sequelize/sequelize/blob/master/lib/sql-string.js

const {DataTypes} = require("sequelize");

module.exports = {
	escape(val, timeZone, dialect, format) {
		let prependN = false;
		if (typeof val === "undefined" || val === null) {
			return "NULL";
		}
		switch (typeof val) {
			case "boolean":
				// SQLite doesn't have true/false support. MySQL aliases true/false to 1/0
				// for us. Postgres actually has a boolean type with true/false literals,
				// but sequelize doesn't use it yet.
				if (dialect === "sqlite" || dialect === "mssql") {
					return +!!val;
				}
				return `${!!val}`;
			case "number":
				return `${val}`;
			case "string":
				// In mssql, prepend N to all quoted vals which are originally a string (for
				// unicode compatibility)
				prependN = dialect === "mssql";
				break;
			default:
				// do nothing
		}

		if (val instanceof Date) {
			// eslint-disable-next-line no-param-reassign
			val = DataTypes[dialect].DATE.prototype.stringify(val, {timezone: timeZone});
		}

		if (Buffer.isBuffer(val)) {
			if (DataTypes[dialect].BLOB) {
				return DataTypes[dialect].BLOB.prototype.stringify(val);
			}

			return DataTypes.BLOB.prototype.stringify(val);
		}

		if (Array.isArray(val)) {
			if (dialect === "postgres" && !format) {
				return DataTypes.ARRAY.prototype.stringify(val, {escape: escape});
			}
			return val.map(v => {
				return escape(v, timeZone, dialect, format);
			});
		}

		if (!val.replace) {
			throw new Error(`Invalid value ${val}`);
		}

		if (dialect === "postgres" || dialect === "sqlite" || dialect === "mssql") {
			// http://www.postgresql.org/docs/8.2/static/sql-syntax-lexical.html#SQL-SYNTAX-STRINGS
			// http://stackoverflow.com/q/603572/130598
			// eslint-disable-next-line no-param-reassign
			val = val.replace(/'/g, "''");
		} else {
			// eslint-disable-next-line no-control-regex, no-param-reassign
			val = val.replace(/[\0\n\r\b\t\\'"\x1a]/g, function (s) {
				switch (s) {
					case "\0": return "\\0";
					case "\n": return "\\n";
					case "\r": return "\\r";
					case "\b": return "\\b";
					case "\t": return "\\t";
					case "\x1a": return "\\Z";
					default: return `\\${s}`;
				}
			});
		}
		return `${(prependN ? "N'" : "'") + val}'`;
	},

	format(sql, values, timeZone, dialect) {
		// eslint-disable-next-line no-param-reassign
		values = [].concat(values);

		if (typeof sql !== "string") {
			throw new Error(`Invalid SQL string provided: ${sql}`);
		}
		return sql.replace(/\?/g, function (match) {
			if (!values.length) {
				return match;
			}

			return escape(values.shift(), timeZone, dialect, true);
		});
	},

	formatNamedParameters(sql, values, timeZone, dialect) {
		return sql.replace(/:+(?!\d)(\w+)/g, function (value, key) {
			if ("postgres" === dialect && "::" === value.slice(0, 2)) {
				return value;
			}

			if (typeof values[key] !== "undefined") {
				return escape(values[key], timeZone, dialect, true);
			}
			throw new Error(`Named parameter "${value}" has no value in the given object.`);

		});
	},
};

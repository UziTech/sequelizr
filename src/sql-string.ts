// https://github.com/sequelize/sequelize/blob/master/lib/sql-string.js

import { DataTypes, Dialect as SequelizeDialect } from "sequelize";

// Define a more specific type for dialects handled, including common string literals
// This helps with indexing DataTypes if a string literal is passed.
type HandledDialect = 'mysql' | 'postgres' | 'sqlite' | 'mssql' | 'mariadb';
type DialectType = SequelizeDialect | HandledDialect;

// Helper function to safely access DataTypes properties
function getDialectDataTypes(dialect: DialectType): any {
	// Ensure dialect is one of the keys of DataTypes or a known string literal
	if (typeof dialect === 'string' && dialectsMapping[dialect as HandledDialect]) {
		return DataTypes[dialectsMapping[dialect as HandledDialect] as SequelizeDialect];
	}
	// Fallback for other dialects if they are passed as string but match SequelizeDialect keys
	if (typeof dialect === 'string' && DataTypes[dialect as SequelizeDialect]) {
	    return DataTypes[dialect as SequelizeDialect];
	}
	// If dialect is already a SequelizeDialect enum value (though they are strings)
	if (DataTypes[dialect as SequelizeDialect]) {
	    return DataTypes[dialect as SequelizeDialect];
	}
	// Default or throw error if dialect is not supported/recognized for specific stringify
	// For BLOB, a generic might be okay. For DATE, it's more specific.
	// console.warn(`Dialect ${dialect} not explicitly handled for DataTypes access, using generic BLOB.`);
	return DataTypes.BLOB; // A somewhat safe default for Buffer, but DATE needs dialect.
}

// Mapping for string literals to Sequelize Dialect keys if necessary (though usually they match)
const dialectsMapping: Record<HandledDialect, SequelizeDialect> = {
	mysql: 'mysql',
	postgres: 'postgres',
	sqlite: 'sqlite',
	mssql: 'mssql',
	mariadb: 'mariadb',
};


// Define the interface for the exported object
interface SqlStringExporter {
	escape(
		val: any,
		timeZone?: string,
		dialect?: DialectType,
		format?: boolean
	): string | number;

	format(
		sql: string,
		values: any | any[],
		timeZone?: string,
		dialect?: DialectType
	): string;

	formatNamedParameters(
		sql: string,
		values: Record<string, any>,
		timeZone?: string,
		dialect?: DialectType
	): string;
}

// Implementation needs to be careful with `this.escape` if not part of a class or bound object.
// Here, `escape` is a local function, so direct calls are fine.

function escapeInternal(
	val: any,
	timeZone?: string,
	dialect?: DialectType,
	format?: boolean // `format` is true if called from `format` or `formatNamedParameters`
): string | number {
	let prependN = false;
	if (typeof val === "undefined" || val === null) {
		return "NULL";
	}
	switch (typeof val) {
		case "boolean":
			if (dialect === "sqlite" || dialect === "mssql") {
				return +!!val; // Convert to 0 or 1
			}
			return `${!!val}`; // 'true' or 'false'
		case "number":
			return `${val}`; // Numbers are stringified directly
		case "string":
			prependN = dialect === "mssql"; // Prepend N for NVARCHAR string literals in MSSQL
			break;
		default:
			// For objects, Date, Buffer, Array
			break;
	}

	if (val instanceof Date) {
		const dialectDataTypes = getDialectDataTypes(dialect || 'mysql'); // Default to mysql if dialect undefined
		if (dialectDataTypes && dialectDataTypes.DATE && dialectDataTypes.DATE.prototype && dialectDataTypes.DATE.prototype.stringify) {
			return dialectDataTypes.DATE.prototype.stringify(val, { timezone: timeZone });
		}
		// Fallback if dialect-specific stringify is not found (should not happen with known dialects)
		return `'${val.toISOString().replace('T', ' ').slice(0, -1)}'`; // Standard ISO format
	}

	if (Buffer.isBuffer(val)) {
		const dialectDataTypes = getDialectDataTypes(dialect || 'mysql');
		if (dialectDataTypes && dialectDataTypes.BLOB && dialectDataTypes.BLOB.prototype && dialectDataTypes.BLOB.prototype.stringify) {
			return dialectDataTypes.BLOB.prototype.stringify(val);
		}
		// Fallback for Buffer if specific stringifier isn't found
		return `X'${val.toString('hex')}'`;
	}

	if (Array.isArray(val)) {
		if (dialect === "postgres" && !format) {
			// For Postgres arrays, use its specific stringify method if not already formatting (to avoid double escaping)
			// The `escapeInternal` needs to be passed carefully here.
			// The original code `escape: escape` would refer to the outer `escape` function.
			// Let's assume DataTypes.ARRAY.prototype.stringify handles internal escaping or uses a compatible one.
			return DataTypes.postgres.ARRAY.prototype.stringify(val, { escape: (v: any) => escapeInternal(v, timeZone, dialect, true) });
		}
		// For other dialects or when formatting, map and escape each element
		return val.map(v => escapeInternal(v, timeZone, dialect, format)).join(", ");
	}
	
	// At this point, val should be a string or an object that needs to be stringified.
	// If it's an object without a custom stringifier (handled by dialect-specific DataTypes),
	// it might be an issue. The original code implies `!val.replace` handles this.
	if (typeof val === 'object' && val !== null && !Buffer.isBuffer(val) && !Array.isArray(val) && !(val instanceof Date)) {
		// This case might indicate an unhandled object type.
		// Consider JSON.stringify or a custom method if objects are expected.
		// For now, to match original error for non-replaceable values:
		if (!('replace' in val) && typeof val.toString === 'function') {
			// If it has a toString but no replace, it might be a custom object.
			// The original error `Invalid value ${val}` would trigger if val.replace is undefined.
			// If we want to stringify it, we'd use val.toString() and then escape that.
			// However, to match the original control flow that leads to error for such objects:
			throw new Error(`Invalid value (object without replace method): ${val}`);
		} else if (!('replace' in val)) {
			throw new Error(`Invalid value (non-stringifiable or unhandled type): ${val}`);
		}
		// If it's an object that somehow has `replace` (e.g. String object), it will be treated as string below.
	}


	let escapedVal = typeof val === 'string' ? val : String(val);

	if (dialect === "postgres" || dialect === "sqlite" || dialect === "mssql") {
		escapedVal = escapedVal.replace(/'/g, "''");
	} else { // MySQL/MariaDB and default
		escapedVal = escapedVal.replace(/[\0\n\r\b\t\\'"\x1a]/g, (s: string) => {
			switch (s) {
				case "\0": return "\\0";
				case "\n": return "\\n";
				case "\r": return "\\r";
				case "\b": return "\\b";
				case "\t": return "\\t";
				case "\x1a": return "\\Z"; // End-of-file marker for some DBs
				case "'": return "''"; // Standard SQL escape for single quote
				case "\"": return "\"\""; // Escape double quote if needed by dialect (not typical for string content)
				case "\\": return "\\\\"; // Escape backslash
				default: return `\\${s}`; // Should not happen with the regex list
			}
		});
	}
	return `${(prependN ? "N'" : "'")}${escapedVal}'`;
}


const sqlStringFunctions: SqlStringExporter = {
	escape(val: any, timeZone?: string, dialect?: DialectType, format?: boolean): string | number {
		return escapeInternal(val, timeZone, dialect, format);
	},

	format(sql: string, values: any | any[], timeZone?: string, dialect?: DialectType): string {
		const valueArray = Array.isArray(values) ? values : [values];

		if (typeof sql !== "string") {
			throw new Error(`Invalid SQL string provided: ${sql}`);
		}
		return sql.replace(/\?/g, (match: string) => {
			if (valueArray.length === 0) {
				return match; // No more values to replace, return the placeholder
			}
			// Use `this.escape` if it were a class method, or `sqlStringFunctions.escape`
			// Since `escapeInternal` is in the same scope, call it directly.
			return String(escapeInternal(valueArray.shift(), timeZone, dialect, true));
		});
	},

	formatNamedParameters(sql: string, values: Record<string, any>, timeZone?: string, dialect?: DialectType): string {
		return sql.replace(/:+(?!\d)(\w+)/g, (value: string, key: string): string => {
			if (dialect === "postgres" && value.startsWith("::")) {
				return value; // Don't escape PostgreSQL type casts e.g. '::TEXT'
			}

			if (key in values) {
				return String(escapeInternal(values[key], timeZone, dialect, true));
			}
			throw new Error(`Named parameter "${value}" has no value in the given object.`);
		});
	},
};

export default sqlStringFunctions;

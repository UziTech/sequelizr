// from https://github.com/sequelize/sequelize/blob/master/lib/sql-string.js

import {DataTypes} from "sequelize";

function arrayToList(array: unknown[], timeZone: string | null, dialect: string, format: boolean): string {
  return array.reduce<string>((sql, val, i) => {
    if (i !== 0) {
      sql += ', ';
    }
    if (Array.isArray(val)) {
      sql += `(${arrayToList(val, timeZone, dialect, format)})`;
    } else {
      sql += escape(val, timeZone, dialect, format);
    }
    return sql;
  }, '');
}

export function escape(val: unknown, timeZone: string | null, dialect: string, format = false): string {
  let prependN = false;
  if (val === undefined || val === null) {
    return 'NULL';
  }
  switch (typeof val) {
    case 'boolean':
      // SQLite doesn't have true/false support. MySQL aliases true/false to 1/0
      // for us. Postgres actually has a boolean type with true/false literals,
      // but sequelize doesn't use it yet.
      if (dialect === 'sqlite' || dialect === 'mssql') {
        return val ? '1' : '0';
      }
      return (!!val).toString();
    case 'number':
      return val.toString();
    case 'string':
      // In mssql, prepend N to all quoted vals which are originally a string (for
      // unicode compatibility)
      prependN = dialect === 'mssql';
      break;
  }

  if (val instanceof Date) {
    val = (DataTypes as any)[dialect].DATE.prototype.stringify(val, {
      timezone: timeZone
    });
  }

  if (Buffer.isBuffer(val)) {
    if ((DataTypes as any)[dialect].BLOB) {
      return (DataTypes as any)[dialect].BLOB.prototype.stringify(val);
    }

    return DataTypes.BLOB.prototype.stringify(val, undefined); // TODO: Remove unknown
  }

  if (Array.isArray(val)) {
    const partialEscape = (escVal: string) => escape(escVal, timeZone, dialect, format);
    if (dialect === 'postgres' && !format) {
      return DataTypes.ARRAY.prototype.stringify(val, {
        escape: partialEscape
      });
    }
    return arrayToList(val, timeZone, dialect, format);
  }

  if (typeof val !== 'string') {
    throw new Error(`Invalid value ${val}`);
  }

  if (dialect === 'postgres' || dialect === 'sqlite' || dialect === 'mssql') {
    // http://www.postgresql.org/docs/8.2/static/sql-syntax-lexical.html#SQL-SYNTAX-STRINGS
    // http://stackoverflow.com/q/603572/130598
    val = val.replace(/'/g, "''");

    if (dialect === 'postgres') {
      // null character is not allowed in Postgres
      // Todo: type inference broken.
      val = (val as string).replace(/\0/g, '\\0');
    }
  } else {
    // eslint-disable-next-line no-control-regex
    val = val.replace(/[\0\n\r\b\t\\'"\x1a]/g, s => {
      switch (s) {
        case '\0':
          return '\\0';
        case '\n':
          return '\\n';
        case '\r':
          return '\\r';
        case '\b':
          return '\\b';
        case '\t':
          return '\\t';
        case '\x1a':
          return '\\Z';
        default:
          return `\\${s}`;
      }
    });
  }
  return `${(prependN ? "N'" : "'") + val}'`;
}

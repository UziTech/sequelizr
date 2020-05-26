# sequelizr

[![Actions Status](https://github.com/UziTech/sequelizr/workflows/CI/badge.svg)](https://github.com/UziTech/sequelizr/actions)
[![dependencies Status](https://david-dm.org/UziTech/sequelizr/status.svg)](https://david-dm.org/UziTech/sequelizr)

Manage Sequelize models

# Usage

-   [CLI](#cli)
    -   [Check models match database](#check-models-match-database)
    -   [Download models from database](#download-models-from-database)
    -   [Upload models to database](#upload-models-to-database)
-   [API](#api)
-   [Configuration](#configuration)

## CLI

You can use Sequelizr from the command line with the following commands:

### Check models match database

Check if models match database tables.

```
sequelizr check [opts]

Command Options:
  --server, -s, --host       Server                       [string] [default: "localhost"]
  --database, -d             Database                                            [string]
  --tables, -t               Tables                                               [array]
  --username, --user, -u     User                                                [string]
  --password, -p             Password                                            [string]
  --port, -r                 Port                                                [number]
  --dialect, -l              Dialect                 [string] [choices: "mysql", "mssql"]
  --models, -m, --directory  Model Directory                      [string] [default: "."]
  --quiet, -q                Build Models Silently             [boolean] [default: false]
  --sort, -x                 Sort fields and attributes        [boolean] [default: false]
  --config, -c               Config File                                         [string]

Global Options:
  --help, -h  Show help                                                         [boolean]
```

### Download models from database

Create model files from database tables.

```
sequelizr download [opts]

Command Options:
  --server, -s, --host       Server                       [string] [default: "localhost"]
  --database, -d             Database                                            [string]
  --tables, -t               Tables                                               [array]
  --username, --user, -u     User                                                [string]
  --password, -p             Password                                            [string]
  --port, -r                 Port                                                [number]
  --dialect, -l              Dialect                 [string] [choices: "mysql", "mssql"]
  --models, -m, --directory  Model Directory                      [string] [default: "."]
  --overwrite, -o            Overwrite files if they exist     [boolean] [default: false]
  --quiet, -q                Build Models Silently             [boolean] [default: false]
  --sort, -x                 Sort fields and attributes        [boolean] [default: false]
  --config, -c               Config File                                         [string]

Global Options:
  --help, -h  Show help                                                         [boolean]
```

### Upload models to database

Create database tables from model files.

```
sequelizr upload [opts]

Command Options:
  --server, -s, --host       Server                       [string] [default: "localhost"]
  --database, -d             Database                                            [string]
  --tables, -t               Tables                                               [array]
  --username, --user, -u     User                                                [string]
  --password, -p             Password                                            [string]
  --port, -r                 Port                                                [number]
  --dialect, -l              Dialect                 [string] [choices: "mysql", "mssql"]
  --models, -m, --directory  Model Directory                      [string] [default: "."]
  --overwrite, -o            Drop tables before creating them  [boolean] [default: false]
  --alter, -a                Alters tables to fit models       [boolean] [default: false]
  --quiet, -q                Build Models Silently             [boolean] [default: false]
  --sort, -x                 Sort fields and attributes        [boolean] [default: false]
  --config, -c               Config File                                         [string]

Global Options:
  --help, -h  Show help                                                         [boolean]
```

## API

You can also use Sequelizr programmatically.

```js
const {checkModels, downloadModels, uploadModels} = require("sequelizr");
const config = require("./config");

checkModels(config);
downloadModels(config);
uploadModels(config);
```

## Configuration

You can use a config file instead of cli arguments. The file can be a JSON or JavaScript file that exports an object.

Example config:
```js
// config.js
module.exports = {
  database: "database",
  username: "username",
  password: "password",
  host: "host",
  port: 1433,
  dialect: "mssql",
  directory: "C:\\models\\database",
  tables: ["table1", "table2"],
  dialectOptions: {...},
  quiet: false, // Build tables silently. Don't output percent complete.
  sort: false, // sort fields and attributes to be more deterministic.

  // `check` specific options
  includeViews: true, // Check models for views along with tables. Default = true
  output: true,       // TRUE(default) = Output errors to console
                      // FALSE = Reject error string
                      // EventEmitter = emit "error" for each error

  // `download` specific options
  overwrite: false,   // Overwrite model files. Default = false
  includeViews: true, // Download models for views along with tables. Default = true

  // `upload` specific options
  overwrite: false,   // Drop tables before create. Default = false
  alter: false,       // Alters tables to fit models. Default = false
}
```

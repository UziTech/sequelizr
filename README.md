# sequelizr

Manage Sequelize models

# Usage

- [Check models match database](#Check-models-match-database)
- [Download models from database](#Download-models-from-database)
- [Upload models to database](#Upload-models-to-database)

## Check models match database

Check if models match database tables.

```
sequelizr check [opts]

Command Options:
  --server, -s, --host       Server                       [string] [default: "localhost"]
  --database, -d             Database                                            [string]
  --tables, -t               Tables                                               [array]
  --user, -u                 User                                                [string]
  --password, -p             Password                                            [string]
  --port, -r                 Port                                                [number]
  --dialect, -l              Dialect                 [string] [choices: "mysql", "mssql"]
  --models, -m, --directory  Model Directory                      [string] [default: "."]
  --config, -c               Config File                                         [string]

Global Options:
  --help, -h  Show help                                                         [boolean]
```

## Download models from database

Create model files from database tables.

```
sequelizr download [opts]

Command Options:
  --server, -s, --host       Server                       [string] [default: "localhost"]
  --database, -d             Database                                            [string]
  --tables, -t               Tables                                               [array]
  --user, -u                 User                                                [string]
  --password, -p             Password                                            [string]
  --port, -r                 Port                                                [number]
  --dialect, -l              Dialect                 [string] [choices: "mysql", "mssql"]
  --models, -m, --directory  Model Directory                      [string] [default: "."]
  --overwrite, -o            Overwrite files if they exist.    [boolean] [default: false]
  --config, -c               Config File                                         [string]

Global Options:
  --help, -h  Show help                                                         [boolean]
```

## Upload models to database

Create database tables from model files.

```
sequelizr upload [opts]

Command Options:
  --server, -s, --host       Server                       [string] [default: "localhost"]
  --database, -d             Database                                            [string]
  --tables, -t               Tables                                               [array]
  --user, -u                 User                                                [string]
  --password, -p             Password                                            [string]
  --port, -r                 Port                                                [number]
  --dialect, -l              Dialect                 [string] [choices: "mysql", "mssql"]
  --models, -m, --directory  Model Directory                      [string] [default: "."]
  --overwrite, -o            Drop tables before creating them. [boolean] [default: false]
  --config, -c               Config File                                         [string]

Global Options:
  --help, -h  Show help                                                         [boolean]
```

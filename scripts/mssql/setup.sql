/*

Enter custom T-SQL here that would run after SQL Server has started up.

*/

CREATE DATABASE [sequelizr_test];
GO

CREATE LOGIN sequelizr_test WITH PASSWORD = 'Sequelizr_test32!';

ALTER SERVER ROLE sysadmin ADD MEMBER sequelizr_test;

USE sequelizr_test;
CREATE USER sequelizr_test FOR LOGIN sequelizr_test;
ALTER USER sequelizr_test WITH DEFAULT_SCHEMA=dbo;
ALTER ROLE db_owner ADD MEMBER sequelizr_test;

GO

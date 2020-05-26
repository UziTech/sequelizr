ARG MSSQL_VERSION
FROM mcr.microsoft.com/mssql/server:$MSSQL_VERSION

# modified from https://github.com/microsoft/mssql-docker/tree/master/linux/preview/examples/mssql-customize

# Create a config directory
RUN mkdir -p /usr/config
WORKDIR /usr/config

# Bundle config source
COPY . /usr/config

# Grant permissions for to our scripts to be executable
#RUN chmod +x /usr/config/entrypoint.sh
#RUN chmod +x /usr/config/configure-db.sh

ENTRYPOINT ["./entrypoint.sh"]

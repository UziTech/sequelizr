ARG MSSQL_VERSION
FROM mcr.microsoft.com/mssql/server:$MSSQL_VERSION

# modified from https://github.com/microsoft/mssql-docker/tree/master/linux/preview/examples/mssql-customize
RUN apt-get update -yqq \
    && apt-get install -y --no-install-recommends openssl \
    && sed -i -E 's/(CipherString\s*=\s*DEFAULT@SECLEVEL=)\d/\10/' /etc/ssl/openssl.cnf
# Create a config directory
USER 0
RUN mkdir -p /usr/config
WORKDIR /usr/config

# Bundle config source
COPY . /usr/config

# Grant permissions for to our scripts to be executable
#RUN chmod +x /usr/config/entrypoint.sh
#RUN chmod +x /usr/config/configure-db.sh

ENTRYPOINT ["./entrypoint.sh"]

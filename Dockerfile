FROM node:22.17.0

RUN apt-get install libpq-dev

WORKDIR /sequelizr
VOLUME /sequelizr

COPY . /sequelizr

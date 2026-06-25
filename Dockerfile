FROM node:24.18.0

RUN apt-get install libpq-dev

WORKDIR /sequelizr
VOLUME /sequelizr

COPY . /sequelizr

FROM node:16

RUN apt-get install libpq-dev

WORKDIR /sequelizr
VOLUME /sequelizr

COPY . /sequelizr

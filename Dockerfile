FROM node:21.7.3

RUN apt-get install libpq-dev

WORKDIR /sequelizr
VOLUME /sequelizr

COPY . /sequelizr

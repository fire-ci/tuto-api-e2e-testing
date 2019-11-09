# docker-compose-node-postgres
End to end testing of your NodeJS + Postgres backend with Docker Compose.

The project is a simple REST API for users in NodeJS using knex as an ORM on top of a PostgreSQL database.

The docker-compose.yml file defines 3 containers:
- db for the database
- myapp for the API we want to test
- myapp-tests for the end to end tests of the API

To run the tests:

```
docker-compose up --force-recreate --build --abort-on-container-exit
```

The flags --force-recreate and --build ensure that containers are rebuilt with the latest version of the code at every run.
The flag --abort-on-container-exit makes all the containers stop as soon when one exits - the tests one. The return code of the command will be the return code of the tests.

After each test run in order to start with a fresh DB one needs to run:

```
docker-compose down --volumes --rmi local
```

This command allows to remove the containers created during the last run (not needed since we want to rebuild from fresh anyway) but most importantly it removes the volume on which the database has been created forcing the DB to recreate from scratch, which is what we want.

A few things to note:
- We have to use dockerize to be sure that the tests are run only once the DB and app are initialized. The depends_on flag just ensures that the container starts but not that the service inside starts, so typically Postgres is not listening on the port yet when tests are ran if we don't use dockerize
- The endpoints for the db and the app in the source code are the names of the containers so "db" for the db and "myapp" for the app in my example, instead of localhost. In a prod system this probably needs some env variables to be set in the Dockerfile so the app uses the Docker endpoints instead of the localhost or some remote ones
- The DB setup/seeding/migration cannot be done in a separate ephemeral container because of the --abort-on-container-exit flag: the container would exit and the tests one would not be run. Instead, both the DB setup and tests are run in the tests container




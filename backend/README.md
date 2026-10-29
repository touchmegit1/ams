# backend

Spring Boot backend application for the AMS Course Management system.

## MySQL configuration

Copy `.env.example` to `.env` and set `DB_USERNAME` and `DB_PASSWORD` for your local MySQL account. The `.env` file is ignored by Git. Set `SPRING_PROFILE=prod` to use the persistent MySQL database. The `dev` profile uses an in-memory H2 database and loses data on restart. Spring SQL initialization is disabled, so `schema.sql` is not run automatically. Do not run that script against a database containing data because it drops `ams_db`.

Run with Java 17+ and Maven:

```sh
mvn spring-boot:run
```

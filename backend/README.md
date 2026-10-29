# backend

Spring Boot backend application for the AMS Course Management system.

## MySQL configuration

Copy `.env.example` to `.env` and set `DB_USERNAME` and `DB_PASSWORD` for your local MySQL account. The `.env` file is ignored by Git. The application loads `src/main/resources/schema.sql` on startup; that script recreates the `ams_db` database, so startup replaces any existing data in it.

Run with Java 17+ and Maven:

```sh
mvn spring-boot:run
```

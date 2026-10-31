# backend

Spring Boot backend application for the AMS Course Management system.

## MySQL configuration

Copy `.env.example` to `.env` and set `DB_USERNAME` and `DB_PASSWORD` for your local MySQL account. The `.env` file is ignored by Git. SQL scripts are not run automatically by Spring Boot. See `src/main/resources/sql/README.md` for fresh database setup and safe upgrade instructions. `schema.sql` drops and recreates `ams_db`, so use it only for a fresh local database.

The course management feature uses authenticated teacher/admin accounts and supports manual course, module, and lesson CRUD. It does not call an AI service.

Run with Java 17+ and Maven:

```sh
mvn spring-boot:run
```

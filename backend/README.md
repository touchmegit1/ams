# backend

Spring Boot backend application for the AMS Course Management system.

## MySQL configuration

Copy `.env.example` to `.env` and set `DB_USERNAME` and `DB_PASSWORD` for your local MySQL account. The `.env` file is ignored by Git. Run `db/ams_demo.sql` once on a disposable local MySQL database to create all tables and sample data. It drops and recreates `ams_db`; Spring Boot does not run it automatically.

The course management feature uses authenticated teacher/admin accounts and supports manual course, module, and lesson CRUD. It does not call an AI service.

Run with Java 17+ and Maven:

```sh
mvn spring-boot:run
```

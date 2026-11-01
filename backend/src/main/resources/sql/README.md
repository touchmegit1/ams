# AMS database scripts

All SQL schema and sample data are in `backend/db/ams_demo.sql`.

The script drops and recreates `ams_db`. Run it only on a disposable local database. Spring Boot does not execute it automatically. It is a fresh setup script, not an in-place migration for an existing database.

Demo login: `admin@gmail.com`, `teacher@gmail.com`, or `student@gmail.com`; password `Admin@123`. The student has no enrollment initially, so both free and paid course registration can be tested.

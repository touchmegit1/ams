# AMS database scripts

All SQL schema and sample data are in `backend/db/ams_demo.sql`.

The script drops and recreates `ams_db`. Run it only on a disposable local database. Spring Boot does not execute it automatically. It is a fresh setup script, not an in-place migration for an existing database.

For an existing database, apply `backend/src/main/resources/sql/V20261102__lesson_quizzes_and_attempts.sql` once. It adds the nullable lesson link to assignments and creates the quiz-attempt table without dropping existing data. Back up the database before applying schema changes.

For teacher lesson-progress tracking, apply `backend/db/ams_teacher_progress_migration.sql` once after the existing course schema is present. It adds `lesson_progress` without changing enrollment, assignment, or submission records. The fresh demo script already creates this table.

Demo login: `admin@gmail.com`, `teacher@gmail.com`, or `student@gmail.com`; password `Admin@123`. The student has no enrollment initially, so both free and paid course registration can be tested.

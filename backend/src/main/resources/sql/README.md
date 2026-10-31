# AMS database scripts

`schema.sql` defines the base tables. It starts by dropping and recreating `ams_db`, so use it only when creating a fresh local database.

## Fresh database

1. Run `schema.sql`.
2. Run `admin-migration.sql` from the parent `resources` directory to add the `ADMIN` role and account-security columns.
3. Run `sql/seed-sample-accounts.sql` to create the sample teacher and student accounts.

The current `schema.sql` already includes the course metadata and archived status used by course management. Do not run `course-management-migration.sql` on a fresh database.

## Existing database from the older schema

Run each one-time migration once, without running `schema.sql`:

1. `admin-migration.sql` (if the admin role, `is_enabled`, and `auth_version` have not been added yet).
2. `sql/course-management-migration.sql` to add course code, subject, target audience, update time, and archived status.
3. `sql/seed-sample-accounts.sql` to add or reset the sample accounts.

Spring Boot has `spring.sql.init.mode=never`; it does not execute these scripts automatically. The app uses Hibernate `ddl-auto=update` for mapped entity columns.

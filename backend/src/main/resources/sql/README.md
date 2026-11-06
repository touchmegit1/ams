# AMS database scripts

All SQL schema and sample data are in `backend/db/ams_demo.sql`.

The script drops and recreates `ams_db`. Run it only on a disposable local database. Spring Boot does not execute it automatically. It is a fresh setup script, not an in-place migration for an existing database.

For an existing database, apply migration scripts such as `V20261103__teacher_workspace_submissions.sql` manually once. They add submission metadata and preserve existing rows; never use the demo reset script to upgrade a database with data.

For databases created with an older `ams_demo.sql`, run `V20261103__repair_submission_versions.sql` against the existing MySQL database. It adds the version columns expected by the application if absent and preserves existing submissions.

Apply `V20261106__assignment_resource_url.sql` once on existing databases for the optional assignment link. To add uploaded-file support, also apply `V20261106__assignment_resource_file.sql`. Both scripts are safe to rerun. Fresh databases created from `ams_demo.sql` already include these columns.

Demo login: `admin@gmail.com`, `teacher@gmail.com`, or `student@gmail.com`; password `Admin@123`. The student has no enrollment initially, so both free and paid course registration can be tested.

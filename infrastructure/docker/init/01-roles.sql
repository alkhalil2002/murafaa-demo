-- murafaa_app: NOLOGIN group role that RLS policies target (migrations also
-- create it if missing). murafaa_api: the LOGIN the API uses; it is a member of
-- murafaa_app and does not own any table. Migrations run as the owner (murafaa).
CREATE ROLE murafaa_app NOLOGIN;
CREATE ROLE murafaa_api LOGIN PASSWORD 'murafaa_api' IN ROLE murafaa_app;
CREATE DATABASE murafaa_test OWNER murafaa;

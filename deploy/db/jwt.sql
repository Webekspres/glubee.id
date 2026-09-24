-- Diambil dari supabase/docker/volumes/db/jwt.sql (master, 24 September 2026).
\set jwt_exp `echo "$JWT_EXP"`

ALTER DATABASE postgres SET "app.settings.jwt_exp" TO :'jwt_exp';

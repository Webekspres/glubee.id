-- Diambil dari supabase/docker/volumes/db/roles.sql (master, 24 September 2026).
-- Password seluruh role internal = POSTGRES_PASSWORD dari /opt/glubee/.env.
-- supabase_functions_admin dihapus: role itu dibuat oleh webhooks.sql upstream yang tidak dipasang (tanpa Edge Functions).
\set pgpass `echo "$POSTGRES_PASSWORD"`

ALTER USER authenticator WITH PASSWORD :'pgpass';
ALTER USER pgbouncer WITH PASSWORD :'pgpass';
ALTER USER supabase_auth_admin WITH PASSWORD :'pgpass';
ALTER USER supabase_storage_admin WITH PASSWORD :'pgpass';

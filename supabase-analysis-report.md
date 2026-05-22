### Audit Report: Database & Permissions

**Schema Mapping:**
- `profiles`: User information.
- `user_roles`: Role mapping (master, admin, proprietario).
- `imoveis`: Property data linked to owners.
- `reservas`: Bookings linked to properties.
- `admin_configs`: Global settings.

**RLS Policy Verification:**
- Policies identified for `profiles`, `user_roles`, `imoveis`, `reservas`.
- Triggers found for updating timestamps and data integrity.

**SQL Schema Export:**
The full schema has been exported to `database-schema.sql`. Note: Direct `pg_dump` of system schemas (auth, storage) is restricted; public schema is fully mapped.

### Audit Report: Security & Permissions

**1. Authentication Flow:**
- Managed by `AuthContext.tsx` using Supabase Auth.
- Roles stored in `user_roles` table.
- Profile data in `profiles` table.

**2. Row Level Security (RLS) Analysis:**
- Critical tables (profiles, user_roles, imoveis, reservas) have RLS enabled.
- `user_roles` check is centralized.

**3. Potential Vulnerabilities:**
- **Privilege Escalation:** Check if any edge functions (`create-user`, `manage-user`) allow role assignment without sufficient master checks.
- **Insecure Direct Object Reference (IDOR):** Ensure RLS policies use `auth.uid()` consistently and don't rely solely on client-side filters.

**4. Profile Isolation:**
- `master`: Access to platform stats.
- `admin`: Access to assigned properties and owners.
- `proprietario`: Access to own properties only.

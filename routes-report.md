### Audit Report: Routes & Components

| Route | Component | Permission | Guard | Notes |
|-------|-----------|------------|-------|-------|
| `/login` | `Login` | Public | - | |
| `/reset-password` | `ResetPassword` | Public | - | |
| `/setup` | `Setup` | Public | - | |
| `/master` | `MasterDashboard` | `master` | `ProtectedLayout` | Overview of platform |
| `/master/admins` | `AdminsList` | `master` | `ProtectedLayout` | |
| `/admin` | `AdminDashboard` | `admin` | `ProtectedLayout` | `master` also has access via `ProtectedRoute` |
| `/admin/proprietarios` | `Proprietarios` | `admin` | `ProtectedLayout` | |
| `/admin/imoveis` | `Imoveis` | `admin` | `ProtectedLayout` | |
| `/admin/reservas` | `Reservas` | `admin` | `ProtectedLayout` | |
| `/admin/configuracoes` | `Configuracoes` | `admin` | `ProtectedLayout` | |
| `/admin/calendario` | `Calendario` | `admin` | `ProtectedLayout` | |
| `/dashboard` | `ProprietarioDashboard` | `proprietario` | `ProtectedLayout` | |
| `/dashboard/imoveis` | `MeusImoveis` | `proprietario` | `ProtectedLayout` | |

**Conflict Analysis:**
- `ProtectedRoute.tsx` (Line 32) allows `master` users to access any route even if `requiredRole` is `admin`.
- Potential issue: If a component like `AdminDashboard` expects data scoped to a specific admin ID but is accessed by a `master` user, it might fail or show incorrect data if not properly handled.

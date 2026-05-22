### Audit Report: React Stability & Error Analysis

**1. "White Screen" (Error #310) Diagnosis:**
- Root cause: Conditional returns before hooks in dashboard components.
- Status: Partially corrected in `OccupancyComparison.tsx`, but logic complexity in `AdminDashboard.tsx` still shows high risk.
- Risk: `if (loading) return ...` patterns observed in multiple sub-components.

**2. Rendering Loops:**
- `useEffect` in `MasterDashboard.tsx` (Line 82) triggers on database changes but relies on a generic `postgres_changes` subscription. This can cause high frequency updates.
- `AdminDashboard.tsx` has multiple `useEffect` hooks with complex dependency arrays (`filtroProprietario`, `imoveis`, `mesSelecionado`, `anoSelecionado`).

**3. Performance Bottlenecks:**
- `OccupancyComparison.tsx`: Massive calculation logic inside `useEffect` (Line 279) instead of offloading to a worker or optimized backend query.
- Multiple redundant `supabase.from(...)` calls across different components for the same data (e.g., `imoveis`).

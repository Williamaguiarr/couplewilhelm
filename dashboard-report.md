### Audit Report: Performance & Dashboard Analysis

**MasterDashboard:**
- Props: None.
- Hooks: `useState`, `useEffect`.
- Optimization: Realtime subscriptions (Lines 85-90) could be debounced.

**AdminDashboard:**
- Props: None.
- Hooks: `useState`, `useEffect`, `useMemo`, `useNavigate`, `useTheme`, `useToast`.
- Critical Path: `fetchStats` (Line 222) performs heavy client-side filtering and calculation on large datasets.

**OccupancyComparison:**
- Critical bottleneck in `processMonthData` (Line 88) which runs in a loop inside `useEffect`.
- Suggestion: Pre-calculate occupancy rates in a materialized view or scheduled function.

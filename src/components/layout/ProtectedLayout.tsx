import React from "react";
import { Outlet } from "react-router-dom";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import AppLayout from "@/components/layout/AppLayout";
import type { Enums } from "@/integrations/supabase/types";

type AppRole = Enums<"app_role">;

interface ProtectedLayoutProps {
  requiredRole: AppRole;
}

const ProtectedLayout: React.FC<ProtectedLayoutProps> = ({ requiredRole }) => (
  <ProtectedRoute requiredRole={requiredRole}>
    <AppLayout>
      <Outlet />
    </AppLayout>
  </ProtectedRoute>
);

export default ProtectedLayout;

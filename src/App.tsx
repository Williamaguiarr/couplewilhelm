import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import AppLayout from "@/components/layout/AppLayout";
import Login from "@/pages/Login";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import Proprietarios from "@/pages/admin/Proprietarios";
import Imoveis from "@/pages/admin/Imoveis";
import Reservas from "@/pages/admin/Reservas";
import ProprietarioDashboard from "@/pages/proprietario/Dashboard";
import MeusImoveis from "@/pages/proprietario/MeusImoveis";
import Setup from "@/pages/Setup";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Rota pública */}
            <Route path="/login" element={<Login />} />
            <Route path="/setup" element={<Setup />} />

            {/* Redirecionar raiz para login */}
            <Route path="/" element={<Navigate to="/login" replace />} />

            {/* Rotas Admin */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AppLayout>
                    <AdminDashboard />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/proprietarios"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AppLayout>
                    <Proprietarios />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/imoveis"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AppLayout>
                    <Imoveis />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/reservas"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AppLayout>
                    <Reservas />
                  </AppLayout>
                </ProtectedRoute>
              }
            />

            {/* Rotas Proprietário */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute requiredRole="proprietario">
                  <AppLayout>
                    <ProprietarioDashboard />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/imoveis"
              element={
                <ProtectedRoute requiredRole="proprietario">
                  <AppLayout>
                    <MeusImoveis />
                  </AppLayout>
                </ProtectedRoute>
              }
            />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

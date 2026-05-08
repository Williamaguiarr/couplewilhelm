import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import ProtectedLayout from "@/components/layout/ProtectedLayout";
import Login from "@/pages/Login";
import ResetPassword from "@/pages/ResetPassword";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import Proprietarios from "@/pages/admin/Proprietarios";
import Imoveis from "@/pages/admin/Imoveis";
import Reservas from "@/pages/admin/Reservas";
import Configuracoes from "@/pages/admin/Configuracoes";
import Calendario from "@/pages/admin/Calendario";

import ProprietarioDashboard from "@/pages/proprietario/Dashboard";
import MeusImoveis from "@/pages/proprietario/MeusImoveis";
import AdminsList from "@/pages/master/AdminsList";
import MasterDashboard from "@/pages/master/MasterDashboard";
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
          <ThemeProvider>
            <Routes>
              {/* Public */}
              <Route path="/login" element={<Login />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/setup" element={<Setup />} />
              <Route path="/" element={<Navigate to="/login" replace />} />

              {/* Master */}
              <Route element={<ProtectedLayout requiredRole="master" />}>
                <Route path="/master" element={<MasterDashboard />} />
                <Route path="/master/admins" element={<AdminsList />} />
              </Route>

              {/* Admin */}
              <Route element={<ProtectedLayout requiredRole="admin" />}>
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/admin/proprietarios" element={<Proprietarios />} />
                <Route path="/admin/imoveis" element={<Imoveis />} />
                <Route path="/admin/reservas" element={<Reservas />} />
                <Route path="/admin/configuracoes" element={<Configuracoes />} />
                <Route path="/admin/calendario" element={<Calendario />} />
                
              </Route>

              {/* Proprietário */}
              <Route element={<ProtectedLayout requiredRole="proprietario" />}>
                <Route path="/dashboard" element={<ProprietarioDashboard />} />
                <Route path="/dashboard/imoveis" element={<MeusImoveis />} />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </ThemeProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

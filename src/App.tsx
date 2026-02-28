import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import CustomerHome from "./pages/CustomerHome";
import AdminDashboard from "./pages/Index";
import BreedsPage from "./pages/BreedsPage";
import ServicesPage from "./pages/ServicesPage";
import StaffPage from "./pages/StaffPage";
import StaffDetailPage from "./pages/StaffDetailPage";
import WorkSchedulePage from "./pages/WorkSchedulePage";
import BookingsPage from "./pages/BookingsPage";
import ContractSignPage from "./pages/ContractSignPage";
import AuthPage from "./pages/AuthPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import AdminUsersPage from "./pages/AdminUsersPage";
import GroomerPortalPage from "./pages/GroomerPortalPage";
import MyPetsPage from "./pages/MyPetsPage";
import { ProtectedRoute } from "./components/ProtectedRoute";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/" element={<CustomerHome />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/contract/sign/:staffId" element={<ContractSignPage />} />

          {/* Customer only */}
          <Route path="/my-pets" element={<ProtectedRoute allowedRoles={["customer", "manager", "director"]}><MyPetsPage /></ProtectedRoute>} />

          {/* Groomer only */}
          <Route path="/portal" element={<ProtectedRoute allowedRoles={["groomer"]}><GroomerPortalPage /></ProtectedRoute>} />

          {/* Manager only */}
          <Route path="/admin" element={<ProtectedRoute allowedRoles={["manager", "director"]}><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/users" element={<ProtectedRoute allowedRoles={["director"]}><AdminUsersPage /></ProtectedRoute>} />
          <Route path="/breeds" element={<ProtectedRoute allowedRoles={["manager", "director"]}><BreedsPage /></ProtectedRoute>} />
          <Route path="/services" element={<ProtectedRoute allowedRoles={["manager", "director"]}><ServicesPage /></ProtectedRoute>} />
          <Route path="/staff" element={<ProtectedRoute allowedRoles={["manager", "director"]}><StaffPage /></ProtectedRoute>} />
          <Route path="/staff/:id" element={<ProtectedRoute allowedRoles={["manager", "director"]}><StaffDetailPage /></ProtectedRoute>} />
          <Route path="/staff/schedule" element={<ProtectedRoute allowedRoles={["manager", "director"]}><WorkSchedulePage /></ProtectedRoute>} />
          <Route path="/bookings" element={<ProtectedRoute allowedRoles={["manager", "director"]}><BookingsPage /></ProtectedRoute>} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

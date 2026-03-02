import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import CustomerHome from "./pages/CustomerHome";
import AdminDashboard from "./pages/Index";
import BreedsPage from "./pages/BreedsPage";
import AddOnsPage from "./pages/AddOnsPage";

import StaffPage from "./pages/StaffPage";
import StaffDetailPage from "./pages/StaffDetailPage";
import WorkSchedulePage from "./pages/WorkSchedulePage";
import BookingsPage from "./pages/BookingsPage";
import ContractSignPage from "./pages/ContractSignPage";
import HealthAndSafetySignPage from "./pages/HealthAndSafetySignPage";
import AuthPage from "./pages/AuthPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import AdminUsersPage from "./pages/AdminUsersPage";
import GroomerPortalPage from "./pages/GroomerPortalPage";
import MarketingPage from "./pages/MarketingPage";
import MyPetsPage from "./pages/MyPetsPage";
import IncidentReportsPage from "./pages/IncidentReportsPage";
import RiskAssessmentsPage from "./pages/RiskAssessmentsPage";
import RulesPage from "./pages/RulesPage";
import TermsEditorPage from "./pages/TermsEditorPage";
import MessagesPage from "./pages/MessagesPage";
import { ProtectedRoute } from "./components/ProtectedRoute";
import BookingEntryPage from "./pages/BookingEntryPage";
import TermsPage from "./pages/TermsPage";
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
          <Route path="/book" element={<BookingEntryPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/hs/sign/:staffId" element={<HealthAndSafetySignPage />} />

          {/* Customer only */}
          <Route path="/my-pets" element={<ProtectedRoute allowedRoles={["customer", "manager", "director"]}><MyPetsPage /></ProtectedRoute>} />

          {/* Groomer only */}
          <Route path="/portal" element={<ProtectedRoute allowedRoles={["groomer"]}><GroomerPortalPage /></ProtectedRoute>} />

          {/* Manager only */}
          <Route path="/admin" element={<ProtectedRoute allowedRoles={["manager", "director"]}><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/users" element={<ProtectedRoute allowedRoles={["director"]}><AdminUsersPage /></ProtectedRoute>} />
          <Route path="/admin/terms" element={<ProtectedRoute allowedRoles={["director"]}><TermsEditorPage /></ProtectedRoute>} />
          <Route path="/breeds" element={<ProtectedRoute allowedRoles={["director"]}><BreedsPage /></ProtectedRoute>} />
          <Route path="/add-ons" element={<ProtectedRoute allowedRoles={["manager", "director"]}><AddOnsPage /></ProtectedRoute>} />
          
          <Route path="/staff" element={<ProtectedRoute allowedRoles={["manager", "director"]}><StaffPage /></ProtectedRoute>} />
          <Route path="/staff/:id" element={<ProtectedRoute allowedRoles={["manager", "director"]}><StaffDetailPage /></ProtectedRoute>} />
          <Route path="/staff/schedule" element={<ProtectedRoute allowedRoles={["manager", "director"]}><WorkSchedulePage /></ProtectedRoute>} />
          <Route path="/staff/incidents" element={<ProtectedRoute allowedRoles={["manager", "director"]}><IncidentReportsPage /></ProtectedRoute>} />
          <Route path="/staff/risk-assessments" element={<ProtectedRoute allowedRoles={["manager", "director"]}><RiskAssessmentsPage /></ProtectedRoute>} />
          <Route path="/staff/rules" element={<ProtectedRoute allowedRoles={["manager", "director", "groomer", "volunteer", "work_placement"]}><RulesPage /></ProtectedRoute>} />
          <Route path="/bookings" element={<ProtectedRoute allowedRoles={["manager", "director"]}><BookingsPage /></ProtectedRoute>} />
          <Route path="/messages" element={<ProtectedRoute allowedRoles={["manager", "director", "groomer"]}><MessagesPage /></ProtectedRoute>} />
          <Route path="/marketing/*" element={<ProtectedRoute allowedRoles={["manager", "director"]}><MarketingPage /></ProtectedRoute>} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

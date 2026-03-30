import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import CustomerHome from "./pages/CustomerHome";

declare global {
  interface Window {
    gtag: (...args: any[]) => void;
    dataLayer: any[];
  }
}

function RouteTracker() {
  const location = useLocation();
  useEffect(() => {
    if (typeof window.gtag === "function") {
      window.gtag("event", "page_view", {
        page_path: location.pathname,
        page_title: document.title,
      });
    }
  }, [location.pathname]);
  return null;
}
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
import CouponsPage from "./pages/CouponsPage";
import CustomerProfilePage from "./pages/CustomerProfilePage";
import FinancePage from "./pages/FinancePage";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { ScrollToTop } from "./components/ScrollToTop";
import BookingEntryPage from "./pages/BookingEntryPage";
import TermsPage from "./pages/TermsPage";
import BookingSuccessPage from "./pages/BookingSuccessPage";
import NotFound from "./pages/NotFound";
import ErrorReportsPage from "./pages/ErrorReportsPage";
import SystemHealthPage from "./pages/SystemHealthPage";
import TestRunnerPage from "./pages/TestRunnerPage";
import MigrationPage from "./pages/MigrationPage";
import WelcomePage from "./pages/WelcomePage";
import BookingPriorityPage from "./pages/BookingPriorityPage";
import ScruffConversationsPage from "./pages/ScruffConversationsPage";
import ScruffHandoffsPage from "./pages/ScruffHandoffsPage";
import ScruffSettingsPage from "./pages/ScruffSettingsPage";
import WixMigrationPage from "./pages/WixMigrationPage";
import HistoricalDataPage from "./pages/HistoricalDataPage";
import DuplicateReportPage from "./pages/DuplicateReportPage";
import AcademyPage from "./pages/AcademyPage";
import AcademyEnquiriesPage from "./pages/AcademyEnquiriesPage";
import PurchaseOrdersPage from "./pages/PurchaseOrdersPage";
import PackagesPage from "./pages/PackagesPage";
import UnsubscribePage from "./pages/UnsubscribePage";
import SmsTrackPage from "./pages/SmsTrackPage";
import SignPackageTCPage from "./pages/SignPackageTCPage";
import PublicPackagesPage from "./pages/PublicPackagesPage";
import BookPackagePage from "./pages/BookPackagePage";
import PackageBookingConfirmedPage from "./pages/PackageBookingConfirmedPage";
import DirectorAssistantPage from "./pages/DirectorAssistantPage";
import GroomerAssistantPage from "./pages/GroomerAssistantPage";
import ActivityLogPage from "./pages/ActivityLogPage";
import AdminInboxPage from "./pages/AdminInboxPage";
import GroomerInboxPage from "./pages/GroomerInboxPage";
const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ScrollToTop />
        <RouteTracker />
        <Routes>
          {/* Public */}
          <Route path="/" element={<CustomerHome />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/contract/sign/:staffId" element={<ContractSignPage />} />
          <Route path="/book" element={<BookingEntryPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/hs/sign/:staffId" element={<HealthAndSafetySignPage />} />
          <Route path="/booking-success" element={<BookingSuccessPage />} />
          <Route path="/welcome" element={<WelcomePage />} />
          <Route path="/academy" element={<AcademyPage />} />
          <Route path="/unsubscribe" element={<UnsubscribePage />} />
          <Route path="/track" element={<SmsTrackPage />} />
          <Route path="/sign-package-tc" element={<SignPackageTCPage />} />
          <Route path="/packages" element={<PublicPackagesPage />} />
          <Route path="/book-package" element={<BookPackagePage />} />
          <Route path="/package-booking-confirmed" element={<PackageBookingConfirmedPage />} />
          {/* Old Wix URL redirects */}
          <Route path="/blank" element={<Navigate to="/" replace />} />
          <Route path="/services-2" element={<Navigate to="/" replace />} />
          <Route path="/booking-form" element={<Navigate to="/book" replace />} />
          <Route path="/about" element={<Navigate to="/" replace />} />
          <Route path="/contact" element={<Navigate to="/" replace />} />

          {/* Customer only */}
          <Route path="/my-pets" element={<ProtectedRoute allowedRoles={["customer", "groomer"]}><MyPetsPage /></ProtectedRoute>} />

          {/* Groomer only */}
          <Route path="/portal" element={<ProtectedRoute allowedRoles={["groomer"]}><GroomerPortalPage /></ProtectedRoute>} />
          <Route path="/portal/bookings" element={<ProtectedRoute allowedRoles={["groomer"]}><GroomerPortalPage /></ProtectedRoute>} />
          <Route path="/portal/messages" element={<ProtectedRoute allowedRoles={["groomer"]}><GroomerPortalPage /></ProtectedRoute>} />
          <Route path="/portal/purchases" element={<ProtectedRoute allowedRoles={["groomer"]}><GroomerPortalPage /></ProtectedRoute>} />
          <Route path="/portal/breeds" element={<ProtectedRoute allowedRoles={["groomer"]}><GroomerPortalPage /></ProtectedRoute>} />
          <Route path="/portal/finance" element={<ProtectedRoute allowedRoles={["groomer"]}><GroomerPortalPage /></ProtectedRoute>} />
          <Route path="/portal/documents" element={<ProtectedRoute allowedRoles={["groomer"]}><GroomerPortalPage /></ProtectedRoute>} />
          <Route path="/portal/assistant" element={<ProtectedRoute allowedRoles={["groomer"]}><GroomerAssistantPage /></ProtectedRoute>} />

          {/* Manager only */}
          <Route path="/admin" element={<ProtectedRoute allowedRoles={["manager", "director"]}><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/users" element={<ProtectedRoute allowedRoles={["director"]}><AdminUsersPage /></ProtectedRoute>} />
          <Route path="/admin/terms" element={<ProtectedRoute allowedRoles={["director"]}><TermsEditorPage /></ProtectedRoute>} />
          <Route path="/admin/coupons" element={<ProtectedRoute allowedRoles={["director"]}><CouponsPage /></ProtectedRoute>} />
          <Route path="/breeds" element={<ProtectedRoute allowedRoles={["director"]}><BreedsPage /></ProtectedRoute>} />
          <Route path="/add-ons" element={<ProtectedRoute allowedRoles={["manager", "director"]}><AddOnsPage /></ProtectedRoute>} />
          
          <Route path="/staff" element={<ProtectedRoute allowedRoles={["manager", "director"]}><StaffPage /></ProtectedRoute>} />
          <Route path="/staff/:id" element={<ProtectedRoute allowedRoles={["manager", "director"]}><StaffDetailPage /></ProtectedRoute>} />
          <Route path="/staff/schedule" element={<ProtectedRoute allowedRoles={["manager", "director"]}><WorkSchedulePage /></ProtectedRoute>} />
          <Route path="/staff/priority" element={<ProtectedRoute allowedRoles={["director"]}><BookingPriorityPage /></ProtectedRoute>} />
          <Route path="/staff/incidents" element={<ProtectedRoute allowedRoles={["manager", "director"]}><IncidentReportsPage /></ProtectedRoute>} />
          <Route path="/staff/risk-assessments" element={<ProtectedRoute allowedRoles={["manager", "director"]}><RiskAssessmentsPage /></ProtectedRoute>} />
          <Route path="/staff/rules" element={<ProtectedRoute allowedRoles={["manager", "director", "groomer", "volunteer", "work_placement"]}><RulesPage /></ProtectedRoute>} />
          <Route path="/bookings" element={<ProtectedRoute allowedRoles={["manager", "director"]}><BookingsPage /></ProtectedRoute>} />
          <Route path="/purchase-orders" element={<ProtectedRoute allowedRoles={["manager", "director"]}><PurchaseOrdersPage /></ProtectedRoute>} />
          <Route path="/admin/packages" element={<ProtectedRoute allowedRoles={["manager", "director", "groomer"]}><PackagesPage /></ProtectedRoute>} />
          <Route path="/finance" element={<ProtectedRoute allowedRoles={["manager", "director"]}><FinancePage /></ProtectedRoute>} />
          <Route path="/messages" element={<ProtectedRoute allowedRoles={["manager", "director", "groomer"]}><MessagesPage /></ProtectedRoute>} />
          <Route path="/admin/customers/:email" element={<ProtectedRoute allowedRoles={["manager", "director", "groomer"]}><CustomerProfilePage /></ProtectedRoute>} />
          <Route path="/marketing/*" element={<ProtectedRoute allowedRoles={["manager", "director"]}><MarketingPage /></ProtectedRoute>} />
          <Route path="/admin/error-reports" element={<ProtectedRoute allowedRoles={["manager", "director"]}><ErrorReportsPage /></ProtectedRoute>} />
          <Route path="/admin/health" element={<ProtectedRoute allowedRoles={["director"]}><SystemHealthPage /></ProtectedRoute>} />
          <Route path="/admin/tests" element={<ProtectedRoute allowedRoles={["director"]}><TestRunnerPage /></ProtectedRoute>} />
          <Route path="/admin/scruff/conversations" element={<ProtectedRoute allowedRoles={["manager", "director"]}><ScruffConversationsPage /></ProtectedRoute>} />
          <Route path="/admin/scruff/handoffs" element={<ProtectedRoute allowedRoles={["manager", "director"]}><ScruffHandoffsPage /></ProtectedRoute>} />
          <Route path="/admin/scruff/settings" element={<ProtectedRoute allowedRoles={["director"]}><ScruffSettingsPage /></ProtectedRoute>} />
          <Route path="/admin/migration" element={<ProtectedRoute allowedRoles={["manager", "director"]}><MigrationPage /></ProtectedRoute>} />
          <Route path="/admin/wix-migration" element={<ProtectedRoute allowedRoles={["manager", "director"]}><WixMigrationPage /></ProtectedRoute>} />
          <Route path="/admin/historical" element={<ProtectedRoute allowedRoles={["manager", "director"]}><HistoricalDataPage /></ProtectedRoute>} />
          <Route path="/admin/duplicate-report" element={<ProtectedRoute allowedRoles={["director"]}><DuplicateReportPage /></ProtectedRoute>} />
          <Route path="/admin/director-assistant" element={<ProtectedRoute allowedRoles={["director"]}><DirectorAssistantPage /></ProtectedRoute>} />
          <Route path="/admin/academy" element={<ProtectedRoute allowedRoles={["director", "manager"]}><AcademyEnquiriesPage /></ProtectedRoute>} />
          <Route path="/admin/activity-log" element={<ProtectedRoute allowedRoles={["director"]}><ActivityLogPage /></ProtectedRoute>} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

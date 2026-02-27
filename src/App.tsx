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
import BookingsPage from "./pages/BookingsPage";
import ContractSignPage from "./pages/ContractSignPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Customer-facing */}
          <Route path="/" element={<CustomerHome />} />

          {/* Admin / Management */}
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/breeds" element={<BreedsPage />} />
          <Route path="/services" element={<ServicesPage />} />
          <Route path="/staff" element={<StaffPage />} />
          <Route path="/staff/:id" element={<StaffDetailPage />} />
          <Route path="/bookings" element={<BookingsPage />} />
          <Route path="/contract/sign/:staffId" element={<ContractSignPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

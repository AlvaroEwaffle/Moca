import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';

// Import our new Moca components
import Landing from "./pages/Landing";
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import Onboarding from "./pages/auth/Onboarding";
import Dashboard from "./pages/dashboard/Dashboard";
import BillingInterface from "./pages/billing/BillingInterface";
import CreatePatient from "./pages/patients/CreatePatient";
import AppointmentsPage from "./pages/appointments/AppointmentsPage";
import AppointmentsList from "./pages/appointments/AppointmentsList";
import CreateAppointmentPage from "./pages/appointments/CreateAppointmentPage";
import CalendarAuthSuccess from "./pages/appointments/CalendarAuthSuccess";
import CalendarAuthError from "./pages/appointments/CalendarAuthError";
import MainLayout from "./components/layout/MainLayout";

// Placeholder components for other routes
const BillingPage = () => (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center">
    <div className="text-center">
      <h1 className="text-3xl font-bold text-gray-900 mb-4">💰 Gestión de Facturación</h1>
      <p className="text-gray-600 mb-6">Esta funcionalidad estará disponible próximamente</p>
      <button 
        onClick={() => window.history.back()} 
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
      >
        Volver
      </button>
    </div>
  </div>
);



const EditAppointmentPage = () => (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center">
    <div className="text-center">
      <h1 className="text-3xl font-bold text-gray-900 mb-4">✏️ Editar Cita</h1>
      <p className="text-gray-600 mb-6">Esta funcionalidad estará disponible próximamente</p>
      <button 
        onClick={() => window.history.back()} 
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
      >
        Volver
      </button>
    </div>
  </div>
);

const ViewAppointmentPage = () => (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center">
    <div className="text-center">
      <h1 className="text-3xl font-bold text-gray-900 mb-4">👁️ Ver Cita</h1>
      <p className="text-gray-600 mb-6">Esta funcionalidad estará disponible próximamente</p>
      <button 
        onClick={() => window.history.back()} 
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
      >
        Volver
      </button>
    </div>
  </div>
);

const CreateBillingPage = () => (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center">
    <div className="text-center">
      <h1 className="text-3xl font-bold text-gray-900 mb-4">💰 Crear Nueva Factura</h1>
      <p className="text-gray-600 mb-6">Esta funcionalidad estará disponible próximamente</p>
      <button 
        onClick={() => window.history.back()} 
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
      >
        Volver
      </button>
    </div>
  </div>
);

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <Router>
          <Helmet>
            <title>Moca - Instagram DM Agent</title>
            <meta name="description" content="Sistema integral de gestión para prácticas de salud mental" />
          </Helmet>
          
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/onboarding" element={<Onboarding />} />
            
            {/* Protected routes */}
            <Route path="/app" element={<MainLayout />}>
              <Route index element={<Navigate to="/app/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="patients/create" element={<CreatePatient />} />
              <Route path="appointments" element={<AppointmentsPage />} />
              <Route path="appointments/list" element={<AppointmentsList />} />
              <Route path="appointments/create" element={<CreateAppointmentPage />} />
              <Route path="appointments/edit/:id" element={<EditAppointmentPage />} />
              <Route path="appointments/view/:id" element={<ViewAppointmentPage />} />
              <Route path="billing" element={<BillingPage />} />
              <Route path="billing/create" element={<CreateBillingPage />} />
              <Route path="facturacion" element={<BillingInterface />} />
            </Route>

            {/* Google Calendar OAuth callback routes (public) */}
            <Route path="/calendar-auth-success" element={<CalendarAuthSuccess />} />
            <Route path="/calendar-auth-error" element={<CalendarAuthError />} />
            
            {/* Catch all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

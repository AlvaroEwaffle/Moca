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
import InstagramSetup from "./pages/instagram/InstagramSetup";
import MainLayout from "./components/layout/MainLayout";

// Phase 2: Conversation Management
import ConversationsList from "./pages/conversations/ConversationsList";
import ConversationDetail from "./pages/conversations/ConversationDetail";
import SendMessage from "./pages/conversations/SendMessage";

// Phase 3: System Management
import QueueStatus from "./pages/system/QueueStatus";
import SystemLogs from "./pages/system/SystemLogs";
import InstagramAccounts from "./pages/system/InstagramAccounts";

// Instagram OAuth
import InstagramAuth from "./pages/auth/InstagramAuth";
import InstagramCallback from "./pages/auth/InstagramCallback";



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
            <Route path="/instagram-auth" element={<InstagramAuth />} />
            <Route path="/instagram-callback" element={<InstagramCallback />} />
            
            {/* Protected routes */}
            <Route path="/app" element={<MainLayout />}>
              <Route index element={<Navigate to="/app/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              
              {/* Phase 2: Conversation Management */}
              <Route path="conversations" element={<ConversationsList />} />
              <Route path="conversations/:id" element={<ConversationDetail />} />
              <Route path="send-message" element={<SendMessage />} />
              
              {/* Phase 3: System Management */}
              <Route path="queue" element={<QueueStatus />} />
              <Route path="logs" element={<SystemLogs />} />
              <Route path="accounts" element={<InstagramAccounts />} />
              
              {/* Instagram Setup */}
              <Route path="instagram" element={<InstagramSetup />} />
            </Route>
            
            {/* Catch all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

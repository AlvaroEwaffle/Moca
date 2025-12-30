import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { AuthProvider } from './context/AuthContext';

// Import our new Moca components
import Landing from "./pages/Landing";
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import Onboarding from "./pages/auth/Onboarding";
import Dashboard from "./pages/dashboard/Dashboard";
import MainLayout from "./components/layout/MainLayout";

// Gmail
import GmailDashboard from "./pages/gmail/GmailDashboard";
import GmailFetcher from "./pages/gmail/GmailFetcher";
import GmailFetchRules from "./pages/gmail/GmailFetchRules";
import GmailFetchRuleForm from "./pages/gmail/GmailFetchRuleForm";
import GmailDrafts from "./pages/gmail/GmailDrafts";
import GmailDraftDetail from "./pages/gmail/GmailDraftDetail";

// Phase 2: Conversation Management
import ConversationsList from "./pages/conversations/ConversationsList";
import ConversationsKanban from "./pages/conversations/ConversationsKanban";
import ConversationDetail from "./pages/conversations/ConversationDetail";
import SendMessage from "./pages/conversations/SendMessage";

// Phase 3: System Management
import QueueStatus from "./pages/system/QueueStatus";
import SystemLogs from "./pages/system/SystemLogs";
import InstagramAccounts from "./pages/system/InstagramAccounts";

// Analytics
import AnalyticsDashboard from "./pages/analytics/AnalyticsDashboard";

// Instagram OAuth
import InstagramAuth from "./pages/auth/InstagramAuth";
import InstagramCallback from "./pages/auth/InstagramCallback";
import GoogleOAuthCallback from "./pages/auth/GoogleOAuthCallback";

// Legal Pages
import PrivacyPolicy from "./pages/legal/PrivacyPolicy";
import TermsOfService from "./pages/legal/TermsOfService";
import DataDeletion from "./pages/legal/DataDeletion";



const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AuthProvider>
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
              <Route path="/google-oauth-callback" element={<GoogleOAuthCallback />} />
              
              {/* Legal pages */}
              <Route path="/privacy-policy" element={<PrivacyPolicy />} />
              <Route path="/terms-of-service" element={<TermsOfService />} />
              <Route path="/data-deletion" element={<DataDeletion />} />
              
              {/* Protected routes */}
              <Route path="/app" element={<MainLayout />}>
                <Route index element={<Navigate to="/app/dashboard" replace />} />
                <Route path="dashboard" element={<Dashboard />} />
                
                {/* Phase 2: Conversation Management */}
                <Route path="conversations" element={<ConversationsList />} />
                <Route path="conversations-kanban" element={<ConversationsKanban />} />
                <Route path="conversations/:id" element={<ConversationDetail />} />
                <Route path="send-message" element={<SendMessage />} />

                {/* Gmail */}
                <Route path="gmail" element={<GmailDashboard />} />
                <Route path="gmail/fetcher" element={<GmailFetcher />} />
                <Route path="gmail/rules" element={<GmailFetchRules />} />
                <Route path="gmail/rules/new" element={<GmailFetchRuleForm />} />
                <Route path="gmail/rules/:id" element={<GmailFetchRuleForm />} />
              {/* Backward compatibility with previous link */}
              <Route path="gmail/agent-creator" element={<Navigate to="/app/gmail/rules/new" replace />} />
                <Route path="gmail/drafts" element={<GmailDrafts />} />
                <Route path="gmail/drafts/:id" element={<GmailDraftDetail />} />
                
                {/* Phase 3: System Management */}
                <Route path="queue" element={<QueueStatus />} />
                <Route path="logs" element={<SystemLogs />} />
              <Route path="instagram" element={<InstagramAccounts />} />
              <Route path="accounts" element={<Navigate to="/app/instagram" replace />} />
                
                {/* Analytics */}
                <Route path="analytics" element={<AnalyticsDashboard />} />
                
              </Route>
              
              {/* Catch all */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Router>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

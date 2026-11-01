import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/context/AuthContext";
import Layout from "@/components/Layout";
import { RequireAuth, RequireRole } from "@/components/Guard";
import Landing from "@/pages/Landing";
import Login from "@/pages/auth/Login";
import RegisterCompany from "@/pages/auth/RegisterCompany";
import ForgotPassword from "@/pages/auth/ForgotPassword";
import ResetPassword from "@/pages/auth/ResetPassword";
import VerifyEmail from "@/pages/auth/VerifyEmail";
import HRDashboard from "@/pages/hr/HRDashboard";
import CreateExam from "@/pages/hr/CreateExam";
import ExamQuestions from "@/pages/hr/ExamQuestions";
import ExamInvitations from "@/pages/hr/ExamInvitations";
import ExamMonitor from "@/pages/hr/ExamMonitor";
import ExamResults from "@/pages/hr/ExamResults";
import AlertsConsole from "@/pages/hr/AlertsConsole";
import CandidateDashboard from "@/pages/candidate/CandidateDashboard";
import InvitationLanding from "@/pages/candidate/InvitationLanding";
import ExamInstructions from "@/pages/candidate/ExamInstructions";
import ExamRunner from "@/pages/candidate/ExamRunner";
import Submitted from "@/pages/candidate/Submitted";
import AdminDashboard from "@/pages/admin/AdminDashboard";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<RegisterCompany />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/candidate/invitation/:token" element={<InvitationLanding />} />
          <Route element={<RequireAuth><Layout /></RequireAuth>}>
            <Route path="/hr" element={<RequireRole role="hr"><HRDashboard /></RequireRole>} />
            <Route path="/hr/exams/new" element={<RequireRole role="hr"><CreateExam /></RequireRole>} />
            <Route path="/hr/exams/:examId/edit" element={<RequireRole role="hr"><CreateExam edit /></RequireRole>} />
            <Route path="/hr/exams/:examId/questions" element={<RequireRole role="hr"><ExamQuestions /></RequireRole>} />
            <Route path="/hr/exams/:examId/invitations" element={<RequireRole role="hr"><ExamInvitations /></RequireRole>} />
            <Route path="/hr/exams/:examId/monitor" element={<RequireRole role="hr"><ExamMonitor /></RequireRole>} />
            <Route path="/hr/exams/:examId/results" element={<RequireRole role="hr"><ExamResults /></RequireRole>} />
            <Route path="/alerts" element={<RequireRole role="hr"><AlertsConsole /></RequireRole>} />
            <Route path="/candidate" element={<RequireRole role="candidate"><CandidateDashboard /></RequireRole>} />
            <Route path="/candidate/exam/:examId" element={<RequireRole role="candidate"><ExamInstructions /></RequireRole>} />
            <Route path="/candidate/exam/:examId/run" element={<RequireRole role="candidate"><ExamRunner /></RequireRole>} />
            <Route path="/candidate/submitted" element={<RequireRole role="candidate"><Submitted /></RequireRole>} />
            <Route path="/admin" element={<RequireRole role="admin"><AdminDashboard /></RequireRole>} />
          </Route>
          <Route path="*" element={<Landing />} />
        </Routes>
        <Toaster richColors position="top-right" />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;

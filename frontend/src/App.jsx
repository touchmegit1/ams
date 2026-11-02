import { useEffect, useLayoutEffect } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
} from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { AuthProvider } from "./context/AuthContext.jsx";
import ProtectedRoute from "./components/common/ProtectedRoute.jsx";
import LoginPage from "./pages/auth/LoginPage.jsx";
import RegisterPage from "./pages/auth/RegisterPage.jsx";
import VerifyOtpPage from "./pages/auth/VerifyOtpPage.jsx";
import ForgotPasswordPage from "./pages/auth/ForgotPasswordPage.jsx";
import ResetPasswordPage from "./pages/auth/ResetPasswordPage.jsx";
import DashboardPage from "./pages/dashboard/DashboardPage.jsx";
import ProfilePage from "./pages/profile/ProfilePage.jsx";
import AssignmentLayout from "./components/assignments/AssignmentLayout.jsx";
import AssignmentListPage from "./pages/assignments/AssignmentListPage.jsx";
import AssignmentDetailPage from "./pages/assignments/AssignmentDetailPage.jsx";
import AssignmentFormPage from "./pages/assignments/AssignmentFormPage.jsx";
import AdminPage from "./pages/admin/AdminPage.jsx";
import TeacherWorkspaceLayout from "./pages/dashboard/TeacherWorkspaceLayout.jsx";
import CourseManagementPage from "./pages/course/CourseManagementPage.jsx";
import CourseCurriculumPage from "./pages/course/CourseCurriculumPage.jsx";
import TeacherStudentsPage from "./pages/course/TeacherStudentsPage.jsx";
import { useAuth } from "./context/AuthContext.jsx";

function ApiNavigation() {
  const navigate = useNavigate();
  useEffect(() => {
    const forbidden = () => navigate("/forbidden");
    window.addEventListener("ams:forbidden", forbidden);
    return () => window.removeEventListener("ams:forbidden", forbidden);
  }, [navigate]);
  return null;
}

function PageMotion({ children }) {
  const { pathname } = useLocation();
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname]);
  return (
    <div className="ams-page-motion" key={pathname}>
      {children}
    </div>
  );
}

function AdminRoute() {
  const { user } = useAuth();
  return user?.role === "ADMIN" ? (
    <AdminPage />
  ) : (
    <Navigate to="/dashboard" replace />
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ApiNavigation />
        <PageMotion>
          <Routes>
            {/* Auth routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/verify-otp" element={<VerifyOtpPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />

            {/* Protected routes */}
            <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
            <Route element={<ProtectedRoute><TeacherWorkspaceLayout /></ProtectedRoute>}>
              <Route path="/courses" element={<CourseManagementPage />} />
              <Route path="/courses/:courseId" element={<CourseCurriculumPage />} />
            </Route>

            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <AdminRoute />
                </ProtectedRoute>
              }
            />

            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <ProfilePage />
                </ProtectedRoute>
              }
            />

            {/* Teacher routes */}
            <Route
              path="/teacher"
              element={
                <ProtectedRoute>
                  <AssignmentLayout />
                </ProtectedRoute>
              }
            >
              <Route path="assignments" element={<AssignmentListPage />} />
              <Route path="assignments/new" element={<AssignmentFormPage />} />
              <Route
                path="assignments/ai-review"
                element={<AssignmentFormPage review />}
              />
              <Route
                path="assignments/:id"
                element={<AssignmentDetailPage />}
              />
              <Route
                path="assignments/:id/edit"
                element={<AssignmentFormPage />}
              />
              <Route
                path="assignment-templates"
                element={<AssignmentListPage templates />}
              />
              <Route
                path="assignment-templates/:id"
                element={<AssignmentDetailPage template />}
              />
              <Route path="students" element={<TeacherStudentsPage />} />
            </Route>
            <Route
              path="/forbidden"
              element={
                <div className="assignment-main">
                  <h1>Bạn không có quyền truy cập</h1>
                  <a href="/dashboard">Về trang chủ</a>
                </div>
              }
            />
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </PageMotion>
        <ToastContainer
          position="top-right"
          autoClose={4000}
          hideProgressBar
          icon={false}
          closeOnClick
          pauseOnHover
          toastClassName="ams-toast"
        />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;

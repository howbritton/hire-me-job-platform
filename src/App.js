import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import LayoutWrapper from './Components/Layout/LayoutWrapper';
import Home from './Components/Home';
import Jobs from './Components/Jobs';
import JobDetails from './Components/JobDetails';
import Pricing from './Components/Pricing';
import AboutUs from './Components/AboutUs';
import ContactUs from './Components/ContactUs';
import CandidateRegistration from './Components/CandidateRegistration';
import EmployerRegistration from './Components/EmployerRegistration';
import CandidateSignIn from './Components/CandidateSignIn';
import EmployerSignIn from './Components/EmployerSignIn';
import CandidateLayout from './Components/Dashboard/CandidateLayout';
import CandidateProfile from './Components/Dashboard/CandidateProfile';
import ViewCandidateProfile from './Components/candidate/ViewCandidateProfile';
import EditCandidateProfile from './Components/candidate/EditCandidateProfile';
import CandidatePersonalResume from './Components/Dashboard/CandidatePersonalResume';
import ResumeUpload from './Components/Dashboard/ResumeUpload';
import FavoriteJobs from './Components/Dashboard/FavoriteJobs';
import AppliedJobs from './Components/Dashboard/AppliedJobs';
import EmployerLayout from './Components/Dashboard/EmployerLayout';
import PaymentHistory from './Components/Dashboard/PaymentHistory';
import EmployerProfile from './Components/Dashboard/EmployerProfile';
import EmployerJobs from './Components/Employer/EmployerJobs';
import CandidateResumes from './Components/Dashboard/CandidateResumes';
import Questions from './Components/Dashboard/Questions';
import Applications from './Components/Dashboard/Applications';
import EmployerFavorites from './Components/Dashboard/EmployerFavorites';
import Subscription from './Components/Dashboard/Subscription';
import Checkout from './Components/Dashboard/Checkout';
// Admin imports
import ExpiredJobs from './Components/Admin/ExpiredJobs';
import AdminLogin from './Components/Admin/AdminLogin';
import AdminLayout from './Components/Admin/AdminLayout';
import AdminDashboard from './Components/Admin/AdminDashboard';
import AllEmployers from './Components/Admin/AllEmployers';
import AllCandidates from './Components/Admin/AllCandidates';
import AdminResumes from './Components/Admin/AdminResumes';
import ApprovedJobs from './Components/Admin/ApprovedJobs';
import UserManagement from './Components/Admin/UserManagement';
import AllJobs from './Components/Admin/AllJobs';
import ApproveJobs from './Components/Admin/ApproveJobs';
import Transactions from './Components/Admin/Transactions';
import Packages from './Components/Admin/Packages';
import Reviews from './Components/Admin/Reviews';
import PromoCodes from './Components/Admin/PromoCodes';
import Messages from './Components/Admin/Messages';
import AdminTemporaryWorkersList from './Components/Admin/AdminTemporaryWorkersList';
import IncompleteProfiles from './Components/Admin/IncompleteProfiles'; // Add this import
import PrivateRoute from './Components/Routes/PrivateRoute';
import AdminRoute from './Components/Routes/AdminRoute';
import 'react-toastify/dist/ReactToastify.css';
import PrivacyPolicy from './Components/PrivacyPolicy';
import TermsOfService from './Components/TermsOfService';
import FAQ from './Components/FAQ';
import TemporaryWorkersForm from './Components/TemporaryWorkersForm';
import TemporaryWorkersList from './Components/TemporaryWorkersList';
import ForgotPassword from './Components/ForgotPassword';
import EmailServiceTest from './Components/Admin/EmailServiceTest';
import './App.css';
import PaymentCallback from './Components/Payment/PaymentCallback';
import PaymentSuccess from './Components/Payment/PaymentSuccess';
import PaymentFailure from './Components/Payment/PaymentFailure';
import PaymentCancel from './Components/Payment/PaymentCancel';
import OrderConfirmation from './Components/OrderConfirmation';
import CompletedProfilesList from './Components/Admin/CompletedProfilesList';
import RejectedJobs from './Components/Admin/RejectedJobs';
import AdminEmailTest from './Components/AdminEmailTest';
import ExpiredProfiles from './Components/Admin/ExpiredProfiles';

function App() {
  return (
    <Router>
      <LayoutWrapper>
        <ToastContainer
          position="top-right"
          autoClose={5000}
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme="light"
        />
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Home />} />
          <Route path="/jobs" element={<Jobs />} />
          <Route path="/jobs/:id" element={<JobDetails />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/about-us" element={<AboutUs />} />
          <Route path="/contact" element={<ContactUs />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="/faq" element={<FAQ />} />
          <Route path="/temporary-workers" element={<TemporaryWorkersList />} />
          <Route path="/temporary-workers/apply" element={<TemporaryWorkersForm />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/order-confirmation" element={<OrderConfirmation />} />

          {/* Auth Routes */}
          <Route path="/employer-sign-in" element={<EmployerSignIn />} />
          <Route path="/candidate-sign-in" element={<CandidateSignIn />} />
          <Route path="/employer-registration" element={<EmployerRegistration />} />
          <Route path="/candidate-registration" element={<CandidateRegistration />} />
          <Route path="/admin-login" element={<AdminLogin />} />

          {/* Protected Candidate Dashboard Routes */}
          <Route
            path="/candidate"
            element={
              <PrivateRoute>
                <CandidateLayout />
              </PrivateRoute>
            }
          >
            <Route path="profile" element={<CandidateProfile />} />
            <Route path="profile/edit/:id" element={<EditCandidateProfile />} />
            <Route path="resume/edit" element={<ResumeUpload />} />
            <Route path="resume" element={<CandidatePersonalResume />} />
            <Route path="favorites" element={<FavoriteJobs />} />
            <Route path="applied" element={<AppliedJobs />} />
            {/* Redirect /candidate to /candidate/profile */}
            <Route index element={<Navigate to="/candidate/profile" replace />} />
          </Route>

          {/* Protected Employer Dashboard Routes */}
          <Route
            path="/employer"
            element={
              <PrivateRoute>
                <EmployerLayout />
              </PrivateRoute>
            }
          >
            <Route path="profile" element={<EmployerProfile />} />
            <Route path="jobs" element={<EmployerJobs />} />
            <Route path="resumes" element={<CandidateResumes />} />
            <Route path="resumes/:id" element={<ViewCandidateProfile />} />
            <Route path="questions" element={<Questions />} />
            <Route path="applications" element={<Applications />} />
            <Route path="favorites" element={<EmployerFavorites />} />
            <Route path="subscription" element={<Subscription />} />
            <Route path="payments" element={<PaymentHistory />} />
            {/* Redirect /employer to /employer/profile */}
            <Route index element={<Navigate to="/employer/profile" replace />} />
          </Route>

          {/* Payment Routes */}
          
          <Route 
            path="/checkout" 
            element={
              <PrivateRoute>
                <Checkout />
              </PrivateRoute>
            } 
          />
          <Route 
            path="/payment/callback" 
            element={
              <PrivateRoute>
                <PaymentCallback />
              </PrivateRoute>
            } 
          />
          <Route 
            path="/payment/success" 
            element={
              <PrivateRoute>
                <PaymentSuccess />
              </PrivateRoute>
            } 
          />
          <Route 
            path="/payment/failure" 
            element={
              <PrivateRoute>
                <PaymentFailure />
              </PrivateRoute>
            } 
          />
          <Route 
            path="/payment/cancel" 
            element={
              <PrivateRoute>
                <PaymentCancel />
              </PrivateRoute>
            } 
          />

          <Route path="/test/admin-email" element={<AdminEmailTest />} />

          {/* Protected Admin Dashboard Routes */}
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminLayout />
              </AdminRoute>
            }
          >
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="users" element={<UserManagement />} />
            <Route path="employers" element={<AllEmployers />} />
            <Route path="candidates" element={<AllCandidates />} />
            <Route path="completed-profiles" element={<CompletedProfilesList />} /> 
            <Route path="incomplete-profiles" element={<IncompleteProfiles />} />
            <Route path="expired-profiles" element={<ExpiredProfiles />} />
            <Route path="all-jobs" element={<AllJobs />} />
            <Route path="approve-jobs" element={<ApproveJobs />} />
            <Route path="jobs" element={<ApprovedJobs />} />
            <Route path="transactions" element={<Transactions />} />
            <Route path="resumes" element={<AdminResumes />} />
            <Route path="packages" element={<Packages />} />
            <Route path="reviews" element={<Reviews />} />
            <Route path="promo-codes" element={<PromoCodes />} />
            <Route path="messages" element={<Messages />} />
            <Route path="temporary-workers" element={<AdminTemporaryWorkersList />} />
            <Route path="email-test" element={<EmailServiceTest />} />
            <Route path="expired-jobs" element={<ExpiredJobs />} />
            <Route path="rejected-jobs" element={<RejectedJobs />} />
            {/* Redirect /admin to /admin/dashboard */}
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
          </Route>

          {/* 404 Route */}
          <Route 
            path="*" 
            element={
              <div className="flex justify-center items-center min-h-[60vh]">
                <div className="text-center">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">404 - Page Not Found</h2>
                  <p className="text-gray-600">The page you're looking for doesn't exist.</p>
                </div>
              </div>
            } 
          />
        </Routes>
      </LayoutWrapper>
    </Router>
  );
}

export default App;
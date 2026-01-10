import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import CandidateLayout from './CandidateLayout';
import CandidateProfile from './dashboard/CandidateProfile';
import ResumeUpload from './dashboard/ResumeUpload';
import FavoriteJobs from './dashboard/FavoriteJobs';

const CandidateDashboard = () => {
  return (
    <CandidateLayout>
      <Routes>
        <Route path="/" element={<Navigate to="/candidate/dashboard" replace />} />
        <Route path="/dashboard" element={<CandidateProfile />} />
        <Route path="/resume" element={<ResumeUpload />} />
        <Route path="/favorites" element={<FavoriteJobs />} />
      </Routes>
    </CandidateLayout>
  );
};

export default CandidateDashboard;
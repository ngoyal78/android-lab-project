import React from 'react';
import { Routes, Route } from 'react-router-dom';
import ArtifactManagement from '../components/ArtifactManagement';
import ArtifactDeployment from '../components/artifacts/ArtifactDeployment';

const ArtifactManagementPage: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<ArtifactManagement />} />
      <Route path="/deploy" element={<ArtifactDeployment />} />
    </Routes>
  );
};

export default ArtifactManagementPage;

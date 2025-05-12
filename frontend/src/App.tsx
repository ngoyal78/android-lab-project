import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import TargetDetail from './pages/TargetDetail';
import TargetList from './pages/TargetList';
import TestDetail from './pages/TestDetail';
import TestList from './pages/TestList';
import UserManagement from './pages/UserManagement';
import RemoteAccess from './pages/RemoteAccess';
import Reservations from './pages/Reservations';
import GatewayList from './pages/GatewayList';
import GatewayDetail from './pages/GatewayDetail';
import TargetGatewayAssociations from './pages/TargetGatewayAssociations';
import ScenarioComposerPage from './pages/ScenarioComposerPage';
import VirtualTargetOrchestrationPage from './pages/VirtualTargetOrchestrationPage';
import VirtualTargetOrchestrationTest from './pages/VirtualTargetOrchestrationTest';
import TopologyEditorPage from './pages/TopologyEditorPage';
import ArtifactManagementPage from './pages/ArtifactManagementPage';
import NotFound from './pages/NotFound';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider } from './contexts/AuthContext';

function App() {
  return (
    <div className="app">
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="targets" element={<TargetList />} />
            <Route path="targets/:id" element={<TargetDetail />} />
            <Route path="tests" element={<TestList />} />
            <Route path="tests/:id" element={<TestDetail />} />
            <Route path="users" element={<UserManagement />} />
            <Route path="remote-access" element={<RemoteAccess />} />
            <Route path="reservations" element={<Reservations />} />
            <Route path="gateways" element={<GatewayList />} />
            <Route path="gateways/:id" element={<GatewayDetail />} />
            <Route path="associations" element={<TargetGatewayAssociations />} />
            <Route path="scenarios" element={<ScenarioComposerPage />} />
            <Route path="virtual-targets" element={<VirtualTargetOrchestrationPage />} />
            <Route path="virtual-targets-test" element={<VirtualTargetOrchestrationTest />} />
            <Route path="topology-editor" element={<TopologyEditorPage />} />
            <Route path="artifacts/*" element={<ArtifactManagementPage />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </AuthProvider>
    </div>
  );
}

export default App;

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';
import { Artifact, ArtifactType, DeploymentStatus } from '../../types/artifact';
import { Target } from '../../types/target';

interface ArtifactDeploymentProps {}

const ArtifactDeployment: React.FC<ArtifactDeploymentProps> = () => {
  // Auth context
  const auth = useAuth();
  const token = auth ? (auth as any).token : '';
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get artifact IDs from location state
  const artifactIds: number[] = location.state?.artifactIds || [];
  
  // State
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [targets, setTargets] = useState<Target[]>([]);
  const [selectedTargets, setSelectedTargets] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDryRun, setIsDryRun] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploymentStatus, setDeploymentStatus] = useState<DeploymentStatus | null>(null);
  const [deploymentProgress, setDeploymentProgress] = useState(0);
  const [deploymentLogs, setDeploymentLogs] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [targetFilters, setTargetFilters] = useState({
    status: 'available',
    platform: '',
  });
  
  // API base URL
  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
  
  // Fetch artifacts
  const fetchArtifacts = useCallback(async () => {
    if (artifactIds.length === 0) {
      navigate('/artifacts');
      return;
    }
    
    try {
      setLoading(true);
      
      // In a real implementation, this would be a proper API call
      // For now, we'll simulate the API response
      const promises = artifactIds.map(id => 
        axios.get(`${API_URL}/artifacts/${id}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
      );
      
      const responses = await Promise.all(promises);
      const fetchedArtifacts = responses.map(response => response.data);
      
      setArtifacts(fetchedArtifacts);
    } catch (err) {
      console.error('Error fetching artifacts:', err);
      setError('Failed to fetch artifacts. Please try again later.');
      
      // For demo purposes, set some mock data
      const mockArtifacts: Artifact[] = artifactIds.map((id: number, index: number) => ({
        id,
        filename: `artifact-${id}.apk`,
        original_filename: `app-release-v1.${index}.${index}.apk`,
        file_path: `/uploads/1/artifact-${id}.apk`,
        file_size: 5242880 + (index * 1000000),
        mime_type: 'application/vnd.android.package-archive',
        artifact_type: ArtifactType.APK,
        user_id: 1,
        target_id: null,
        created_at: new Date().toISOString(),
        updated_at: null,
        user_username: 'admin',
        version: `1.${index}.${index}`,
        description: `Artifact ${id} description`,
        tags: ['production', 'release'],
        platform_compatibility: ['android-11', 'android-12', 'android-13'],
        metadata: {
          minSdkVersion: 30,
          targetSdkVersion: 33,
        },
        is_latest: true,
        previous_version_id: null,
      }));
      
      setArtifacts(mockArtifacts);
    } finally {
      setLoading(false);
    }
  }, [API_URL, token, artifactIds, navigate]);
  
  // Fetch targets
  const fetchTargets = useCallback(async () => {
    try {
      // In a real implementation, this would be a proper API call with filters
      const response = await axios.post(
        `${API_URL}/target-management/advanced-search`,
        {
          status: targetFilters.status ? [targetFilters.status] : undefined,
          platform: targetFilters.platform ? targetFilters.platform : undefined,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      
      setTargets(response.data);
    } catch (err) {
      console.error('Error fetching targets:', err);
      
      // For demo purposes, set some mock data
      const mockTargets: Target[] = [
        {
          id: 1,
          name: 'Pixel 6 Pro',
          device_type: 'physical',
          status: 'available',
          android_version: '13',
          api_level: 33,
          manufacturer: 'Google',
          model: 'Pixel 6 Pro',
          location: 'Lab 1',
          tags: ['pixel', 'google', 'flagship'],
          purpose: ['testing'],
          health_check_score: 98,
          last_heartbeat: new Date().toISOString(),
          adb_status: true,
          serial_status: true,
          is_active: true,
        },
        {
          id: 2,
          name: 'Samsung Galaxy S22',
          device_type: 'physical',
          status: 'available',
          android_version: '12',
          api_level: 31,
          manufacturer: 'Samsung',
          model: 'Galaxy S22',
          location: 'Lab 1',
          tags: ['samsung', 'galaxy', 'flagship'],
          purpose: ['testing'],
          health_check_score: 95,
          last_heartbeat: new Date().toISOString(),
          adb_status: true,
          serial_status: true,
          is_active: true,
        },
        {
          id: 3,
          name: 'Android Emulator',
          device_type: 'emulator',
          status: 'available',
          android_version: '11',
          api_level: 30,
          manufacturer: 'Google',
          model: 'Android Emulator',
          location: 'Virtual',
          tags: ['emulator', 'virtual'],
          purpose: ['development'],
          health_check_score: 100,
          last_heartbeat: new Date().toISOString(),
          adb_status: true,
          serial_status: true,
          is_active: true,
        },
      ];
      
      setTargets(mockTargets);
    }
  }, [API_URL, token, targetFilters]);
  
  // Initial data fetch
  useEffect(() => {
    fetchArtifacts();
    fetchTargets();
  }, [fetchArtifacts, fetchTargets]);
  
  // Handle target selection
  const handleSelectTarget = (id: number) => {
    if (selectedTargets.includes(id)) {
      setSelectedTargets(selectedTargets.filter(targetId => targetId !== id));
    } else {
      setSelectedTargets([...selectedTargets, id]);
    }
  };
  
  // Handle select all targets
  const handleSelectAllTargets = () => {
    if (selectedTargets.length === targets.length) {
      setSelectedTargets([]);
    } else {
      setSelectedTargets(targets.map(target => target.id));
    }
  };
  
  // Handle filter change
  const handleFilterChange = (field: string, value: string) => {
    setTargetFilters(prev => ({ ...prev, [field]: value }));
  };
  
  // Handle preview deployment
  const handlePreviewDeployment = () => {
    if (selectedTargets.length === 0) {
      setError('Please select at least one target for deployment');
      return;
    }
    
    setShowPreview(true);
  };
  
  // Handle deploy
  const handleDeploy = async () => {
    if (selectedTargets.length === 0) {
      setError('Please select at least one target for deployment');
      return;
    }
    
    setIsDeploying(true);
    setDeploymentStatus(DeploymentStatus.PENDING);
    setDeploymentProgress(0);
    setDeploymentLogs([`[${new Date().toLocaleTimeString()}] Starting deployment...`]);
    
    try {
      // In a real implementation, this would be a proper API call
      // For now, we'll simulate the deployment process
      
      // Simulate deployment preparation
      await simulateDeploymentStep(
        10,
        'Preparing deployment...',
        'Deployment preparation complete'
      );
      
      // Simulate artifact validation
      await simulateDeploymentStep(
        20,
        'Validating artifacts...',
        'Artifact validation complete'
      );
      
      // Simulate target preparation
      await simulateDeploymentStep(
        30,
        'Preparing targets...',
        'Target preparation complete'
      );
      
      // Simulate deployment to each target
      setDeploymentStatus(DeploymentStatus.IN_PROGRESS);
      for (let i = 0; i < selectedTargets.length; i++) {
        const targetId = selectedTargets[i];
        const target = targets.find(t => t.id === targetId);
        
        if (target) {
          await simulateDeploymentStep(
            40 + (i * (50 / selectedTargets.length)),
            `Deploying to ${target.name}...`,
            `Deployment to ${target.name} complete`
          );
        }
      }
      
      // Simulate deployment finalization
      await simulateDeploymentStep(
        95,
        'Finalizing deployment...',
        'Deployment finalization complete'
      );
      
      // Complete deployment
      setDeploymentProgress(100);
      setDeploymentLogs(prev => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] Deployment completed successfully!`,
      ]);
      setDeploymentStatus(DeploymentStatus.SUCCESS);
    } catch (err) {
      console.error('Error during deployment:', err);
      setDeploymentLogs(prev => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] ERROR: Deployment failed - ${err}`,
      ]);
      setDeploymentStatus(DeploymentStatus.FAILED);
    } finally {
      setIsDeploying(false);
    }
  };
  
  // Simulate a deployment step
  const simulateDeploymentStep = async (
    progressTarget: number,
    startMessage: string,
    completeMessage: string
  ) => {
    setDeploymentLogs(prev => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] ${startMessage}`,
    ]);
    
    // Simulate progress
    const startProgress = deploymentProgress;
    const progressDiff = progressTarget - startProgress;
    const stepDuration = 1000 + Math.random() * 2000; // 1-3 seconds
    const startTime = Date.now();
    
    return new Promise<void>((resolve) => {
      const updateProgress = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(
          startProgress + (progressDiff * (elapsed / stepDuration)),
          progressTarget
        );
        
        setDeploymentProgress(Math.round(progress));
        
        if (progress < progressTarget) {
          requestAnimationFrame(updateProgress);
        } else {
          setDeploymentLogs(prev => [
            ...prev,
            `[${new Date().toLocaleTimeString()}] ${completeMessage}`,
          ]);
          resolve();
        }
      };
      
      updateProgress();
    });
  };
  
  // Handle rollback
  const handleRollback = async () => {
    if (deploymentStatus !== DeploymentStatus.SUCCESS) {
      return;
    }
    
    setIsDeploying(true);
    setDeploymentStatus(DeploymentStatus.ROLLBACK_IN_PROGRESS);
    setDeploymentLogs(prev => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] Starting rollback...`,
    ]);
    
    try {
      // Simulate rollback process
      for (let progress = 100; progress >= 0; progress -= 10) {
        setDeploymentProgress(progress);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      setDeploymentLogs(prev => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] Rollback completed successfully!`,
      ]);
      setDeploymentStatus(DeploymentStatus.ROLLBACK_COMPLETE);
    } catch (err) {
      console.error('Error during rollback:', err);
      setDeploymentLogs(prev => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] ERROR: Rollback failed - ${err}`,
      ]);
      setDeploymentStatus(DeploymentStatus.FAILED);
    } finally {
      setIsDeploying(false);
    }
  };
  
  // Render deployment status badge
  const renderDeploymentStatusBadge = () => {
    if (!deploymentStatus) return null;
    
    let badgeClass = 'badge ';
    
    switch (deploymentStatus) {
      case DeploymentStatus.PENDING:
        badgeClass += 'bg-secondary';
        break;
      case DeploymentStatus.IN_PROGRESS:
        badgeClass += 'bg-primary';
        break;
      case DeploymentStatus.SUCCESS:
        badgeClass += 'bg-success';
        break;
      case DeploymentStatus.FAILED:
        badgeClass += 'bg-danger';
        break;
      case DeploymentStatus.CANCELED:
        badgeClass += 'bg-warning';
        break;
      case DeploymentStatus.ROLLBACK_IN_PROGRESS:
        badgeClass += 'bg-info';
        break;
      case DeploymentStatus.ROLLBACK_COMPLETE:
        badgeClass += 'bg-warning';
        break;
      default:
        badgeClass += 'bg-secondary';
    }
    
    return <span className={badgeClass}>{deploymentStatus}</span>;
  };
  
  return (
    <div className="container-fluid mt-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1>Deploy Artifacts</h1>
        <button
          className="btn btn-outline-secondary"
          onClick={() => navigate('/artifacts')}
        >
          Back to Artifacts
        </button>
      </div>
      
      {error && (
        <div className="alert alert-danger alert-dismissible fade show" role="alert">
          {error}
          <button type="button" className="btn-close" onClick={() => setError(null)}></button>
        </div>
      )}
      
      <div className="row">
        {/* Left column - Artifacts */}
        <div className="col-md-4">
          <div className="card mb-4">
            <div className="card-header">
              <h5 className="mb-0">Selected Artifacts</h5>
            </div>
            <div className="card-body p-0">
              {loading ? (
                <div className="text-center p-4">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                </div>
              ) : artifacts.length === 0 ? (
                <div className="text-center p-4">
                  <p className="mb-0">No artifacts selected</p>
                </div>
              ) : (
                <ul className="list-group list-group-flush">
                  {artifacts.map(artifact => (
                    <li key={artifact.id} className="list-group-item">
                      <div className="d-flex justify-content-between align-items-center">
                        <div>
                          <h6 className="mb-1">{artifact.original_filename}</h6>
                          <div className="small text-muted">
                            Version: {artifact.version}
                          </div>
                          <div className="small text-muted">
                            Type: {artifact.artifact_type}
                          </div>
                        </div>
                        <span className="badge bg-primary rounded-pill">
                          {artifact.platform_compatibility.join(', ')}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          
          {/* Deployment Options */}
          <div className="card mb-4">
            <div className="card-header">
              <h5 className="mb-0">Deployment Options</h5>
            </div>
            <div className="card-body">
              <div className="form-check form-switch mb-3">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="dry-run-switch"
                  checked={isDryRun}
                  onChange={() => setIsDryRun(!isDryRun)}
                  disabled={isDeploying}
                />
                <label className="form-check-label" htmlFor="dry-run-switch">
                  Dry Run Mode
                </label>
                <div className="form-text">
                  Simulates deployment without actually applying changes
                </div>
              </div>
              
              <div className="d-grid gap-2">
                <button
                  className="btn btn-primary"
                  onClick={handlePreviewDeployment}
                  disabled={selectedTargets.length === 0 || isDeploying}
                >
                  Preview Deployment
                </button>
                <button
                  className="btn btn-success"
                  onClick={handleDeploy}
                  disabled={selectedTargets.length === 0 || isDeploying}
                >
                  {isDryRun ? 'Start Dry Run' : 'Deploy to Selected Targets'}
                </button>
              </div>
            </div>
          </div>
        </div>
        
        {/* Middle column - Targets */}
        <div className="col-md-4">
          <div className="card mb-4">
            <div className="card-header d-flex justify-content-between align-items-center">
              <h5 className="mb-0">Select Targets</h5>
              <span className="badge bg-primary">{selectedTargets.length} selected</span>
            </div>
            <div className="card-body">
              {/* Target filters */}
              <div className="mb-3">
                <label htmlFor="status-filter" className="form-label">Status</label>
                <select
                  id="status-filter"
                  className="form-select"
                  value={targetFilters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  disabled={isDeploying}
                >
                  <option value="">All</option>
                  <option value="available">Available</option>
                  <option value="reserved">Reserved</option>
                  <option value="offline">Offline</option>
                </select>
              </div>
              
              <div className="mb-3">
                <label htmlFor="platform-filter" className="form-label">Platform</label>
                <select
                  id="platform-filter"
                  className="form-select"
                  value={targetFilters.platform}
                  onChange={(e) => handleFilterChange('platform', e.target.value)}
                  disabled={isDeploying}
                >
                  <option value="">All</option>
                  <option value="android-11">Android 11</option>
                  <option value="android-12">Android 12</option>
                  <option value="android-13">Android 13</option>
                </select>
              </div>
              
              <div className="mb-3">
                <button
                  className="btn btn-outline-secondary btn-sm"
                  onClick={fetchTargets}
                  disabled={isDeploying}
                >
                  Apply Filters
                </button>
              </div>
              
              {/* Target list */}
              <div className="list-group">
                <div className="list-group-item">
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="select-all-targets"
                      checked={selectedTargets.length === targets.length && targets.length > 0}
                      onChange={handleSelectAllTargets}
                      disabled={isDeploying}
                    />
                    <label className="form-check-label" htmlFor="select-all-targets">
                      Select All
                    </label>
                  </div>
                </div>
                
                {targets.map(target => (
                  <div key={target.id} className="list-group-item">
                    <div className="form-check">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id={`target-${target.id}`}
                        checked={selectedTargets.includes(target.id)}
                        onChange={() => handleSelectTarget(target.id)}
                        disabled={isDeploying}
                      />
                      <label className="form-check-label" htmlFor={`target-${target.id}`}>
                        <div>{target.name}</div>
                        <div className="small text-muted">
                          {target.manufacturer} {target.model} - Android {target.android_version} (API {target.api_level})
                        </div>
                        <div className="small">
                          <span className={`badge ${target.status === 'available' ? 'bg-success' : 'bg-secondary'}`}>
                            {target.status}
                          </span>
                          <span className={`badge ${target.device_type === 'physical' ? 'bg-info' : 'bg-warning'} ms-1`}>
                            {target.device_type}
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        
        {/* Right column - Deployment Status */}
        <div className="col-md-4">
          <div className="card mb-4">
            <div className="card-header d-flex justify-content-between align-items-center">
              <h5 className="mb-0">Deployment Status</h5>
              {renderDeploymentStatusBadge()}
            </div>
            <div className="card-body">
              {deploymentStatus ? (
                <>
                  <div className="mb-3">
                    <label className="form-label">Progress</label>
                    <div className="progress">
                      <div
                        className={`progress-bar ${isDeploying ? 'progress-bar-striped progress-bar-animated' : ''} ${
                          deploymentStatus === DeploymentStatus.FAILED ? 'bg-danger' : 
                          deploymentStatus === DeploymentStatus.SUCCESS ? 'bg-success' : 
                          deploymentStatus === DeploymentStatus.ROLLBACK_COMPLETE ? 'bg-warning' : 'bg-primary'
                        }`}
                        role="progressbar"
                        style={{ width: `${deploymentProgress}%` }}
                        aria-valuenow={deploymentProgress}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      >
                        {deploymentProgress}%
                      </div>
                    </div>
                  </div>
                  
                  <div className="mb-3">
                    <label className="form-label">Logs</label>
                    <div className="border rounded p-2 bg-dark text-light" style={{ height: '300px', overflowY: 'auto' }}>
                      {deploymentLogs.map((log, index) => (
                        <div key={index} className="small">
                          {log}
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {deploymentStatus === DeploymentStatus.SUCCESS && (
                    <div className="d-grid">
                      <button
                        className="btn btn-warning"
                        onClick={handleRollback}
                        disabled={isDeploying}
                      >
                        Rollback Deployment
                      </button>
                    </div>
                  )}
                </>
              ) : showPreview ? (
                <div>
                  <h6>Deployment Preview</h6>
                  <p>The following artifacts will be deployed to {selectedTargets.length} target(s):</p>
                  
                  <ul className="list-group mb-3">
                    {artifacts.map(artifact => (
                      <li key={artifact.id} className="list-group-item">
                        {artifact.original_filename} (v{artifact.version})
                      </li>
                    ))}
                  </ul>
                  
                  <p>Selected targets:</p>
                  <ul className="list-group mb-3">
                    {targets
                      .filter(target => selectedTargets.includes(target.id))
                      .map(target => (
                        <li key={target.id} className="list-group-item">
                          {target.name} - {target.manufacturer} {target.model}
                        </li>
                      ))}
                  </ul>
                  
                  <div className="alert alert-info">
                    {isDryRun ? (
                      <p className="mb-0">
                        <strong>Dry Run Mode:</strong> No actual changes will be made to the targets.
                      </p>
                    ) : (
                      <p className="mb-0">
                        <strong>Live Deployment:</strong> Changes will be applied to the selected targets.
                      </p>
                    )}
                  </div>
                  
                  <div className="d-grid">
                    <button
                      className="btn btn-success"
                      onClick={handleDeploy}
                      disabled={isDeploying}
                    >
                      {isDryRun ? 'Start Dry Run' : 'Start Deployment'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center p-4">
                  <p>Select targets and click "Preview Deployment" to continue</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ArtifactDeployment;

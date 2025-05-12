import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { Artifact, ArtifactType, ArtifactFilter } from '../types/artifact';
import ArtifactFilterPanel from './artifacts/ArtifactFilterPanel';
import ArtifactList from './artifacts/ArtifactList';
import ArtifactUploadWizard from './artifacts/ArtifactUploadWizard';

const ArtifactManagement: React.FC = () => {
  // Auth context
  const auth = useAuth();
  const token = auth ? (auth as any).token : '';
  const navigate = useNavigate();
  
  // State
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ArtifactFilter>({});
  const [page, setPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [showUploadWizard, setShowUploadWizard] = useState(false);
  const [selectedArtifacts, setSelectedArtifacts] = useState<number[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [projects, setProjects] = useState<string[]>([]);

  // API base URL
  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

  // Fetch artifacts with filters
  const fetchArtifacts = useCallback(async () => {
    try {
      setLoading(true);
      
      // In a real implementation, this would be a proper API call with filters
      // For now, we'll simulate the API response
      const response = await axios.get(
        `${API_URL}/artifacts?skip=${(page - 1) * itemsPerPage}&limit=${itemsPerPage}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          params: {
            ...filters,
          },
        }
      );
      
      // Simulate extended properties for demo purposes
      const enhancedArtifacts = response.data.map((artifact: any) => ({
        ...artifact,
        version: artifact.metadata?.version || '1.0.0',
        description: artifact.metadata?.description || null,
        tags: artifact.metadata?.tags || [],
        platform_compatibility: artifact.metadata?.platform_compatibility || [],
        is_latest: true,
        previous_version_id: null,
      }));
      
      setArtifacts(enhancedArtifacts);
      setTotalCount(response.headers['x-total-count'] || enhancedArtifacts.length);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching artifacts:', err);
      setError('Failed to fetch artifacts. Please try again later.');
      setLoading(false);
      
      // For demo purposes, set some mock data
      const mockArtifacts: Artifact[] = [
        {
          id: 1,
          filename: 'app-release-v1.2.3.apk',
          original_filename: 'app-release.apk',
          file_path: '/uploads/1/app-release-v1.2.3.apk',
          file_size: 5242880,
          mime_type: 'application/vnd.android.package-archive',
          artifact_type: ArtifactType.APK,
          user_id: 1,
          target_id: null,
          created_at: '2025-05-01T10:00:00Z',
          updated_at: null,
          user_username: 'admin',
          version: '1.2.3',
          description: 'Production release with bug fixes',
          tags: ['production', 'release'],
          platform_compatibility: ['android-11', 'android-12', 'android-13'],
          metadata: {
            minSdkVersion: 30,
            targetSdkVersion: 33,
          },
          is_latest: true,
          previous_version_id: null,
        },
        {
          id: 2,
          filename: 'config-v2.1.0.json',
          original_filename: 'config.json',
          file_path: '/uploads/1/config-v2.1.0.json',
          file_size: 2048,
          mime_type: 'application/json',
          artifact_type: ArtifactType.CONFIG,
          user_id: 1,
          target_id: null,
          created_at: '2025-05-02T14:30:00Z',
          updated_at: null,
          user_username: 'admin',
          version: '2.1.0',
          description: 'Updated configuration for A/B testing',
          tags: ['config', 'ab-testing'],
          platform_compatibility: ['all'],
          metadata: {},
          is_latest: true,
          previous_version_id: null,
        },
        {
          id: 3,
          filename: 'test-suite-v1.0.0.zip',
          original_filename: 'test-suite.zip',
          file_path: '/uploads/1/test-suite-v1.0.0.zip',
          file_size: 1048576,
          mime_type: 'application/zip',
          artifact_type: ArtifactType.TEST_SCRIPT,
          user_id: 2,
          target_id: null,
          created_at: '2025-05-03T09:15:00Z',
          updated_at: null,
          user_username: 'tester',
          version: '1.0.0',
          description: 'Automated test suite for core functionality',
          tags: ['tests', 'automation'],
          platform_compatibility: ['android-12', 'android-13'],
          metadata: {},
          is_latest: true,
          previous_version_id: null,
        },
      ];
      
      setArtifacts(mockArtifacts);
      setTotalCount(mockArtifacts.length);
      setLoading(false);
    }
  }, [API_URL, token, page, itemsPerPage, filters]);

  // Fetch metadata for filters
  const fetchMetadata = useCallback(async () => {
    try {
      // In a real implementation, these would be API calls
      // For now, we'll use mock data
      setTags(['production', 'release', 'config', 'ab-testing', 'tests', 'automation', 'debug']);
      setPlatforms(['android-11', 'android-12', 'android-13', 'all']);
      setProjects(['main-app', 'config-service', 'test-framework']);
    } catch (err) {
      console.error('Error fetching metadata:', err);
    }
  }, []);

  // Initial data fetch
  useEffect(() => {
    fetchArtifacts();
    fetchMetadata();
  }, [fetchArtifacts, fetchMetadata]);

  // Handle filter changes
  const handleFilterChange = (newFilters: ArtifactFilter) => {
    setFilters(newFilters);
    setPage(1); // Reset to first page when filters change
  };

  // Handle artifact selection
  const handleSelectArtifact = (id: number) => {
    if (selectedArtifacts.includes(id)) {
      setSelectedArtifacts(selectedArtifacts.filter((artifactId) => artifactId !== id));
    } else {
      setSelectedArtifacts([...selectedArtifacts, id]);
    }
  };

  // Handle view artifact details
  const handleViewArtifact = (id: number) => {
    navigate(`/artifacts/${id}`);
  };

  // Handle deploy artifacts
  const handleDeployArtifacts = () => {
    if (selectedArtifacts.length === 0) {
      setError('Please select at least one artifact to deploy');
      return;
    }
    navigate('/artifacts/deploy', { state: { artifactIds: selectedArtifacts } });
  };

  // Handle upload completion
  const handleUploadComplete = () => {
    setShowUploadWizard(false);
    fetchArtifacts();
  };

  return (
    <div className="container-fluid mt-4">
      <h1 className="mb-4">Artifact Management</h1>
      
      {error && (
        <div className="alert alert-danger alert-dismissible fade show" role="alert">
          {error}
          <button type="button" className="btn-close" onClick={() => setError(null)}></button>
        </div>
      )}
      
      {/* Actions */}
      <div className="row mb-4">
        <div className="col-md-6">
          <button
            className="btn btn-primary me-2"
            onClick={() => setShowUploadWizard(true)}
          >
            Upload New Artifact
          </button>
          <button
            className="btn btn-success me-2"
            onClick={handleDeployArtifacts}
            disabled={selectedArtifacts.length === 0}
          >
            Deploy Selected
          </button>
        </div>
        
        <div className="col-md-6 text-end">
          <button
            className="btn btn-outline-secondary"
            onClick={fetchArtifacts}
          >
            Refresh
          </button>
        </div>
      </div>
      
      {/* Main content */}
      <div className="row">
        {/* Filter panel */}
        <div className="col-md-3">
          <ArtifactFilterPanel 
            filters={filters}
            onFilterChange={handleFilterChange}
            availableTags={tags}
            availablePlatforms={platforms}
            availableProjects={projects}
          />
        </div>
        
        {/* Artifact list */}
        <div className="col-md-9">
          <ArtifactList 
            artifacts={artifacts}
            loading={loading}
            selectedArtifacts={selectedArtifacts}
            onSelectArtifact={handleSelectArtifact}
            onViewArtifact={handleViewArtifact}
            page={page}
            itemsPerPage={itemsPerPage}
            totalCount={totalCount}
            onPageChange={setPage}
          />
        </div>
      </div>
      
      {/* Upload wizard modal */}
      {showUploadWizard && (
        <ArtifactUploadWizard
          onClose={() => setShowUploadWizard(false)}
          onComplete={handleUploadComplete}
          availablePlatforms={platforms}
          availableTags={tags}
          availableProjects={projects}
        />
      )}
    </div>
  );
};

export default ArtifactManagement;

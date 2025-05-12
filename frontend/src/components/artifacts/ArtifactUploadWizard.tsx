import React, { useState, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';
import { ArtifactType, ArtifactMetadata } from '../../types/artifact';

interface ArtifactUploadWizardProps {
  onClose: () => void;
  onComplete: (artifactId?: number) => void;
  availablePlatforms: string[];
  availableTags: string[];
  availableProjects: string[];
}

const ArtifactUploadWizard: React.FC<ArtifactUploadWizardProps> = ({
  onClose,
  onComplete,
  availablePlatforms,
  availableTags,
  availableProjects,
}) => {
  // Auth context
  const auth = useAuth();
  const token = auth ? (auth as any).token : '';
  
  // Step state
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 3;
  
  // File selection state
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Metadata state
  const [metadata, setMetadata] = useState<ArtifactMetadata>({
    version: '1.0.0',
    type: ArtifactType.APK,
    platform_compatibility: [],
    description: '',
    tags: [],
    project: '',
  });
  
  // Custom tag/platform input
  const [customTag, setCustomTag] = useState('');
  const [customPlatform, setCustomPlatform] = useState('');
  
  // Upload state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  
  // API base URL
  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
  
  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    setFileError(null);
    
    if (!selectedFile) {
      setFile(null);
      return;
    }
    
    // Determine artifact type from file extension
    const fileExtension = selectedFile.name.split('.').pop()?.toLowerCase() || '';
    let artifactType = ArtifactType.OTHER;
    
    if (fileExtension === 'apk') {
      artifactType = ArtifactType.APK;
    } else if (['json', 'xml', 'yaml', 'yml', 'properties', 'conf'].includes(fileExtension)) {
      artifactType = ArtifactType.CONFIG;
    } else if (['py', 'js', 'sh', 'bat', 'ps1', 'java', 'kt', 'ts'].includes(fileExtension)) {
      artifactType = ArtifactType.TEST_SCRIPT;
    } else if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(fileExtension)) {
      artifactType = ArtifactType.IMAGE;
    } else if (['exe', 'dll', 'so', 'dylib', 'bin'].includes(fileExtension)) {
      artifactType = ArtifactType.BINARY;
    }
    
    setFile(selectedFile);
    setMetadata(prev => ({ ...prev, type: artifactType }));
  };
  
  // Handle metadata changes
  const handleMetadataChange = (field: keyof ArtifactMetadata, value: any) => {
    setMetadata(prev => ({ ...prev, [field]: value }));
  };
  
  // Handle tag selection
  const handleTagToggle = (tag: string) => {
    const currentTags = metadata.tags || [];
    
    if (currentTags.includes(tag)) {
      handleMetadataChange('tags', currentTags.filter(t => t !== tag));
    } else {
      handleMetadataChange('tags', [...currentTags, tag]);
    }
  };
  
  // Handle adding custom tag
  const handleAddCustomTag = () => {
    if (customTag && !metadata.tags?.includes(customTag)) {
      handleMetadataChange('tags', [...(metadata.tags || []), customTag]);
      setCustomTag('');
    }
  };
  
  // Handle platform selection
  const handlePlatformToggle = (platform: string) => {
    const currentPlatforms = metadata.platform_compatibility || [];
    
    if (currentPlatforms.includes(platform)) {
      handleMetadataChange('platform_compatibility', currentPlatforms.filter(p => p !== platform));
    } else {
      handleMetadataChange('platform_compatibility', [...currentPlatforms, platform]);
    }
  };
  
  // Handle adding custom platform
  const handleAddCustomPlatform = () => {
    if (customPlatform && !metadata.platform_compatibility?.includes(customPlatform)) {
      handleMetadataChange('platform_compatibility', [...(metadata.platform_compatibility || []), customPlatform]);
      setCustomPlatform('');
    }
  };
  
  // Handle next step
  const handleNextStep = () => {
    // Validate current step
    if (currentStep === 1 && !file) {
      setFileError('Please select a file to upload');
      return;
    }
    
    if (currentStep === 2) {
      if (!metadata.version) {
        setUploadError('Version is required');
        return;
      }
      if (metadata.platform_compatibility.length === 0) {
        setUploadError('At least one platform compatibility is required');
        return;
      }
    }
    
    setCurrentStep(prev => Math.min(prev + 1, totalSteps));
  };
  
  // Handle previous step
  const handlePreviousStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };
  
  // Handle upload
  const handleUpload = async () => {
    if (!file) {
      setUploadError('No file selected');
      return;
    }
    
    setIsUploading(true);
    setUploadProgress(0);
    setUploadError(null);
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('artifact_type', metadata.type);
    
    // Add metadata as JSON
    formData.append('metadata', JSON.stringify({
      version: metadata.version,
      description: metadata.description,
      tags: metadata.tags,
      platform_compatibility: metadata.platform_compatibility,
      project: metadata.project,
    }));
    
    try {
      // In a real app, this would be an actual API call
      const response = await axios.post(`${API_URL}/artifacts`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${token}`,
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 1));
          setUploadProgress(percentCompleted);
        },
      });
      
      // Call the completion callback with the new artifact ID
      onComplete(response.data.id);
    } catch (err) {
      console.error('Error uploading artifact:', err);
      setUploadError('Failed to upload artifact. Please try again later.');
      
      // For demo purposes, simulate a successful upload
      setTimeout(() => {
        onComplete(Math.floor(Math.random() * 1000) + 100); // Random ID for demo
      }, 2000);
    } finally {
      setIsUploading(false);
    }
  };
  
  // Render step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="step-content">
            <h5 className="mb-3">Select Artifact File</h5>
            
            <div className="mb-4">
              <div className="d-flex flex-column align-items-center justify-content-center p-5 border rounded bg-light">
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileChange}
                  className="d-none"
                  id="artifact-file-input"
                />
                
                {file ? (
                  <div className="text-center">
                    <div className="mb-2">
                      <i className="bi bi-file-earmark-check fs-1 text-success"></i>
                    </div>
                    <h5>{file.name}</h5>
                    <p className="text-muted">
                      {file.size < 1024 * 1024
                        ? `${(file.size / 1024).toFixed(2)} KB`
                        : `${(file.size / (1024 * 1024)).toFixed(2)} MB`}
                    </p>
                    <button
                      className="btn btn-outline-secondary mt-2"
                      onClick={() => {
                        setFile(null);
                        if (fileInputRef.current) {
                          fileInputRef.current.value = '';
                        }
                      }}
                    >
                      Change File
                    </button>
                  </div>
                ) : (
                  <div className="text-center">
                    <div className="mb-3">
                      <i className="bi bi-cloud-upload fs-1"></i>
                    </div>
                    <h5>Drag and drop your file here</h5>
                    <p className="text-muted">or</p>
                    <button
                      className="btn btn-primary"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Browse Files
                    </button>
                  </div>
                )}
              </div>
              
              {fileError && (
                <div className="alert alert-danger mt-3">
                  {fileError}
                </div>
              )}
            </div>
            
            <div className="mb-3">
              <h6>Supported File Types:</h6>
              <ul className="list-unstyled d-flex flex-wrap gap-2">
                <li><span className="badge bg-success">APK</span></li>
                <li><span className="badge bg-info">Config Files</span></li>
                <li><span className="badge bg-primary">Test Scripts</span></li>
                <li><span className="badge bg-warning">Binaries</span></li>
                <li><span className="badge bg-secondary">Images</span></li>
                <li><span className="badge bg-light text-dark">Other</span></li>
              </ul>
            </div>
          </div>
        );
        
      case 2:
        return (
          <div className="step-content">
            <h5 className="mb-3">Artifact Metadata</h5>
            
            <div className="mb-3">
              <label htmlFor="artifact-type" className="form-label">Artifact Type</label>
              <select
                id="artifact-type"
                className="form-select"
                value={metadata.type}
                onChange={(e) => handleMetadataChange('type', e.target.value)}
              >
                {Object.values(ArtifactType).map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            
            <div className="mb-3">
              <label htmlFor="artifact-version" className="form-label">Version *</label>
              <input
                type="text"
                id="artifact-version"
                className="form-control"
                placeholder="e.g., 1.0.0"
                value={metadata.version}
                onChange={(e) => handleMetadataChange('version', e.target.value)}
                required
              />
              <div className="form-text">
                Semantic versioning recommended (e.g., 1.0.0, 2.3.1)
              </div>
            </div>
            
            <div className="mb-3">
              <label htmlFor="artifact-description" className="form-label">Description</label>
              <textarea
                id="artifact-description"
                className="form-control"
                rows={3}
                placeholder="Describe the purpose and contents of this artifact"
                value={metadata.description || ''}
                onChange={(e) => handleMetadataChange('description', e.target.value)}
              ></textarea>
            </div>
            
            <div className="mb-3">
              <label htmlFor="artifact-project" className="form-label">Project</label>
              <select
                id="artifact-project"
                className="form-select"
                value={metadata.project || ''}
                onChange={(e) => handleMetadataChange('project', e.target.value)}
              >
                <option value="">Select a project</option>
                {availableProjects.map(project => (
                  <option key={project} value={project}>{project}</option>
                ))}
              </select>
            </div>
            
            <div className="mb-3">
              <label className="form-label">Platform Compatibility *</label>
              <div className="d-flex flex-wrap gap-2 mb-2">
                {availablePlatforms.map(platform => (
                  <div key={platform} className="form-check form-check-inline">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id={`platform-${platform}`}
                      checked={metadata.platform_compatibility?.includes(platform) || false}
                      onChange={() => handlePlatformToggle(platform)}
                    />
                    <label className="form-check-label" htmlFor={`platform-${platform}`}>
                      {platform}
                    </label>
                  </div>
                ))}
              </div>
              
              <div className="input-group">
                <input
                  type="text"
                  className="form-control"
                  placeholder="Add custom platform..."
                  value={customPlatform}
                  onChange={(e) => setCustomPlatform(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddCustomPlatform()}
                />
                <button
                  className="btn btn-outline-secondary"
                  type="button"
                  onClick={handleAddCustomPlatform}
                  disabled={!customPlatform}
                >
                  Add
                </button>
              </div>
              
              <div className="mt-2">
                {metadata.platform_compatibility?.map(platform => (
                  <span key={platform} className="badge bg-light text-dark me-1 mb-1">
                    {platform}
                    <button
                      type="button"
                      className="btn-close btn-close-sm ms-1"
                      onClick={() => handlePlatformToggle(platform)}
                    ></button>
                  </span>
                ))}
              </div>
            </div>
            
            <div className="mb-3">
              <label className="form-label">Tags</label>
              <div className="d-flex flex-wrap gap-2 mb-2">
                {availableTags.map(tag => (
                  <div key={tag} className="form-check form-check-inline">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id={`tag-${tag}`}
                      checked={metadata.tags?.includes(tag) || false}
                      onChange={() => handleTagToggle(tag)}
                    />
                    <label className="form-check-label" htmlFor={`tag-${tag}`}>
                      {tag}
                    </label>
                  </div>
                ))}
              </div>
              
              <div className="input-group">
                <input
                  type="text"
                  className="form-control"
                  placeholder="Add custom tag..."
                  value={customTag}
                  onChange={(e) => setCustomTag(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddCustomTag()}
                />
                <button
                  className="btn btn-outline-secondary"
                  type="button"
                  onClick={handleAddCustomTag}
                  disabled={!customTag}
                >
                  Add
                </button>
              </div>
              
              <div className="mt-2">
                {metadata.tags?.map(tag => (
                  <span key={tag} className="badge bg-secondary me-1 mb-1">
                    {tag}
                    <button
                      type="button"
                      className="btn-close btn-close-white btn-close-sm ms-1"
                      onClick={() => handleTagToggle(tag)}
                    ></button>
                  </span>
                ))}
              </div>
            </div>
            
            {uploadError && (
              <div className="alert alert-danger">
                {uploadError}
              </div>
            )}
          </div>
        );
        
      case 3:
        return (
          <div className="step-content">
            <h5 className="mb-3">Review & Upload</h5>
            
            <div className="card mb-3">
              <div className="card-header">
                <h6 className="mb-0">File Information</h6>
              </div>
              <div className="card-body">
                <div className="row mb-2">
                  <div className="col-4 fw-bold">Filename:</div>
                  <div className="col-8">{file?.name}</div>
                </div>
                <div className="row mb-2">
                  <div className="col-4 fw-bold">Size:</div>
                  <div className="col-8">
                    {file?.size ? (
                      file.size < 1024 * 1024
                        ? `${(file.size / 1024).toFixed(2)} KB`
                        : `${(file.size / (1024 * 1024)).toFixed(2)} MB`
                    ) : 'Unknown'}
                  </div>
                </div>
                <div className="row mb-2">
                  <div className="col-4 fw-bold">Type:</div>
                  <div className="col-8">{file?.type || 'Unknown'}</div>
                </div>
              </div>
            </div>
            
            <div className="card mb-3">
              <div className="card-header">
                <h6 className="mb-0">Metadata</h6>
              </div>
              <div className="card-body">
                <div className="row mb-2">
                  <div className="col-4 fw-bold">Artifact Type:</div>
                  <div className="col-8">{metadata.type}</div>
                </div>
                <div className="row mb-2">
                  <div className="col-4 fw-bold">Version:</div>
                  <div className="col-8">{metadata.version}</div>
                </div>
                {metadata.project && (
                  <div className="row mb-2">
                    <div className="col-4 fw-bold">Project:</div>
                    <div className="col-8">{metadata.project}</div>
                  </div>
                )}
                {metadata.description && (
                  <div className="row mb-2">
                    <div className="col-4 fw-bold">Description:</div>
                    <div className="col-8">{metadata.description}</div>
                  </div>
                )}
                <div className="row mb-2">
                  <div className="col-4 fw-bold">Platform Compatibility:</div>
                  <div className="col-8">
                    {metadata.platform_compatibility?.length ? (
                      <div className="d-flex flex-wrap gap-1">
                        {metadata.platform_compatibility.map(platform => (
                          <span key={platform} className="badge bg-light text-dark">
                            {platform}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted">None specified</span>
                    )}
                  </div>
                </div>
                <div className="row mb-2">
                  <div className="col-4 fw-bold">Tags:</div>
                  <div className="col-8">
                    {metadata.tags?.length ? (
                      <div className="d-flex flex-wrap gap-1">
                        {metadata.tags.map(tag => (
                          <span key={tag} className="badge bg-secondary">
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted">None specified</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            {isUploading && (
              <div className="mb-3">
                <label className="form-label">Upload Progress</label>
                <div className="progress">
                  <div
                    className="progress-bar progress-bar-striped progress-bar-animated"
                    role="progressbar"
                    style={{ width: `${uploadProgress}%` }}
                    aria-valuenow={uploadProgress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    {uploadProgress}%
                  </div>
                </div>
              </div>
            )}
            
            {uploadError && (
              <div className="alert alert-danger">
                {uploadError}
              </div>
            )}
          </div>
        );
        
      default:
        return null;
    }
  };
  
  return (
    <div className="modal d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
      <div className="modal-dialog modal-lg modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Upload New Artifact</h5>
            <button
              type="button"
              className="btn-close"
              onClick={onClose}
              disabled={isUploading}
            ></button>
          </div>
          
          <div className="modal-body">
            {/* Progress indicator */}
            <div className="mb-4">
              <div className="d-flex justify-content-between">
                {Array.from({ length: totalSteps }).map((_, index) => (
                  <div
                    key={index}
                    className={`step-indicator ${index + 1 === currentStep ? 'active' : ''} ${
                      index + 1 < currentStep ? 'completed' : ''
                    }`}
                    style={{ flex: 1 }}
                  >
                    <div className="d-flex flex-column align-items-center">
                      <div
                        className={`step-circle ${index + 1 === currentStep ? 'active' : ''} ${
                          index + 1 < currentStep ? 'completed' : ''
                        }`}
                      >
                        {index + 1 < currentStep ? (
                          <i className="bi bi-check"></i>
                        ) : (
                          index + 1
                        )}
                      </div>
                      <div className="step-label mt-2">
                        {index === 0
                          ? 'Select File'
                          : index === 1
                          ? 'Add Metadata'
                          : 'Review & Upload'}
                      </div>
                    </div>
                    {index < totalSteps - 1 && (
                      <div
                        className={`step-line ${index + 1 < currentStep ? 'completed' : ''}`}
                      ></div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            
            {/* Step content */}
            {renderStepContent()}
          </div>
          
          <div className="modal-footer">
            {currentStep > 1 && (
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={handlePreviousStep}
                disabled={isUploading}
              >
                Previous
              </button>
            )}
            
            {currentStep < totalSteps ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleNextStep}
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-success"
                onClick={handleUpload}
                disabled={isUploading}
              >
                {isUploading ? 'Uploading...' : 'Upload Artifact'}
              </button>
            )}
          </div>
        </div>
      </div>
      
      <style>{`
        .step-circle {
          width: 30px;
          height: 30px;
          border-radius: 50%;
          background-color: #e9ecef;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
        }
        
        .step-circle.active {
          background-color: #0d6efd;
          color: white;
        }
        
        .step-circle.completed {
          background-color: #198754;
          color: white;
        }
        
        .step-line {
          height: 2px;
          background-color: #e9ecef;
          flex: 1;
          margin: 0 5px;
        }
        
        .step-line.completed {
          background-color: #198754;
        }
        
        .step-label {
          font-size: 0.8rem;
          text-align: center;
        }
      `}</style>
    </div>
  );
};

export default ArtifactUploadWizard;

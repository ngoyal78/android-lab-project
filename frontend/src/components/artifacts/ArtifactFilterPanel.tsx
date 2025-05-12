import React, { useState } from 'react';
import { ArtifactType, ArtifactFilter } from '../../types/artifact';

interface ArtifactFilterPanelProps {
  filters: ArtifactFilter;
  onFilterChange: (filters: ArtifactFilter) => void;
  availableTags: string[];
  availablePlatforms: string[];
  availableProjects: string[];
}

const ArtifactFilterPanel: React.FC<ArtifactFilterPanelProps> = ({
  filters,
  onFilterChange,
  availableTags,
  availablePlatforms,
  availableProjects,
}) => {
  const [searchTerm, setSearchTerm] = useState(filters.search || '');
  
  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    
    // Apply search filter after a short delay
    const timer = setTimeout(() => {
      onFilterChange({ ...filters, search: value });
    }, 500);
    
    return () => clearTimeout(timer);
  };
  
  // Handle artifact type filter change
  const handleTypeChange = (type: ArtifactType, checked: boolean) => {
    const currentTypes = filters.type || [];
    let newTypes: ArtifactType[];
    
    if (checked) {
      newTypes = [...currentTypes, type];
    } else {
      newTypes = currentTypes.filter(t => t !== type);
    }
    
    onFilterChange({ ...filters, type: newTypes.length > 0 ? newTypes : undefined });
  };
  
  // Handle tag filter change
  const handleTagChange = (tag: string, checked: boolean) => {
    const currentTags = filters.tags || [];
    let newTags: string[];
    
    if (checked) {
      newTags = [...currentTags, tag];
    } else {
      newTags = currentTags.filter(t => t !== tag);
    }
    
    onFilterChange({ ...filters, tags: newTags.length > 0 ? newTags : undefined });
  };
  
  // Handle platform filter change
  const handlePlatformChange = (platform: string, checked: boolean) => {
    const currentPlatforms = filters.platform || [];
    let newPlatforms: string[];
    
    if (checked) {
      newPlatforms = [...currentPlatforms, platform];
    } else {
      newPlatforms = currentPlatforms.filter(p => p !== platform);
    }
    
    onFilterChange({ ...filters, platform: newPlatforms.length > 0 ? newPlatforms : undefined });
  };
  
  // Handle project filter change
  const handleProjectChange = (project: string) => {
    onFilterChange({ ...filters, project: project === 'all' ? undefined : project });
  };
  
  // Handle date filter change
  const handleDateChange = (field: 'dateFrom' | 'dateTo', value: string) => {
    onFilterChange({ ...filters, [field]: value || undefined });
  };
  
  // Handle clear all filters
  const handleClearFilters = () => {
    setSearchTerm('');
    onFilterChange({});
  };
  
  return (
    <div className="card">
      <div className="card-header d-flex justify-content-between align-items-center">
        <h5 className="mb-0">Filters</h5>
        <button 
          className="btn btn-sm btn-outline-secondary" 
          onClick={handleClearFilters}
        >
          Clear All
        </button>
      </div>
      <div className="card-body">
        {/* Search */}
        <div className="mb-3">
          <label htmlFor="search" className="form-label">Search</label>
          <input
            type="text"
            className="form-control"
            id="search"
            placeholder="Search artifacts..."
            value={searchTerm}
            onChange={handleSearchChange}
          />
        </div>
        
        {/* Artifact Type */}
        <div className="mb-3">
          <label className="form-label">Artifact Type</label>
          <div className="form-check">
            <input
              className="form-check-input"
              type="checkbox"
              id="type-apk"
              checked={filters.type?.includes(ArtifactType.APK) || false}
              onChange={(e) => handleTypeChange(ArtifactType.APK, e.target.checked)}
            />
            <label className="form-check-label" htmlFor="type-apk">
              APK
            </label>
          </div>
          <div className="form-check">
            <input
              className="form-check-input"
              type="checkbox"
              id="type-config"
              checked={filters.type?.includes(ArtifactType.CONFIG) || false}
              onChange={(e) => handleTypeChange(ArtifactType.CONFIG, e.target.checked)}
            />
            <label className="form-check-label" htmlFor="type-config">
              Configuration
            </label>
          </div>
          <div className="form-check">
            <input
              className="form-check-input"
              type="checkbox"
              id="type-test"
              checked={filters.type?.includes(ArtifactType.TEST_SCRIPT) || false}
              onChange={(e) => handleTypeChange(ArtifactType.TEST_SCRIPT, e.target.checked)}
            />
            <label className="form-check-label" htmlFor="type-test">
              Test Script
            </label>
          </div>
          <div className="form-check">
            <input
              className="form-check-input"
              type="checkbox"
              id="type-binary"
              checked={filters.type?.includes(ArtifactType.BINARY) || false}
              onChange={(e) => handleTypeChange(ArtifactType.BINARY, e.target.checked)}
            />
            <label className="form-check-label" htmlFor="type-binary">
              Binary
            </label>
          </div>
          <div className="form-check">
            <input
              className="form-check-input"
              type="checkbox"
              id="type-image"
              checked={filters.type?.includes(ArtifactType.IMAGE) || false}
              onChange={(e) => handleTypeChange(ArtifactType.IMAGE, e.target.checked)}
            />
            <label className="form-check-label" htmlFor="type-image">
              Image
            </label>
          </div>
        </div>
        
        {/* Platform */}
        <div className="mb-3">
          <label className="form-label">Platform Compatibility</label>
          {availablePlatforms.map(platform => (
            <div className="form-check" key={platform}>
              <input
                className="form-check-input"
                type="checkbox"
                id={`platform-${platform}`}
                checked={filters.platform?.includes(platform) || false}
                onChange={(e) => handlePlatformChange(platform, e.target.checked)}
              />
              <label className="form-check-label" htmlFor={`platform-${platform}`}>
                {platform}
              </label>
            </div>
          ))}
        </div>
        
        {/* Project */}
        <div className="mb-3">
          <label htmlFor="project" className="form-label">Project</label>
          <select
            className="form-select"
            id="project"
            value={filters.project || 'all'}
            onChange={(e) => handleProjectChange(e.target.value)}
          >
            <option value="all">All Projects</option>
            {availableProjects.map(project => (
              <option key={project} value={project}>{project}</option>
            ))}
          </select>
        </div>
        
        {/* Date Range */}
        <div className="mb-3">
          <label className="form-label">Date Range</label>
          <div className="input-group mb-2">
            <span className="input-group-text">From</span>
            <input
              type="date"
              className="form-control"
              value={filters.dateFrom || ''}
              onChange={(e) => handleDateChange('dateFrom', e.target.value)}
            />
          </div>
          <div className="input-group">
            <span className="input-group-text">To</span>
            <input
              type="date"
              className="form-control"
              value={filters.dateTo || ''}
              onChange={(e) => handleDateChange('dateTo', e.target.value)}
            />
          </div>
        </div>
        
        {/* Tags */}
        <div className="mb-3">
          <label className="form-label">Tags</label>
          {availableTags.map(tag => (
            <div className="form-check" key={tag}>
              <input
                className="form-check-input"
                type="checkbox"
                id={`tag-${tag}`}
                checked={filters.tags?.includes(tag) || false}
                onChange={(e) => handleTagChange(tag, e.target.checked)}
              />
              <label className="form-check-label" htmlFor={`tag-${tag}`}>
                {tag}
              </label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ArtifactFilterPanel;

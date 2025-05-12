import React from 'react';
import { Artifact, ArtifactType } from '../../types/artifact';

interface ArtifactListProps {
  artifacts: Artifact[];
  loading: boolean;
  selectedArtifacts: number[];
  onSelectArtifact: (id: number) => void;
  onViewArtifact: (id: number) => void;
  page: number;
  itemsPerPage: number;
  totalCount: number;
  onPageChange: (page: number) => void;
}

const ArtifactList: React.FC<ArtifactListProps> = ({
  artifacts,
  loading,
  selectedArtifacts,
  onSelectArtifact,
  onViewArtifact,
  page,
  itemsPerPage,
  totalCount,
  onPageChange,
}) => {
  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) {
      return bytes + ' B';
    } else if (bytes < 1024 * 1024) {
      return (bytes / 1024).toFixed(2) + ' KB';
    } else if (bytes < 1024 * 1024 * 1024) {
      return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    } else {
      return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
    }
  };

  // Format date
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  // Render artifact type badge
  const renderArtifactTypeBadge = (type: ArtifactType): JSX.Element => {
    let badgeClass = 'badge ';
    
    switch (type) {
      case ArtifactType.APK:
        badgeClass += 'bg-success';
        break;
      case ArtifactType.CONFIG:
        badgeClass += 'bg-info';
        break;
      case ArtifactType.TEST_SCRIPT:
        badgeClass += 'bg-primary';
        break;
      case ArtifactType.BINARY:
        badgeClass += 'bg-warning';
        break;
      case ArtifactType.IMAGE:
        badgeClass += 'bg-secondary';
        break;
      default:
        badgeClass += 'bg-light text-dark';
    }
    
    return <span className={badgeClass}>{type}</span>;
  };

  // Handle select all
  const handleSelectAll = () => {
    if (selectedArtifacts.length === artifacts.length) {
      // Deselect all
      onSelectArtifact(-1); // Special value to clear all
    } else {
      // Select all
      artifacts.forEach(artifact => {
        if (!selectedArtifacts.includes(artifact.id)) {
          onSelectArtifact(artifact.id);
        }
      });
    }
  };

  // Calculate pagination
  const totalPages = Math.ceil(totalCount / itemsPerPage);
  const showPagination = totalPages > 1;

  return (
    <div className="card">
      <div className="card-header">
        <h5 className="mb-0">Artifacts</h5>
      </div>
      <div className="card-body p-0">
        <div className="table-responsive">
          <table className="table table-hover mb-0">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={selectedArtifacts.length === artifacts.length && artifacts.length > 0}
                    onChange={handleSelectAll}
                    disabled={artifacts.length === 0}
                  />
                </th>
                <th>Name</th>
                <th>Type</th>
                <th>Version</th>
                <th>Size</th>
                <th>Uploaded</th>
                <th>Platform</th>
                <th>Tags</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="text-center py-4">
                    <div className="spinner-border text-primary" role="status">
                      <span className="visually-hidden">Loading...</span>
                    </div>
                  </td>
                </tr>
              ) : artifacts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-4">
                    No artifacts found
                  </td>
                </tr>
              ) : (
                artifacts.map(artifact => (
                  <tr key={artifact.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedArtifacts.includes(artifact.id)}
                        onChange={() => onSelectArtifact(artifact.id)}
                      />
                    </td>
                    <td>
                      <div className="d-flex align-items-center">
                        {artifact.is_latest && (
                          <span className="badge bg-success me-2">Latest</span>
                        )}
                        <span>{artifact.original_filename}</span>
                      </div>
                    </td>
                    <td>{renderArtifactTypeBadge(artifact.artifact_type)}</td>
                    <td>{artifact.version}</td>
                    <td>{formatFileSize(artifact.file_size)}</td>
                    <td>
                      <div>{formatDate(artifact.created_at)}</div>
                      <small className="text-muted">by {artifact.user_username}</small>
                    </td>
                    <td>
                      {artifact.platform_compatibility.map(platform => (
                        <span key={platform} className="badge bg-light text-dark me-1">
                          {platform}
                        </span>
                      ))}
                    </td>
                    <td>
                      {artifact.tags.map(tag => (
                        <span key={tag} className="badge bg-secondary me-1">
                          {tag}
                        </span>
                      ))}
                    </td>
                    <td>
                      <div className="btn-group">
                        <button
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => onViewArtifact(artifact.id)}
                        >
                          View
                        </button>
                        <button
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => window.open(`/api/artifacts/${artifact.id}/download`)}
                        >
                          Download
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Pagination */}
      {showPagination && (
        <div className="card-footer d-flex justify-content-between align-items-center">
          <div>
            Showing {((page - 1) * itemsPerPage) + 1} to {Math.min(page * itemsPerPage, totalCount)} of {totalCount} artifacts
          </div>
          <nav aria-label="Artifact pagination">
            <ul className="pagination mb-0">
              <li className={`page-item ${page === 1 ? 'disabled' : ''}`}>
                <button
                  className="page-link"
                  onClick={() => onPageChange(page - 1)}
                  disabled={page === 1}
                >
                  Previous
                </button>
              </li>
              
              {/* First page */}
              {page > 2 && (
                <li className="page-item">
                  <button className="page-link" onClick={() => onPageChange(1)}>1</button>
                </li>
              )}
              
              {/* Ellipsis */}
              {page > 3 && (
                <li className="page-item disabled">
                  <span className="page-link">...</span>
                </li>
              )}
              
              {/* Previous page */}
              {page > 1 && (
                <li className="page-item">
                  <button className="page-link" onClick={() => onPageChange(page - 1)}>{page - 1}</button>
                </li>
              )}
              
              {/* Current page */}
              <li className="page-item active">
                <span className="page-link">{page}</span>
              </li>
              
              {/* Next page */}
              {page < totalPages && (
                <li className="page-item">
                  <button className="page-link" onClick={() => onPageChange(page + 1)}>{page + 1}</button>
                </li>
              )}
              
              {/* Ellipsis */}
              {page < totalPages - 2 && (
                <li className="page-item disabled">
                  <span className="page-link">...</span>
                </li>
              )}
              
              {/* Last page */}
              {page < totalPages - 1 && (
                <li className="page-item">
                  <button className="page-link" onClick={() => onPageChange(totalPages)}>{totalPages}</button>
                </li>
              )}
              
              <li className={`page-item ${page === totalPages ? 'disabled' : ''}`}>
                <button
                  className="page-link"
                  onClick={() => onPageChange(page + 1)}
                  disabled={page === totalPages}
                >
                  Next
                </button>
              </li>
            </ul>
          </nav>
        </div>
      )}
    </div>
  );
};

export default ArtifactList;

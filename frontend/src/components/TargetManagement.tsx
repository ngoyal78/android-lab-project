import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

// Define types
interface Target {
  id: number;
  name: string;
  device_type: 'physical' | 'virtual' | 'emulator';
  status: 'available' | 'reserved' | 'offline' | 'maintenance' | 'unhealthy';
  android_version: string;
  api_level: number;
  manufacturer: string;
  model: string;
  location: string;
  tags: string[];
  purpose: string[];
  health_check_score: number | null;
  last_heartbeat: string;
  adb_status: boolean;
  serial_status: boolean;
  is_active: boolean;
}

interface FilterParams {
  status?: string[];
  device_type?: string[];
  is_active?: boolean;
  tags?: string[];
  purpose?: string[];
  android_version?: string;
  api_level_min?: number;
  api_level_max?: number;
  manufacturer?: string;
  model?: string;
  location?: string;
  health_score_min?: number;
  search?: string;
}

interface TargetStats {
  total_count: number;
  active_count: number;
  inactive_count: number;
  status_counts: Record<string, number>;
  type_counts: Record<string, number>;
  health_counts: {
    excellent: number;
    good: number;
    fair: number;
    poor: number;
    unknown: number;
  };
  top_tags: { tag: string; count: number }[];
  top_purposes: { purpose: string; count: number }[];
}

const TargetManagement: React.FC = () => {
  // Cast the auth context to our expected type
  const auth = useAuth();
  const token = auth ? (auth as any).token : '';
  const navigate = useNavigate();
  
  const [targets, setTargets] = useState<Target[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<TargetStats | null>(null);
  const [selectedTargets, setSelectedTargets] = useState<number[]>([]);
  const [filters, setFilters] = useState<FilterParams>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [itemsPerPage] = useState(20);

  // API base URL
  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

  // Fetch targets with advanced search
  const fetchTargets = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.post(
        `${API_URL}/target-management/advanced-search?skip=${(page - 1) * itemsPerPage}&limit=${itemsPerPage}`,
        filters,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      setTargets(response.data);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching targets:', err);
      setError('Failed to fetch targets. Please try again later.');
      setLoading(false);
    }
  }, [API_URL, token, page, itemsPerPage, filters]);

  // Fetch target statistics
  const fetchStats = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/target-management/stats`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setStats(response.data);
    } catch (err) {
      console.error('Error fetching target stats:', err);
    }
  }, [API_URL, token]);

  // Initial data fetch
  useEffect(() => {
    fetchTargets();
    fetchStats();
  }, [fetchTargets, fetchStats]);

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    // Apply search filter after a short delay
    const timer = setTimeout(() => {
      setFilters((prev) => ({ ...prev, search: e.target.value }));
    }, 500);
    return () => clearTimeout(timer);
  };

  // Handle target selection
  const handleSelectTarget = (id: number) => {
    if (selectedTargets.includes(id)) {
      setSelectedTargets(selectedTargets.filter((targetId) => targetId !== id));
    } else {
      setSelectedTargets([...selectedTargets, id]);
    }
  };

  // Handle select all targets
  const handleSelectAll = () => {
    if (selectedTargets.length === targets.length) {
      setSelectedTargets([]);
    } else {
      setSelectedTargets(targets.map((target) => target.id));
    }
  };

  // Handle refresh
  const handleRefresh = async () => {
    try {
      await axios.post(
        `${API_URL}/target-management/refresh`,
        {
          target_ids: selectedTargets.length > 0 ? selectedTargets : undefined,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      
      // Wait a bit for the refresh to take effect
      setTimeout(() => {
        fetchTargets();
        fetchStats();
      }, 2000);
    } catch (err) {
      console.error('Error refreshing targets:', err);
      setError('Failed to refresh targets. Please try again later.');
    }
  };

  // Handle view target details
  const handleViewTarget = (id: number) => {
    navigate(`/targets/${id}`);
  };

  // Render status indicator
  const renderStatusIndicator = (status: string) => {
    switch (status) {
      case 'available':
        return <span className="badge bg-success">Available</span>;
      case 'reserved':
        return <span className="badge bg-primary">Reserved</span>;
      case 'offline':
        return <span className="badge bg-secondary">Offline</span>;
      case 'maintenance':
        return <span className="badge bg-warning">Maintenance</span>;
      case 'unhealthy':
        return <span className="badge bg-danger">Unhealthy</span>;
      default:
        return <span className="badge bg-secondary">{status}</span>;
    }
  };

  // Render device type indicator
  const renderDeviceTypeIndicator = (type: string) => {
    switch (type) {
      case 'physical':
        return <span className="badge bg-info">Physical</span>;
      case 'virtual':
        return <span className="badge bg-primary">Virtual</span>;
      case 'emulator':
        return <span className="badge bg-success">Emulator</span>;
      default:
        return <span className="badge bg-secondary">{type}</span>;
    }
  };

  return (
    <div className="container-fluid mt-4">
      <h1 className="mb-4">Android Target Management</h1>
      
      {error && (
        <div className="alert alert-danger alert-dismissible fade show" role="alert">
          {error}
          <button type="button" className="btn-close" onClick={() => setError(null)}></button>
        </div>
      )}
      
      {/* Stats Dashboard */}
      {stats && (
        <div className="row mb-4">
          <div className="col-md-3">
            <div className="card">
              <div className="card-body">
                <h5 className="card-title">Targets</h5>
                <div className="d-flex justify-content-between">
                  <div>
                    <h2>{stats.total_count}</h2>
                    <p className="text-muted">Total</p>
                  </div>
                  <div>
                    <h2>{stats.active_count}</h2>
                    <p className="text-success">Active</p>
                  </div>
                  <div>
                    <h2>{stats.inactive_count}</h2>
                    <p className="text-danger">Inactive</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Filters and Actions */}
      <div className="row mb-4">
        <div className="col-md-6">
          <div className="input-group">
            <input
              type="text"
              className="form-control"
              placeholder="Search targets..."
              value={searchTerm}
              onChange={handleSearchChange}
            />
            <button
              className="btn btn-outline-secondary"
              type="button"
              onClick={() => setFilters({})}
            >
              Clear Filters
            </button>
          </div>
        </div>
        
        <div className="col-md-6">
          <div className="btn-group float-end">
            <button
              className="btn btn-outline-info"
              onClick={handleRefresh}
            >
              Refresh
            </button>
          </div>
        </div>
      </div>
      
      {/* Target Table */}
      <div className="table-responsive">
        <table className="table table-hover">
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  checked={selectedTargets.length === targets.length && targets.length > 0}
                  onChange={handleSelectAll}
                />
              </th>
              <th>Name</th>
              <th>Type</th>
              <th>Status</th>
              <th>Android</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="text-center">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                </td>
              </tr>
            ) : targets.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center">
                  No targets found
                </td>
              </tr>
            ) : (
              targets.map((target) => (
                <tr key={target.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedTargets.includes(target.id)}
                      onChange={() => handleSelectTarget(target.id)}
                    />
                  </td>
                  <td>{target.name}</td>
                  <td>{renderDeviceTypeIndicator(target.device_type)}</td>
                  <td>{renderStatusIndicator(target.status)}</td>
                  <td>{target.android_version} (API {target.api_level})</td>
                  <td>
                    <button
                      className="btn btn-sm btn-outline-primary me-1"
                      onClick={() => handleViewTarget(target.id)}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      
      {/* Pagination */}
      <div className="d-flex justify-content-between align-items-center mt-3">
        <div>
          Showing {targets.length} targets
        </div>
        <div>
          <button
            className="btn btn-sm btn-outline-secondary me-1"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </button>
          <span className="mx-2">
            Page {page}
          </span>
          <button
            className="btn btn-sm btn-outline-secondary ms-1"
            onClick={() => setPage(page + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};

export default TargetManagement;

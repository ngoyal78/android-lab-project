import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import ConsoleViewer from '../components/ConsoleViewer';
import TestJobForm from '../components/TestJobForm';
import TestJobList from '../components/TestJobList';

interface Target {
  id: string;
  name: string;
  type: 'physical' | 'virtual';
  status: 'available' | 'reserved' | 'offline';
  reservedBy?: string;
  androidVersion: string;
  apiLevel: number;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  lastConnected?: string;
  cpuArchitecture?: string;
  ramSize?: string;
  storageSize?: string;
  screenResolution?: string;
  ipAddress?: string;
  macAddress?: string;
}

interface LogEntry {
  id: string;
  timestamp: string;
  action: string;
  user: string;
  details?: string;
}

const TargetDetail: React.FC = () => {
  const { id = '' } = useParams<{ id: string }>();
  const { user, hasRole } = useAuth();
  const [target, setTarget] = useState<Target | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [activeTab, setActiveTab] = useState<'info' | 'console' | 'test' | 'logs'>('info');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTargetData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // In a real app, these would be actual API calls
        const targetResponse = await axios.get(`/api/targets/${id}`);
        const logsResponse = await axios.get(`/api/targets/${id}/logs`);
        
        setTarget(targetResponse.data);
        setLogs(logsResponse.data);
      } catch (err) {
        console.error('Error fetching target data:', err);
        setError('Failed to load target data. Please try again later.');
        
        // For demo purposes, set some mock data
        setTarget({
          id: id || '1',
          name: 'Pixel 6 Pro',
          type: 'physical',
          status: 'available',
          androidVersion: '12',
          apiLevel: 31,
          manufacturer: 'Google',
          model: 'Pixel 6 Pro',
          serialNumber: 'GP6P12345678',
          lastConnected: '2023-08-15T10:30:00Z',
          cpuArchitecture: 'ARM64',
          ramSize: '8 GB',
          storageSize: '128 GB',
          screenResolution: '1440 x 3120',
          ipAddress: '192.168.1.100',
          macAddress: '00:1B:44:11:3A:B7'
        });
        
        setLogs([
          {
            id: '1',
            timestamp: '2023-08-15T10:30:00Z',
            action: 'Connected',
            user: 'system',
            details: 'Device connected to the platform'
          },
          {
            id: '2',
            timestamp: '2023-08-15T10:35:00Z',
            action: 'Reserved',
            user: 'john.doe',
            details: 'Device reserved for testing'
          },
          {
            id: '3',
            timestamp: '2023-08-15T11:20:00Z',
            action: 'Released',
            user: 'john.doe',
            details: 'Device released back to the pool'
          }
        ]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTargetData();
  }, [id]);

  const handleReserveTarget = async () => {
    try {
      // In a real app, this would be an actual API call
      await axios.post(`/api/targets/${id}/reserve`);
      
      // Update the target status
      if (target) {
        setTarget({
          ...target,
          status: 'reserved',
          reservedBy: user?.username
        });
        
        // Add a log entry
        const newLog = {
          id: `log-${Date.now()}`,
          timestamp: new Date().toISOString(),
          action: 'Reserved',
          user: user?.username || 'unknown',
          details: 'Device reserved for testing'
        };
        
        setLogs([newLog, ...logs]);
      }
    } catch (err) {
      console.error('Error reserving target:', err);
      setError('Failed to reserve target. Please try again later.');
    }
  };

  const handleReleaseTarget = async () => {
    try {
      // In a real app, this would be an actual API call
      await axios.post(`/api/targets/${id}/release`);
      
      // Update the target status
      if (target) {
        setTarget({
          ...target,
          status: 'available',
          reservedBy: undefined
        });
        
        // Add a log entry
        const newLog = {
          id: `log-${Date.now()}`,
          timestamp: new Date().toISOString(),
          action: 'Released',
          user: user?.username || 'unknown',
          details: 'Device released back to the pool'
        };
        
        setLogs([newLog, ...logs]);
      }
    } catch (err) {
      console.error('Error releasing target:', err);
      setError('Failed to release target. Please try again later.');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available':
        return 'bg-green-100 text-green-800';
      case 'reserved':
        return 'bg-yellow-100 text-yellow-800';
      case 'offline':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!target) {
    return (
      <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-red-700">Target not found.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center">
            <Link to="/targets" className="mr-2 text-primary-600 hover:text-primary-900">
              <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </Link>
            <h1 className="text-2xl font-semibold text-gray-900">{target.name}</h1>
          </div>
          <p className="text-sm text-gray-500">
            {target.manufacturer} {target.model} • Android {target.androidVersion} (API {target.apiLevel})
          </p>
        </div>
        <div className="flex space-x-3">
          {target.status === 'available' && (
            <button
              onClick={handleReserveTarget}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
            >
              Reserve
            </button>
          )}
          {target.status === 'reserved' && target.reservedBy === user?.username && (
            <button
              onClick={handleReleaseTarget}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
            >
              Release
            </button>
          )}
          {hasRole('Admin') && (
            <button
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              Edit
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('info')}
            className={`${
              activeTab === 'info'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Device Info
          </button>
          <button
            onClick={() => setActiveTab('console')}
            className={`${
              activeTab === 'console'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            ADB Console
          </button>
          <button
            onClick={() => setActiveTab('test')}
            className={`${
              activeTab === 'test'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Test
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`${
              activeTab === 'logs'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Activity Logs
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {/* Device Info Tab */}
        {activeTab === 'info' && (
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:px-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900">Device Information</h3>
              <p className="mt-1 max-w-2xl text-sm text-gray-500">Details about the Android target device.</p>
            </div>
            <div className="border-t border-gray-200 px-4 py-5 sm:p-0">
              <dl className="sm:divide-y sm:divide-gray-200">
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Status</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(target.status)}`}>
                      {target.status}
                      {target.reservedBy && ` (by ${target.reservedBy})`}
                    </span>
                  </dd>
                </div>
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Type</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    {target.type === 'physical' ? 'Physical Device' : 'Virtual Device'}
                  </dd>
                </div>
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Manufacturer</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    {target.manufacturer || 'N/A'}
                  </dd>
                </div>
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Model</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    {target.model || 'N/A'}
                  </dd>
                </div>
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Serial Number</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    {target.serialNumber || 'N/A'}
                  </dd>
                </div>
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Android Version</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    {target.androidVersion} (API Level {target.apiLevel})
                  </dd>
                </div>
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">CPU Architecture</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    {target.cpuArchitecture || 'N/A'}
                  </dd>
                </div>
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">RAM</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    {target.ramSize || 'N/A'}
                  </dd>
                </div>
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Storage</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    {target.storageSize || 'N/A'}
                  </dd>
                </div>
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Screen Resolution</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    {target.screenResolution || 'N/A'}
                  </dd>
                </div>
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">IP Address</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    {target.ipAddress || 'N/A'}
                  </dd>
                </div>
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">MAC Address</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    {target.macAddress || 'N/A'}
                  </dd>
                </div>
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Last Connected</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    {target.lastConnected ? new Date(target.lastConnected).toLocaleString() : 'N/A'}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        )}

        {/* Console Tab */}
        {activeTab === 'console' && (
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:px-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900">ADB Console</h3>
              <p className="mt-1 max-w-2xl text-sm text-gray-500">
                Execute ADB commands on the device.
              </p>
            </div>
            <div className="border-t border-gray-200 px-4 py-5 sm:p-6">
              {target.status !== 'reserved' || target.reservedBy !== user?.username ? (
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-yellow-700">
                        You must reserve this device to use the ADB console.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <ConsoleViewer targetId={id} consoleType="adb" />
              )}
            </div>
          </div>
        )}

        {/* Test Tab */}
        {activeTab === 'test' && (
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:px-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900">Test Execution</h3>
              <p className="mt-1 max-w-2xl text-sm text-gray-500">
                Run automated tests on this device.
              </p>
            </div>
            <div className="border-t border-gray-200 px-4 py-5 sm:p-6">
              {target.status !== 'reserved' || target.reservedBy !== user?.username ? (
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-yellow-700">
                        You must reserve this device to run tests on it.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <TestJobForm targetId={parseInt(id)} />
                  <div className="mt-8">
                    <h3 className="text-lg font-semibold mb-4">Recent Test Jobs</h3>
                    <TestJobList targetId={parseInt(id)} limit={5} />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Logs Tab */}
        {activeTab === 'logs' && (
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:px-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900">Activity Logs</h3>
              <p className="mt-1 max-w-2xl text-sm text-gray-500">
                Recent activity history for this device.
              </p>
            </div>
            <div className="border-t border-gray-200">
              <ul className="divide-y divide-gray-200">
                {logs.map((log) => (
                  <li key={log.id} className="px-4 py-4 sm:px-6">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-primary-600 truncate">
                        {log.action}
                      </p>
                      <div className="ml-2 flex-shrink-0 flex">
                        <p className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                          {log.user}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 sm:flex sm:justify-between">
                      <div className="sm:flex">
                        <p className="flex items-center text-sm text-gray-500">
                          {log.details}
                        </p>
                      </div>
                      <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                        <svg className="flex-shrink-0 mr-1.5 h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                        </svg>
                        <span>
                          {new Date(log.timestamp).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TargetDetail;

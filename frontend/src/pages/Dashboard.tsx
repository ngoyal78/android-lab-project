import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import TestJobList from '../components/TestJobList';

interface Target {
  id: string;
  name: string;
  type: 'physical' | 'virtual';
  status: 'available' | 'reserved' | 'offline';
  reservedBy?: string;
  androidVersion: string;
  apiLevel: number;
}

interface TestRun {
  id: string;
  name: string;
  status: 'running' | 'completed' | 'failed';
  targetId: string;
  targetName: string;
  startTime: string;
  endTime?: string;
  user: string;
}

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [recentTargets, setRecentTargets] = useState<Target[]>([]);
  const [recentTests, setRecentTests] = useState<TestRun[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // For demo purposes, use mock data directly instead of API calls
        // In a real app, these would be actual API calls
        // const targetsResponse = await axios.get('/api/targets/recent');
        // const testsResponse = await axios.get('/api/tests/recent');
        // setRecentTargets(targetsResponse.data);
        // setRecentTests(testsResponse.data);
        
        // Mock data for demonstration
        setRecentTargets([
          {
            id: '1',
            name: 'Pixel 6 Pro',
            type: 'physical',
            status: 'available',
            androidVersion: '12',
            apiLevel: 31
          },
          {
            id: '2',
            name: 'Samsung Galaxy S21',
            type: 'physical',
            status: 'reserved',
            reservedBy: 'john.doe',
            androidVersion: '11',
            apiLevel: 30
          },
          {
            id: '3',
            name: 'Emulator - Pixel 4',
            type: 'virtual',
            status: 'available',
            androidVersion: '10',
            apiLevel: 29
          }
        ]);
        
        setRecentTests([
          {
            id: '101',
            name: 'UI Automation Test Suite',
            status: 'completed',
            targetId: '1',
            targetName: 'Pixel 6 Pro',
            startTime: '2023-08-15T10:30:00Z',
            endTime: '2023-08-15T10:45:00Z',
            user: 'jane.smith'
          },
          {
            id: '102',
            name: 'Performance Benchmark',
            status: 'running',
            targetId: '2',
            targetName: 'Samsung Galaxy S21',
            startTime: '2023-08-15T11:00:00Z',
            user: 'john.doe'
          }
        ]);
      } catch (err) {
        console.error('Error setting up dashboard data:', err);
        setError('Failed to load dashboard data. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available':
        return 'bg-green-100 text-green-800';
      case 'reserved':
        return 'bg-yellow-100 text-yellow-800';
      case 'offline':
        return 'bg-gray-100 text-gray-800';
      case 'running':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
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

  if (error) {
    return (
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
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500">
          Welcome back, {user?.username}!
        </p>
      </div>

      {/* Recent Targets */}
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
          <div>
            <h2 className="text-lg leading-6 font-medium text-gray-900">Recent Targets</h2>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              Android devices available for testing
            </p>
          </div>
          <Link
            to="/targets"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
          >
            View All
          </Link>
        </div>
        <div className="border-t border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Android Version
                </th>
                <th scope="col" className="relative px-6 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {recentTargets.map((target) => (
                <tr key={target.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{target.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">
                      {target.type === 'physical' ? 'Physical Device' : 'Virtual Device'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(target.status)}`}>
                      {target.status}
                      {target.reservedBy && ` (by ${target.reservedBy})`}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    Android {target.androidVersion} (API {target.apiLevel})
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Link to={`/targets/${target.id}`} className="text-primary-600 hover:text-primary-900">
                      Details
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Test Jobs */}
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
          <div>
            <h2 className="text-lg leading-6 font-medium text-gray-900">Recent Test Jobs</h2>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              Latest test executions on Android targets
            </p>
          </div>
          <Link
            to="/tests"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
          >
            View All
          </Link>
        </div>
        <div className="border-t border-gray-200 p-4">
          <TestJobList limit={5} />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

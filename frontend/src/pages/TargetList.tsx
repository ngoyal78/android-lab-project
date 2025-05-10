import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

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
}

const TargetList: React.FC = () => {
  const [targets, setTargets] = useState<Target[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    const fetchTargets = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // In a real app, this would be an actual API call
        const response = await axios.get('/api/targets');
        setTargets(response.data);
      } catch (err) {
        console.error('Error fetching targets:', err);
        setError('Failed to load targets. Please try again later.');
        
        // For demo purposes, set some mock data
        setTargets([
          {
            id: '1',
            name: 'Pixel 6 Pro',
            type: 'physical',
            status: 'available',
            androidVersion: '12',
            apiLevel: 31,
            manufacturer: 'Google',
            model: 'Pixel 6 Pro',
            serialNumber: 'GP6P12345678',
            lastConnected: '2023-08-15T10:30:00Z'
          },
          {
            id: '2',
            name: 'Samsung Galaxy S21',
            type: 'physical',
            status: 'reserved',
            reservedBy: 'john.doe',
            androidVersion: '11',
            apiLevel: 30,
            manufacturer: 'Samsung',
            model: 'Galaxy S21',
            serialNumber: 'SGS21987654',
            lastConnected: '2023-08-15T09:15:00Z'
          },
          {
            id: '3',
            name: 'Emulator - Pixel 4',
            type: 'virtual',
            status: 'available',
            androidVersion: '10',
            apiLevel: 29,
            model: 'Pixel 4',
            lastConnected: '2023-08-14T16:45:00Z'
          },
          {
            id: '4',
            name: 'Xiaomi Mi 11',
            type: 'physical',
            status: 'offline',
            androidVersion: '11',
            apiLevel: 30,
            manufacturer: 'Xiaomi',
            model: 'Mi 11',
            serialNumber: 'XM11ABCDEF',
            lastConnected: '2023-08-10T14:20:00Z'
          },
          {
            id: '5',
            name: 'Emulator - Galaxy Tab S7',
            type: 'virtual',
            status: 'available',
            androidVersion: '12',
            apiLevel: 31,
            model: 'Galaxy Tab S7',
            lastConnected: '2023-08-15T11:10:00Z'
          }
        ]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTargets();
  }, []);

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

  const filteredTargets = targets.filter(target => {
    const matchesSearch = target.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (target.manufacturer && target.manufacturer.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (target.model && target.model.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (target.serialNumber && target.serialNumber.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesType = filterType === 'all' || target.type === filterType;
    const matchesStatus = filterStatus === 'all' || target.status === filterStatus;
    
    return matchesSearch && matchesType && matchesStatus;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Android Targets</h1>
        <button
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
        >
          Add Target
        </button>
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

      {/* Filters */}
      <div className="bg-white shadow px-4 py-5 sm:rounded-lg sm:p-6">
        <div className="md:flex md:items-center md:justify-between">
          <div className="flex-1 min-w-0">
            <div className="max-w-lg w-full lg:max-w-xs">
              <label htmlFor="search" className="sr-only">Search</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                  </svg>
                </div>
                <input
                  id="search"
                  name="search"
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  placeholder="Search targets"
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>
          <div className="mt-4 flex md:mt-0 md:ml-4 space-x-3">
            <select
              id="type-filter"
              name="type-filter"
              className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="all">All Types</option>
              <option value="physical">Physical</option>
              <option value="virtual">Virtual</option>
            </select>
            <select
              id="status-filter"
              name="status-filter"
              className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="available">Available</option>
              <option value="reserved">Reserved</option>
              <option value="offline">Offline</option>
            </select>
          </div>
        </div>
      </div>

      {/* Target List */}
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
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
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Last Connected
              </th>
              <th scope="col" className="relative px-6 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredTargets.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                  No targets found matching your criteria.
                </td>
              </tr>
            ) : (
              filteredTargets.map((target) => (
                <tr key={target.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-full bg-primary-100 text-primary-600">
                        <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{target.name}</div>
                        <div className="text-sm text-gray-500">
                          {target.manufacturer && `${target.manufacturer} `}
                          {target.model}
                        </div>
                      </div>
                    </div>
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
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {target.lastConnected ? new Date(target.lastConnected).toLocaleString() : 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Link to={`/targets/${target.id}`} className="text-primary-600 hover:text-primary-900 mr-4">
                      Details
                    </Link>
                    {target.status === 'available' && (
                      <button className="text-primary-600 hover:text-primary-900">
                        Reserve
                      </button>
                    )}
                    {target.status === 'reserved' && target.reservedBy === 'john.doe' && (
                      <button className="text-red-600 hover:text-red-900">
                        Release
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TargetList;

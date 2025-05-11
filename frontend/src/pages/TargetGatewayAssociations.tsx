import React from 'react';
import TargetGatewayAssociation from '../components/TargetGatewayAssociation';

const TargetGatewayAssociations: React.FC = () => {
  return (
    <div className="container mx-auto py-5 px-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Target-Gateway Associations</h1>
          <p className="text-gray-500">Manage connections between Android targets and SLC gateways</p>
        </div>
        <div className="flex space-x-3">
          <button 
            className="px-4 py-2 bg-teal-500 text-white rounded hover:bg-teal-600 flex items-center"
            onClick={() => alert('Export CSV functionality will be available in the full implementation')}
          >
            <span className="mr-2">↓</span>
            Export CSV
          </button>
          <button 
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center"
            onClick={() => alert('Refresh functionality will be available in the full implementation')}
          >
            <span className="mr-2">↻</span>
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
        <div className="border rounded-md p-4 shadow-sm">
          <div>
            <p className="text-sm text-gray-500">Total Associations</p>
            <p className="text-2xl font-bold">0</p>
            <div className="flex mt-1 space-x-2">
              <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">0 Active</span>
              <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full">0 Failed</span>
            </div>
          </div>
        </div>
        
        <div className="border rounded-md p-4 shadow-sm">
          <div>
            <p className="text-sm text-gray-500">Targets</p>
            <p className="text-2xl font-bold">0</p>
            <p className="text-xs text-gray-500 mt-1">Status Distribution</p>
            <div className="flex mt-1 space-x-2">
              <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">active: 0</span>
              <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full">offline: 0</span>
            </div>
          </div>
        </div>
        
        <div className="border rounded-md p-4 shadow-sm">
          <div>
            <p className="text-sm text-gray-500">Gateways</p>
            <p className="text-2xl font-bold">0</p>
            <p className="text-xs text-gray-500 mt-1">Status Distribution</p>
            <div className="flex mt-1 space-x-2">
              <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">active: 0</span>
              <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full">offline: 0</span>
            </div>
          </div>
        </div>
        
        <div className="border rounded-md p-4 shadow-sm">
          <div>
            <p className="text-sm text-gray-500">Average Health</p>
            <p className="text-2xl font-bold">0%</p>
            <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
              <div className="bg-red-500 h-2.5 rounded-full" style={{ width: '0%' }}></div>
            </div>
          </div>
        </div>
      </div>

      <div className="border-b border-gray-200 mb-4">
        <nav className="-mb-px flex space-x-8">
          <button className="border-b-2 border-blue-500 py-4 px-1 text-blue-600 font-medium">
            All Associations
          </button>
          <button className="border-b-2 border-transparent py-4 px-1 text-gray-500 font-medium hover:text-gray-700 hover:border-gray-300">
            By Target
          </button>
          <button className="border-b-2 border-transparent py-4 px-1 text-gray-500 font-medium hover:text-gray-700 hover:border-gray-300">
            By Gateway
          </button>
        </nav>
      </div>

      <div className="pt-4">
        <TargetGatewayAssociation />
      </div>
    </div>
  );
};

export default TargetGatewayAssociations;

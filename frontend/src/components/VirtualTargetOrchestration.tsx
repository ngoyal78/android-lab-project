import React, { useState, useEffect } from 'react';

// Define types for virtual targets
interface VirtualTarget {
  id: string;
  name: string;
  type: 'android_emulator' | 'simics_vm' | 'qemu';
  status: 'provisioning' | 'starting' | 'running' | 'idle' | 'paused' | 'stopping' | 'stopped' | 'error';
  osType: string;
  osVersion: string;
  cpuCores: number;
  memoryMB: number;
  diskGB: number;
  snapshotAvailable: boolean;
  lastStarted?: string;
  resourceUsage?: ResourceUsage;
}

interface ResourceUsage {
  cpuPercent: number;
  memoryPercent: number;
  diskPercent: number;
  networkMbps: number;
}

const VirtualTargetOrchestration: React.FC = () => {
  const [virtualTargets, setVirtualTargets] = useState<VirtualTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [isLaunching, setIsLaunching] = useState(false);
  const [launchConfig, setLaunchConfig] = useState({
    name: '',
    type: 'android_emulator',
    osType: 'Android',
    osVersion: 'Android 13',
    cpuCores: 2,
    memoryMB: 2048,
    diskGB: 8
  });

  // Fetch virtual targets
  useEffect(() => {
    // Mock data for demonstration
    const mockVirtualTargets: VirtualTarget[] = [
      {
        id: '1',
        name: 'Pixel 6 Emulator',
        type: 'android_emulator',
        status: 'running',
        osType: 'Android',
        osVersion: 'Android 13',
        cpuCores: 2,
        memoryMB: 2048,
        diskGB: 8,
        snapshotAvailable: true,
        lastStarted: '2025-05-11T10:30:00Z',
        resourceUsage: {
          cpuPercent: 35,
          memoryPercent: 42,
          diskPercent: 28,
          networkMbps: 1.2
        }
      },
      {
        id: '2',
        name: 'Galaxy Tab S7 Emulator',
        type: 'android_emulator',
        status: 'stopped',
        osType: 'Android',
        osVersion: 'Android 12',
        cpuCores: 4,
        memoryMB: 4096,
        diskGB: 16,
        snapshotAvailable: true
      },
      {
        id: '3',
        name: 'Simics ARM Platform',
        type: 'simics_vm',
        status: 'paused',
        osType: 'Android',
        osVersion: 'Android 11',
        cpuCores: 8,
        memoryMB: 8192,
        diskGB: 32,
        snapshotAvailable: true,
        lastStarted: '2025-05-10T15:45:00Z',
        resourceUsage: {
          cpuPercent: 0,
          memoryPercent: 25,
          diskPercent: 15,
          networkMbps: 0
        }
      },
      {
        id: '4',
        name: 'QEMU x86 VM',
        type: 'qemu',
        status: 'idle',
        osType: 'Linux',
        osVersion: 'Ubuntu 22.04',
        cpuCores: 4,
        memoryMB: 4096,
        diskGB: 64,
        snapshotAvailable: true,
        lastStarted: '2025-05-11T09:15:00Z',
        resourceUsage: {
          cpuPercent: 5,
          memoryPercent: 30,
          diskPercent: 45,
          networkMbps: 0.1
        }
      }
    ];

    setVirtualTargets(mockVirtualTargets);
    setLoading(false);
  }, []);

  // Get selected target
  const selectedTarget = virtualTargets.find(target => target.id === selectedTargetId);

  // Handle target selection
  const handleSelectTarget = (id: string) => {
    setSelectedTargetId(id);
  };

  // Handle launch config change
  const handleConfigChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setLaunchConfig({
      ...launchConfig,
      [name]: name === 'cpuCores' || name === 'memoryMB' || name === 'diskGB' 
        ? parseInt(value) 
        : value
    });
  };

  // Handle launch new virtual target
  const handleLaunchTarget = () => {
    setIsLaunching(true);
    
    // Simulate API call with a timeout
    setTimeout(() => {
      const newTarget: VirtualTarget = {
        id: `new-${Date.now()}`,
        name: launchConfig.name,
        type: launchConfig.type as 'android_emulator' | 'simics_vm' | 'qemu',
        status: 'running',
        osType: launchConfig.osType,
        osVersion: launchConfig.osVersion,
        cpuCores: launchConfig.cpuCores,
        memoryMB: launchConfig.memoryMB,
        diskGB: launchConfig.diskGB,
        snapshotAvailable: false,
        lastStarted: new Date().toISOString(),
        resourceUsage: {
          cpuPercent: 45,
          memoryPercent: 30,
          diskPercent: 10,
          networkMbps: 0.8
        }
      };
      
      setVirtualTargets([...virtualTargets, newTarget]);
      setSelectedTargetId(newTarget.id);
      setIsLaunching(false);
      
      // Reset form
      setLaunchConfig({
        name: '',
        type: 'android_emulator',
        osType: 'Android',
        osVersion: 'Android 13',
        cpuCores: 2,
        memoryMB: 2048,
        diskGB: 8
      });
    }, 1000);
  };

  // Handle boot target
  const handleBootTarget = (id: string) => {
    setVirtualTargets(
      virtualTargets.map(target => 
        target.id === id 
          ? { 
              ...target, 
              status: 'running', 
              lastStarted: new Date().toISOString(),
              resourceUsage: {
                cpuPercent: 45,
                memoryPercent: 30,
                diskPercent: 10,
                networkMbps: 0.8
              }
            } 
          : target
      )
    );
  };

  // Handle pause/resume target
  const handlePauseResumeTarget = (id: string) => {
    setVirtualTargets(
      virtualTargets.map(target => 
        target.id === id 
          ? { 
              ...target, 
              status: target.status === 'running' || target.status === 'idle' ? 'paused' : 'running',
              resourceUsage: target.status === 'paused' 
                ? {
                    cpuPercent: 45,
                    memoryPercent: 30,
                    diskPercent: 10,
                    networkMbps: 0.8
                  }
                : {
                    cpuPercent: 0,
                    memoryPercent: target.resourceUsage?.memoryPercent || 0,
                    diskPercent: target.resourceUsage?.diskPercent || 0,
                    networkMbps: 0
                  }
            } 
          : target
      )
    );
  };

  // Handle stop target
  const handleStopTarget = (id: string) => {
    setVirtualTargets(
      virtualTargets.map(target => 
        target.id === id 
          ? { 
              ...target, 
              status: 'stopped',
              resourceUsage: undefined
            } 
          : target
      )
    );
  };

  // Handle create snapshot
  const handleCreateSnapshot = (id: string) => {
    setVirtualTargets(
      virtualTargets.map(target => 
        target.id === id 
          ? { 
              ...target, 
              snapshotAvailable: true
            } 
          : target
      )
    );
  };

  // Handle restore snapshot
  const handleRestoreSnapshot = (id: string) => {
    setVirtualTargets(
      virtualTargets.map(target => 
        target.id === id 
          ? { 
              ...target, 
              status: 'running',
              lastStarted: new Date().toISOString(),
              resourceUsage: {
                cpuPercent: 45,
                memoryPercent: 30,
                diskPercent: 10,
                networkMbps: 0.8
              }
            } 
          : target
      )
    );
  };

  // Render status badge
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'provisioning':
        return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">Provisioning</span>;
      case 'starting':
        return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">Starting</span>;
      case 'running':
        return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Running</span>;
      case 'idle':
        return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Idle</span>;
      case 'stopping':
        return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-orange-100 text-orange-800">Stopping</span>;
      case 'stopped':
        return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">Stopped</span>;
      case 'paused':
        return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">Paused</span>;
      case 'error':
        return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">Error</span>;
      default:
        return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">{status}</span>;
    }
  };

  // Render type badge
  const renderTypeBadge = (type: string) => {
    switch (type) {
      case 'android_emulator':
        return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">Android Emulator</span>;
      case 'simics_vm':
        return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-100 text-purple-800">Simics VM</span>;
      case 'qemu':
        return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-indigo-100 text-indigo-800">QEMU VM</span>;
      default:
        return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">{type}</span>;
    }
  };

  // Render resource usage bar
  const renderResourceBar = (percent: number, color: string) => {
    return (
      <div className="w-full bg-gray-200 rounded-full h-2.5">
        <div 
          className={`h-2.5 rounded-full ${color}`} 
          style={{ width: `${percent}%` }}
        ></div>
      </div>
    );
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-6">Virtual Target Orchestration</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left panel - Target list */}
        <div className="md:col-span-1">
          <div className="bg-white shadow rounded-lg">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-lg font-medium">Virtual Targets</h2>
              <button 
                className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                onClick={() => setIsLaunching(true)}
              >
                Launch New
              </button>
            </div>
            <div className="p-2">
              {virtualTargets.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  No virtual targets available
                </div>
              ) : (
                <div className="space-y-2">
                  {virtualTargets.map((target) => (
                    <div
                      key={target.id}
                      className={`p-3 border rounded cursor-pointer ${
                        selectedTargetId === target.id 
                          ? 'bg-blue-50 border-blue-300' 
                          : 'hover:bg-gray-50 border-gray-200'
                      }`}
                      onClick={() => handleSelectTarget(target.id)}
                    >
                      <div className="flex justify-between items-center">
                        <h3 className="font-medium">{target.name}</h3>
                        {renderStatusBadge(target.status)}
                      </div>
                      <div className="flex justify-between mt-1 text-sm text-gray-500">
                        <div>{renderTypeBadge(target.type)}</div>
                        <div>{target.osVersion}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          {/* Launch Form */}
          {isLaunching && (
            <div className="mt-4 bg-white shadow rounded-lg p-4">
              <h2 className="text-lg font-medium mb-4">Launch New Virtual Target</h2>
              <form onSubmit={(e) => { e.preventDefault(); handleLaunchTarget(); }}>
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    type="text"
                    name="name"
                    value={launchConfig.name}
                    onChange={handleConfigChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    required
                  />
                </div>
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select
                    name="type"
                    value={launchConfig.type}
                    onChange={handleConfigChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="android_emulator">Android Emulator</option>
                    <option value="simics_vm">Simics VM</option>
                    <option value="qemu">QEMU VM</option>
                  </select>
                </div>
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">OS Version</label>
                  <select
                    name="osVersion"
                    value={launchConfig.osVersion}
                    onChange={handleConfigChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="Android 13">Android 13</option>
                    <option value="Android 12">Android 12</option>
                    <option value="Android 11">Android 11</option>
                    <option value="Ubuntu 22.04">Ubuntu 22.04</option>
                  </select>
                </div>
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">CPU Cores</label>
                  <input
                    type="number"
                    name="cpuCores"
                    value={launchConfig.cpuCores}
                    onChange={handleConfigChange}
                    min="1"
                    max="16"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Memory (MB)</label>
                  <input
                    type="number"
                    name="memoryMB"
                    value={launchConfig.memoryMB}
                    onChange={handleConfigChange}
                    min="512"
                    step="512"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Disk (GB)</label>
                  <input
                    type="number"
                    name="diskGB"
                    value={launchConfig.diskGB}
                    onChange={handleConfigChange}
                    min="1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <button
                    type="button"
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700"
                    onClick={() => setIsLaunching(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    disabled={!launchConfig.name}
                  >
                    Launch
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
        
        {/* Right panel - Target details and controls */}
        <div className="md:col-span-2">
          {selectedTarget ? (
            <div className="bg-white shadow rounded-lg">
              <div className="p-4 border-b border-gray-200">
                <h2 className="text-lg font-medium">{selectedTarget.name}</h2>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-3">Target Information</h3>
                    <table className="min-w-full">
                      <tbody className="divide-y divide-gray-200">
                        <tr>
                          <td className="py-2 text-sm font-medium text-gray-500">Type</td>
                          <td className="py-2 text-sm text-gray-900">{renderTypeBadge(selectedTarget.type)}</td>
                        </tr>
                        <tr>
                          <td className="py-2 text-sm font-medium text-gray-500">Status</td>
                          <td className="py-2 text-sm text-gray-900">{renderStatusBadge(selectedTarget.status)}</td>
                        </tr>
                        <tr>
                          <td className="py-2 text-sm font-medium text-gray-500">OS</td>
                          <td className="py-2 text-sm text-gray-900">{selectedTarget.osType} {selectedTarget.osVersion}</td>
                        </tr>
                        <tr>
                          <td className="py-2 text-sm font-medium text-gray-500">CPU Cores</td>
                          <td className="py-2 text-sm text-gray-900">{selectedTarget.cpuCores}</td>
                        </tr>
                        <tr>
                          <td className="py-2 text-sm font-medium text-gray-500">Memory</td>
                          <td className="py-2 text-sm text-gray-900">{selectedTarget.memoryMB} MB</td>
                        </tr>
                        <tr>
                          <td className="py-2 text-sm font-medium text-gray-500">Disk</td>
                          <td className="py-2 text-sm text-gray-900">{selectedTarget.diskGB} GB</td>
                        </tr>
                        <tr>
                          <td className="py-2 text-sm font-medium text-gray-500">Snapshot</td>
                          <td className="py-2 text-sm text-gray-900">{selectedTarget.snapshotAvailable ? 'Available' : 'Not Available'}</td>
                        </tr>
                        {selectedTarget.lastStarted && (
                          <tr>
                            <td className="py-2 text-sm font-medium text-gray-500">Last Started</td>
                            <td className="py-2 text-sm text-gray-900">{new Date(selectedTarget.lastStarted).toLocaleString()}</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-3">Resource Usage</h3>
                    {selectedTarget.resourceUsage ? (
                      <div className="space-y-4">
                        <div>
                          <div className="flex justify-between mb-1">
                            <span className="text-sm font-medium text-gray-500">CPU</span>
                            <span className="text-sm font-medium text-gray-700">{selectedTarget.resourceUsage.cpuPercent}%</span>
                          </div>
                          {renderResourceBar(selectedTarget.resourceUsage.cpuPercent, 'bg-blue-500')}
                        </div>
                        <div>
                          <div className="flex justify-between mb-1">
                            <span className="text-sm font-medium text-gray-500">Memory</span>
                            <span className="text-sm font-medium text-gray-700">{selectedTarget.resourceUsage.memoryPercent}%</span>
                          </div>
                          {renderResourceBar(selectedTarget.resourceUsage.memoryPercent, 'bg-green-500')}
                        </div>
                        <div>
                          <div className="flex justify-between mb-1">
                            <span className="text-sm font-medium text-gray-500">Disk</span>
                            <span className="text-sm font-medium text-gray-700">{selectedTarget.resourceUsage.diskPercent}%</span>
                          </div>
                          {renderResourceBar(selectedTarget.resourceUsage.diskPercent, 'bg-yellow-500')}
                        </div>
                        <div>
                          <div className="flex justify-between mb-1">
                            <span className="text-sm font-medium text-gray-500">Network</span>
                            <span className="text-sm font-medium text-gray-700">{selectedTarget.resourceUsage.networkMbps} Mbps</span>
                          </div>
                          {renderResourceBar(Math.min(selectedTarget.resourceUsage.networkMbps * 10, 100), 'bg-purple-500')}
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 bg-gray-50 rounded text-gray-500 text-center">
                        Resource usage not available for stopped targets
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="mt-6">
                  <h3 className="text-sm font-medium text-gray-500 mb-3">Control Actions</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedTarget.status === 'stopped' && (
                      <button 
                        className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                        onClick={() => handleBootTarget(selectedTarget.id)}
                      >
                        Boot
                      </button>
                    )}
                    
                    {selectedTarget.status === 'running' && (
                      <button 
                        className="px-3 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
                        onClick={() => handlePauseResumeTarget(selectedTarget.id)}
                      >
                        Pause
                      </button>
                    )}
                    
                    {selectedTarget.status === 'paused' && (
                      <button 
                        className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                        onClick={() => handlePauseResumeTarget(selectedTarget.id)}
                      >
                        Resume
                      </button>
                    )}
                    
                    {(selectedTarget.status === 'running' || selectedTarget.status === 'paused' || selectedTarget.status === 'idle') && (
                      <button 
                        className="px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                        onClick={() => handleStopTarget(selectedTarget.id)}
                      >
                        Stop
                      </button>
                    )}
                    
                    {selectedTarget.status === 'running' && (
                      <button 
                        className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                        onClick={() => handleCreateSnapshot(selectedTarget.id)}
                        disabled={selectedTarget.snapshotAvailable}
                      >
                        Create Snapshot
                      </button>
                    )}
                    
                    {selectedTarget.status !== 'running' && selectedTarget.snapshotAvailable && (
                      <button 
                        className="px-3 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                        onClick={() => handleRestoreSnapshot(selectedTarget.id)}
                      >
                        Restore Snapshot
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white shadow rounded-lg p-8 text-center">
              <h3 className="text-lg text-gray-500 mb-4">No Target Selected</h3>
              <p className="text-gray-500 mb-4">Select a virtual target from the list or launch a new one.</p>
              <button 
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                onClick={() => setIsLaunching(true)}
              >
                Launch New Virtual Target
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VirtualTargetOrchestration;

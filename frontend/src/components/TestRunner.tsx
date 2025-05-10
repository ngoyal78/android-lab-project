import React, { useState, useEffect } from 'react';
import axios from 'axios';
import FileUpload from './FileUpload';

interface Target {
  id: string;
  name: string;
  type: 'physical' | 'virtual';
  status: 'available' | 'reserved' | 'offline';
  reservedBy?: string;
}

interface TestFile {
  id: string;
  name: string;
  url: string;
  size: number;
  type: string;
  uploadedAt: string;
}

interface TestRun {
  id: string;
  targetId: string;
  fileId: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  startTime?: string;
  endTime?: string;
  logs: string[];
}

interface TestRunnerProps {
  targetId?: string;
}

const TestRunner: React.FC<TestRunnerProps> = ({ targetId }) => {
  const [availableTargets, setAvailableTargets] = useState<Target[]>([]);
  const [selectedTargets, setSelectedTargets] = useState<string[]>(targetId ? [targetId] : []);
  const [testFiles, setTestFiles] = useState<TestFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [testRuns, setTestRuns] = useState<TestRun[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // In a real app, these would be actual API calls
        const targetsResponse = await axios.get('/api/targets?status=available');
        const filesResponse = await axios.get('/api/files');
        
        setAvailableTargets(targetsResponse.data);
        setTestFiles(filesResponse.data);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load data. Please try again later.');
        
        // For demo purposes, set some mock data
        setAvailableTargets([
          {
            id: '1',
            name: 'Pixel 6 Pro',
            type: 'physical',
            status: 'available'
          },
          {
            id: '2',
            name: 'Samsung Galaxy S21',
            type: 'physical',
            status: 'available'
          },
          {
            id: '3',
            name: 'Emulator - Pixel 4',
            type: 'virtual',
            status: 'available'
          }
        ]);
        
        setTestFiles([
          {
            id: '1',
            name: 'ui_tests.zip',
            url: '/files/ui_tests.zip',
            size: 2048576,
            type: 'application/zip',
            uploadedAt: '2023-08-14T15:30:00Z'
          },
          {
            id: '2',
            name: 'performance_test.py',
            url: '/files/performance_test.py',
            size: 4096,
            type: 'text/x-python',
            uploadedAt: '2023-08-15T09:45:00Z'
          },
          {
            id: '3',
            name: 'sample_app.apk',
            url: '/files/sample_app.apk',
            size: 15728640,
            type: 'application/vnd.android.package-archive',
            uploadedAt: '2023-08-10T11:20:00Z'
          }
        ]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleTargetToggle = (targetId: string) => {
    setSelectedTargets(prev => 
      prev.includes(targetId)
        ? prev.filter(id => id !== targetId)
        : [...prev, targetId]
    );
  };

  const handleFileSelect = (fileId: string) => {
    setSelectedFile(fileId);
  };

  const handleFileUploadComplete = (fileInfo: { name: string; url: string; size: number; type: string }) => {
    // In a real app, this would come from the server response
    const newFile: TestFile = {
      id: `file-${Date.now()}`,
      name: fileInfo.name,
      url: fileInfo.url,
      size: fileInfo.size,
      type: fileInfo.type,
      uploadedAt: new Date().toISOString()
    };
    
    setTestFiles(prev => [newFile, ...prev]);
    setSelectedFile(newFile.id);
  };

  const handleRunTest = async () => {
    if (selectedTargets.length === 0) {
      setError('Please select at least one target device');
      return;
    }
    
    if (!selectedFile) {
      setError('Please select a test file');
      return;
    }
    
    setIsRunning(true);
    setError(null);
    
    try {
      // Create a test run for each selected target
      const newRuns = selectedTargets.map(targetId => {
        // In a real app, this would be an API call
        return {
          id: `run-${Date.now()}-${targetId}`,
          targetId,
          fileId: selectedFile,
          status: 'queued' as const,
          logs: []
        };
      });
      
      setTestRuns(prev => [...newRuns, ...prev]);
      
      // Simulate test execution
      for (const run of newRuns) {
        // Update status to running
        setTestRuns(prev => 
          prev.map(r => 
            r.id === run.id 
              ? { ...r, status: 'running' as const, startTime: new Date().toISOString() } 
              : r
          )
        );
        
        // Add some logs
        await new Promise(resolve => setTimeout(resolve, 1000));
        setTestRuns(prev => 
          prev.map(r => 
            r.id === run.id 
              ? { ...r, logs: [...r.logs, 'Initializing test environment...'] } 
              : r
          )
        );
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        setTestRuns(prev => 
          prev.map(r => 
            r.id === run.id 
              ? { ...r, logs: [...r.logs, 'Installing test package...'] } 
              : r
          )
        );
        
        await new Promise(resolve => setTimeout(resolve, 1500));
        setTestRuns(prev => 
          prev.map(r => 
            r.id === run.id 
              ? { ...r, logs: [...r.logs, 'Running tests...'] } 
              : r
          )
        );
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        setTestRuns(prev => 
          prev.map(r => 
            r.id === run.id 
              ? { 
                  ...r, 
                  logs: [...r.logs, 'Tests completed successfully.'], 
                  status: 'completed' as const,
                  endTime: new Date().toISOString()
                } 
              : r
          )
        );
      }
    } catch (err) {
      console.error('Error running tests:', err);
      setError('Failed to run tests. Please try again later.');
    } finally {
      setIsRunning(false);
    }
  };

  const getTargetById = (id: string) => {
    return availableTargets.find(target => target.id === id);
  };

  const getFileById = (id: string) => {
    return testFiles.find(file => file.id === id);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white shadow sm:rounded-lg p-6">
        <h3 className="text-lg leading-6 font-medium text-gray-900">Test Runner</h3>
        <div className="mt-2 max-w-xl text-sm text-gray-500">
          <p>Select targets and a test file to run automated tests.</p>
        </div>
        
        {error && (
          <div className="mt-4 bg-red-50 border-l-4 border-red-400 p-4">
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
        
        <div className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <h4 className="text-base font-medium text-gray-900">Select Targets</h4>
            <div className="mt-2 space-y-2">
              {availableTargets.length === 0 ? (
                <p className="text-sm text-gray-500">No available targets found.</p>
              ) : (
                availableTargets.map(target => (
                  <div key={target.id} className="flex items-center">
                    <input
                      id={`target-${target.id}`}
                      name={`target-${target.id}`}
                      type="checkbox"
                      checked={selectedTargets.includes(target.id)}
                      onChange={() => handleTargetToggle(target.id)}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />
                    <label htmlFor={`target-${target.id}`} className="ml-3 text-sm text-gray-700">
                      {target.name} ({target.type})
                    </label>
                  </div>
                ))
              )}
            </div>
          </div>
          
          <div>
            <h4 className="text-base font-medium text-gray-900">Select Test File</h4>
            <div className="mt-2 space-y-2">
              {testFiles.length === 0 ? (
                <p className="text-sm text-gray-500">No test files found. Upload a file first.</p>
              ) : (
                testFiles.map(file => (
                  <div key={file.id} className="flex items-center">
                    <input
                      id={`file-${file.id}`}
                      name="test-file"
                      type="radio"
                      checked={selectedFile === file.id}
                      onChange={() => handleFileSelect(file.id)}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                    />
                    <label htmlFor={`file-${file.id}`} className="ml-3 text-sm text-gray-700">
                      {file.name} ({formatDate(file.uploadedAt)})
                    </label>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
        
        <div className="mt-6">
          <button
            type="button"
            onClick={handleRunTest}
            disabled={isRunning || selectedTargets.length === 0 || !selectedFile}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
          >
            {isRunning ? 'Running Tests...' : 'Run Tests'}
          </button>
        </div>
      </div>
      
      <FileUpload onUploadComplete={handleFileUploadComplete} />
      
      {testRuns.length > 0 && (
        <div className="bg-white shadow sm:rounded-lg p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Test Runs</h3>
          <div className="mt-2 max-w-xl text-sm text-gray-500">
            <p>Recent test executions and their results.</p>
          </div>
          
          <div className="mt-5 space-y-6">
            {testRuns.map(run => {
              const target = getTargetById(run.targetId);
              const file = getFileById(run.fileId);
              
              return (
                <div key={run.id} className="border border-gray-200 rounded-md p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-base font-medium text-gray-900">
                        {target?.name || 'Unknown Target'} - {file?.name || 'Unknown File'}
                      </h4>
                      <p className="text-sm text-gray-500">
                        {run.startTime && `Started: ${formatDate(run.startTime)}`}
                        {run.endTime && ` • Completed: ${formatDate(run.endTime)}`}
                      </p>
                    </div>
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      run.status === 'completed' ? 'bg-green-100 text-green-800' :
                      run.status === 'failed' ? 'bg-red-100 text-red-800' :
                      run.status === 'running' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {run.status}
                    </span>
                  </div>
                  
                  {run.logs.length > 0 && (
                    <div className="mt-4">
                      <h5 className="text-sm font-medium text-gray-900">Logs</h5>
                      <div className="mt-2 bg-gray-50 p-3 rounded-md">
                        <pre className="text-xs text-gray-700 whitespace-pre-wrap">
                          {run.logs.join('\n')}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default TestRunner;

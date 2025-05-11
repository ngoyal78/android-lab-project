import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { TestType } from '../types/test';

interface TestJobFormProps {
  targetId: number;
  onSuccess?: (jobId: string) => void;
}

const TestJobForm: React.FC<TestJobFormProps> = ({ targetId, onSuccess }) => {
  const { authToken } = useAuth();
  const navigate = useNavigate();
  
  const [command, setCommand] = useState<string>('');
  const [testType, setTestType] = useState<TestType>(TestType.CUSTOM);
  const [artifactId, setArtifactId] = useState<number | null>(null);
  const [artifacts, setArtifacts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // Fetch available artifacts for this target
  useEffect(() => {
    const fetchArtifacts = async () => {
      try {
        const response = await fetch(`/api/artifacts?target_id=${targetId}`, {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch artifacts');
        }
        
        const data = await response.json();
        setArtifacts(data);
      } catch (err) {
        console.error('Error fetching artifacts:', err);
      }
    };
    
    fetchArtifacts();
  }, [targetId, authToken]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    
    try {
      const payload = {
        target_id: targetId,
        command,
        test_type: testType,
        ...(artifactId && { artifact_id: artifactId })
      };
      
      const response = await fetch('/api/tests/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to submit test job');
      }
      
      const data = await response.json();
      
      if (onSuccess) {
        onSuccess(data.id);
      } else {
        navigate(`/tests/${data.id}`);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="bg-white shadow-md rounded-lg p-6">
      <h2 className="text-xl font-semibold mb-4">Run Test</h2>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2">
            Test Type
          </label>
          <select
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            value={testType}
            onChange={(e) => setTestType(e.target.value as TestType)}
            required
          >
            <option value={TestType.CUSTOM}>Custom Command</option>
            <option value={TestType.INSTRUMENTATION}>Instrumentation Test</option>
            <option value={TestType.MONKEY}>Monkey Test</option>
            <option value={TestType.UI_AUTOMATOR}>UI Automator Test</option>
            <option value={TestType.ESPRESSO}>Espresso Test</option>
          </select>
        </div>
        
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2">
            Command
          </label>
          <input
            type="text"
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            placeholder="Enter test command"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            required
          />
          <p className="text-sm text-gray-500 mt-1">
            Use {'{target}'} for target serial number and {'{artifact}'} for artifact path
          </p>
        </div>
        
        {artifacts.length > 0 && (
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Artifact (Optional)
            </label>
            <select
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              value={artifactId || ''}
              onChange={(e) => setArtifactId(e.target.value ? parseInt(e.target.value) : null)}
            >
              <option value="">None</option>
              {artifacts.map((artifact) => (
                <option key={artifact.id} value={artifact.id}>
                  {artifact.original_filename} ({artifact.artifact_type})
                </option>
              ))}
            </select>
          </div>
        )}
        
        <div className="flex items-center justify-between">
          <button
            type="submit"
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
            disabled={isLoading}
          >
            {isLoading ? 'Submitting...' : 'Run Test'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default TestJobForm;

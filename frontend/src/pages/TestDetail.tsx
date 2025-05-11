import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { TestJob, TestJobWithDetails, TestStatus } from '../types/test';

const TestDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { authToken } = useAuth();
  const navigate = useNavigate();
  
  const [testJob, setTestJob] = useState<TestJobWithDetails | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [websocket, setWebsocket] = useState<WebSocket | null>(null);
  
  // Fetch test job details
  useEffect(() => {
    const fetchTestJob = async () => {
      try {
        setLoading(true);
        
        const response = await fetch(`/api/tests/${id}`, {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch test job details');
        }
        
        const data = await response.json();
        setTestJob(data);
      } catch (err: any) {
        setError(err.message);
        console.error('Error fetching test job details:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchTestJob();
  }, [id, authToken]);
  
  // Connect to WebSocket for real-time logs
  useEffect(() => {
    if (!testJob || testJob.status !== TestStatus.RUNNING) {
      return;
    }
    
    // Create WebSocket connection
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const ws = new WebSocket(`${protocol}//${host}/api/ws/test/${id}`);
    
    ws.onopen = () => {
      console.log('WebSocket connection established');
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'log') {
          setLogs(prevLogs => [...prevLogs, data.content]);
        } else if (data.type === 'status_update') {
          setTestJob(prevJob => prevJob ? { ...prevJob, status: data.status } : null);
        }
      } catch (err) {
        console.error('Error parsing WebSocket message:', err);
      }
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    ws.onclose = () => {
      console.log('WebSocket connection closed');
    };
    
    setWebsocket(ws);
    
    // Clean up WebSocket connection
    return () => {
      ws.close();
    };
  }, [id, testJob]);
  
  // Fetch logs if test is not running (historical logs)
  useEffect(() => {
    if (!testJob || testJob.status === TestStatus.RUNNING) {
      return;
    }
    
    const fetchLogs = async () => {
      try {
        const response = await fetch(`/api/tests/${id}/logs`, {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch test logs');
        }
        
        const data = await response.json();
        setLogs(data.map((log: any) => log.content));
      } catch (err: any) {
        console.error('Error fetching test logs:', err);
      }
    };
    
    fetchLogs();
  }, [id, authToken, testJob]);
  
  const handleCancelTest = async () => {
    if (!testJob) return;
    
    if (window.confirm('Are you sure you want to cancel this test job?')) {
      try {
        const response = await fetch(`/api/tests/${id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });
        
        if (!response.ok) {
          throw new Error('Failed to cancel test job');
        }
        
        setTestJob(prev => prev ? { ...prev, status: TestStatus.CANCELLED } : null);
      } catch (err: any) {
        console.error('Error cancelling test job:', err);
        alert(`Error: ${err instanceof Error ? err.message : 'Failed to cancel test job'}`);
      }
    }
  };
  
  const getStatusBadgeClass = (status: TestStatus) => {
    switch (status) {
      case TestStatus.PENDING:
        return 'bg-yellow-100 text-yellow-800';
      case TestStatus.RUNNING:
        return 'bg-blue-100 text-blue-800';
      case TestStatus.COMPLETED:
        return 'bg-green-100 text-green-800';
      case TestStatus.FAILED:
        return 'bg-red-100 text-red-800';
      case TestStatus.ERROR:
        return 'bg-red-100 text-red-800';
      case TestStatus.CANCELLED:
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };
  
  if (loading) {
    return (
      <div className="container mx-auto p-4">
        <div className="flex justify-center p-4">Loading test job details...</div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="container mx-auto p-4">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          Error: {error}
        </div>
        <button
          onClick={() => navigate(-1)}
          className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
        >
          Go Back
        </button>
      </div>
    );
  }
  
  if (!testJob) {
    return (
      <div className="container mx-auto p-4">
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4">
          Test job not found
        </div>
        <button
          onClick={() => navigate(-1)}
          className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
        >
          Go Back
        </button>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Test Job Details</h1>
        <div className="flex space-x-2">
          <button
            onClick={() => navigate(-1)}
            className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
          >
            Go Back
          </button>
          {(testJob.status === TestStatus.RUNNING || testJob.status === TestStatus.PENDING) && (
            <button
              onClick={handleCancelTest}
              className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
            >
              Cancel Test
            </button>
          )}
        </div>
      </div>
      
      <div className="bg-white shadow-md rounded-lg p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-gray-600">ID:</p>
            <p className="font-semibold">{testJob.id}</p>
          </div>
          <div>
            <p className="text-gray-600">Status:</p>
            <p>
              <span className={`px-2 py-1 rounded-full text-xs ${getStatusBadgeClass(testJob.status)}`}>
                {testJob.status}
              </span>
            </p>
          </div>
          <div>
            <p className="text-gray-600">Target:</p>
            <p className="font-semibold">
              {testJob.target_name || `Target #${testJob.target_id}`}
            </p>
          </div>
          <div>
            <p className="text-gray-600">Test Type:</p>
            <p className="font-semibold">{testJob.test_type}</p>
          </div>
          <div>
            <p className="text-gray-600">Command:</p>
            <p className="font-mono text-sm bg-gray-100 p-2 rounded">{testJob.command}</p>
          </div>
          <div>
            <p className="text-gray-600">Created At:</p>
            <p className="font-semibold">{new Date(testJob.created_at).toLocaleString()}</p>
          </div>
          {testJob.start_time && (
            <div>
              <p className="text-gray-600">Started At:</p>
              <p className="font-semibold">{new Date(testJob.start_time).toLocaleString()}</p>
            </div>
          )}
          {testJob.end_time && (
            <div>
              <p className="text-gray-600">Ended At:</p>
              <p className="font-semibold">{new Date(testJob.end_time).toLocaleString()}</p>
            </div>
          )}
          {testJob.artifact_filename && (
            <div>
              <p className="text-gray-600">Artifact:</p>
              <p className="font-semibold">{testJob.artifact_filename}</p>
            </div>
          )}
        </div>
      </div>
      
      <div className="bg-white shadow-md rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Test Logs</h2>
        {logs.length === 0 ? (
          <div className="bg-gray-100 p-4 rounded text-gray-500">
            {testJob.status === TestStatus.PENDING ? 'Test has not started yet.' : 'No logs available.'}
          </div>
        ) : (
          <div className="bg-black text-green-400 font-mono text-sm p-4 rounded h-96 overflow-y-auto">
            {logs.map((log, index) => (
              <div key={index} className="whitespace-pre-wrap mb-1">
                {log}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TestDetail;

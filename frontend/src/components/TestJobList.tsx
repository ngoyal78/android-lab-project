import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { TestJob, TestStatus, TestJobWithDetails, TestType } from '../types/test';

interface TestJobListProps {
  targetId?: number;
  limit?: number;
  showAll?: boolean;
}

const TestJobList: React.FC<TestJobListProps> = ({ targetId, limit = 10, showAll = false }) => {
  const { authToken } = useAuth();
  const [testJobs, setTestJobs] = useState<(TestJob | TestJobWithDetails)[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const fetchTestJobs = async () => {
      try {
        setLoading(true);
        
        // For demo purposes, use mock data instead of API calls
        // In a real app, this would be an actual API call
        /*
        let url = '/api/tests/';
        if (targetId) {
          url += `?target_id=${targetId}`;
        }
        
        if (limit && !showAll) {
          url += `${targetId ? '&' : '?'}limit=${limit}`;
        }
        
        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch test jobs');
        }
        
        const data = await response.json();
        setTestJobs(data);
        */
        
        // Mock data for demonstration
        const mockTestJobs: TestJobWithDetails[] = [
          {
            id: '101',
            user_id: 1,
            target_id: 1,
            artifact_id: 1,
            command: './gradlew connectedAndroidTest',
            test_type: TestType.INSTRUMENTATION,
            status: TestStatus.COMPLETED,
            result_data: { passed: 42, failed: 0, skipped: 2 },
            created_at: '2023-08-15T10:30:00Z',
            start_time: '2023-08-15T10:30:00Z',
            end_time: '2023-08-15T10:45:00Z',
            target_name: 'Pixel 6 Pro',
            artifact_filename: 'app-debug.apk',
            user_username: 'jane.smith'
          },
          {
            id: '102',
            user_id: 2,
            target_id: 2,
            artifact_id: 2,
            command: 'monkey -p com.example.app -v 500',
            test_type: TestType.MONKEY,
            status: TestStatus.RUNNING,
            result_data: {},
            created_at: '2023-08-15T11:00:00Z',
            start_time: '2023-08-15T11:00:00Z',
            target_name: 'Samsung Galaxy S21',
            artifact_filename: 'app-release.apk',
            user_username: 'john.doe'
          },
          {
            id: '103',
            user_id: 1,
            target_id: 3,
            artifact_id: 3,
            command: 'am instrument -w com.example.app.test/androidx.test.runner.AndroidJUnitRunner',
            test_type: TestType.ESPRESSO,
            status: TestStatus.PENDING,
            result_data: {},
            created_at: '2023-08-15T11:30:00Z',
            target_name: 'Emulator - Pixel 4',
            artifact_filename: 'app-debug-androidTest.apk',
            user_username: 'jane.smith'
          },
          {
            id: '104',
            user_id: 3,
            target_id: 1,
            artifact_id: 4,
            command: 'custom test command',
            test_type: TestType.CUSTOM,
            status: TestStatus.FAILED,
            result_data: { error: 'Test execution failed with exit code 1' },
            created_at: '2023-08-14T15:00:00Z',
            start_time: '2023-08-14T15:00:00Z',
            end_time: '2023-08-14T15:10:00Z',
            target_name: 'Pixel 6 Pro',
            artifact_filename: 'custom-test.zip',
            user_username: 'admin'
          }
        ];
        
        // Filter by target ID if specified
        let filteredJobs = mockTestJobs;
        if (targetId) {
          filteredJobs = mockTestJobs.filter(job => job.target_id === targetId);
        }
        
        // Apply limit if specified and not showing all
        if (limit && !showAll && filteredJobs.length > limit) {
          filteredJobs = filteredJobs.slice(0, limit);
        }
        
        setTestJobs(filteredJobs);
      } catch (err: any) {
        setError(err.message);
        console.error('Error setting up test jobs:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchTestJobs();
  }, [authToken, targetId, limit, showAll]);
  
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
    return <div className="flex justify-center p-4">Loading test jobs...</div>;
  }
  
  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
        Error: {error}
      </div>
    );
  }
  
  if (testJobs.length === 0) {
    return <div className="text-gray-500 p-4">No test jobs found.</div>;
  }
  
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full bg-white">
        <thead className="bg-gray-100">
          <tr>
            <th className="py-2 px-4 text-left">ID</th>
            <th className="py-2 px-4 text-left">Target</th>
            <th className="py-2 px-4 text-left">Type</th>
            <th className="py-2 px-4 text-left">Status</th>
            <th className="py-2 px-4 text-left">Created</th>
            <th className="py-2 px-4 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {testJobs.map((job) => (
            <tr key={job.id} className="border-b hover:bg-gray-50">
              <td className="py-2 px-4">
                <Link to={`/tests/${job.id}`} className="text-blue-600 hover:underline">
                  {job.id.substring(0, 8)}...
                </Link>
              </td>
              <td className="py-2 px-4">
                {'target_name' in job ? (
                  <Link to={`/targets/${job.target_id}`} className="text-blue-600 hover:underline">
                    {job.target_name}
                  </Link>
                ) : (
                  <Link to={`/targets/${job.target_id}`} className="text-blue-600 hover:underline">
                    Target #{job.target_id}
                  </Link>
                )}
              </td>
              <td className="py-2 px-4">{job.test_type}</td>
              <td className="py-2 px-4">
                <span className={`px-2 py-1 rounded-full text-xs ${getStatusBadgeClass(job.status)}`}>
                  {job.status}
                </span>
              </td>
              <td className="py-2 px-4">
                {new Date(job.created_at).toLocaleString()}
              </td>
              <td className="py-2 px-4">
                <Link to={`/tests/${job.id}`} className="text-blue-600 hover:underline mr-2">
                  View
                </Link>
                {(job.status === TestStatus.RUNNING || job.status === TestStatus.PENDING) && (
                  <button
                    className="text-red-600 hover:underline"
                    onClick={async () => {
                      if (window.confirm('Are you sure you want to cancel this test job?')) {
                        try {
                          const response = await fetch(`/api/tests/${job.id}`, {
                            method: 'DELETE',
                            headers: {
                              'Authorization': `Bearer ${authToken}`
                            }
                          });
                          
                          if (!response.ok) {
                            throw new Error('Failed to cancel test job');
                          }
                          
                          // Refresh the list
                          setTestJobs(testJobs.map(j => 
                            j.id === job.id ? { ...j, status: TestStatus.CANCELLED } : j
                          ));
                        } catch (err: any) {
                          console.error('Error cancelling test job:', err);
                          alert(`Error: ${err instanceof Error ? err.message : 'Failed to cancel test job'}`);
                        }
                      }
                    }}
                  >
                    Cancel
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      
      {!showAll && testJobs.length >= limit && (
        <div className="mt-4 text-center">
          <Link to="/tests" className="text-blue-600 hover:underline">
            View All Test Jobs
          </Link>
        </div>
      )}
    </div>
  );
};

export default TestJobList;

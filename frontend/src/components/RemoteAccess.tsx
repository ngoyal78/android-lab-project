import React, { useState, useEffect, useCallback } from 'react';
// import { useNavigate } from 'react-router-dom'; // Uncomment if navigation is needed in the future
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

interface Device {
  device_id: string;
  device_info: {
    id: string;
    gateway_id: string;
    platform: string;
    hostname: string;
    manufacturer?: string;
    model?: string;
    android_version?: string;
    api_level?: string;
  };
  health_status: string;
  last_health_check: string;
  active_sessions: number;
}

interface Session {
  session_id: string;
  device_id: string;
  user_id: string;
  start_time: string;
  status: string;
  local_port: number;
  remote_port: number;
}

const RemoteAccess: React.FC = () => {
  const { authToken } = useAuth();
  // const navigate = useNavigate(); // Uncomment if navigation is needed in the future
  const [devices, setDevices] = useState<Device[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [connectionInfo, setConnectionInfo] = useState<{ host: string; port: number } | null>(null);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);

  const fetchDevices = useCallback(async () => {
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/api/remote-access/devices`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      
      if (response.data.status === 'success') {
        setDevices(response.data.devices);
      } else {
        setError('Failed to fetch devices');
      }
    } catch (err) {
      console.error('Error fetching devices:', err);
      setError('Failed to fetch devices');
    }
  }, [authToken]);

  const fetchSessions = useCallback(async () => {
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/api/remote-access/sessions`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      
      if (response.data.status === 'success') {
        setSessions(response.data.sessions);
      } else {
        setError('Failed to fetch sessions');
      }
    } catch (err) {
      console.error('Error fetching sessions:', err);
      setError('Failed to fetch sessions');
    } finally {
      setLoading(false);
    }
  }, [authToken]);

  const refreshData = useCallback(() => {
    fetchDevices();
    fetchSessions();
  }, [fetchDevices, fetchSessions]);

  useEffect(() => {
    refreshData();
    
    // Set up auto-refresh every 10 seconds
    const interval = setInterval(refreshData, 10000);
    setRefreshInterval(interval);
    
    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [refreshData, refreshInterval]); // Added refreshInterval to dependency array

  const startSession = async (deviceId: string) => {
    try {
      setLoading(true);
      
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/api/remote-access/session/start`,
        { device_id: deviceId },
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (response.data.status === 'success') {
        // Add the new session to the list
        setSessions((prevSessions) => [
          ...prevSessions,
          {
            session_id: response.data.session_id,
            device_id: deviceId,
            user_id: 'current', // This will be replaced with actual user ID
            start_time: new Date().toISOString(),
            status: 'active',
            local_port: response.data.connection_info.port,
            remote_port: response.data.connection_info.port,
          },
        ]);
        
        // Set connection info for display
        setConnectionInfo(response.data.connection_info);
        
        // Set selected device
        setSelectedDevice(deviceId);
        
        // Show success message
        alert('Remote access session started successfully!');
      } else {
        setError('Failed to start session');
      }
    } catch (err: any) {
      console.error('Error starting session:', err);
      setError(err.response?.data?.detail || 'Failed to start session');
    } finally {
      setLoading(false);
    }
  };

  const endSession = async (sessionId: string) => {
    try {
      setLoading(true);
      
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/api/remote-access/session/end/${sessionId}`,
        {},
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );
      
      if (response.data.status === 'success') {
        // Remove the session from the list
        setSessions((prevSessions) =>
          prevSessions.filter((session) => session.session_id !== sessionId)
        );
        
        // Clear connection info if this was the selected device
        const session = sessions.find((s) => s.session_id === sessionId);
        if (session && session.device_id === selectedDevice) {
          setConnectionInfo(null);
          setSelectedDevice(null);
        }
        
        // Show success message
        alert('Remote access session ended successfully!');
      } else {
        setError('Failed to end session');
      }
    } catch (err) {
      console.error('Error ending session:', err);
      setError('Failed to end session');
    } finally {
      setLoading(false);
    }
  };

  const getDeviceById = (deviceId: string): Device | undefined => {
    return devices.find((device) => device.device_id === deviceId);
  };

  const getSessionsForDevice = (deviceId: string): Session[] => {
    return sessions.filter((session) => session.device_id === deviceId);
  };

  const formatDateTime = (dateTimeStr: string): string => {
    const date = new Date(dateTimeStr);
    return date.toLocaleString();
  };

  const getHealthStatusClass = (status: string): string => {
    switch (status) {
      case 'connected':
        return 'bg-green-100 text-green-800';
      case 'disconnected':
        return 'bg-red-100 text-red-800';
      case 'unhealthy':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading && devices.length === 0) {
    return (
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">Remote Access</h1>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Remote Access</h1>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p>{error}</p>
          <button
            className="underline ml-2"
            onClick={() => setError(null)}
          >
            Dismiss
          </button>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h2 className="text-xl font-semibold mb-2">Available Devices</h2>
          {devices.length === 0 ? (
            <p className="text-gray-500">No devices available</p>
          ) : (
            <div className="space-y-4">
              {devices.map((device) => (
                <div
                  key={device.device_id}
                  className={`border rounded-lg p-4 ${
                    selectedDevice === device.device_id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold">
                        {device.device_info.manufacturer
                          ? `${device.device_info.manufacturer} ${device.device_info.model}`
                          : device.device_info.hostname || device.device_id}
                      </h3>
                      <p className="text-sm text-gray-600">ID: {device.device_id}</p>
                      {device.device_info.android_version && (
                        <p className="text-sm text-gray-600">
                          Android {device.device_info.android_version} (API {device.device_info.api_level})
                        </p>
                      )}
                    </div>
                    <span
                      className={`px-2 py-1 rounded-full text-xs ${getHealthStatusClass(
                        device.health_status
                      )}`}
                    >
                      {device.health_status}
                    </span>
                  </div>
                  
                  <div className="mt-2">
                    <p className="text-sm text-gray-600">
                      Last check: {device.last_health_check ? formatDateTime(device.last_health_check) : 'N/A'}
                    </p>
                    <p className="text-sm text-gray-600">
                      Active sessions: {device.active_sessions}
                    </p>
                  </div>
                  
                  <div className="mt-3 flex justify-end">
                    {getSessionsForDevice(device.device_id).length > 0 ? (
                      <button
                        className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded"
                        onClick={() => {
                          const session = getSessionsForDevice(device.device_id)[0];
                          endSession(session.session_id);
                        }}
                        disabled={loading}
                      >
                        End Session
                      </button>
                    ) : (
                      <button
                        className={`${
                          device.health_status === 'connected'
                            ? 'bg-blue-500 hover:bg-blue-600'
                            : 'bg-gray-400 cursor-not-allowed'
                        } text-white px-3 py-1 rounded`}
                        onClick={() => startSession(device.device_id)}
                        disabled={device.health_status !== 'connected' || loading}
                      >
                        Start Session
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div>
          <h2 className="text-xl font-semibold mb-2">Active Sessions</h2>
          {sessions.length === 0 ? (
            <p className="text-gray-500">No active sessions</p>
          ) : (
            <div className="space-y-4">
              {sessions.map((session) => {
                const device = getDeviceById(session.device_id);
                return (
                  <div key={session.session_id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold">
                          {device
                            ? device.device_info.manufacturer
                              ? `${device.device_info.manufacturer} ${device.device_info.model}`
                              : device.device_info.hostname
                            : session.device_id}
                        </h3>
                        <p className="text-sm text-gray-600">Session ID: {session.session_id}</p>
                        <p className="text-sm text-gray-600">
                          Started: {formatDateTime(session.start_time)}
                        </p>
                        <p className="text-sm text-gray-600">
                          Port: {session.remote_port}
                        </p>
                      </div>
                      <span
                        className={`px-2 py-1 rounded-full text-xs ${
                          session.status === 'active'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {session.status}
                      </span>
                    </div>
                    
                    <div className="mt-3 flex justify-end">
                      <button
                        className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded"
                        onClick={() => endSession(session.session_id)}
                        disabled={loading}
                      >
                        End Session
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          
          {connectionInfo && (
            <div className="mt-6 border border-blue-200 rounded-lg p-4 bg-blue-50">
              <h3 className="font-semibold text-blue-800">Connection Information</h3>
              <p className="mt-2">
                <span className="font-medium">Host:</span> {connectionInfo.host}
              </p>
              <p>
                <span className="font-medium">Port:</span> {connectionInfo.port}
              </p>
              <div className="mt-3 bg-gray-100 p-3 rounded font-mono text-sm">
                <p>adb connect {connectionInfo.host}:{connectionInfo.port}</p>
              </div>
              <p className="mt-2 text-sm text-gray-600">
                Use the command above to connect to the device using ADB.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RemoteAccess;

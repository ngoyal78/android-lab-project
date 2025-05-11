import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import {
  Box,
  Flex,
  Heading,
  Text,
  Button,
  Badge,
  Spinner,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  CloseButton,
  useToast,
  useColorModeValue,
  Divider,
  Tooltip,
  IconButton,
  Grid,
  GridItem
} from '@chakra-ui/react';
import { 
  RepeatIcon, 
  InfoIcon,
  WarningIcon,
  CheckCircleIcon
} from '@chakra-ui/icons';
import RemoteAccessSession from './RemoteAccessSession';

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
  const [devices, setDevices] = useState<Device[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [connectionInfo, setConnectionInfo] = useState<{ host: string; port: number } | null>(null);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);
  const [activeSession, setActiveSession] = useState<{
    sessionId: string;
    deviceId: string;
    deviceInfo: any;
    connectionInfo: { host: string; port: number };
  } | null>(null);
  
  const toast = useToast();
  const borderColor = useColorModeValue('gray.200', 'gray.700');

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
      <Box p={4}>
        <Heading size="lg" mb={4}>Remote Access</Heading>
        <Flex justifyContent="center" alignItems="center" height="64">
          <Spinner size="xl" />
        </Flex>
      </Box>
    );
  }

  // Replace the old startSession with the new handleStartSession
  const handleStartSession = async (deviceId: string) => {
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
        const newSession: Session = {
          session_id: response.data.session_id,
          device_id: deviceId,
          user_id: 'current', // This will be replaced with actual user ID
          start_time: new Date().toISOString(),
          status: 'active',
          local_port: response.data.connection_info.port,
          remote_port: response.data.connection_info.port,
        };
        
        setSessions((prevSessions) => [...prevSessions, newSession]);
        
        // Set connection info for display
        setConnectionInfo(response.data.connection_info);
        
        // Set selected device
        setSelectedDevice(deviceId);
        
        // Get device info
        const deviceInfo = getDeviceById(deviceId);
        
        if (deviceInfo) {
          // Set active session for the new UI
          setActiveSession({
            sessionId: response.data.session_id,
            deviceId: deviceId,
            deviceInfo: deviceInfo.device_info,
            connectionInfo: response.data.connection_info
          });
        }
        
        toast({
          title: "Session started",
          description: "Remote access session started successfully",
          status: "success",
          duration: 3000,
          isClosable: true,
        });
      } else {
        setError('Failed to start session');
      }
    } catch (err: any) {
      console.error('Error starting session:', err);
      setError(err.response?.data?.detail || 'Failed to start session');
      
      toast({
        title: "Error",
        description: err.response?.data?.detail || 'Failed to start session',
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Handle ending a session with the new UI
  const handleEndSession = async (sessionId: string) => {
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
        
        // Clear active session
        setActiveSession(null);
        
        toast({
          title: "Session ended",
          description: "Remote access session ended successfully",
          status: "info",
          duration: 3000,
          isClosable: true,
        });
      } else {
        setError('Failed to end session');
      }
    } catch (err) {
      console.error('Error ending session:', err);
      setError('Failed to end session');
      
      toast({
        title: "Error",
        description: "Failed to end session",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  // If there's an active session, show the session UI
  if (activeSession) {
    return (
      <Box p={4}>
        <RemoteAccessSession
          sessionId={activeSession.sessionId}
          deviceId={activeSession.deviceId}
          deviceInfo={activeSession.deviceInfo}
          connectionInfo={activeSession.connectionInfo}
          onEndSession={() => handleEndSession(activeSession.sessionId)}
        />
      </Box>
    );
  }

  return (
    <Box p={4}>
      <Flex justifyContent="space-between" alignItems="center" mb={4}>
        <Heading size="lg">Remote Access</Heading>
        <Tooltip label="Refresh data">
          <IconButton
            aria-label="Refresh data"
            icon={<RepeatIcon />}
            onClick={refreshData}
            isLoading={loading}
          />
        </Tooltip>
      </Flex>
      
      {error && (
        <Alert status="error" mb={4}>
          <AlertIcon />
          <AlertTitle mr={2}>Error!</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
          <CloseButton
            position="absolute"
            right="8px"
            top="8px"
            onClick={() => setError(null)}
          />
        </Alert>
      )}
      
      <Grid templateColumns={{ base: "1fr", md: "repeat(2, 1fr)" }} gap={6}>
        <GridItem>
          <Box borderWidth="1px" borderRadius="lg" p={4} borderColor={borderColor}>
            <Heading size="md" mb={4}>Available Devices</Heading>
            
            {devices.length === 0 ? (
              <Text color="gray.500">No devices available</Text>
            ) : (
              <Box>
                {devices.map((device) => {
                  const deviceSessions = getSessionsForDevice(device.device_id);
                  const hasActiveSession = deviceSessions.length > 0;
                  
                  return (
                    <Box 
                      key={device.device_id}
                      borderWidth="1px"
                      borderRadius="md"
                      p={4}
                      mb={4}
                      borderColor={selectedDevice === device.device_id ? "blue.500" : borderColor}
                      bg={selectedDevice === device.device_id ? "blue.50" : "transparent"}
                    >
                      <Flex justifyContent="space-between" alignItems="flex-start">
                        <Box>
                          <Heading size="sm">
                            {device.device_info.manufacturer
                              ? `${device.device_info.manufacturer} ${device.device_info.model}`
                              : device.device_info.hostname || device.device_id}
                          </Heading>
                          <Text fontSize="sm" color="gray.600">ID: {device.device_id}</Text>
                          {device.device_info.android_version && (
                            <Text fontSize="sm" color="gray.600">
                              Android {device.device_info.android_version} (API {device.device_info.api_level})
                            </Text>
                          )}
                        </Box>
                        
                        <Badge colorScheme={
                          device.health_status === 'connected' ? 'green' :
                          device.health_status === 'disconnected' ? 'red' :
                          device.health_status === 'unhealthy' ? 'yellow' : 'gray'
                        }>
                          {device.health_status}
                        </Badge>
                      </Flex>
                      
                      <Box mt={2}>
                        <Text fontSize="sm" color="gray.600">
                          Last check: {device.last_health_check ? formatDateTime(device.last_health_check) : 'N/A'}
                        </Text>
                        <Text fontSize="sm" color="gray.600">
                          Active sessions: {device.active_sessions}
                        </Text>
                      </Box>
                      
                      <Flex mt={3} justifyContent="flex-end">
                        {hasActiveSession ? (
                          <Button
                            colorScheme="red"
                            size="sm"
                            onClick={() => {
                              const session = deviceSessions[0];
                              handleEndSession(session.session_id);
                            }}
                            isLoading={loading}
                          >
                            End Session
                          </Button>
                        ) : (
                          <Button
                            colorScheme="blue"
                            size="sm"
                            onClick={() => handleStartSession(device.device_id)}
                            isDisabled={device.health_status !== 'connected' || loading}
                            isLoading={loading && selectedDevice === device.device_id}
                          >
                            Start Session
                          </Button>
                        )}
                      </Flex>
                    </Box>
                  );
                })}
              </Box>
            )}
          </Box>
        </GridItem>
        
        <GridItem>
          <Box borderWidth="1px" borderRadius="lg" p={4} borderColor={borderColor}>
            <Heading size="md" mb={4}>Active Sessions</Heading>
            
            {sessions.length === 0 ? (
              <Text color="gray.500">No active sessions</Text>
            ) : (
              <Box>
                {sessions.map((session) => {
                  const device = getDeviceById(session.device_id);
                  
                  return (
                    <Box 
                      key={session.session_id}
                      borderWidth="1px"
                      borderRadius="md"
                      p={4}
                      mb={4}
                      borderColor={borderColor}
                    >
                      <Flex justifyContent="space-between" alignItems="flex-start">
                        <Box>
                          <Heading size="sm">
                            {device
                              ? device.device_info.manufacturer
                                ? `${device.device_info.manufacturer} ${device.device_info.model}`
                                : device.device_info.hostname
                              : session.device_id}
                          </Heading>
                          <Text fontSize="sm" color="gray.600">Session ID: {session.session_id}</Text>
                          <Text fontSize="sm" color="gray.600">
                            Started: {formatDateTime(session.start_time)}
                          </Text>
                          <Text fontSize="sm" color="gray.600">
                            Port: {session.remote_port}
                          </Text>
                        </Box>
                        
                        <Badge colorScheme={session.status === 'active' ? 'green' : 'gray'}>
                          {session.status}
                        </Badge>
                      </Flex>
                      
                      <Flex mt={3} justifyContent="space-between" alignItems="center">
                        <Button
                          colorScheme="blue"
                          size="sm"
                          leftIcon={<InfoIcon />}
                          onClick={() => {
                            if (device) {
                              setActiveSession({
                                sessionId: session.session_id,
                                deviceId: session.device_id,
                                deviceInfo: device.device_info,
                                connectionInfo: {
                                  host: connectionInfo?.host || 'localhost',
                                  port: session.remote_port
                                }
                              });
                            }
                          }}
                        >
                          Connect
                        </Button>
                        
                        <Button
                          colorScheme="red"
                          size="sm"
                          onClick={() => handleEndSession(session.session_id)}
                          isLoading={loading}
                        >
                          End Session
                        </Button>
                      </Flex>
                    </Box>
                  );
                })}
              </Box>
            )}
          </Box>
          
          {connectionInfo && !activeSession && (
            <Box 
              mt={6} 
              borderWidth="1px" 
              borderRadius="lg" 
              p={4} 
              bg="blue.50" 
              borderColor="blue.200"
            >
              <Heading size="sm" color="blue.800" mb={2}>Connection Information</Heading>
              <Text mt={2}>
                <Text as="span" fontWeight="medium">Host:</Text> {connectionInfo.host}
              </Text>
              <Text>
                <Text as="span" fontWeight="medium">Port:</Text> {connectionInfo.port}
              </Text>
              <Box mt={3} bg="gray.100" p={3} borderRadius="md" fontFamily="mono" fontSize="sm">
                <Text>adb connect {connectionInfo.host}:{connectionInfo.port}</Text>
              </Box>
              <Text mt={2} fontSize="sm" color="gray.600">
                Use the command above to connect to the device using ADB.
              </Text>
            </Box>
          )}
        </GridItem>
      </Grid>
    </Box>
  );
};

export default RemoteAccess;

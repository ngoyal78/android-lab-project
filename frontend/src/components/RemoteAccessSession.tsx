import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Flex,
  Heading,
  Text,
  Button,
  Badge,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  CloseButton,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Progress,
  useToast,
  useColorModeValue,
  Divider,
  Tooltip,
  IconButton,
  HStack
} from '@chakra-ui/react';
import { 
  WarningIcon, 
  TimeIcon, 
  RepeatIcon, 
  CloseIcon, 
  InfoIcon,
  CheckCircleIcon
} from '@chakra-ui/icons';
import TerminalEmulator from './TerminalEmulator';
import VncViewer from './VncViewer';

interface RemoteAccessSessionProps {
  sessionId: string;
  deviceId: string;
  deviceInfo: {
    id: string;
    gateway_id: string;
    platform: string;
    hostname: string;
    manufacturer?: string;
    model?: string;
    android_version?: string;
    api_level?: string;
  };
  connectionInfo: {
    host: string;
    port: number;
  };
  onEndSession: () => void;
}

const RemoteAccessSession: React.FC<RemoteAccessSessionProps> = ({
  sessionId,
  deviceId,
  deviceInfo,
  connectionInfo,
  onEndSession
}) => {
  const [activeTab, setActiveTab] = useState<number>(0);
  const [sessionStatus, setSessionStatus] = useState<'active' | 'degraded' | 'reconnecting' | 'expired'>('active');
  const [lastActivity, setLastActivity] = useState<Date>(new Date());
  const [sessionStartTime, setSessionStartTime] = useState<Date>(new Date());
  const [expiryTime, setExpiryTime] = useState<Date>(new Date(Date.now() + 60 * 60 * 1000)); // 1 hour from now
  const [timeRemaining, setTimeRemaining] = useState<number>(60 * 60); // 1 hour in seconds
  const [showExpiryWarning, setShowExpiryWarning] = useState<boolean>(false);
  const [isTerminalActive, setIsTerminalActive] = useState<boolean>(false);
  const [isVncActive, setIsVncActive] = useState<boolean>(false);
  const [networkLatency, setNetworkLatency] = useState<number>(0);
  const [connectionQuality, setConnectionQuality] = useState<'good' | 'fair' | 'poor'>('good');
  
  const { isOpen: isExtendModalOpen, onOpen: onExtendModalOpen, onClose: onExtendModalClose } = useDisclosure();
  const { isOpen: isEndModalOpen, onOpen: onEndModalOpen, onClose: onEndModalClose } = useDisclosure();
  const toast = useToast();
  
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  
  // Initialize session
  useEffect(() => {
    // Simulate session initialization
    setSessionStartTime(new Date());
    setLastActivity(new Date());
    
    // Activate terminal by default
    setTimeout(() => {
      setIsTerminalActive(true);
    }, 500);
    
    // Start session timer
    const timer = setInterval(() => {
      const now = new Date();
      const diffSeconds = Math.max(0, Math.floor((expiryTime.getTime() - now.getTime()) / 1000));
      
      setTimeRemaining(diffSeconds);
      
      // Show warning when less than 5 minutes remaining
      if (diffSeconds <= 300 && diffSeconds > 0 && !showExpiryWarning) {
        setShowExpiryWarning(true);
        toast({
          title: "Session expiring soon",
          description: "Your session will expire in less than 5 minutes. Please extend if needed.",
          status: "warning",
          duration: 10000,
          isClosable: true,
        });
      }
      
      // Mark session as expired
      if (diffSeconds <= 0) {
        setSessionStatus('expired');
        clearInterval(timer);
        
        toast({
          title: "Session expired",
          description: "Your remote access session has expired.",
          status: "error",
          duration: null,
          isClosable: true,
        });
      }
    }, 1000);
    
    // Simulate network quality changes
    const networkQualityTimer = setInterval(() => {
      // Random latency between 10ms and 200ms
      const latency = Math.floor(Math.random() * 190) + 10;
      setNetworkLatency(latency);
      
      // Set connection quality based on latency
      if (latency < 50) {
        setConnectionQuality('good');
      } else if (latency < 120) {
        setConnectionQuality('fair');
      } else {
        setConnectionQuality('poor');
      }
      
      // 5% chance of connection degradation
      if (Math.random() < 0.05 && sessionStatus === 'active') {
        setSessionStatus('degraded');
        
        toast({
          title: "Connection degraded",
          description: "The connection quality has degraded. Some features may be slower than usual.",
          status: "warning",
          duration: 5000,
          isClosable: true,
        });
      }
      
      // 2% chance of connection loss requiring reconnect
      if (Math.random() < 0.02 && sessionStatus === 'active') {
        setSessionStatus('reconnecting');
        
        toast({
          title: "Connection lost",
          description: "Attempting to reconnect to the session...",
          status: "error",
          duration: 5000,
          isClosable: true,
        });
        
        // Simulate reconnection after 3 seconds
        setTimeout(() => {
          setSessionStatus('active');
          
          toast({
            title: "Reconnected",
            description: "Successfully reconnected to the session.",
            status: "success",
            duration: 3000,
            isClosable: true,
          });
        }, 3000);
      }
    }, 10000);
    
    return () => {
      clearInterval(timer);
      clearInterval(networkQualityTimer);
    };
  }, [expiryTime, showExpiryWarning, sessionStatus, toast]);
  
  // Handle tab change
  const handleTabChange = (index: number) => {
    setActiveTab(index);
    
    // Activate the appropriate component based on tab
    if (index === 0) {
      setIsTerminalActive(true);
      setIsVncActive(false);
    } else if (index === 1) {
      setIsTerminalActive(false);
      setIsVncActive(true);
    }
    
    setLastActivity(new Date());
  };
  
  // Handle session extension
  const handleExtendSession = () => {
    // Extend session by 1 hour
    const newExpiryTime = new Date(Date.now() + 60 * 60 * 1000);
    setExpiryTime(newExpiryTime);
    setShowExpiryWarning(false);
    onExtendModalClose();
    
    toast({
      title: "Session extended",
      description: "Your session has been extended by 1 hour.",
      status: "success",
      duration: 3000,
      isClosable: true,
    });
  };
  
  // Handle session end
  const handleEndSession = () => {
    onEndModalClose();
    onEndSession();
  };
  
  // Handle reconnect
  const handleReconnect = () => {
    setSessionStatus('reconnecting');
    
    // Simulate reconnection
    setTimeout(() => {
      setSessionStatus('active');
      setLastActivity(new Date());
      
      toast({
        title: "Reconnected",
        description: "Successfully reconnected to the session.",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    }, 2000);
  };
  
  // Format time remaining
  const formatTimeRemaining = (): string => {
    const hours = Math.floor(timeRemaining / 3600);
    const minutes = Math.floor((timeRemaining % 3600) / 60);
    const seconds = timeRemaining % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  };
  
  // Get status badge color
  const getStatusBadgeColor = (): string => {
    switch (sessionStatus) {
      case 'active':
        return 'green';
      case 'degraded':
        return 'yellow';
      case 'reconnecting':
        return 'orange';
      case 'expired':
        return 'red';
      default:
        return 'gray';
    }
  };
  
  // Get connection quality color
  const getConnectionQualityColor = (): string => {
    switch (connectionQuality) {
      case 'good':
        return 'green';
      case 'fair':
        return 'yellow';
      case 'poor':
        return 'red';
      default:
        return 'gray';
    }
  };
  
  // Calculate session duration
  const getSessionDuration = (): string => {
    const now = new Date();
    const diffMs = now.getTime() - sessionStartTime.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    
    if (diffHours > 0) {
      return `${diffHours}h ${mins}m`;
    } else {
      return `${mins}m`;
    }
  };
  
  return (
    <Box 
      borderWidth="1px" 
      borderRadius="lg" 
      overflow="hidden" 
      bg={bgColor}
      boxShadow="md"
      height="100%"
      display="flex"
      flexDirection="column"
    >
      {/* Session Header */}
      <Flex 
        bg={useColorModeValue('gray.50', 'gray.900')} 
        p={4} 
        justifyContent="space-between" 
        alignItems="center"
        borderBottomWidth="1px"
        borderColor={borderColor}
      >
        <Box>
          <Heading size="md">
            {deviceInfo.manufacturer && deviceInfo.model 
              ? `${deviceInfo.manufacturer} ${deviceInfo.model}`
              : deviceInfo.hostname || deviceId}
          </Heading>
          <Text fontSize="sm" color={useColorModeValue('gray.600', 'gray.400')}>
            Session ID: {sessionId}
          </Text>
        </Box>
        
        <Flex alignItems="center">
          <Badge colorScheme={getStatusBadgeColor()} mr={4}>
            {sessionStatus === 'active' ? 'Active' : 
             sessionStatus === 'degraded' ? 'Degraded' :
             sessionStatus === 'reconnecting' ? 'Reconnecting' : 'Expired'}
          </Badge>
          
          <Tooltip label="Reconnect session">
            <IconButton
              aria-label="Reconnect session"
              icon={<RepeatIcon />}
              size="sm"
              mr={2}
              isDisabled={sessionStatus === 'reconnecting'}
              onClick={handleReconnect}
            />
          </Tooltip>
          
          <Button
            colorScheme="blue"
            size="sm"
            mr={2}
            onClick={onExtendModalOpen}
            isDisabled={sessionStatus === 'expired'}
          >
            Extend
          </Button>
          
          <Button
            colorScheme="red"
            size="sm"
            onClick={onEndModalOpen}
          >
            End Session
          </Button>
        </Flex>
      </Flex>
      
      {/* Session Expiry Warning */}
      {showExpiryWarning && (
        <Alert status="warning">
          <AlertIcon />
          <AlertTitle mr={2}>Session expiring soon!</AlertTitle>
          <AlertDescription>
            Your session will expire in {formatTimeRemaining()}. Please extend your session if needed.
          </AlertDescription>
          <CloseButton
            position="absolute"
            right="8px"
            top="8px"
            onClick={() => setShowExpiryWarning(false)}
          />
        </Alert>
      )}
      
      {/* Session Status Bar */}
      <Flex 
        bg={useColorModeValue('gray.100', 'gray.800')} 
        p={2} 
        justifyContent="space-between" 
        alignItems="center"
        borderBottomWidth="1px"
        borderColor={borderColor}
      >
        <HStack spacing={4}>
          <Flex alignItems="center">
            <TimeIcon mr={1} />
            <Text fontSize="sm">Remaining: {formatTimeRemaining()}</Text>
          </Flex>
          
          <Flex alignItems="center">
            <InfoIcon mr={1} />
            <Text fontSize="sm">Duration: {getSessionDuration()}</Text>
          </Flex>
        </HStack>
        
        <HStack spacing={4}>
          <Flex alignItems="center">
            <Text fontSize="sm" mr={1}>Connection:</Text>
            <Badge colorScheme={getConnectionQualityColor()}>
              {connectionQuality.charAt(0).toUpperCase() + connectionQuality.slice(1)}
            </Badge>
          </Flex>
          
          <Text fontSize="sm">Latency: {networkLatency}ms</Text>
        </HStack>
      </Flex>
      
      {/* Connection Info */}
      <Box p={4} borderBottomWidth="1px" borderColor={borderColor}>
        <Heading size="sm" mb={2}>Connection Information</Heading>
        <Flex flexWrap="wrap">
          <Box mr={6} mb={2}>
            <Text fontWeight="bold" fontSize="sm">Host:</Text>
            <Text fontSize="sm">{connectionInfo.host}</Text>
          </Box>
          <Box mr={6} mb={2}>
            <Text fontWeight="bold" fontSize="sm">Port:</Text>
            <Text fontSize="sm">{connectionInfo.port}</Text>
          </Box>
          <Box mr={6} mb={2}>
            <Text fontWeight="bold" fontSize="sm">ADB Command:</Text>
            <Text fontSize="sm" fontFamily="monospace">
              adb connect {connectionInfo.host}:{connectionInfo.port}
            </Text>
          </Box>
          {deviceInfo.android_version && (
            <Box mr={6} mb={2}>
              <Text fontWeight="bold" fontSize="sm">Android Version:</Text>
              <Text fontSize="sm">{deviceInfo.android_version} (API {deviceInfo.api_level})</Text>
            </Box>
          )}
        </Flex>
      </Box>
      
      {/* Main Content Tabs */}
      <Tabs 
        flex="1" 
        display="flex" 
        flexDirection="column" 
        onChange={handleTabChange} 
        index={activeTab}
        variant="enclosed"
        colorScheme="blue"
        isLazy
      >
        <TabList>
          <Tab>Terminal</Tab>
          <Tab>VNC Viewer</Tab>
          <Tab>Session Info</Tab>
        </TabList>
        
        <TabPanels flex="1" display="flex" flexDirection="column">
          {/* Terminal Tab */}
          <TabPanel flex="1" display="flex" flexDirection="column" p={0}>
            <TerminalEmulator
              sessionId={sessionId}
              deviceId={deviceId}
              isActive={isTerminalActive}
              onClose={onEndModalOpen}
              onReconnect={handleReconnect}
            />
          </TabPanel>
          
          {/* VNC Viewer Tab */}
          <TabPanel flex="1" display="flex" flexDirection="column" p={0}>
            <VncViewer
              sessionId={sessionId}
              deviceId={deviceId}
              isActive={isVncActive}
              onClose={onEndModalOpen}
              onReconnect={handleReconnect}
            />
          </TabPanel>
          
          {/* Session Info Tab */}
          <TabPanel p={4}>
            <Box>
              <Heading size="sm" mb={3}>Device Information</Heading>
              <Flex flexWrap="wrap" mb={4}>
                <Box mr={6} mb={2}>
                  <Text fontWeight="bold" fontSize="sm">Device ID:</Text>
                  <Text fontSize="sm">{deviceId}</Text>
                </Box>
                <Box mr={6} mb={2}>
                  <Text fontWeight="bold" fontSize="sm">Gateway ID:</Text>
                  <Text fontSize="sm">{deviceInfo.gateway_id}</Text>
                </Box>
                <Box mr={6} mb={2}>
                  <Text fontWeight="bold" fontSize="sm">Platform:</Text>
                  <Text fontSize="sm">{deviceInfo.platform}</Text>
                </Box>
                <Box mr={6} mb={2}>
                  <Text fontWeight="bold" fontSize="sm">Hostname:</Text>
                  <Text fontSize="sm">{deviceInfo.hostname}</Text>
                </Box>
                {deviceInfo.manufacturer && (
                  <Box mr={6} mb={2}>
                    <Text fontWeight="bold" fontSize="sm">Manufacturer:</Text>
                    <Text fontSize="sm">{deviceInfo.manufacturer}</Text>
                  </Box>
                )}
                {deviceInfo.model && (
                  <Box mr={6} mb={2}>
                    <Text fontWeight="bold" fontSize="sm">Model:</Text>
                    <Text fontSize="sm">{deviceInfo.model}</Text>
                  </Box>
                )}
              </Flex>
              
              <Divider my={4} />
              
              <Heading size="sm" mb={3}>Session Information</Heading>
              <Flex flexWrap="wrap" mb={4}>
                <Box mr={6} mb={2}>
                  <Text fontWeight="bold" fontSize="sm">Session ID:</Text>
                  <Text fontSize="sm">{sessionId}</Text>
                </Box>
                <Box mr={6} mb={2}>
                  <Text fontWeight="bold" fontSize="sm">Start Time:</Text>
                  <Text fontSize="sm">{sessionStartTime.toLocaleString()}</Text>
                </Box>
                <Box mr={6} mb={2}>
                  <Text fontWeight="bold" fontSize="sm">Expiry Time:</Text>
                  <Text fontSize="sm">{expiryTime.toLocaleString()}</Text>
                </Box>
                <Box mr={6} mb={2}>
                  <Text fontWeight="bold" fontSize="sm">Last Activity:</Text>
                  <Text fontSize="sm">{lastActivity.toLocaleString()}</Text>
                </Box>
                <Box mr={6} mb={2}>
                  <Text fontWeight="bold" fontSize="sm">Status:</Text>
                  <Badge colorScheme={getStatusBadgeColor()}>
                    {sessionStatus.charAt(0).toUpperCase() + sessionStatus.slice(1)}
                  </Badge>
                </Box>
              </Flex>
              
              <Divider my={4} />
              
              <Heading size="sm" mb={3}>Connection Statistics</Heading>
              <Box mb={4}>
                <Text fontWeight="bold" fontSize="sm" mb={1}>Connection Quality:</Text>
                <Progress 
                  value={connectionQuality === 'good' ? 90 : connectionQuality === 'fair' ? 60 : 30} 
                  colorScheme={getConnectionQualityColor()}
                  size="sm"
                  borderRadius="full"
                  mb={2}
                />
                <Flex justifyContent="space-between">
                  <Text fontSize="xs">Poor</Text>
                  <Text fontSize="xs">Fair</Text>
                  <Text fontSize="xs">Good</Text>
                </Flex>
              </Box>
              
              <Box mb={4}>
                <Text fontWeight="bold" fontSize="sm" mb={1}>Network Latency: {networkLatency}ms</Text>
                <Progress 
                  value={Math.max(0, 100 - networkLatency / 2)} 
                  colorScheme={networkLatency < 50 ? 'green' : networkLatency < 120 ? 'yellow' : 'red'}
                  size="sm"
                  borderRadius="full"
                  mb={2}
                />
                <Flex justifyContent="space-between">
                  <Text fontSize="xs">High (200ms+)</Text>
                  <Text fontSize="xs">Medium (100ms)</Text>
                  <Text fontSize="xs">Low (0-50ms)</Text>
                </Flex>
              </Box>
              
              <Box mb={4}>
                <Text fontWeight="bold" fontSize="sm" mb={1}>Session Time Remaining:</Text>
                <Progress 
                  value={(timeRemaining / (60 * 60)) * 100} 
                  colorScheme={timeRemaining > 1800 ? 'green' : timeRemaining > 300 ? 'yellow' : 'red'}
                  size="sm"
                  borderRadius="full"
                  mb={2}
                />
                <Flex justifyContent="space-between">
                  <Text fontSize="xs">Expiring</Text>
                  <Text fontSize="xs">Halfway</Text>
                  <Text fontSize="xs">Full Time</Text>
                </Flex>
              </Box>
            </Box>
          </TabPanel>
        </TabPanels>
      </Tabs>
      
      {/* Extend Session Modal */}
      <Modal isOpen={isExtendModalOpen} onClose={onExtendModalClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Extend Session</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text>
              Your current session will expire in {formatTimeRemaining()}. 
              Would you like to extend it by 1 hour?
            </Text>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onExtendModalClose}>
              Cancel
            </Button>
            <Button colorScheme="blue" onClick={handleExtendSession}>
              Extend Session
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      
      {/* End Session Modal */}
      <Modal isOpen={isEndModalOpen} onClose={onEndModalClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>End Session</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text>
              Are you sure you want to end this remote access session? 
              This will close all connections to the device.
            </Text>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onEndModalClose}>
              Cancel
            </Button>
            <Button colorScheme="red" onClick={handleEndSession}>
              End Session
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default RemoteAccessSession;

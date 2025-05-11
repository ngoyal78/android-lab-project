import React, { useState, useEffect, useRef } from 'react';
import { 
  Box, 
  Flex, 
  Text, 
  IconButton, 
  Tooltip, 
  useColorModeValue, 
  Spinner,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Button,
  useToast
} from '@chakra-ui/react';
import { 
  RepeatIcon, 
  CloseIcon, 
  InfoIcon, 
  CopyIcon, 
  DownloadIcon,
  ChevronDownIcon,
  SettingsIcon
} from '@chakra-ui/icons';

interface VncViewerProps {
  sessionId: string;
  deviceId: string;
  isActive: boolean;
  onClose?: () => void;
  onReconnect?: () => void;
}

// Mock screen data - simulates different device screens with CSS gradients
const mockScreens = [
  'linear-gradient(45deg, #3498db, #2980b9)', // Blue gradient
  'linear-gradient(45deg, #2ecc71, #27ae60)', // Green gradient
  'linear-gradient(45deg, #e74c3c, #c0392b)', // Red gradient
  'linear-gradient(to right, #f1c40f, #f39c12)', // Yellow gradient
  'linear-gradient(to bottom, #9b59b6, #8e44ad)', // Purple gradient
  'linear-gradient(to bottom right, #1abc9c, #16a085)' // Teal gradient
];

const VncViewer: React.FC<VncViewerProps> = ({
  sessionId,
  deviceId,
  isActive,
  onClose,
  onReconnect
}) => {
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [lastActivity, setLastActivity] = useState<Date>(new Date());
  const [expiryTime, setExpiryTime] = useState<Date>(new Date(Date.now() + 60 * 60 * 1000)); // 1 hour from now
  const [currentScreen, setCurrentScreen] = useState<string>('');
  const [quality, setQuality] = useState<string>('medium');
  const [clipboardContent, setClipboardContent] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const toast = useToast();
  
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  
  // Simulate VNC connection
  useEffect(() => {
    if (isActive) {
      setIsConnecting(true);
      
      // Simulate connection delay
      const timer = setTimeout(() => {
        setIsConnecting(false);
        // Set initial screen
        setCurrentScreen(mockScreens[0]);
        setLastActivity(new Date());
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [isActive]);
  
  // Simulate screen updates
  useEffect(() => {
    if (isActive && !isConnecting) {
      const screenUpdateInterval = setInterval(() => {
        // 15% chance of screen update every 8 seconds
        if (Math.random() < 0.15) {
          const randomScreen = mockScreens[Math.floor(Math.random() * mockScreens.length)];
          setCurrentScreen(randomScreen);
          setLastActivity(new Date());
        }
      }, 8000);
      
      return () => clearInterval(screenUpdateInterval);
    }
  }, [isActive, isConnecting]);
  
  // Format time remaining until session expiry
  const formatTimeRemaining = (): string => {
    const now = new Date();
    const diffMs = expiryTime.getTime() - now.getTime();
    
    if (diffMs <= 0) {
      return 'Expired';
    }
    
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    
    if (diffHours > 0) {
      return `${diffHours}h ${mins}m`;
    } else {
      return `${mins}m`;
    }
  };
  
  // Handle reconnect
  const handleReconnect = () => {
    if (onReconnect) {
      setIsConnecting(true);
      
      // Simulate reconnection
      setTimeout(() => {
        setIsConnecting(false);
        setCurrentScreen(mockScreens[0]);
        setLastActivity(new Date());
        
        toast({
          title: "Reconnected",
          description: "VNC connection has been reestablished",
          status: "success",
          duration: 3000,
          isClosable: true,
        });
      }, 2000);
      
      onReconnect();
    }
  };
  
  // Handle clipboard copy from device
  const handleCopyFromDevice = () => {
    // In a real implementation, this would get clipboard content from the device
    const mockDeviceClipboard = "https://developer.android.com/";
    
    navigator.clipboard.writeText(mockDeviceClipboard)
      .then(() => {
        toast({
          title: "Clipboard copied",
          description: "Device clipboard content copied to your clipboard",
          status: "success",
          duration: 3000,
          isClosable: true,
        });
      })
      .catch(err => {
        toast({
          title: "Clipboard error",
          description: "Failed to copy device clipboard",
          status: "error",
          duration: 3000,
          isClosable: true,
        });
      });
  };
  
  // Handle clipboard paste to device
  const handlePasteToDevice = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setClipboardContent(text);
      
      toast({
        title: "Clipboard pasted",
        description: "Your clipboard content pasted to device",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    } catch (err) {
      toast({
        title: "Clipboard error",
        description: "Failed to read your clipboard",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  };
  
  // Handle screenshot
  const handleScreenshot = () => {
    if (!canvasRef.current || !currentScreen) return;
    
    try {
      // In a real implementation, this would capture the actual canvas content
      // For this mock, we'll simulate a successful screenshot
      
      toast({
        title: "Screenshot saved",
        description: "Screenshot has been saved to your downloads",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
      
      // Simulate a download action
      setTimeout(() => {
        toast({
          title: "Download complete",
          description: `vnc_screenshot_${deviceId}_${new Date().toISOString().slice(0, 10)}.png`,
          status: "info",
          duration: 2000,
          isClosable: true,
        });
      }, 1000);
    } catch (err) {
      toast({
        title: "Screenshot error",
        description: "Failed to save screenshot",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  };
  
  // Handle quality change
  const handleQualityChange = (newQuality: string) => {
    setQuality(newQuality);
    
    toast({
      title: "Quality changed",
      description: `Display quality set to ${newQuality}`,
      status: "info",
      duration: 2000,
      isClosable: true,
    });
  };
  
  // Handle mouse interaction with the VNC display
  const handleMouseInteraction = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isConnecting) return;
    
    // Get canvas and calculate relative position
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // In a real implementation, these coordinates would be sent to the VNC server
    console.log(`VNC interaction at coordinates: ${x}, ${y}`);
    
    // For the mock, we'll just update the last activity time
    setLastActivity(new Date());
    
    // 10% chance of screen change on click
    if (e.type === 'click' && Math.random() < 0.1) {
      const randomScreen = mockScreens[Math.floor(Math.random() * mockScreens.length)];
      setCurrentScreen(randomScreen);
    }
  };
  
  // Toggle fullscreen
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };
  
  return (
    <Box 
      borderWidth="1px" 
      borderRadius="md" 
      borderColor={borderColor}
      overflow="hidden"
      height="100%"
      display="flex"
      flexDirection="column"
      position={isFullscreen ? "fixed" : "relative"}
      top={isFullscreen ? 0 : "auto"}
      left={isFullscreen ? 0 : "auto"}
      right={isFullscreen ? 0 : "auto"}
      bottom={isFullscreen ? 0 : "auto"}
      zIndex={isFullscreen ? 1000 : "auto"}
      bg={isFullscreen ? "black" : "transparent"}
    >
      {/* VNC Header */}
      <Flex 
        bg={useColorModeValue('gray.100', 'gray.800')} 
        p={2} 
        justifyContent="space-between" 
        alignItems="center"
      >
        <Flex alignItems="center">
          <Text fontWeight="bold" fontSize="sm">VNC: {deviceId}</Text>
          {isConnecting && <Spinner size="sm" ml={2} />}
        </Flex>
        
        <Flex>
          <Tooltip label="Time until session expiry">
            <Flex alignItems="center" mr={2}>
              <InfoIcon mr={1} />
              <Text fontSize="xs">{formatTimeRemaining()}</Text>
            </Flex>
          </Tooltip>
          
          <Menu>
            <Tooltip label="Settings">
              <MenuButton
                as={IconButton}
                aria-label="Settings"
                icon={<SettingsIcon />}
                size="sm"
                variant="ghost"
                mr={1}
              />
            </Tooltip>
            <MenuList>
              <MenuItem onClick={() => handleQualityChange('low')}>
                Quality: Low {quality === 'low' && '✓'}
              </MenuItem>
              <MenuItem onClick={() => handleQualityChange('medium')}>
                Quality: Medium {quality === 'medium' && '✓'}
              </MenuItem>
              <MenuItem onClick={() => handleQualityChange('high')}>
                Quality: High {quality === 'high' && '✓'}
              </MenuItem>
              <MenuItem onClick={toggleFullscreen}>
                {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Mode'}
              </MenuItem>
            </MenuList>
          </Menu>
          
          <Menu>
            <Tooltip label="Clipboard">
              <MenuButton
                as={IconButton}
                aria-label="Clipboard"
                icon={<CopyIcon />}
                size="sm"
                variant="ghost"
                mr={1}
              />
            </Tooltip>
            <MenuList>
              <MenuItem onClick={handleCopyFromDevice}>
                Copy from device
              </MenuItem>
              <MenuItem onClick={handlePasteToDevice}>
                Paste to device
              </MenuItem>
            </MenuList>
          </Menu>
          
          <Tooltip label="Take screenshot">
            <IconButton
              aria-label="Take screenshot"
              icon={<DownloadIcon />}
              size="sm"
              variant="ghost"
              onClick={handleScreenshot}
              mr={1}
            />
          </Tooltip>
          
          <Tooltip label="Reconnect">
            <IconButton
              aria-label="Reconnect"
              icon={<RepeatIcon />}
              size="sm"
              variant="ghost"
              onClick={handleReconnect}
              mr={1}
            />
          </Tooltip>
          
          <Tooltip label="Close VNC">
            <IconButton
              aria-label="Close VNC"
              icon={<CloseIcon />}
              size="sm"
              variant="ghost"
              onClick={onClose}
            />
          </Tooltip>
        </Flex>
      </Flex>
      
      {/* VNC Display */}
      <Box 
        flex="1"
        position="relative"
        bg="black"
        display="flex"
        justifyContent="center"
        alignItems="center"
        overflow="hidden"
      >
        {isConnecting ? (
          <Flex direction="column" alignItems="center">
            <Spinner size="xl" color="blue.500" />
            <Text mt={4} color="white">Connecting to VNC session...</Text>
          </Flex>
        ) : currentScreen ? (
          <Box
            as="canvas"
            ref={canvasRef}
            onClick={handleMouseInteraction}
            onMouseMove={handleMouseInteraction}
            sx={{
              maxWidth: '100%',
              maxHeight: '100%',
              cursor: 'pointer',
              background: currentScreen,
              width: '100%',
              height: '100%',
              borderRadius: 'md',
              position: 'relative'
            }}
          >
            {/* Mock Android UI elements */}
            <Box 
              position="absolute" 
              top="10px" 
              left="0" 
              right="0" 
              height="20px" 
              bg="rgba(0,0,0,0.7)"
              display="flex"
              alignItems="center"
              justifyContent="space-between"
              px={2}
            >
              <Text color="white" fontSize="xs">Android {Math.floor(Math.random() * 5) + 9}</Text>
              <Flex>
                <Text color="white" fontSize="xs" mr={2}>
                  {new Date().getHours()}:{String(new Date().getMinutes()).padStart(2, '0')}
                </Text>
                <Text color="white" fontSize="xs">100%</Text>
              </Flex>
            </Box>
          </Box>
        ) : (
          <Text color="white">No display available</Text>
        )}
      </Box>
      
      {/* VNC Controls */}
      <Flex 
        bg={useColorModeValue('gray.100', 'gray.800')} 
        p={2} 
        justifyContent="space-between" 
        alignItems="center"
      >
        <Flex>
          <Button size="sm" variant="ghost" mr={1}>
            Home
          </Button>
          <Button size="sm" variant="ghost" mr={1}>
            Back
          </Button>
          <Button size="sm" variant="ghost" mr={1}>
            Menu
          </Button>
        </Flex>
        
        <Flex alignItems="center" fontSize="xs" color={useColorModeValue('gray.600', 'gray.400')}>
          <Text>Quality: {quality}</Text>
          <Text ml={4}>Last activity: {lastActivity.toLocaleTimeString()}</Text>
        </Flex>
      </Flex>
      
      {/* Session Status */}
      <Flex 
        bg={useColorModeValue('gray.50', 'gray.900')} 
        p={1} 
        justifyContent="space-between" 
        alignItems="center"
        fontSize="xs"
        color={useColorModeValue('gray.600', 'gray.400')}
        borderTopWidth="1px"
        borderColor={borderColor}
      >
        <Text>Session: {sessionId}</Text>
        <Text>Device: {deviceId}</Text>
      </Flex>
    </Box>
  );
};

export default VncViewer;

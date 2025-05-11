import React, { useState, useEffect, useRef } from 'react';
import { Box, Flex, Text, Button, useColorModeValue, Tooltip, IconButton, Spinner } from '@chakra-ui/react';
import { RepeatIcon, CopyIcon, DownloadIcon, CloseIcon, InfoIcon } from '@chakra-ui/icons';

interface TerminalEmulatorProps {
  sessionId: string;
  deviceId: string;
  isActive: boolean;
  onClose?: () => void;
  onReconnect?: () => void;
}

// Mock terminal data generator
const generateTerminalOutput = (lines: number = 10): string[] => {
  const outputs = [
    '$ ls -la',
    'total 20',
    'drwxr-xr-x  5 user user 4096 May 11 14:08 .',
    'drwxr-xr-x 28 user user 4096 May 11 13:45 ..',
    'drwxr-xr-x  8 user user 4096 May 11 14:08 .git',
    '-rw-r--r--  1 user user  237 May 11 14:08 README.md',
    'drwxr-xr-x  3 user user 4096 May 11 14:08 src',
    'drwxr-xr-x  2 user user 4096 May 11 14:08 tests',
    '$ ps aux | grep java',
    'user     12345 23.0  5.1 3458808 418172 ?      Sl   13:45   0:42 java -jar app.jar',
    'user     12346  0.0  0.0  14428  1020 pts/0    S+   14:09   0:00 grep --color=auto java',
    '$ netstat -tulpn | grep LISTEN',
    'tcp        0      0 0.0.0.0:22              0.0.0.0:*               LISTEN      -',
    'tcp        0      0 0.0.0.0:5555            0.0.0.0:*               LISTEN      -',
    'tcp6       0      0 :::8080                 :::*                    LISTEN      -',
    '$ df -h',
    'Filesystem      Size  Used Avail Use% Mounted on',
    '/dev/sda1        50G   15G   35G  30% /',
    'tmpfs           3.9G     0  3.9G   0% /dev/shm',
    '$ free -m',
    '              total        used        free      shared  buff/cache   available',
    'Mem:           7964        2145        3521         304        2298        5214',
    'Swap:          2048           0        2048',
    '$ uname -a',
    'Linux hostname 5.15.0-76-generic #83-Ubuntu SMP Thu Jun 15 19:16:32 UTC 2023 x86_64 x86_64 x86_64 GNU/Linux',
    '$ adb devices',
    'List of devices attached',
    'emulator-5554   device',
    'RFCN90JVXXN     device',
    '$ adb -s emulator-5554 shell getprop ro.build.version.release',
    '13',
    '$ adb -s emulator-5554 shell getprop ro.build.version.sdk',
    '33',
    '$ adb -s RFCN90JVXXN shell dumpsys battery',
    'Current Battery Service state:',
    '  AC powered: true',
    '  USB powered: false',
    '  Wireless powered: false',
    '  Max charging current: 1500000',
    '  Max charging voltage: 5000000',
    '  Charge counter: 3715914',
    '  status: 2',
    '  health: 2',
    '  present: true',
    '  level: 100',
    '  scale: 100',
    '  temperature: 250',
    '  technology: Li-ion',
    '$ '
  ];
  
  const randomStart = Math.floor(Math.random() * (outputs.length - lines));
  return outputs.slice(randomStart, randomStart + lines);
};

const TerminalEmulator: React.FC<TerminalEmulatorProps> = ({ 
  sessionId, 
  deviceId, 
  isActive, 
  onClose, 
  onReconnect 
}) => {
  const [terminalLines, setTerminalLines] = useState<string[]>([]);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [lastActivity, setLastActivity] = useState<Date>(new Date());
  const [expiryTime, setExpiryTime] = useState<Date>(new Date(Date.now() + 60 * 60 * 1000)); // 1 hour from now
  const [inputValue, setInputValue] = useState<string>('');
  const terminalRef = useRef<HTMLDivElement>(null);
  
  const bgColor = useColorModeValue('black', 'black');
  const textColor = useColorModeValue('green.400', 'green.400');
  const borderColor = useColorModeValue('gray.700', 'gray.700');
  
  // Simulate terminal connection
  useEffect(() => {
    if (isActive) {
      setIsConnecting(true);
      
      // Simulate connection delay
      const timer = setTimeout(() => {
        setIsConnecting(false);
        setTerminalLines([
          `Connected to device ${deviceId}`,
          `Session ID: ${sessionId}`,
          `Type 'help' for available commands`,
          '$'
        ]);
        setLastActivity(new Date());
      }, 1500);
      
      return () => clearTimeout(timer);
    }
  }, [isActive, deviceId, sessionId]);
  
  // Simulate terminal activity
  useEffect(() => {
    if (isActive && !isConnecting) {
      const activityInterval = setInterval(() => {
        // 20% chance of new terminal output every 5 seconds
        if (Math.random() < 0.2) {
          const newOutput = generateTerminalOutput(1);
          setTerminalLines(prev => [...prev, ...newOutput]);
          setLastActivity(new Date());
        }
      }, 5000);
      
      return () => clearInterval(activityInterval);
    }
  }, [isActive, isConnecting]);
  
  // Auto-scroll to bottom when terminal content changes
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminalLines]);
  
  // Handle input submission
  const handleInputSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      const command = inputValue.trim();
      setTerminalLines(prev => [...prev, `$ ${command}`]);
      
      // Simulate command execution
      setTimeout(() => {
        let output: string[] = [];
        
        if (command === 'help') {
          output = [
            'Available commands:',
            '  help     - Show this help message',
            '  clear    - Clear the terminal',
            '  exit     - Close the terminal session',
            '  ls       - List files',
            '  ps       - Show processes',
            '  adb      - Run ADB commands',
            '  netstat  - Show network connections',
            '  df       - Show disk usage',
            '  free     - Show memory usage'
          ];
        } else if (command === 'clear') {
          setTerminalLines([]);
          setInputValue('');
          return;
        } else if (command === 'exit') {
          output = ['Closing session...'];
          setTimeout(() => {
            if (onClose) onClose();
          }, 1000);
        } else if (command.startsWith('ls')) {
          output = generateTerminalOutput(5).filter(line => line.includes('drwx') || line.includes('-rw-'));
        } else if (command.startsWith('ps')) {
          output = generateTerminalOutput(3).filter(line => line.includes('user'));
        } else if (command.startsWith('adb')) {
          if (command.includes('devices')) {
            output = [
              'List of devices attached',
              `${deviceId}\tdevice`
            ];
          } else {
            output = generateTerminalOutput(2);
          }
        } else {
          output = generateTerminalOutput(3);
        }
        
        setTerminalLines(prev => [...prev, ...output, '$']);
        setLastActivity(new Date());
      }, 300);
      
      setInputValue('');
    }
  };
  
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
  
  // Handle clipboard copy
  const handleCopyToClipboard = () => {
    const text = terminalLines.join('\n');
    navigator.clipboard.writeText(text)
      .then(() => {
        // Show success message (in a real app, you'd use a toast)
        console.log('Terminal output copied to clipboard');
      })
      .catch(err => {
        console.error('Failed to copy terminal output:', err);
      });
  };
  
  // Handle terminal download
  const handleDownloadTerminal = () => {
    const text = terminalLines.join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `terminal_${deviceId}_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  // Handle reconnect
  const handleReconnect = () => {
    if (onReconnect) {
      setIsConnecting(true);
      setTerminalLines(prev => [...prev, 'Reconnecting...']);
      
      // Simulate reconnection
      setTimeout(() => {
        setIsConnecting(false);
        setTerminalLines(prev => [...prev, 'Connection reestablished', '$']);
        setLastActivity(new Date());
      }, 2000);
      
      onReconnect();
    }
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
    >
      {/* Terminal Header */}
      <Flex 
        bg={useColorModeValue('gray.800', 'gray.900')} 
        color="white" 
        p={2} 
        justifyContent="space-between" 
        alignItems="center"
      >
        <Flex alignItems="center">
          <Text fontWeight="bold" fontSize="sm">Terminal: {deviceId}</Text>
          {isConnecting && <Spinner size="sm" ml={2} />}
        </Flex>
        
        <Flex>
          <Tooltip label="Time until session expiry">
            <Flex alignItems="center" mr={2}>
              <InfoIcon mr={1} />
              <Text fontSize="xs">{formatTimeRemaining()}</Text>
            </Flex>
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
          
          <Tooltip label="Copy to clipboard">
            <IconButton
              aria-label="Copy to clipboard"
              icon={<CopyIcon />}
              size="sm"
              variant="ghost"
              onClick={handleCopyToClipboard}
              mr={1}
            />
          </Tooltip>
          
          <Tooltip label="Download terminal output">
            <IconButton
              aria-label="Download terminal output"
              icon={<DownloadIcon />}
              size="sm"
              variant="ghost"
              onClick={handleDownloadTerminal}
              mr={1}
            />
          </Tooltip>
          
          <Tooltip label="Close terminal">
            <IconButton
              aria-label="Close terminal"
              icon={<CloseIcon />}
              size="sm"
              variant="ghost"
              onClick={onClose}
            />
          </Tooltip>
        </Flex>
      </Flex>
      
      {/* Terminal Output */}
      <Box 
        ref={terminalRef}
        bg={bgColor} 
        color={textColor} 
        p={3} 
        fontFamily="monospace" 
        fontSize="sm" 
        overflowY="auto"
        flex="1"
        whiteSpace="pre-wrap"
      >
        {isConnecting ? (
          <Flex justifyContent="center" alignItems="center" height="100%">
            <Spinner />
            <Text ml={3}>Connecting to terminal...</Text>
          </Flex>
        ) : (
          terminalLines.map((line, index) => (
            <Text key={index}>{line}</Text>
          ))
        )}
      </Box>
      
      {/* Terminal Input */}
      {!isConnecting && (
        <Flex 
          borderTopWidth="1px" 
          borderColor={borderColor}
          bg={bgColor}
          p={2}
        >
          <Text color={textColor} fontFamily="monospace" mr={1}>$</Text>
          <Box flex="1">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleInputSubmit}
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'inherit',
                fontFamily: 'monospace',
                fontSize: '14px'
              }}
              placeholder="Type command here..."
              disabled={isConnecting}
            />
          </Box>
        </Flex>
      )}
      
      {/* Session Status */}
      <Flex 
        bg={useColorModeValue('gray.100', 'gray.800')} 
        p={1} 
        justifyContent="space-between" 
        alignItems="center"
        fontSize="xs"
        color={useColorModeValue('gray.600', 'gray.400')}
      >
        <Text>Session: {sessionId}</Text>
        <Text>Last activity: {lastActivity.toLocaleTimeString()}</Text>
      </Flex>
    </Box>
  );
};

export default TerminalEmulator;

import React, { useState, useEffect, useRef } from 'react';

interface ConsoleViewerProps {
  targetId: string;
  consoleType: 'adb' | 'serial';
  initialOutput?: string;
  readOnly?: boolean;
}

const ConsoleViewer: React.FC<ConsoleViewerProps> = ({
  targetId,
  consoleType,
  initialOutput = '',
  readOnly = false
}) => {
  const [output, setOutput] = useState<string>(initialOutput);
  const [input, setInput] = useState<string>('');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Auto-scroll to bottom when output changes
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  // Connect to WebSocket when component mounts
  useEffect(() => {
    if (readOnly) {
      // In read-only mode, we don't connect to WebSocket
      return;
    }

    const connectWebSocket = () => {
      setIsConnecting(true);
      setError(null);

      // In a real app, this would be a real WebSocket connection
      // const ws = new WebSocket(`ws://localhost:8000/api/console/${consoleType}/${targetId}`);
      
      // For demo purposes, we'll simulate a WebSocket connection
      setTimeout(() => {
        setIsConnected(true);
        setIsConnecting(false);
        
        // Add a welcome message
        const welcomeMessage = consoleType === 'adb' 
          ? 'Connected to ADB shell.\n$ '
          : 'Connected to serial console.\n> ';
        
        setOutput(prev => prev + welcomeMessage);
      }, 1000);

      // Simulate WebSocket events
      const simulatedWs = {
        send: (message: string) => {
          // Simulate sending a message
          console.log(`Sending message to ${consoleType} console:`, message);
          
          // Simulate response after a short delay
          setTimeout(() => {
            let response = '';
            
            if (consoleType === 'adb') {
              if (message.trim() === 'ls') {
                response = 'emulated\nsystem\ndata\nconfig\n$ ';
              } else if (message.trim() === 'pwd') {
                response = '/storage/emulated/0\n$ ';
              } else if (message.trim().startsWith('echo')) {
                response = `${message.substring(5)}\n$ `;
              } else {
                response = `Command executed: ${message}\n$ `;
              }
            } else {
              // Serial console responses
              response = `> ${message}\n> `;
            }
            
            setOutput(prev => prev + message + '\n' + response);
          }, 300);
        },
        close: () => {
          setIsConnected(false);
          setOutput(prev => prev + '\nDisconnected from console.\n');
        }
      };
      
      wsRef.current = simulatedWs as unknown as WebSocket;
      
      return () => {
        if (wsRef.current) {
          wsRef.current.close();
        }
      };
    };

    const cleanup = connectWebSocket();
    
    return () => {
      if (cleanup) {
        cleanup();
      }
    };
  }, [targetId, consoleType, readOnly]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const handleInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!input.trim() || !isConnected || !wsRef.current) {
      return;
    }
    
    // Send the command to the WebSocket
    wsRef.current.send(input);
    
    // Clear the input field
    setInput('');
  };

  const handleClearConsole = () => {
    setOutput(isConnected ? (consoleType === 'adb' ? '$ ' : '> ') : '');
  };

  const handleReconnect = () => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    
    setIsConnected(false);
    setIsConnecting(true);
    setError(null);
    
    // Simulate reconnection
    setTimeout(() => {
      setIsConnected(true);
      setIsConnecting(false);
      
      const welcomeMessage = consoleType === 'adb' 
        ? 'Reconnected to ADB shell.\n$ '
        : 'Reconnected to serial console.\n> ';
      
      setOutput(welcomeMessage);
    }, 1000);
  };

  return (
    <div className="bg-black text-white font-mono rounded-md overflow-hidden">
      <div className="flex items-center justify-between bg-gray-800 px-4 py-2">
        <div className="text-sm font-semibold">
          {consoleType === 'adb' ? 'ADB Shell' : 'Serial Console'}
        </div>
        <div className="flex space-x-2">
          <div className={`h-2 w-2 rounded-full ${
            isConnected ? 'bg-green-500' : isConnecting ? 'bg-yellow-500' : 'bg-red-500'
          }`}></div>
          <span className="text-xs text-gray-300">
            {isConnected ? 'Connected' : isConnecting ? 'Connecting...' : 'Disconnected'}
          </span>
          {!readOnly && (
            <>
              <button
                onClick={handleClearConsole}
                className="ml-4 text-xs text-gray-300 hover:text-white"
              >
                Clear
              </button>
              {!isConnected && !isConnecting && (
                <button
                  onClick={handleReconnect}
                  className="ml-2 text-xs text-gray-300 hover:text-white"
                >
                  Reconnect
                </button>
              )}
            </>
          )}
        </div>
      </div>
      
      <div 
        ref={outputRef}
        className="p-4 h-64 overflow-y-auto whitespace-pre-wrap"
      >
        {output}
      </div>
      
      {!readOnly && (
        <form onSubmit={handleInputSubmit} className="flex border-t border-gray-700">
          <input
            type="text"
            value={input}
            onChange={handleInputChange}
            disabled={!isConnected}
            className="flex-1 bg-black text-white px-4 py-2 focus:outline-none"
            placeholder={isConnected ? `Enter ${consoleType} command...` : 'Disconnected...'}
          />
          <button
            type="submit"
            disabled={!isConnected}
            className="px-4 py-2 bg-gray-800 text-white disabled:opacity-50"
          >
            Send
          </button>
        </form>
      )}
      
      {error && (
        <div className="p-2 bg-red-900 text-white text-sm">
          Error: {error}
        </div>
      )}
    </div>
  );
};

export default ConsoleViewer;

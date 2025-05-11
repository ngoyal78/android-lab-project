import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import {
  Box,
  Flex,
  Heading,
  Text,
  Button,
  Select,
  Input,
  FormControl,
  FormLabel,
  FormHelperText,
  Stack,
  Divider,
  Badge,
  Spinner,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  CloseButton,
  useToast,
  useColorModeValue,
  Tooltip,
  IconButton,
  Grid,
  GridItem,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Slider,
  SliderTrack,
  SliderFilledTrack,
  SliderThumb,
  Switch,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Code,
  Tag,
  TagLabel,
  TagCloseButton,
  HStack,
  VStack,
  Checkbox,
  Radio,
  RadioGroup,
  Textarea,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Progress
} from '@chakra-ui/react';
import {
  AddIcon,
  DeleteIcon,
  RepeatIcon,
  CheckIcon,
  WarningIcon,
  InfoIcon,
  TimeIcon,
  DownloadIcon,
  CopyIcon,
  EditIcon,
  ViewIcon,
  ChevronRightIcon
} from '@chakra-ui/icons';

// Define interfaces for our data structures
interface Target {
  id: number;
  name: string;
  device_type: 'physical' | 'virtual' | 'emulator';
  status: 'available' | 'reserved' | 'offline' | 'maintenance' | 'unhealthy';
  serial_number: string;
  android_version?: string;
  api_level?: number;
  manufacturer?: string;
  model?: string;
  hal_support?: Record<string, any>;
}

interface TestProfile {
  id: string;
  name: string;
  description: string;
  type: string;
  parameters: Record<string, any>;
}

interface ScenarioAction {
  id: string;
  type: string;
  name: string;
  description: string;
  parameters: Record<string, any>;
  target?: string; // Target device ID
}

interface ScenarioStep {
  id: string;
  name: string;
  action: ScenarioAction;
  order: number;
  delay_before_ms?: number;
  conditions?: Record<string, any>;
}

interface Scenario {
  id: string;
  name: string;
  description: string;
  target_ids: number[];
  steps: ScenarioStep[];
  created_at: string;
  updated_at: string;
  created_by: number;
}

interface ScenarioExecution {
  id: string;
  scenario_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  start_time?: string;
  end_time?: string;
  results: Record<string, any>;
  logs: string[];
}

// Mock data for development
const mockHALs = [
  { id: 'camera', name: 'Camera HAL', description: 'Camera hardware abstraction layer' },
  { id: 'audio', name: 'Audio HAL', description: 'Audio hardware abstraction layer' },
  { id: 'sensors', name: 'Sensors HAL', description: 'Sensors hardware abstraction layer' },
  { id: 'gps', name: 'GPS HAL', description: 'GPS/Location hardware abstraction layer' },
  { id: 'bluetooth', name: 'Bluetooth HAL', description: 'Bluetooth hardware abstraction layer' },
  { id: 'wifi', name: 'WiFi HAL', description: 'WiFi hardware abstraction layer' },
  { id: 'telephony', name: 'Telephony HAL', description: 'Telephony hardware abstraction layer' },
  { id: 'nfc', name: 'NFC HAL', description: 'NFC hardware abstraction layer' },
  { id: 'battery', name: 'Battery HAL', description: 'Battery hardware abstraction layer' }
];

const mockTestProfiles = [
  {
    id: 'basic_functionality',
    name: 'Basic Functionality',
    description: 'Tests basic device functionality',
    type: 'functional',
    parameters: {}
  },
  {
    id: 'performance',
    name: 'Performance Test',
    description: 'Tests device performance under load',
    type: 'performance',
    parameters: {
      duration_seconds: 300,
      cpu_load: 80,
      memory_usage: 70
    }
  },
  {
    id: 'battery_drain',
    name: 'Battery Drain Test',
    description: 'Tests battery consumption under various conditions',
    type: 'battery',
    parameters: {
      duration_minutes: 30,
      screen_brightness: 100,
      wifi_enabled: true,
      bluetooth_enabled: true,
      gps_enabled: true
    }
  },
  {
    id: 'stress_test',
    name: 'Stress Test',
    description: 'Stress tests device under extreme conditions',
    type: 'stress',
    parameters: {
      duration_minutes: 60,
      iterations: 10,
      random_reboot: false
    }
  }
];

const mockScenarioActions = [
  {
    id: 'gps_drift',
    type: 'simulation',
    name: 'GPS Drift',
    description: 'Simulate GPS location drift',
    parameters: {
      start_latitude: 37.7749,
      start_longitude: -122.4194,
      drift_pattern: 'random', // random, linear, circular
      drift_speed: 'medium', // slow, medium, fast
      duration_seconds: 60
    }
  },
  {
    id: 'battery_event',
    type: 'simulation',
    name: 'Battery Event',
    description: 'Simulate battery events like charging, discharging, or low battery',
    parameters: {
      event_type: 'discharging', // charging, discharging, low_battery
      target_level: 15, // percentage
      transition_time_seconds: 300
    }
  },
  {
    id: 'network_condition',
    type: 'simulation',
    name: 'Network Condition',
    description: 'Simulate different network conditions',
    parameters: {
      network_type: '4g', // 2g, 3g, 4g, 5g, wifi
      signal_strength: 'medium', // low, medium, high
      packet_loss: 0, // percentage
      latency_ms: 50
    }
  },
  {
    id: 'device_rotation',
    type: 'simulation',
    name: 'Device Rotation',
    description: 'Simulate device rotation',
    parameters: {
      orientation: 'landscape', // portrait, landscape, reverse_portrait, reverse_landscape
      rotation_speed: 'medium' // slow, medium, fast
    }
  },
  {
    id: 'app_launch',
    type: 'action',
    name: 'Launch App',
    description: 'Launch an application on the device',
    parameters: {
      package_name: 'com.example.app',
      activity_name: '.MainActivity',
      clear_data: false
    }
  },
  {
    id: 'app_close',
    type: 'action',
    name: 'Close App',
    description: 'Close an application on the device',
    parameters: {
      package_name: 'com.example.app',
      force_stop: true
    }
  },
  {
    id: 'take_screenshot',
    type: 'action',
    name: 'Take Screenshot',
    description: 'Capture a screenshot of the device',
    parameters: {
      save_path: '/screenshots/',
      filename_prefix: 'screen_'
    }
  },
  {
    id: 'run_adb_command',
    type: 'action',
    name: 'Run ADB Command',
    description: 'Execute an ADB command on the device',
    parameters: {
      command: 'shell dumpsys battery'
    }
  },
  {
    id: 'wait',
    type: 'action',
    name: 'Wait',
    description: 'Wait for a specified duration',
    parameters: {
      duration_seconds: 10
    }
  },
  {
    id: 'device_reboot',
    type: 'action',
    name: 'Reboot Device',
    description: 'Reboot the target device',
    parameters: {
      wait_for_boot: true,
      timeout_seconds: 120
    }
  },
  {
    id: 'run_test',
    type: 'test',
    name: 'Run Test',
    description: 'Execute a test on the device',
    parameters: {
      test_profile_id: 'basic_functionality'
    }
  },
  {
    id: 'reset_to_factory',
    type: 'action',
    name: 'Factory Reset',
    description: 'Reset device to factory settings',
    parameters: {
      confirm: true,
      wait_for_completion: true,
      timeout_seconds: 300
    }
  }
];

const ScenarioComposer: React.FC = () => {
  const { authToken } = useAuth();
  const toast = useToast();
  const [targets, setTargets] = useState<Target[]>([]);
  const [selectedTargets, setSelectedTargets] = useState<number[]>([]);
  const [testProfiles, setTestProfiles] = useState<TestProfile[]>(mockTestProfiles);
  const [scenarioActions, setScenarioActions] = useState<ScenarioAction[]>(mockScenarioActions);
  const [currentScenario, setCurrentScenario] = useState<Scenario>({
    id: `scenario-${Date.now()}`,
    name: 'New Scenario',
    description: '',
    target_ids: [],
    steps: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    created_by: 1 // Placeholder user ID
  });
  const [savedScenarios, setSavedScenarios] = useState<Scenario[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeExecution, setActiveExecution] = useState<ScenarioExecution | null>(null);
  const [executionHistory, setExecutionHistory] = useState<ScenarioExecution[]>([]);
  const [previewOutput, setPreviewOutput] = useState<string>('');
  const [statusUpdates, setStatusUpdates] = useState<string[]>([]);
  const [editingStepIndex, setEditingStepIndex] = useState<number | null>(null);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  
  const { isOpen: isPreviewOpen, onOpen: onPreviewOpen, onClose: onPreviewClose } = useDisclosure();
  const { isOpen: isNewActionOpen, onOpen: onNewActionOpen, onClose: onNewActionClose } = useDisclosure();
  
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const bgColor = useColorModeValue('white', 'gray.800');
  const accentColor = useColorModeValue('blue.500', 'blue.300');

  // Fetch targets from API
  const fetchTargets = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // In a real implementation, this would be an API call
      // const response = await axios.get(`${process.env.REACT_APP_API_URL}/api/targets`, {
      //   headers: {
      //     Authorization: `Bearer ${authToken}`,
      //   },
      // });
      
      // Mock response for development
      const mockTargets: Target[] = [
        {
          id: 1,
          name: 'Pixel 6 Pro',
          device_type: 'physical',
          status: 'available',
          serial_number: 'RFCN90JVXXN',
          android_version: '13',
          api_level: 33,
          manufacturer: 'Google',
          model: 'Pixel 6 Pro',
          hal_support: {
            camera: true,
            audio: true,
            sensors: true,
            gps: true,
            bluetooth: true,
            wifi: true,
            telephony: true,
            nfc: true,
            battery: true
          }
        },
        {
          id: 2,
          name: 'Samsung Galaxy S21',
          device_type: 'physical',
          status: 'available',
          serial_number: 'R5CT10JVXXP',
          android_version: '12',
          api_level: 31,
          manufacturer: 'Samsung',
          model: 'Galaxy S21',
          hal_support: {
            camera: true,
            audio: true,
            sensors: true,
            gps: true,
            bluetooth: true,
            wifi: true,
            telephony: true,
            nfc: true,
            battery: true
          }
        },
        {
          id: 3,
          name: 'Emulator - Pixel 4',
          device_type: 'emulator',
          status: 'available',
          serial_number: 'emulator-5554',
          android_version: '11',
          api_level: 30,
          manufacturer: 'Google',
          model: 'Pixel 4 (Emulator)',
          hal_support: {
            camera: true,
            audio: true,
            sensors: true,
            gps: true,
            bluetooth: true,
            wifi: true,
            telephony: false,
            nfc: false,
            battery: true
          }
        }
      ];
      
      setTargets(mockTargets);
    } catch (err) {
      console.error('Error fetching targets:', err);
      setError('Failed to fetch targets');
    } finally {
      setIsLoading(false);
    }
  }, [authToken]);

  // Fetch saved scenarios
  const fetchScenarios = useCallback(async () => {
    try {
      // In a real implementation, this would be an API call
      // const response = await axios.get(`${process.env.REACT_APP_API_URL}/api/scenarios`, {
      //   headers: {
      //     Authorization: `Bearer ${authToken}`,
      //   },
      // });
      
      // Mock response for development
      const mockScenarios: Scenario[] = [
        {
          id: 'scenario-1',
          name: 'GPS Drift Test',
          description: 'Test GPS drift simulation',
          target_ids: [1],
          steps: [
            {
              id: 'step-1',
              name: 'Initialize GPS',
              action: {
                ...scenarioActions.find(a => a.id === 'gps_drift')!,
                parameters: {
                  start_latitude: 37.7749,
                  start_longitude: -122.4194,
                  drift_pattern: 'random',
                  drift_speed: 'medium',
                  duration_seconds: 60
                }
              },
              order: 1
            },
            {
              id: 'step-2',
              name: 'Take Screenshot',
              action: {
                ...scenarioActions.find(a => a.id === 'take_screenshot')!,
                parameters: {
                  save_path: '/screenshots/',
                  filename_prefix: 'gps_drift_'
                }
              },
              order: 2,
              delay_before_ms: 30000
            }
          ],
          created_at: '2023-08-15T10:30:00Z',
          updated_at: '2023-08-15T10:30:00Z',
          created_by: 1
        },
        {
          id: 'scenario-2',
          name: 'Battery Drain Test',
          description: 'Test battery consumption under load',
          target_ids: [1, 2],
          steps: [
            {
              id: 'step-1',
              name: 'Set Battery Level',
              action: {
                ...scenarioActions.find(a => a.id === 'battery_event')!,
                parameters: {
                  event_type: 'discharging',
                  target_level: 80,
                  transition_time_seconds: 10
                }
              },
              order: 1
            },
            {
              id: 'step-2',
              name: 'Run Performance Test',
              action: {
                ...scenarioActions.find(a => a.id === 'run_test')!,
                parameters: {
                  test_profile_id: 'performance'
                }
              },
              order: 2,
              delay_before_ms: 5000
            },
            {
              id: 'step-3',
              name: 'Check Battery Level',
              action: {
                ...scenarioActions.find(a => a.id === 'run_adb_command')!,
                parameters: {
                  command: 'shell dumpsys battery'
                }
              },
              order: 3,
              delay_before_ms: 60000
            }
          ],
          created_at: '2023-08-16T14:45:00Z',
          updated_at: '2023-08-16T15:20:00Z',
          created_by: 1
        }
      ];
      
      setSavedScenarios(mockScenarios);
    } catch (err) {
      console.error('Error fetching scenarios:', err);
      setError('Failed to fetch scenarios');
    }
  }, [authToken, scenarioActions]);

  // Initialize data
  useEffect(() => {
    fetchTargets();
    fetchScenarios();
  }, [fetchTargets, fetchScenarios]);

  // Handle target selection
  const handleTargetSelect = (targetId: number) => {
    setSelectedTargets(prev => {
      if (prev.includes(targetId)) {
        return prev.filter(id => id !== targetId);
      } else {
        return [...prev, targetId];
      }
    });
    
    setCurrentScenario(prev => ({
      ...prev,
      target_ids: prev.target_ids.includes(targetId)
        ? prev.target_ids.filter(id => id !== targetId)
        : [...prev.target_ids, targetId]
    }));
  };

  // Add a new step to the scenario
  const handleAddStep = (actionId: string) => {
    const action = scenarioActions.find(a => a.id === actionId);
    
    if (!action) return;
    
    const newStep: ScenarioStep = {
      id: `step-${Date.now()}`,
      name: action.name,
      action: { ...action },
      order: currentScenario.steps.length + 1
    };
    
    setCurrentScenario(prev => ({
      ...prev,
      steps: [...prev.steps, newStep],
      updated_at: new Date().toISOString()
    }));
    
    // Set this step as the one being edited
    setEditingStepIndex(currentScenario.steps.length);
  };

  // Update a step in the scenario
  const handleUpdateStep = (index: number, updatedStep: Partial<ScenarioStep>) => {
    setCurrentScenario(prev => {
      const newSteps = [...prev.steps];
      newSteps[index] = { ...newSteps[index], ...updatedStep };
      
      return {
        ...prev,
        steps: newSteps,
        updated_at: new Date().toISOString()
      };
    });
  };

  // Remove a step from the scenario
  const handleRemoveStep = (index: number) => {
    setCurrentScenario(prev => {
      const newSteps = prev.steps.filter((_, i) => i !== index);
      
      // Update order of remaining steps
      newSteps.forEach((step, i) => {
        step.order = i + 1;
      });
      
      return {
        ...prev,
        steps: newSteps,
        updated_at: new Date().toISOString()
      };
    });
    
    // If we were editing this step, clear the editing state
    if (editingStepIndex === index) {
      setEditingStepIndex(null);
    } else if (editingStepIndex !== null && editingStepIndex > index) {
      // If we were editing a step after this one, adjust the index
      setEditingStepIndex(editingStepIndex - 1);
    }
  };

  // Move a step up or down in the scenario
  const handleMoveStep = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === currentScenario.steps.length - 1)
    ) {
      return;
    }
    
    setCurrentScenario(prev => {
      const newSteps = [...prev.steps];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      
      // Swap steps
      [newSteps[index], newSteps[targetIndex]] = [newSteps[targetIndex], newSteps[index]];
      
      // Update order
      newSteps.forEach((step, i) => {
        step.order = i + 1;
      });
      
      return {
        ...prev,
        steps: newSteps,
        updated_at: new Date().toISOString()
      };
    });
    
    // Update editing index if needed
    if (editingStepIndex === index) {
      setEditingStepIndex(direction === 'up' ? index - 1 : index + 1);
    } else if (editingStepIndex === (direction === 'up' ? index - 1 : index + 1)) {
      setEditingStepIndex(index);
    }
  };

  // Save the current scenario
  const handleSaveScenario = async () => {
    try {
      // Validate scenario
      if (!currentScenario.name) {
        toast({
          title: "Validation Error",
          description: "Scenario name is required",
          status: "error",
          duration: 3000,
          isClosable: true,
        });
        return;
      }
      
      if (currentScenario.target_ids.length === 0) {
        toast({
          title: "Validation Error",
          description: "At least one target device must be selected",
          status: "error",
          duration: 3000,
          isClosable: true,
        });
        return;
      }
      
      if (currentScenario.steps.length === 0) {
        toast({
          title: "Validation Error",
          description: "At least one step must be added to the scenario",
          status: "error",
          duration: 3000,
          isClosable: true,
        });
        return;
      }
      
      // In a real implementation, this would be an API call
      // const response = await axios.post(
      //   `${process.env.REACT_APP_API_URL}/api/scenarios`,
      //   currentScenario,
      //   {
      //     headers: {
      //       Authorization: `Bearer ${authToken}`,
      //       'Content-Type': 'application/json',
      //     },
      //   }
      // );
      
      // Mock response for development
      const savedScenario = {
        ...currentScenario,
        updated_at: new Date().toISOString()
      };
      
      // Update saved scenarios
      setSavedScenarios(prev => {
        const existingIndex = prev.findIndex(s => s.id === savedScenario.id);
        
        if (existingIndex >= 0) {
          // Update existing scenario
          const newScenarios = [...prev];
          newScenarios[existingIndex] = savedScenario;
          return newScenarios;
        } else {
          // Add new scenario
          return [...prev, savedScenario];
        }
      });
      
      toast({
        title: "Scenario Saved",
        description: "Your scenario has been saved successfully",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    } catch (err) {
      console.error('Error saving scenario:', err);
      
      toast({
        title: "Error",
        description: "Failed to save scenario",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  };

  // Load a saved scenario
  const handleLoadScenario = (scenarioId: string) => {
    const scenario = savedScenarios.find(s => s.id === scenarioId);
    
    if (!scenario) return;
    
    setCurrentScenario(scenario);
    setSelectedTargets(scenario.target_ids);
    setEditingStepIndex(null);
    
    toast({
      title: "Scenario Loaded",
      description: `Loaded scenario: ${scenario.name}`,
      status: "info",
      duration: 3000,
      isClosable: true,
    });
  };

  // Create a new scenario
  const handleNewScenario = () => {
    setCurrentScenario({
      id: `scenario-${Date.now()}`,
      name: 'New Scenario',
      description: '',
      target_ids: [],
      steps: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: 1 // Placeholder user ID
    });
    
    setSelectedTargets([]);
    setEditingStepIndex(null);
  };

  // Preview the scenario execution
  const handlePreviewScenario = () => {
    // Generate preview output
    let preview = `# Scenario Preview: ${currentScenario.name}\n\n`;
    
    if (currentScenario.description) {
      preview += `Description: ${currentScenario.description}\n\n`;
    }
    
    preview += `Target Devices:\n`;
    currentScenario.target_ids.forEach(targetId => {
      const target = targets.find(t => t.id === targetId);
      if (target) {
        preview += `- ${target.name} (${target.manufacturer} ${target.model}, Android ${target.android_version})\n`;
      }
    });
    
    preview += `\nExecution Steps:\n`;
    currentScenario.steps.forEach((step, index) => {
      preview += `${index + 1}. ${step.name}\n`;
      preview += `   Action: ${step.action.description}\n`;
      
      if (step.delay_before_ms) {
        preview += `   Delay: ${step.delay_before_ms / 1000} seconds\n`;
      }
      
      preview += `   Parameters:\n`;
      Object.entries(step.action.parameters).forEach(([key, value]) => {
        preview += `     - ${key}: ${value}\n`;
      });
      
      preview += `\n`;
    });
    
    preview += `Estimated execution time: ${estimateExecutionTime(currentScenario)} seconds\n`;
    
    setPreviewOutput(preview);
    onPreviewOpen();
  };

  // Estimate execution time for a scenario
  const estimateExecutionTime = (scenario: Scenario): number => {
    let totalTime = 0;
    
    scenario.steps.forEach(step => {
      // Add delay before step
      if (step.delay_before_ms) {
        totalTime += step.delay_before_ms / 1000;
      }
      
      // Add time for action execution
      switch (step.action.id) {
        case 'gps_drift':
          totalTime += step.action.parameters.duration_seconds || 60;
          break;
        case 'battery_event':
          totalTime += step.action.parameters.transition_time_seconds || 300;
          break;
        case 'wait':
          totalTime += step.action.parameters.duration_seconds || 10;
          break;
        case 'device_reboot':
          totalTime += step.action.parameters.timeout_seconds || 120;
          break;
        case 'reset_to_factory':
          totalTime += step.action.parameters.timeout_seconds || 300;
          break;
        case 'run_test':
          const testProfileId = step.action.parameters.test_profile_id;
          const testProfile = testProfiles.find(p => p.id === testProfileId);
          
          if (testProfile) {
            if (testProfile.parameters.duration_seconds) {
              totalTime += testProfile.parameters.duration_seconds;
            } else if (testProfile.parameters.duration_minutes) {
              totalTime += testProfile.parameters.duration_minutes * 60;
            } else {
              totalTime += 60; // Default 1 minute
            }
          } else {
            totalTime += 60; // Default 1 minute
          }
          break;
        default:
          totalTime += 5; // Default 5 seconds for other actions
      }
    });
    
    return totalTime;
  };

  // Execute the scenario
  const handleExecuteScenario = async () => {
    try {
      // Validate scenario
      if (currentScenario.target_ids.length === 0) {
        toast({
          title: "Validation Error",
          description: "At least one target device must be selected",
          status: "error",
          duration: 3000,
          isClosable: true,
        });
        return;
      }
      
      if (currentScenario.steps.length === 0) {
        toast({
          title: "Validation Error",
          description: "At least one step must be added to the scenario",
          status: "error",
          duration: 3000,
          isClosable: true,
        });
        return;
      }
      
      setIsExecuting(true);
      setStatusUpdates([`Starting execution of scenario: ${currentScenario.name}`]);
      
      // Create execution record
      const executionId = `exec-${Date.now()}`;
      const newExecution: ScenarioExecution = {
        id: executionId,
        scenario_id: currentScenario.id,
        status: 'running',
        start_time: new Date().toISOString(),
        results: {},
        logs: [`Starting execution of scenario: ${currentScenario.name}`]
      };
      
      setActiveExecution(newExecution);
      
      // In a real implementation, this would be an API call
      // const response = await axios.post(
      //   `${process.env.REACT_APP_API_URL}/api/scenarios/execute`,
      //   {
      //     scenario_id: currentScenario.id,
      //     target_ids: currentScenario.target_ids
      //   },
      //   {
      //     headers: {
      //       Authorization: `Bearer ${authToken}`,
      //       'Content-Type': 'application/json',
      //     },
      //   }
      // );
      
      // Simulate execution
      for (let i = 0; i < currentScenario.steps.length; i++) {
        const step = currentScenario.steps[i];
        
        // Add status update
        const stepStartMsg = `Executing step ${i + 1}: ${step.name}`;
        setStatusUpdates(prev => [...prev, stepStartMsg]);
        setActiveExecution(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            logs: [...prev.logs, stepStartMsg]
          };
        });
        
        // Simulate delay before step if specified
        if (step.delay_before_ms && step.delay_before_ms > 0) {
          const delayMsg = `Waiting for ${step.delay_before_ms / 1000} seconds before executing step`;
          setStatusUpdates(prev => [...prev, delayMsg]);
          setActiveExecution(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              logs: [...prev.logs, delayMsg]
            };
          });
          
          // Simulate delay
          await new Promise(resolve => setTimeout(resolve, Math.min(step.delay_before_ms!, 2000)));
        }
        
        // Simulate step execution
        const executionTime = Math.floor(Math.random() * 2000) + 500; // Random time between 0.5 and 2.5 seconds
        await new Promise(resolve => setTimeout(resolve, executionTime));
        
        // Add result
        const stepCompleteMsg = `Completed step ${i + 1}: ${step.name}`;
        setStatusUpdates(prev => [...prev, stepCompleteMsg]);
        setActiveExecution(prev => {
          if (!prev) return prev;
          
          // Add step result to execution results
          const updatedResults = { ...prev.results };
          updatedResults[step.id] = {
            status: 'completed',
            execution_time_ms: executionTime,
            output: `Simulated output for ${step.action.name}`
          };
          
          return {
            ...prev,
            logs: [...prev.logs, stepCompleteMsg],
            results: updatedResults
          };
        });
      }
      
      // Mark execution as completed
      const completionMsg = `Scenario execution completed successfully`;
      setStatusUpdates(prev => [...prev, completionMsg]);
      setActiveExecution(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          status: 'completed',
          end_time: new Date().toISOString(),
          logs: [...prev.logs, completionMsg]
        };
      });
      
      // Add to execution history
      setExecutionHistory(prev => {
        if (!activeExecution) return prev;
        return [
          {
            ...activeExecution,
            status: 'completed',
            end_time: new Date().toISOString()
          },
          ...prev
        ];
      });
      
      toast({
        title: "Execution Complete",
        description: "Scenario executed successfully",
        status: "success",
        duration: 5000,
        isClosable: true,
      });
    } catch (err) {
      console.error('Error executing scenario:', err);
      
      // Mark execution as failed
      const errorMsg = `Error executing scenario: ${err instanceof Error ? err.message : 'Unknown error'}`;
      setStatusUpdates(prev => [...prev, errorMsg]);
      setActiveExecution(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          status: 'failed',
          end_time: new Date().toISOString(),
          logs: [...prev.logs, errorMsg]
        };
      });
      
      // Add to execution history
      setExecutionHistory(prev => {
        if (!activeExecution) return prev;
        return [
          {
            ...activeExecution,
            status: 'failed',
            end_time: new Date().toISOString()
          },
          ...prev
        ];
      });
      
      toast({
        title: "Execution Failed",
        description: err instanceof Error ? err.message : 'An error occurred during execution',
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsExecuting(false);
    }
  };

  // Render the component
  return (
    <Box p={4}>
      <Flex justifyContent="space-between" alignItems="center" mb={4}>
        <Heading size="lg">Scenario Composer</Heading>
        <HStack spacing={2}>
          <Button
            leftIcon={<AddIcon />}
            colorScheme="blue"
            onClick={handleNewScenario}
          >
            New Scenario
          </Button>
          <Button
            leftIcon={<ViewIcon />}
            onClick={handlePreviewScenario}
            isDisabled={currentScenario.steps.length === 0}
          >
            Preview
          </Button>
          <Button
            leftIcon={<CheckIcon />}
            colorScheme="green"
            onClick={handleSaveScenario}
            isDisabled={currentScenario.steps.length === 0}
          >
            Save
          </Button>
          <Button
            leftIcon={<RepeatIcon />}
            colorScheme="purple"
            onClick={handleExecuteScenario}
            isLoading={isExecuting}
            isDisabled={currentScenario.steps.length === 0 || isExecuting}
          >
            Execute
          </Button>
        </HStack>
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
      
      <Grid templateColumns={{ base: "1fr", lg: "3fr 2fr" }} gap={6}>
        <GridItem>
          <Box borderWidth="1px" borderRadius="lg" p={4} borderColor={borderColor} mb={6}>
            <Heading size="md" mb={4}>Scenario Details</Heading>
            <FormControl mb={4}>
              <FormLabel>Scenario Name</FormLabel>
              <Input 
                value={currentScenario.name}
                onChange={(e) => setCurrentScenario(prev => ({
                  ...prev,
                  name: e.target.value,
                  updated_at: new Date().toISOString()
                }))}
                placeholder="Enter scenario name"
              />
            </FormControl>
            
            <FormControl mb={4}>
              <FormLabel>Description</FormLabel>
              <Textarea 
                value={currentScenario.description}
                onChange={(e) => setCurrentScenario(prev => ({
                  ...prev,
                  description: e.target.value,
                  updated_at: new Date().toISOString()
                }))}
                placeholder="Enter scenario description"
                rows={3}
              />
            </FormControl>
            
            <FormControl mb={4}>
              <FormLabel>Target Devices</FormLabel>
              <Box borderWidth="1px" borderRadius="md" p={3} borderColor={borderColor}>
                {targets.length === 0 ? (
                  <Text color="gray.500">No devices available</Text>
                ) : (
                  <Stack spacing={2}>
                    {targets.map(target => (
                      <Checkbox
                        key={target.id}
                        isChecked={selectedTargets.includes(target.id)}
                        onChange={() => handleTargetSelect(target.id)}
                        isDisabled={target.status !== 'available' && target.status !== 'reserved'}
                      >
                        <HStack spacing={2} align="center">
                          <Text>{target.name}</Text>
                          <Badge colorScheme={
                            target.status === 'available' ? 'green' :
                            target.status === 'reserved' ? 'blue' :
                            target.status === 'offline' ? 'red' :
                            target.status === 'maintenance' ? 'orange' : 'gray'
                          }>
                            {target.status}
                          </Badge>
                          <Text fontSize="xs" color="gray.500">
                            {target.manufacturer} {target.model} (Android {target.android_version})
                          </Text>
                        </HStack>
                      </Checkbox>
                    ))}
                  </Stack>
                )}
              </Box>
              <FormHelperText>Select one or more target devices for this scenario</FormHelperText>
            </FormControl>
          </Box>
          
          <Box borderWidth="1px" borderRadius="lg" p={4} borderColor={borderColor}>
            <Flex justifyContent="space-between" alignItems="center" mb={4}>
              <Heading size="md">Scenario Steps</Heading>
              <Menu>
                <MenuButton as={Button} rightIcon={<ChevronRightIcon />} colorScheme="blue" size="sm">
                  Add Step
                </MenuButton>
                <MenuList maxH="400px" overflowY="auto">
                  <Box p={2}>
                    <Text fontWeight="bold" mb={2}>Simulations</Text>
                    {scenarioActions.filter(a => a.type === 'simulation').map(action => (
                      <MenuItem key={action.id} onClick={() => handleAddStep(action.id)}>
                        {action.name}
                      </MenuItem>
                    ))}
                  </Box>
                  <Divider />
                  <Box p={2}>
                    <Text fontWeight="bold" mb={2}>Actions</Text>
                    {scenarioActions.filter(a => a.type === 'action').map(action => (
                      <MenuItem key={action.id} onClick={() => handleAddStep(action.id)}>
                        {action.name}
                      </MenuItem>
                    ))}
                  </Box>
                  <Divider />
                  <Box p={2}>
                    <Text fontWeight="bold" mb={2}>Tests</Text>
                    {scenarioActions.filter(a => a.type === 'test').map(action => (
                      <MenuItem key={action.id} onClick={() => handleAddStep(action.id)}>
                        {action.name}
                      </MenuItem>
                    ))}
                  </Box>
                </MenuList>
              </Menu>
            </Flex>
            
            {currentScenario.steps.length === 0 ? (
              <Box textAlign="center" py={8} bg="gray.50" borderRadius="md">
                <Text color="gray.500">No steps added yet. Click "Add Step" to begin building your scenario.</Text>
              </Box>
            ) : (
              <Box>
                {currentScenario.steps.map((step, index) => (
                  <Box 
                    key={step.id}
                    borderWidth="1px"
                    borderRadius="md"
                    p={3}
                    mb={3}
                    borderColor={editingStepIndex === index ? accentColor : borderColor}
                    bg={editingStepIndex === index ? useColorModeValue('blue.50', 'blue.900') : 'transparent'}
                  >
                    <Flex justifyContent="space-between" alignItems="center" mb={2}>
                      <HStack>
                        <Badge colorScheme={
                          step.action.type === 'simulation' ? 'purple' :
                          step.action.type === 'test' ? 'green' : 'blue'
                        }>
                          {step.action.type}
                        </Badge>
                        <Text fontWeight="bold">{index + 1}. {step.name}</Text>
                      </HStack>
                      
                      <HStack spacing={1}>
                        <IconButton
                          aria-label="Move step up"
                          icon={<ChevronRightIcon transform="rotate(-90deg)" />}
                          size="xs"
                          variant="ghost"
                          isDisabled={index === 0}
                          onClick={() => handleMoveStep(index, 'up')}
                        />
                        <IconButton
                          aria-label="Move step down"
                          icon={<ChevronRightIcon transform="rotate(90deg)" />}
                          size="xs"
                          variant="ghost"
                          isDisabled={index === currentScenario.steps.length - 1}
                          onClick={() => handleMoveStep(index, 'down')}
                        />
                        <IconButton
                          aria-label="Edit step"
                          icon={<EditIcon />}
                          size="xs"
                          variant="ghost"
                          onClick={() => setEditingStepIndex(editingStepIndex === index ? null : index)}
                        />
                        <IconButton
                          aria-label="Remove step"
                          icon={<DeleteIcon />}
                          size="xs"
                          variant="ghost"
                          colorScheme="red"
                          onClick={() => handleRemoveStep(index)}
                        />
                      </HStack>
                    </Flex>
                    
                    <Text fontSize="sm" color="gray.600" mb={2}>{step.action.description}</Text>
                    
                    {editingStepIndex === index && (
                      <Box mt={3} bg={useColorModeValue('gray.50', 'gray.700')} p={3} borderRadius="md">
                        <FormControl mb={3}>
                          <FormLabel fontSize="sm">Step Name</FormLabel>
                          <Input 
                            size="sm"
                            value={step.name}
                            onChange={(e) => handleUpdateStep(index, { name: e.target.value })}
                          />
                        </FormControl>
                        
                        <FormControl mb={3}>
                          <FormLabel fontSize="sm">Delay Before Execution (ms)</FormLabel>
                          <NumberInput
                            size="sm"
                            min={0}
                            step={1000}
                            value={step.delay_before_ms || 0}
                            onChange={(_, value) => handleUpdateStep(index, { delay_before_ms: value })}
                          >
                            <NumberInputField />
                            <NumberInputStepper>
                              <NumberIncrementStepper />
                              <NumberDecrementStepper />
                            </NumberInputStepper>
                          </NumberInput>
                          <FormHelperText>Delay in milliseconds before executing this step</FormHelperText>
                        </FormControl>
                        
                        <Divider my={3} />
                        
                        <Text fontWeight="bold" mb={2} fontSize="sm">Parameters</Text>
                        
                        {Object.entries(step.action.parameters).map(([key, value]) => {
                          // Render different input types based on parameter type
                          if (typeof value === 'boolean') {
                            return (
                              <FormControl key={key} mb={2}>
                                <FormLabel fontSize="sm">{key.replace(/_/g, ' ')}</FormLabel>
                                <Switch
                                  isChecked={value}
                                  onChange={(e) => {
                                    const updatedStep = { ...step };
                                    updatedStep.action.parameters[key] = e.target.checked;
                                    handleUpdateStep(index, updatedStep);
                                  }}
                                />
                              </FormControl>
                            );
                          } else if (typeof value === 'number') {
                            return (
                              <FormControl key={key} mb={2}>
                                <FormLabel fontSize="sm">{key.replace(/_/g, ' ')}</FormLabel>
                                <NumberInput
                                  size="sm"
                                  value={value}
                                  onChange={(_, val) => {
                                    const updatedStep = { ...step };
                                    updatedStep.action.parameters[key] = val;
                                    handleUpdateStep(index, updatedStep);
                                  }}
                                >
                                  <NumberInputField />
                                  <NumberInputStepper>
                                    <NumberIncrementStepper />
                                    <NumberDecrementStepper />
                                  </NumberInputStepper>
                                </NumberInput>
                              </FormControl>
                            );
                          } else if (key === 'test_profile_id') {
                            return (
                              <FormControl key={key} mb={2}>
                                <FormLabel fontSize="sm">Test Profile</FormLabel>
                                <Select
                                  size="sm"
                                  value={value}
                                  onChange={(e) => {
                                    const updatedStep = { ...step };
                                    updatedStep.action.parameters[key] = e.target.value;
                                    handleUpdateStep(index, updatedStep);
                                  }}
                                >
                                  {testProfiles.map(profile => (
                                    <option key={profile.id} value={profile.id}>
                                      {profile.name}
                                    </option>
                                  ))}
                                </Select>
                              </FormControl>
                            );
                          } else if (
                            key === 'drift_pattern' || 
                            key === 'drift_speed' || 
                            key === 'event_type' || 
                            key === 'network_type' || 
                            key === 'signal_strength' || 
                            key === 'orientation' || 
                            key === 'rotation_speed'
                          ) {
                            // Render select for enum-like values
                            let options: string[] = [];
                            
                            switch (key) {
                              case 'drift_pattern':
                                options = ['random', 'linear', 'circular'];
                                break;
                              case 'drift_speed':
                              case 'rotation_speed':
                              case 'signal_strength':
                                options = ['slow', 'medium', 'fast'];
                                break;
                              case 'event_type':
                                options = ['charging', 'discharging', 'low_battery'];
                                break;
                              case 'network_type':
                                options = ['2g', '3g', '4g', '5g', 'wifi'];
                                break;
                              case 'orientation':
                                options = ['portrait', 'landscape', 'reverse_portrait', 'reverse_landscape'];
                                break;
                              default:
                                options = [value as string];
                            }
                            
                            return (
                              <FormControl key={key} mb={2}>
                                <FormLabel fontSize="sm">{key.replace(/_/g, ' ')}</FormLabel>
                                <Select
                                  size="sm"
                                  value={value as string}
                                  onChange={(e) => {
                                    const updatedStep = { ...step };
                                    updatedStep.action.parameters[key] = e.target.value;
                                    handleUpdateStep(index, updatedStep);
                                  }}
                                >
                                  {options.map(option => (
                                    <option key={option} value={option}>
                                      {option.replace(/_/g, ' ')}
                                    </option>
                                  ))}
                                </Select>
                              </FormControl>
                            );
                          } else {
                            // Default to text input for other types
                            return (
                              <FormControl key={key} mb={2}>
                                <FormLabel fontSize="sm">{key.replace(/_/g, ' ')}</FormLabel>
                                <Input
                                  size="sm"
                                  value={value as string}
                                  onChange={(e) => {
                                    const updatedStep = { ...step };
                                    updatedStep.action.parameters[key] = e.target.value;
                                    handleUpdateStep(index, updatedStep);
                                  }}
                                />
                              </FormControl>
                            );
                          }
                        })}
                      </Box>
                    )}
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        </GridItem>
        
        <GridItem>
          <Tabs variant="enclosed" colorScheme="blue">
            <TabList>
              <Tab>Saved Scenarios</Tab>
              <Tab>Execution Status</Tab>
              <Tab>History</Tab>
            </TabList>
            
            <TabPanels>
              <TabPanel>
                <Box borderWidth="1px" borderRadius="md" borderColor={borderColor} overflow="hidden">
                  {savedScenarios.length === 0 ? (
                    <Box p={4} textAlign="center">
                      <Text color="gray.500">No saved scenarios yet</Text>
                    </Box>
                  ) : (
                    <Stack spacing={0} divider={<Divider />}>
                      {savedScenarios.map(scenario => (
                        <Box key={scenario.id} p={3} _hover={{ bg: useColorModeValue('gray.50', 'gray.700') }}>
                          <Flex justifyContent="space-between" alignItems="center">
                            <Box>
                              <Heading size="sm">{scenario.name}</Heading>
                              <Text fontSize="sm" color="gray.500">
                                {scenario.steps.length} steps • {scenario.target_ids.length} targets
                              </Text>
                              {scenario.description && (
                                <Text fontSize="sm" mt={1} noOfLines={1}>
                                  {scenario.description}
                                </Text>
                              )}
                            </Box>
                            <Button
                              size="sm"
                              onClick={() => handleLoadScenario(scenario.id)}
                            >
                              Load
                            </Button>
                          </Flex>
                        </Box>
                      ))}
                    </Stack>
                  )}
                </Box>
              </TabPanel>
              
              <TabPanel>
                <Box borderWidth="1px" borderRadius="md" borderColor={borderColor} p={4}>
                  <Heading size="sm" mb={3}>Execution Status</Heading>
                  
                  {isExecuting ? (
                    <Box mb={4}>
                      <Flex alignItems="center" mb={2}>
                        <Spinner size="sm" mr={2} />
                        <Text fontWeight="medium">Executing scenario: {currentScenario.name}</Text>
                      </Flex>
                      <Progress size="sm" isIndeterminate colorScheme="blue" />
                    </Box>
                  ) : activeExecution ? (
                    <Box mb={4}>
                      <Flex alignItems="center" mb={2}>
                        <Badge colorScheme={
                          activeExecution.status === 'completed' ? 'green' :
                          activeExecution.status === 'failed' ? 'red' :
                          'blue'
                        }>
                          {activeExecution.status}
                        </Badge>
                        <Text ml={2} fontWeight="medium">
                          {currentScenario.name}
                        </Text>
                      </Flex>
                      
                      {activeExecution.start_time && activeExecution.end_time && (
                        <Text fontSize="sm" color="gray.500" mb={2}>
                          Duration: {
                            Math.round(
                              (new Date(activeExecution.end_time).getTime() - 
                              new Date(activeExecution.start_time).getTime()) / 1000
                            )
                          } seconds
                        </Text>
                      )}
                    </Box>
                  ) : (
                    <Box mb={4} p={4} bg="gray.50" borderRadius="md" textAlign="center">
                      <Text color="gray.500">No active execution</Text>
                    </Box>
                  )}
                  
                  <Divider my={3} />
                  
                  <Heading size="sm" mb={3}>Status Updates</Heading>
                  <Box
                    borderWidth="1px"
                    borderRadius="md"
                    borderColor={borderColor}
                    p={2}
                    bg={useColorModeValue('gray.50', 'gray.700')}
                    maxH="300px"
                    overflowY="auto"
                    fontFamily="monospace"
                    fontSize="sm"
                  >
                    {statusUpdates.length === 0 ? (
                      <Text p={2} color="gray.500">No status updates</Text>
                    ) : (
                      statusUpdates.map((update, index) => (
                        <Text key={index} p={1}>{update}</Text>
                      ))
                    )}
                  </Box>
                </Box>
              </TabPanel>
              
              <TabPanel>
                <Box borderWidth="1px" borderRadius="md" borderColor={borderColor} overflow="hidden">
                  {executionHistory.length === 0 ? (
                    <Box p={4} textAlign="center">
                      <Text color="gray.500">No execution history</Text>
                    </Box>
                  ) : (
                    <Stack spacing={0} divider={<Divider />}>
                      {executionHistory.map(execution => {
                        const scenario = savedScenarios.find(s => s.id === execution.scenario_id);
                        
                        return (
                          <Box key={execution.id} p={3}>
                            <Flex justifyContent="space-between" alignItems="center">
                              <Box>
                                <Heading size="sm">
                                  {scenario?.name || 'Unknown Scenario'}
                                </Heading>
                                <Text fontSize="sm" color="gray.500">
                                  {execution.start_time ? new Date(execution.start_time).toLocaleString() : 'Unknown time'}
                                </Text>
                              </Box>
                              <Badge colorScheme={
                                execution.status === 'completed' ? 'green' :
                                execution.status === 'failed' ? 'red' :
                                execution.status === 'cancelled' ? 'orange' :
                                'blue'
                              }>
                                {execution.status}
                              </Badge>
                            </Flex>
                            
                            <Accordion allowToggle mt={2}>
                              <AccordionItem border="none">
                                <AccordionButton px={0} py={1} _hover={{ bg: 'transparent' }}>
                                  <Box flex="1" textAlign="left" fontSize="sm">
                                    View Logs
                                  </Box>
                                  <AccordionIcon />
                                </AccordionButton>
                                <AccordionPanel pb={4} px={0}>
                                  <Box
                                    borderWidth="1px"
                                    borderRadius="md"
                                    borderColor={borderColor}
                                    p={2}
                                    bg={useColorModeValue('gray.50', 'gray.700')}
                                    maxH="200px"
                                    overflowY="auto"
                                    fontFamily="monospace"
                                    fontSize="xs"
                                  >
                                    {execution.logs.map((log, index) => (
                                      <Text key={index} p={1}>{log}</Text>
                                    ))}
                                  </Box>
                                </AccordionPanel>
                              </AccordionItem>
                            </Accordion>
                          </Box>
                        );
                      })}
                    </Stack>
                  )}
                </Box>
              </TabPanel>
            </TabPanels>
          </Tabs>
        </GridItem>
      </Grid>
      
      {/* Preview Modal */}
      <Modal isOpen={isPreviewOpen} onClose={onPreviewClose} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Scenario Preview</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Box
              fontFamily="monospace"
              whiteSpace="pre-wrap"
              p={4}
              bg={useColorModeValue('gray.50', 'gray.700')}
              borderRadius="md"
              fontSize="sm"
            >
              {previewOutput}
            </Box>
          </ModalBody>
          <ModalFooter>
            <Button colorScheme="blue" mr={3} onClick={onPreviewClose}>
              Close
            </Button>
            <Button variant="ghost" onClick={handleExecuteScenario} isDisabled={isExecuting}>
              Execute
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default ScenarioComposer;

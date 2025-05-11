import React, { useState, useRef, useCallback, useEffect } from 'react';
import ReactFlow, {
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  addEdge,
  Node,
  Edge,
  Connection,
  useNodesState,
  useEdgesState,
  NodeTypes,
  EdgeTypes,
  Panel,
  MarkerType,
  OnConnectStartParams,
  useReactFlow,
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
  Box,
  Flex,
  Heading,
  Text,
  Button,
  IconButton,
  Drawer,
  DrawerBody,
  DrawerHeader,
  DrawerOverlay,
  DrawerContent,
  DrawerCloseButton,
  useDisclosure,
  FormControl,
  FormLabel,
  Input,
  Select,
  Badge,
  Divider,
  useToast,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  HStack,
  VStack,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Progress,
  useColorModeValue,
  Grid,
  GridItem
} from '@chakra-ui/react';
import {
  AddIcon,
  DeleteIcon,
  RepeatIcon,
  CloseIcon,
  ViewIcon,
  DownloadIcon,
  SearchIcon
} from '@chakra-ui/icons';

// Define types for our topology editor
type NodeType = 'physical' | 'virtual' | 'emulator' | 'gateway' | 'dummy';
type NodeStatus = 'online' | 'offline' | 'reserved' | 'error' | 'booting' | 'rebooting';
type DependencyType = 'start-before' | 'restart-after' | 'power-on-sequence';

interface NodeData {
  label: string;
  type: NodeType;
  status: NodeStatus;
  role?: string;
  metadata?: Record<string, any>;
  isGroup?: boolean;
  childNodes?: string[];
}

interface EdgeData {
  type: DependencyType;
  priority?: number;
  label?: string;
}

// Custom node component
const TargetNodeComponent = ({ data, selected }: { data: NodeData; selected: boolean }) => {
  // Status color mapping
  const statusColors = {
    online: 'green.500',
    offline: 'gray.500',
    reserved: 'blue.500',
    error: 'red.500',
    booting: 'yellow.500',
    rebooting: 'orange.500'
  };

  // Type icon mapping
  const typeIcons = {
    physical: '💻',
    virtual: '☁️',
    emulator: '📱',
    gateway: '🔌',
    dummy: '⚪'
  };

  // Always define all colors at the top level
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColorBase = useColorModeValue('gray.200', 'gray.600');
  const borderColor = selected ? 'blue.500' : borderColorBase;
  const groupBgColor = useColorModeValue('gray.50', 'gray.700');
  const statusColor = statusColors[data.status];
  
  // Render group node
  if (data.isGroup) {
    return (
      <Box
        p={2}
        borderWidth={2}
        borderStyle="dashed"
        borderColor={borderColor}
        borderRadius="md"
        bg={groupBgColor}
        minWidth="150px"
        minHeight="100px"
        position="relative"
        opacity={0.9}
      >
        <Flex justifyContent="space-between" alignItems="center" mb={2}>
          <Badge colorScheme="purple" fontSize="0.8em">Group</Badge>
          <Text fontSize="sm" fontWeight="bold">{data.label}</Text>
        </Flex>
        {data.role && (
          <Text fontSize="xs" color="gray.500" mb={1}>Role: {data.role}</Text>
        )}
        <Box position="absolute" bottom={1} right={1}>
          <Badge colorScheme="gray" fontSize="0.7em">
            {data.childNodes?.length || 0} nodes
          </Badge>
        </Box>
      </Box>
    );
  }
  
  // Render regular node
  return (
    <Box
      p={3}
      borderWidth={2}
      borderColor={borderColor}
      borderRadius="md"
      bg={bgColor}
      boxShadow="md"
      minWidth="120px"
      position="relative"
    >
      <Box position="absolute" top={-2} right={-2} borderRadius="full" bg={statusColor} w={4} h={4}></Box>
      <Flex justifyContent="space-between" alignItems="center">
        <Text fontSize="sm" fontWeight="bold">{data.label}</Text>
        <Text fontSize="lg">{typeIcons[data.type]}</Text>
      </Flex>
      <Divider my={2} />
      <Flex direction="column" gap={1}>
        <Badge colorScheme={
          data.type === 'physical' ? 'blue' :
          data.type === 'virtual' ? 'purple' :
          data.type === 'emulator' ? 'green' :
          data.type === 'gateway' ? 'orange' : 'gray'
        } fontSize="0.7em">
          {data.type}
        </Badge>
        {data.role && (
          <Text fontSize="xs" color="gray.500">Role: {data.role}</Text>
        )}
        <Badge colorScheme={
          data.status === 'online' ? 'green' :
          data.status === 'offline' ? 'gray' :
          data.status === 'reserved' ? 'blue' :
          data.status === 'error' ? 'red' :
          data.status === 'booting' ? 'yellow' : 'orange'
        } fontSize="0.7em" mt={1}>
          {data.status}
        </Badge>
      </Flex>
    </Box>
  );
};

// Custom edge component
const DependencyEdgeComponent = ({ data, selected }: { data: EdgeData; selected: boolean }) => {
  const edgeColor = 
    data.type === 'start-before' ? '#3182CE' :
    data.type === 'restart-after' ? '#DD6B20' :
    data.type === 'power-on-sequence' ? '#38A169' : '#718096';

  return (
    <>
      <path
        className="react-flow__edge-path"
        stroke={selected ? '#805AD5' : edgeColor}
        strokeWidth={selected ? 3 : 2}
      />
      {data.label && (
        <text
          className="react-flow__edge-text"
          style={{ fill: edgeColor, fontWeight: 500 }}
          textAnchor="middle"
          dominantBaseline="central"
          alignmentBaseline="central"
        >
          {data.label}
        </text>
      )}
    </>
  );
};

// Draggable target palette item
const DraggableTargetItem = ({ type, label, onDragStart }: { 
  type: NodeType; 
  label: string; 
  onDragStart: (event: React.DragEvent, nodeType: string) => void 
}) => {
  // Type icon mapping
  const typeIcons = {
    physical: '💻',
    virtual: '☁️',
    emulator: '📱',
    gateway: '🔌',
    dummy: '⚪'
  };

  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');

  return (
    <Box
      p={2}
      borderWidth={1}
      borderColor={borderColor}
      borderRadius="md"
      bg={bgColor}
      mb={2}
      cursor="grab"
      draggable
      onDragStart={(event) => onDragStart(event, type)}
      _hover={{ borderColor: 'blue.500' }}
    >
      <Flex alignItems="center">
        <Text fontSize="lg" mr={2}>{typeIcons[type]}</Text>
        <Text fontSize="sm">{label}</Text>
      </Flex>
    </Box>
  );
};

// Main component
const TopologyEditor: React.FC = () => {
  // Define all color mode values at the top level
  const sidebarBorderColor = useColorModeValue('gray.200', 'gray.700');
  const modalBorderColor = useColorModeValue('gray.200', 'gray.700');
  
  // Node types definition
  const nodeTypes: NodeTypes = {
    targetNode: TargetNodeComponent as any
  };

  // Edge types definition
  const edgeTypes: EdgeTypes = {
    dependencyEdge: DependencyEdgeComponent as any
  };

  // Mock data for target palette
  const targetPaletteItems = [
    { type: 'physical' as NodeType, label: 'Physical Target' },
    { type: 'virtual' as NodeType, label: 'Virtual Target' },
    { type: 'emulator' as NodeType, label: 'Emulator' },
    { type: 'gateway' as NodeType, label: 'Gateway' },
    { type: 'dummy' as NodeType, label: 'Dummy Node' }
  ];

  // State for nodes and edges
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  
  // State for selected elements
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
  
  // State for preview mode
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [previewStatus, setPreviewStatus] = useState({
    isRunning: false,
    currentStep: 0,
    totalSteps: 0,
    log: [] as string[]
  });
  
  // React Flow instance
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { project } = useReactFlow();
  
  // Chakra UI hooks
  const toast = useToast();
  const { isOpen: isPropertiesOpen, onOpen: onPropertiesOpen, onClose: onPropertiesClose } = useDisclosure();
  const { isOpen: isPreviewOpen, onOpen: onPreviewOpen, onClose: onPreviewClose } = useDisclosure();
  
  // Form state
  const [nodeForm, setNodeForm] = useState({
    label: '',
    type: 'physical' as NodeType,
    status: 'online' as NodeStatus,
    role: '',
    metadata: {} as Record<string, any>
  });
  
  const [edgeForm, setEdgeForm] = useState({
    type: 'start-before' as DependencyType,
    priority: 1,
    label: ''
  });
  
  // Handle node selection
  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
    setSelectedEdge(null);
    onPropertiesOpen();
  }, [onPropertiesOpen]);
  
  // Handle edge selection
  const onEdgeClick = useCallback((event: React.MouseEvent, edge: Edge) => {
    setSelectedEdge(edge);
    setSelectedNode(null);
    onPropertiesOpen();
  }, [onPropertiesOpen]);
  
  // Handle node form change
  const handleNodeFormChange = (field: string, value: any) => {
    setNodeForm({
      ...nodeForm,
      [field]: value
    });
  };
  
  // Handle edge form change
  const handleEdgeFormChange = (field: string, value: any) => {
    setEdgeForm({
      ...edgeForm,
      [field]: value
    });
  };
  
  // Update node properties
  const updateNodeProperties = () => {
    if (!selectedNode) return;
    
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === selectedNode.id) {
          return {
            ...node,
            data: {
              ...node.data,
              label: nodeForm.label,
              type: nodeForm.type,
              status: nodeForm.status,
              role: nodeForm.role,
              metadata: nodeForm.metadata
            }
          };
        }
        return node;
      })
    );
    
    toast({
      title: 'Node updated',
      status: 'success',
      duration: 2000,
      isClosable: true
    });
    
    onPropertiesClose();
  };
  
  // Update edge properties
  const updateEdgeProperties = () => {
    if (!selectedEdge) return;
    
    setEdges((eds) =>
      eds.map((edge) => {
        if (edge.id === selectedEdge.id) {
          return {
            ...edge,
            data: {
              ...edge.data,
              type: edgeForm.type,
              priority: edgeForm.priority,
              label: edgeForm.label || (edgeForm.type === 'power-on-sequence' ? edgeForm.priority.toString() : '')
            }
          };
        }
        return edge;
      })
    );
    
    toast({
      title: 'Edge updated',
      status: 'success',
      duration: 2000,
      isClosable: true
    });
    
    onPropertiesClose();
  };
  
  // Handle node drag start (from palette)
  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };
  
  // Handle drop on canvas
  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      
      if (!reactFlowWrapper.current) return;
      
      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
      const type = event.dataTransfer.getData('application/reactflow');
      
      // Check if the dropped element is valid
      if (!type) return;
      
      const position = project({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top
      });
      
      const newNode = {
        id: `node-${Date.now()}`,
        type: 'targetNode',
        position,
        data: {
          label: `New ${type.charAt(0).toUpperCase() + type.slice(1)}`,
          type: type as NodeType,
          status: 'offline' as NodeStatus,
          role: '',
          metadata: {}
        }
      };
      
      setNodes((nds) => nds.concat(newNode));
    },
    [project, setNodes]
  );
  
  // Handle drag over
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);
  
  // Handle connection
  const onConnect = useCallback(
    (params: Connection) => {
      // Create a new edge with default dependency type
      const newEdge = {
        ...params,
        type: 'dependencyEdge',
        data: {
          type: 'start-before' as DependencyType,
          label: 'Start Before'
        }
      };
      
      setEdges((eds) => addEdge(newEdge, eds));
    },
    [setEdges]
  );
  
  // Delete selected elements
  const deleteSelected = useCallback(() => {
    if (selectedNode) {
      setNodes((nds) => nds.filter((node) => node.id !== selectedNode.id));
      // Also delete connected edges
      setEdges((eds) =>
        eds.filter(
          (edge) => edge.source !== selectedNode.id && edge.target !== selectedNode.id
        )
      );
      setSelectedNode(null);
    }
    
    if (selectedEdge) {
      setEdges((eds) => eds.filter((edge) => edge.id !== selectedEdge.id));
      setSelectedEdge(null);
    }
    
    onPropertiesClose();
    
    toast({
      title: 'Element deleted',
      status: 'info',
      duration: 2000,
      isClosable: true
    });
  }, [selectedNode, selectedEdge, setNodes, setEdges, onPropertiesClose, toast]);
  
  // Start preview mode
  const startPreview = () => {
    if (nodes.length === 0) {
      toast({
        title: 'No nodes to preview',
        description: 'Add some nodes to the topology first',
        status: 'warning',
        duration: 3000,
        isClosable: true
      });
      return;
    }
    
    setIsPreviewMode(true);
    onPreviewOpen();
    
    // Reset preview status
    setPreviewStatus({
      isRunning: true,
      currentStep: 0,
      totalSteps: nodes.length,
      log: ['Starting topology preview...']
    });
    
    // Simulate preview steps
    setTimeout(() => {
      setPreviewStatus({
        isRunning: false,
        currentStep: nodes.length,
        totalSteps: nodes.length,
        log: ['Starting topology preview...', 'Preview completed']
      });
    }, 2000);
  };
  
  // Stop preview mode
  const stopPreview = () => {
    setIsPreviewMode(false);
    onPreviewClose();
  };
  
  // Initialize with some default nodes
  useEffect(() => {
    const initialNodes = [
      {
        id: 'node-1',
        type: 'targetNode',
        position: { x: 100, y: 100 },
        data: {
          label: 'Physical Target',
          type: 'physical' as NodeType,
          status: 'online' as NodeStatus,
          role: 'DUT',
          metadata: {}
        }
      },
      {
        id: 'node-2',
        type: 'targetNode',
        position: { x: 300, y: 100 },
        data: {
          label: 'Virtual Target',
          type: 'virtual' as NodeType,
          status: 'online' as NodeStatus,
          role: 'Sensor',
          metadata: {}
        }
      }
    ];
    
    const initialEdges = [
      {
        id: 'edge-1',
        source: 'node-1',
        target: 'node-2',
        type: 'dependencyEdge',
        data: {
          type: 'start-before' as DependencyType,
          label: 'Start Before'
        }
      }
    ];
    
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [setNodes, setEdges]);
  
  // Update forms when selection changes
  useEffect(() => {
    if (selectedNode) {
      setNodeForm({
        label: selectedNode.data.label,
        type: selectedNode.data.type,
        status: selectedNode.data.status,
        role: selectedNode.data.role || '',
        metadata: selectedNode.data.metadata || {}
      });
    }
    
    if (selectedEdge) {
      setEdgeForm({
        type: selectedEdge.data.type,
        priority: selectedEdge.data.priority || 1,
        label: selectedEdge.data.label || ''
      });
    }
  }, [selectedNode, selectedEdge]);
  
  return (
    <Box height="100%" width="100%">
      <Grid templateColumns="250px 1fr" height="100%">
        {/* Left sidebar - Target palette */}
        <GridItem borderRight="1px" borderColor={sidebarBorderColor} p={4} overflowY="auto">
          <VStack align="stretch" spacing={4}>
            <Heading size="md">Target Palette</Heading>
            <Text fontSize="sm" color="gray.500">Drag items to the canvas</Text>
            
            <Box>
              <Heading size="xs" mb={2}>Physical Targets</Heading>
              <DraggableTargetItem type="physical" label="Physical Target" onDragStart={onDragStart} />
              <DraggableTargetItem type="emulator" label="Emulator" onDragStart={onDragStart} />
            </Box>
            
            <Box>
              <Heading size="xs" mb={2}>Virtual Targets</Heading>
              <DraggableTargetItem type="virtual" label="Virtual Target" onDragStart={onDragStart} />
            </Box>
            
            <Box>
              <Heading size="xs" mb={2}>Other</Heading>
              <DraggableTargetItem type="gateway" label="Gateway" onDragStart={onDragStart} />
              <DraggableTargetItem type="dummy" label="Dummy Node" onDragStart={onDragStart} />
            </Box>
            
            <Divider />
            
            <Box>
              <Heading size="xs" mb={2}>Actions</Heading>
              <VStack align="stretch" spacing={2}>
                <Button size="sm" leftIcon={<ViewIcon />} onClick={startPreview} colorScheme="blue">
                  Preview
                </Button>
              </VStack>
            </Box>
          </VStack>
        </GridItem>
        
        {/* Main content - Flow canvas */}
        <GridItem position="relative">
          <Box position="absolute" top={0} right={0} left={0} bottom={0} ref={reactFlowWrapper}>
            <ReactFlowProvider>
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeClick={onNodeClick}
                onEdgeClick={onEdgeClick}
                onDrop={onDrop}
                onDragOver={onDragOver}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                fitView
                attributionPosition="bottom-right"
              >
                <Controls />
                <MiniMap />
                <Background />
                
                <Panel position="top-right">
                  <HStack spacing={2}>
                    <Button
                      size="sm"
                      leftIcon={<DeleteIcon />}
                      colorScheme="red"
                      variant="outline"
                      onClick={deleteSelected}
                      isDisabled={!selectedNode && !selectedEdge}
                    >
                      Delete Selected
                    </Button>
                  </HStack>
                </Panel>
              </ReactFlow>
            </ReactFlowProvider>
          </Box>
        </GridItem>
      </Grid>
      
      {/* Properties drawer */}
      <Drawer
        isOpen={isPropertiesOpen}
        placement="right"
        onClose={onPropertiesClose}
        size="md"
      >
        <DrawerOverlay />
        <DrawerContent>
          <DrawerCloseButton />
          <DrawerHeader>
            {selectedNode ? 'Node Properties' : selectedEdge ? 'Edge Properties' : 'Properties'}
          </DrawerHeader>
          
          <DrawerBody>
            {selectedNode && (
              <VStack align="stretch" spacing={4}>
                <FormControl>
                  <FormLabel>Label</FormLabel>
                  <Input
                    value={nodeForm.label}
                    onChange={(e) => handleNodeFormChange('label', e.target.value)}
                  />
                </FormControl>
                
                <FormControl>
                  <FormLabel>Type</FormLabel>
                  <Select
                    value={nodeForm.type}
                    onChange={(e) => handleNodeFormChange('type', e.target.value)}
                  >
                    <option value="physical">Physical</option>
                    <option value="virtual">Virtual</option>
                    <option value="emulator">Emulator</option>
                    <option value="gateway">Gateway</option>
                    <option value="dummy">Dummy</option>
                  </Select>
                </FormControl>
                
                <FormControl>
                  <FormLabel>Status</FormLabel>
                  <Select
                    value={nodeForm.status}
                    onChange={(e) => handleNodeFormChange('status', e.target.value)}
                  >
                    <option value="online">Online</option>
                    <option value="offline">Offline</option>
                    <option value="reserved">Reserved</option>
                    <option value="error">Error</option>
                    <option value="booting">Booting</option>
                    <option value="rebooting">Rebooting</option>
                  </Select>
                </FormControl>
                
                <FormControl>
                  <FormLabel>Role</FormLabel>
                  <Input
                    value={nodeForm.role}
                    onChange={(e) => handleNodeFormChange('role', e.target.value)}
                    placeholder="e.g., Sensor, ECU, Controller"
                  />
                </FormControl>
                
                <Button colorScheme="blue" onClick={updateNodeProperties}>
                  Update Node
                </Button>
              </VStack>
            )}
            
            {selectedEdge && (
              <VStack align="stretch" spacing={4}>
                <FormControl>
                  <FormLabel>Dependency Type</FormLabel>
                  <Select
                    value={edgeForm.type}
                    onChange={(e) => handleEdgeFormChange('type', e.target.value)}
                  >
                    <option value="start-before">Start Before</option>
                    <option value="restart-after">Restart After</option>
                    <option value="power-on-sequence">Power-on Sequence</option>
                  </Select>
                </FormControl>
                
                {edgeForm.type === 'power-on-sequence' && (
                  <FormControl>
                    <FormLabel>Priority</FormLabel>
                    <Input
                      type="number"
                      value={edgeForm.priority}
                      onChange={(e) => handleEdgeFormChange('priority', parseInt(e.target.value))}
                      min={1}
                    />
                  </FormControl>
                )}
                
                <FormControl>
                  <FormLabel>Label</FormLabel>
                  <Input
                    value={edgeForm.label}
                    onChange={(e) => handleEdgeFormChange('label', e.target.value)}
                    placeholder={edgeForm.type === 'power-on-sequence' ? edgeForm.priority.toString() : ''}
                  />
                </FormControl>
                
                <Button colorScheme="blue" onClick={updateEdgeProperties}>
                  Update Edge
                </Button>
              </VStack>
            )}
          </DrawerBody>
        </DrawerContent>
      </Drawer>
      
      {/* Preview modal */}
      <Modal isOpen={isPreviewOpen} onClose={stopPreview} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Topology Preview</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack align="stretch" spacing={4}>
              <Text>Simulating topology execution and dependencies...</Text>
              
              <Progress
                value={(previewStatus.currentStep / previewStatus.totalSteps) * 100}
                size="sm"
                colorScheme="blue"
                isIndeterminate={previewStatus.isRunning && previewStatus.currentStep === 0}
              />
              
              <Box
                border="1px"
                borderColor={modalBorderColor}
                borderRadius="md"
                p={2}
                maxHeight="300px"
                overflowY="auto"
                fontFamily="monospace"
                fontSize="sm"
              >
                {previewStatus.log.map((line, index) => (
                  <Text key={index}>{line}</Text>
                ))}
              </Box>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button colorScheme="blue" mr={3} onClick={stopPreview}>
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default TopologyEditor;

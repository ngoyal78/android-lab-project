import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Button, 
  Heading, 
  Table, 
  Thead, 
  Tbody, 
  Tr, 
  Th, 
  Td, 
  Badge, 
  Flex, 
  Input, 
  Select, 
  IconButton, 
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  FormControl,
  FormLabel,
  Tooltip,
  Text,
  HStack,
  VStack,
  useToast,
  Spinner,
  Tag,
  TagLabel,
  TagCloseButton,
  Wrap,
  WrapItem,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  StatGroup,
  Progress,
  Divider,
  useColorModeValue
} from '@chakra-ui/react';
import { 
  AddIcon, 
  ChevronDownIcon, 
  EditIcon, 
  DeleteIcon, 
  DownloadIcon, 
  RepeatIcon,
  LinkIcon,
  ExternalLinkIcon,
  WarningIcon,
  InfoIcon,
  CheckCircleIcon,
  TimeIcon
} from '@chakra-ui/icons';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

// Define types for Gateway data
interface Gateway {
  id: number;
  gateway_id: string;
  name: string;
  description?: string;
  gateway_type: 'STANDALONE' | 'CLUSTER' | 'EDGE';
  parent_gateway_id?: string;
  status: 'ONLINE' | 'OFFLINE' | 'MAINTENANCE' | 'DEGRADED';
  hostname?: string;
  ip_address?: string;
  location?: string;
  region?: string;
  environment?: string;
  max_targets?: number;
  current_targets: number;
  max_concurrent_sessions?: number;
  current_sessions?: number;
  cpu_usage?: number;
  memory_usage?: number;
  disk_usage?: number;
  health_check_score?: number;
  last_heartbeat?: string;
  tags?: string[];
  features?: string[];
  created_at: string;
  updated_at?: string;
  is_active: boolean;
}

interface GatewayStatistics {
  total_gateways: number;
  online_gateways: number;
  offline_gateways: number;
  maintenance_gateways: number;
  degraded_gateways: number;
  total_targets: number;
  connected_targets: number;
  total_sessions: number;
  gateway_types: Record<string, number>;
  regions: Record<string, number>;
  environments: Record<string, number>;
}

interface GatewayFormData {
  gateway_id: string;
  name: string;
  description?: string;
  gateway_type: string;
  parent_gateway_id?: string;
  hostname?: string;
  ip_address?: string;
  ssh_port?: number;
  api_port?: number;
  location?: string;
  region?: string;
  environment?: string;
  max_targets?: number;
  max_concurrent_sessions?: number;
  tags?: string[];
  features?: string[];
}

const GatewayList: React.FC = () => {
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [statistics, setStatistics] = useState<GatewayStatistics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [regionFilter, setRegionFilter] = useState<string>('');
  const [environmentFilter, setEnvironmentFilter] = useState<string>('');
  const [formData, setFormData] = useState<GatewayFormData>({
    gateway_id: '',
    name: '',
    gateway_type: 'STANDALONE'
  });
  const [selectedGateway, setSelectedGateway] = useState<Gateway | null>(null);
  const [newTag, setNewTag] = useState<string>('');
  const [newFeature, setNewFeature] = useState<string>('');
  const [availableParentGateways, setAvailableParentGateways] = useState<Gateway[]>([]);
  
  const { isOpen: isCreateOpen, onOpen: onCreateOpen, onClose: onCreateClose } = useDisclosure();
  const { isOpen: isEditOpen, onOpen: onEditOpen, onClose: onEditClose } = useDisclosure();
  const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useDisclosure();
  const { isOpen: isDeactivateOpen, onOpen: onDeactivateOpen, onClose: onDeactivateClose } = useDisclosure();
  
  const toast = useToast();
  const navigate = useNavigate();
  
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  
  // Fetch gateways and statistics
  const fetchGateways = async () => {
    setLoading(true);
    try {
      const [gatewaysResponse, statisticsResponse] = await Promise.all([
        axios.get('/api/gateways'),
        axios.get('/api/gateways/statistics')
      ]);
      
      setGateways(gatewaysResponse.data);
      setStatistics(statisticsResponse.data);
      
      // Get available parent gateways (standalone or cluster types)
      const parentGateways = gatewaysResponse.data.filter(
        (g: Gateway) => g.gateway_type !== 'EDGE' && g.is_active
      );
      setAvailableParentGateways(parentGateways);
      
    } catch (error) {
      console.error('Error fetching gateways:', error);
      toast({
        title: 'Error fetching gateways',
        description: 'Could not load gateway data. Please try again later.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    fetchGateways();
    
    // Set up refresh interval (every 30 seconds)
    const intervalId = setInterval(fetchGateways, 30000);
    
    // Clean up interval on component unmount
    return () => clearInterval(intervalId);
  }, []);
  
  // Filter gateways based on search and filters
  const filteredGateways = gateways.filter(gateway => {
    const matchesSearch = searchTerm === '' || 
      gateway.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      gateway.gateway_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (gateway.description && gateway.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (gateway.location && gateway.location.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === '' || gateway.status === statusFilter;
    const matchesType = typeFilter === '' || gateway.gateway_type === typeFilter;
    const matchesRegion = regionFilter === '' || gateway.region === regionFilter;
    const matchesEnvironment = environmentFilter === '' || gateway.environment === environmentFilter;
    
    return matchesSearch && matchesStatus && matchesType && matchesRegion && matchesEnvironment;
  });
  
  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };
  
  // Handle tag addition
  const handleAddTag = () => {
    if (newTag.trim() !== '') {
      setFormData({
        ...formData,
        tags: [...(formData.tags || []), newTag.trim()]
      });
      setNewTag('');
    }
  };
  
  // Handle tag removal
  const handleRemoveTag = (tagToRemove: string) => {
    setFormData({
      ...formData,
      tags: (formData.tags || []).filter(tag => tag !== tagToRemove)
    });
  };
  
  // Handle feature addition
  const handleAddFeature = () => {
    if (newFeature.trim() !== '') {
      setFormData({
        ...formData,
        features: [...(formData.features || []), newFeature.trim()]
      });
      setNewFeature('');
    }
  };
  
  // Handle feature removal
  const handleRemoveFeature = (featureToRemove: string) => {
    setFormData({
      ...formData,
      features: (formData.features || []).filter(feature => feature !== featureToRemove)
    });
  };
  
  // Create new gateway
  const handleCreateGateway = async () => {
    try {
      await axios.post('/api/gateways', formData);
      toast({
        title: 'Gateway created',
        description: `Gateway ${formData.name} has been created successfully.`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
      onCreateClose();
      fetchGateways();
      // Reset form data
      setFormData({
        gateway_id: '',
        name: '',
        gateway_type: 'STANDALONE'
      });
    } catch (error) {
      console.error('Error creating gateway:', error);
      toast({
        title: 'Error creating gateway',
        description: 'Could not create gateway. Please check your inputs and try again.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };
  
  // Update gateway
  const handleUpdateGateway = async () => {
    if (!selectedGateway) return;
    
    try {
      await axios.put(`/api/gateways/${selectedGateway.gateway_id}`, formData);
      toast({
        title: 'Gateway updated',
        description: `Gateway ${formData.name} has been updated successfully.`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
      onEditClose();
      fetchGateways();
    } catch (error) {
      console.error('Error updating gateway:', error);
      toast({
        title: 'Error updating gateway',
        description: 'Could not update gateway. Please check your inputs and try again.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };
  
  // Deactivate gateway
  const handleDeactivateGateway = async () => {
    if (!selectedGateway) return;
    
    try {
      await axios.post(`/api/gateways/${selectedGateway.gateway_id}/deactivate`, {
        reason: 'Manually deactivated by user'
      });
      toast({
        title: 'Gateway deactivated',
        description: `Gateway ${selectedGateway.name} has been deactivated.`,
        status: 'info',
        duration: 5000,
        isClosable: true,
      });
      onDeactivateClose();
      fetchGateways();
    } catch (error) {
      console.error('Error deactivating gateway:', error);
      toast({
        title: 'Error deactivating gateway',
        description: 'Could not deactivate gateway. Please try again later.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };
  
  // Delete gateway
  const handleDeleteGateway = async () => {
    if (!selectedGateway) return;
    
    try {
      await axios.delete(`/api/gateways/${selectedGateway.gateway_id}`);
      toast({
        title: 'Gateway deleted',
        description: `Gateway ${selectedGateway.name} has been permanently deleted.`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
      onDeleteClose();
      fetchGateways();
    } catch (error) {
      console.error('Error deleting gateway:', error);
      toast({
        title: 'Error deleting gateway',
        description: 'Could not delete gateway. It may have associated targets or child gateways.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };
  
  // Open edit modal with selected gateway data
  const openEditModal = (gateway: Gateway) => {
    setSelectedGateway(gateway);
    setFormData({
      gateway_id: gateway.gateway_id,
      name: gateway.name,
      description: gateway.description || '',
      gateway_type: gateway.gateway_type,
      parent_gateway_id: gateway.parent_gateway_id || '',
      hostname: gateway.hostname || '',
      ip_address: gateway.ip_address || '',
      location: gateway.location || '',
      region: gateway.region || '',
      environment: gateway.environment || '',
      max_targets: gateway.max_targets || undefined,
      max_concurrent_sessions: gateway.max_concurrent_sessions || undefined,
      tags: gateway.tags || [],
      features: gateway.features || []
    });
    onEditOpen();
  };
  
  // Open delete confirmation modal
  const openDeleteModal = (gateway: Gateway) => {
    setSelectedGateway(gateway);
    onDeleteOpen();
  };
  
  // Open deactivate confirmation modal
  const openDeactivateModal = (gateway: Gateway) => {
    setSelectedGateway(gateway);
    onDeactivateOpen();
  };
  
  // Navigate to gateway detail page
  const navigateToGatewayDetail = (gatewayId: string) => {
    navigate(`/gateways/${gatewayId}`);
  };
  
  // Get status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ONLINE':
        return 'green';
      case 'OFFLINE':
        return 'red';
      case 'MAINTENANCE':
        return 'orange';
      case 'DEGRADED':
        return 'yellow';
      default:
        return 'gray';
    }
  };
  
  // Get gateway type badge color
  const getTypeColor = (type: string) => {
    switch (type) {
      case 'STANDALONE':
        return 'blue';
      case 'CLUSTER':
        return 'purple';
      case 'EDGE':
        return 'teal';
      default:
        return 'gray';
    }
  };
  
  // Format date for display
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString();
  };
  
  // Calculate time since last heartbeat
  const getHeartbeatStatus = (lastHeartbeat?: string) => {
    if (!lastHeartbeat) return { text: 'Never', color: 'red' };
    
    const lastHeartbeatTime = new Date(lastHeartbeat).getTime();
    const now = new Date().getTime();
    const diffSeconds = Math.floor((now - lastHeartbeatTime) / 1000);
    
    if (diffSeconds < 30) {
      return { text: 'Just now', color: 'green' };
    } else if (diffSeconds < 60) {
      return { text: `${diffSeconds} seconds ago`, color: 'green' };
    } else if (diffSeconds < 300) { // 5 minutes
      const minutes = Math.floor(diffSeconds / 60);
      return { text: `${minutes} minute${minutes > 1 ? 's' : ''} ago`, color: 'green' };
    } else if (diffSeconds < 3600) { // 1 hour
      const minutes = Math.floor(diffSeconds / 60);
      return { text: `${minutes} minute${minutes > 1 ? 's' : ''} ago`, color: 'yellow' };
    } else if (diffSeconds < 86400) { // 1 day
      const hours = Math.floor(diffSeconds / 3600);
      return { text: `${hours} hour${hours > 1 ? 's' : ''} ago`, color: 'orange' };
    } else {
      const days = Math.floor(diffSeconds / 86400);
      return { text: `${days} day${days > 1 ? 's' : ''} ago`, color: 'red' };
    }
  };
  
  // Reset form data for new gateway
  const handleCreateModalOpen = () => {
    setFormData({
      gateway_id: '',
      name: '',
      gateway_type: 'STANDALONE'
    });
    onCreateOpen();
  };
  
  return (
    <Box p={4}>
      <Flex justifyContent="space-between" alignItems="center" mb={6}>
        <Heading size="lg">Gateway Management</Heading>
        <Button leftIcon={<AddIcon />} colorScheme="blue" onClick={handleCreateModalOpen}>
          Add Gateway
        </Button>
      </Flex>
      
      {/* Statistics Dashboard */}
      {statistics && (
        <Box mb={6} p={4} borderWidth="1px" borderRadius="lg" bg={bgColor} boxShadow="sm">
          <Heading size="md" mb={4}>Gateway Statistics</Heading>
          <StatGroup>
            <Stat>
              <StatLabel>Total Gateways</StatLabel>
              <StatNumber>{statistics.total_gateways}</StatNumber>
            </Stat>
            <Stat>
              <StatLabel>Online</StatLabel>
              <StatNumber>{statistics.online_gateways}</StatNumber>
              <StatHelpText>
                {statistics.total_gateways > 0 
                  ? `${Math.round((statistics.online_gateways / statistics.total_gateways) * 100)}%`
                  : '0%'}
              </StatHelpText>
            </Stat>
            <Stat>
              <StatLabel>Offline</StatLabel>
              <StatNumber>{statistics.offline_gateways}</StatNumber>
            </Stat>
            <Stat>
              <StatLabel>Maintenance</StatLabel>
              <StatNumber>{statistics.maintenance_gateways}</StatNumber>
            </Stat>
            <Stat>
              <StatLabel>Degraded</StatLabel>
              <StatNumber>{statistics.degraded_gateways}</StatNumber>
            </Stat>
          </StatGroup>
          
          <Divider my={4} />
          
          <StatGroup>
            <Stat>
              <StatLabel>Total Targets</StatLabel>
              <StatNumber>{statistics.total_targets}</StatNumber>
            </Stat>
            <Stat>
              <StatLabel>Connected Targets</StatLabel>
              <StatNumber>{statistics.connected_targets}</StatNumber>
              <StatHelpText>
                {statistics.total_targets > 0 
                  ? `${Math.round((statistics.connected_targets / statistics.total_targets) * 100)}%`
                  : '0%'}
              </StatHelpText>
            </Stat>
            <Stat>
              <StatLabel>Active Sessions</StatLabel>
              <StatNumber>{statistics.total_sessions}</StatNumber>
            </Stat>
          </StatGroup>
        </Box>
      )}
      
      {/* Filters */}
      <Flex mb={4} flexWrap="wrap" gap={2}>
        <Input
          placeholder="Search gateways..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          width={{ base: "100%", md: "300px" }}
          mr={2}
        />
        
        <Select
          placeholder="Filter by status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          width={{ base: "100%", md: "200px" }}
          mr={2}
        >
          <option value="">All Statuses</option>
          <option value="ONLINE">Online</option>
          <option value="OFFLINE">Offline</option>
          <option value="MAINTENANCE">Maintenance</option>
          <option value="DEGRADED">Degraded</option>
        </Select>
        
        <Select
          placeholder="Filter by type"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          width={{ base: "100%", md: "200px" }}
          mr={2}
        >
          <option value="">All Types</option>
          <option value="STANDALONE">Standalone</option>
          <option value="CLUSTER">Cluster</option>
          <option value="EDGE">Edge</option>
        </Select>
        
        <Select
          placeholder="Filter by region"
          value={regionFilter}
          onChange={(e) => setRegionFilter(e.target.value)}
          width={{ base: "100%", md: "200px" }}
          mr={2}
        >
          <option value="">All Regions</option>
          {statistics && Object.keys(statistics.regions).map(region => (
            <option key={region} value={region}>{region}</option>
          ))}
        </Select>
        
        <Select
          placeholder="Filter by environment"
          value={environmentFilter}
          onChange={(e) => setEnvironmentFilter(e.target.value)}
          width={{ base: "100%", md: "200px" }}
        >
          <option value="">All Environments</option>
          {statistics && Object.keys(statistics.environments).map(env => (
            <option key={env} value={env}>{env}</option>
          ))}
        </Select>
        
        <IconButton
          aria-label="Refresh"
          icon={<RepeatIcon />}
          onClick={fetchGateways}
          ml="auto"
        />
      </Flex>
      
      {/* Gateway Table */}
      {loading ? (
        <Flex justify="center" align="center" height="200px">
          <Spinner size="xl" />
        </Flex>
      ) : (
        <Box overflowX="auto">
          <Table variant="simple" size="sm">
            <Thead>
              <Tr>
                <Th>Name</Th>
                <Th>Gateway ID</Th>
                <Th>Type</Th>
                <Th>Status</Th>
                <Th>Health</Th>
                <Th>Last Heartbeat</Th>
                <Th>Targets</Th>
                <Th>Location</Th>
                <Th>Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {filteredGateways.length === 0 ? (
                <Tr>
                  <Td colSpan={9} textAlign="center">No gateways found</Td>
                </Tr>
              ) : (
                filteredGateways.map(gateway => (
                  <Tr 
                    key={gateway.id} 
                    _hover={{ bg: bgColor === 'white' ? 'gray.50' : 'gray.700' }}
                    cursor="pointer"
                    onClick={() => navigateToGatewayDetail(gateway.gateway_id)}
                  >
                    <Td fontWeight="medium">
                      {gateway.name}
                      {!gateway.is_active && (
                        <Badge ml={2} colorScheme="red">Inactive</Badge>
                      )}
                    </Td>
                    <Td>{gateway.gateway_id}</Td>
                    <Td>
                      <Badge colorScheme={getTypeColor(gateway.gateway_type)}>
                        {gateway.gateway_type}
                      </Badge>
                    </Td>
                    <Td>
                      <Badge colorScheme={getStatusColor(gateway.status)}>
                        {gateway.status}
                      </Badge>
                    </Td>
                    <Td>
                      {gateway.health_check_score !== undefined ? (
                        <Tooltip label={`Health score: ${gateway.health_check_score}/100`}>
                          <Box>
                            <Progress 
                              value={gateway.health_check_score} 
                              size="sm" 
                              colorScheme={
                                gateway.health_check_score > 80 ? "green" :
                                gateway.health_check_score > 50 ? "yellow" : "red"
                              }
                              borderRadius="full"
                            />
                          </Box>
                        </Tooltip>
                      ) : (
                        <Text fontSize="sm" color="gray.500">N/A</Text>
                      )}
                    </Td>
                    <Td>
                      {gateway.last_heartbeat ? (
                        <Tooltip label={formatDate(gateway.last_heartbeat)}>
                          <Badge colorScheme={getHeartbeatStatus(gateway.last_heartbeat).color}>
                            {getHeartbeatStatus(gateway.last_heartbeat).text}
                          </Badge>
                        </Tooltip>
                      ) : (
                        <Badge colorScheme="red">Never</Badge>
                      )}
                    </Td>
                    <Td>
                      {gateway.current_targets !== undefined ? (
                        <Text>
                          {gateway.current_targets}
                          {gateway.max_targets && ` / ${gateway.max_targets}`}
                        </Text>
                      ) : (
                        <Text fontSize="sm" color="gray.500">N/A</Text>
                      )}
                    </Td>
                    <Td>
                      {gateway.location || 'N/A'}
                      {gateway.region && ` (${gateway.region})`}
                    </Td>
                    <Td onClick={(e) => e.stopPropagation()}>
                      <Menu>
                        <MenuButton
                          as={IconButton}
                          aria-label="Options"
                          icon={<ChevronDownIcon />}
                          variant="outline"
                          size="sm"
                        />
                        <MenuList>
                          <MenuItem 
                            icon={<EditIcon />} 
                            onClick={() => openEditModal(gateway)}
                          >
                            Edit
                          </MenuItem>
                          <MenuItem 
                            icon={<LinkIcon />} 
                            onClick={() => navigate(`/gateways/${gateway.gateway_id}/targets`)}
                          >
                            View Targets
                          </MenuItem>
                          {gateway.is_active ? (
                            <MenuItem 
                              icon={<WarningIcon />} 
                              onClick={() => openDeactivateModal(gateway)}
                              color="orange.500"
                            >
                              Deactivate
                            </MenuItem>
                          ) : (
                            <MenuItem 
                              icon={<CheckCircleIcon />} 
                              onClick={() => {
                                // Reactivate gateway
                                axios.put(`/api/gateways/${gateway.gateway_id}`, { is_active: true })
                                  .then(() => {
                                    toast({
                                      title: 'Gateway reactivated',
                                      status: 'success',
                                      duration: 3000,
                                    });
                                    fetchGateways();
                                  })
                                  .catch(err => {
                                    console.error(err);
                                    toast({
                                      title: 'Failed to reactivate gateway',
                                      status: 'error',
                                      duration: 3000,
                                    });
                                  });
                              }}
                              color="green.500"
                            >
                              Reactivate
                            </MenuItem>
                          )}
                          <MenuItem 
                            icon={<DeleteIcon />} 
                            onClick={() => openDeleteModal(gateway)}
                            color="red.500"
                          >
                            Delete
                          </MenuItem>
                        </MenuList>
                      </Menu>
                    </Td>
                  </Tr>
                ))
              )}
            </Tbody>
          </Table>
        </Box>
      )}
      
      {/* Create Gateway Modal */}
      <Modal isOpen={isCreateOpen} onClose={onCreateClose} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Create New Gateway</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Tabs isFitted variant="enclosed">
              <TabList mb="1em">
                <Tab>Basic Info</Tab>
                <Tab>Network</Tab>
                <Tab>Configuration</Tab>
                <Tab>Tags & Features</Tab>
              </TabList>
              <TabPanels>
                <TabPanel>
                  <VStack spacing={4} align="stretch">
                    <FormControl isRequired>
                      <FormLabel>Gateway ID</FormLabel>
                      <Input 
                        name="gateway_id" 
                        value={formData.gateway_id} 
                        onChange={handleInputChange}
                        placeholder="Unique identifier (e.g., gateway-123)"
                      />
                    </FormControl>
                    
                    <FormControl isRequired>
                      <FormLabel>Name</FormLabel>
                      <Input 
                        name="name" 
                        value={formData.name} 
                        onChange={handleInputChange}
                        placeholder="Display name"
                      />
                    </FormControl>
                    
                    <FormControl>
                      <FormLabel>Description</FormLabel>
                      <Input 
                        name="description" 
                        value={formData.description || ''} 
                        onChange={handleInputChange}
                        placeholder="Optional description"
                      />
                    </FormControl>
                    
                    <FormControl isRequired>
                      <FormLabel>Gateway Type</FormLabel>
                      <Select 
                        name="gateway_type" 
                        value={formData.gateway_type} 
                        onChange={handleInputChange}
                      >
                        <option value="STANDALONE">Standalone</option>
                        <option value="CLUSTER">Cluster</option>
                        <option value="EDGE">Edge</option>
                      </Select>
                    </FormControl>
                    
                    {formData.gateway_type === 'EDGE' && (
                      <FormControl>
                        <FormLabel>Parent Gateway</FormLabel>
                        <Select 
                          name="parent_gateway_id" 
                          value={formData.parent_gateway_id || ''} 
                          onChange={handleInputChange}
                          placeholder="Select parent gateway"
                        >
                          {availableParentGateways.map(gateway => (
                            <option key={gateway.gateway_id} value={gateway.gateway_id}>
                              {gateway.name} ({gateway.gateway_id})
                            </option>
                          ))}
                        </Select>
                      </FormControl>
                    )}
                    
                    <FormControl>
                      <FormLabel>Location</FormLabel>
                      <Input 
                        name="location" 
                        value={formData.location || ''} 
                        onChange={handleInputChange}
                        placeholder="Physical location"
                      />
                    </FormControl>
                    
                    <FormControl>
                      <FormLabel>Region</FormLabel>
                      <Input 
                        name="region" 
                        value={formData.region || ''} 
                        onChange={handleInputChange}
                        placeholder="Region (e.g., us-west, eu-central)"
                      />
                    </FormControl>
                    
                    <FormControl>
                      <FormLabel>Environment</FormLabel>
                      <Input 
                        name="environment" 
                        value={formData.environment || ''} 
                        onChange={handleInputChange}
                        placeholder="Environment (e.g., production, staging, development)"
                      />
                    </FormControl>
                  </VStack>
                </TabPanel>
                
                <TabPanel>
                  <VStack spacing={4} align="stretch">
                    <FormControl>
                      <FormLabel>Hostname</FormLabel>
                      <Input 
                        name="hostname" 
                        value={formData.hostname || ''} 
                        onChange={handleInputChange}
                        placeholder="Hostname or FQDN"
                      />
                    </FormControl>
                    
                    <FormControl>
                      <FormLabel>IP Address</FormLabel>
                      <Input 
                        name="ip_address" 
                        value={formData.ip_address || ''} 
                        onChange={handleInputChange}
                        placeholder="IP address"
                      />
                    </FormControl>
                    
                    <FormControl>
                      <FormLabel>SSH Port</FormLabel>
                      <Input 
                        name="ssh_port" 
                        type="number"
                        value={formData.ssh_port || 22} 
                        onChange={handleInputChange}
                        placeholder="SSH port (default: 22)"
                      />
                    </FormControl>
                    
                    <FormControl>
                      <FormLabel>API Port</FormLabel>
                      <Input 
                        name="api_port" 
                        type="number"
                        value={formData.api_port || 8000} 
                        onChange={handleInputChange}
                        placeholder="API port (default: 8000)"
                      />
                    </FormControl>
                  </VStack>
                </TabPanel>
                
                <TabPanel>
                  <VStack spacing={4} align="stretch">
                    <FormControl>
                      <FormLabel>Maximum Targets</FormLabel>
                      <Input 
                        name="max_targets" 
                        type="number"
                        value={formData.max_targets || ''} 
                        onChange={handleInputChange}
                        placeholder="Maximum number of targets"
                      />
                    </FormControl>
                    
                    <FormControl>
                      <FormLabel>Maximum Concurrent Sessions</FormLabel>
                      <Input 
                        name="max_concurrent_sessions" 
                        type="number"
                        value={formData.max_concurrent_sessions || ''} 
                        onChange={handleInputChange}
                        placeholder="Maximum concurrent sessions"
                      />
                    </FormControl>
                  </VStack>
                </TabPanel>
                
                <TabPanel>
                  <VStack spacing={4} align="stretch">
                    <FormControl>
                      <FormLabel>Tags</FormLabel>
                      <Wrap spacing={2} mb={2}>
                        {(formData.tags || []).map(tag => (
                          <WrapItem key={tag}>
                            <Tag size="md" colorScheme="blue" borderRadius="full">
                              <TagLabel>{tag}</TagLabel>
                              <TagCloseButton onClick={() => handleRemoveTag(tag)} />
                            </Tag>
                          </WrapItem>
                        ))}
                      </Wrap>
                      <Flex>
                        <Input 
                          value={newTag} 
                          onChange={(e) => setNewTag(e.target.value)}
                          placeholder="Add a tag"
                          mr={2}
                        />
                        <Button onClick={handleAddTag}>Add</Button>
                      </Flex>
                    </FormControl>
                    
                    <FormControl>
                      <FormLabel>Features</FormLabel>
                      <Wrap spacing={2} mb={2}>
                        {(formData.features || []).map(feature => (
                          <WrapItem key={feature}>
                            <Tag size="md" colorScheme="purple" borderRadius="full">
                              <TagLabel>{feature}</TagLabel>
                              <TagCloseButton onClick={() => handleRemoveFeature(feature)} />
                            </Tag>
                          </WrapItem>
                        ))}
                      </Wrap>
                      <Flex>
                        <Input 
                          value={newFeature} 
                          onChange={(e) => setNewFeature(e.target.value)}
                          placeholder="Add a feature"
                          mr={2}
                        />
                        <Button onClick={handleAddFeature}>Add</Button>
                      </Flex>
                    </FormControl>
                  </VStack>
                </TabPanel>
              </TabPanels>
            </Tabs>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onCreateClose}>
              Cancel
            </Button>
            <Button colorScheme="blue" onClick={handleCreateGateway}>
              Create Gateway
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      
      {/* Edit Gateway Modal */}
      <Modal isOpen={isEditOpen} onClose={onEditClose} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Edit Gateway</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Tabs isFitted variant="enclosed">
              <TabList mb="1em">
                <Tab>Basic Info</Tab>
                <Tab>Network</Tab>
                <Tab>Configuration</Tab>
                <Tab>Tags & Features</Tab>
              </TabList>
              <TabPanels>
                <TabPanel>
                  <VStack spacing={4} align="stretch">
                    <FormControl isRequired>
                      <FormLabel>Gateway ID</FormLabel>
                      <Input 
                        name="gateway_id" 
                        value={formData.gateway_id} 
                        isReadOnly
                        bg="gray.100"
                      />
                    </FormControl>
                    
                    <FormControl isRequired>
                      <FormLabel>Name</FormLabel>
                      <Input 
                        name="name" 
                        value={formData.name} 
                        onChange={handleInputChange}
                        placeholder="Display name"
                      />
                    </FormControl>
                    
                    <FormControl>
                      <FormLabel>Description</FormLabel>
                      <Input 
                        name="description" 
                        value={formData.description || ''} 
                        onChange={handleInputChange}
                        placeholder="Optional description"
                      />
                    </FormControl>
                    
                    <FormControl isRequired>
                      <FormLabel>Gateway Type</FormLabel>
                      <Select 
                        name="gateway_type" 
                        value={formData.gateway_type} 
                        onChange={handleInputChange}
                      >
                        <option value="STANDALONE">Standalone</option>
                        <option value="CLUSTER">Cluster</option>
                        <option value="EDGE">Edge</option>
                      </Select>
                    </FormControl>
                    
                    {formData.gateway_type === 'EDGE' && (
                      <FormControl>
                        <FormLabel>Parent Gateway</FormLabel>
                        <Select 
                          name="parent_gateway_id" 
                          value={formData.parent_gateway_id || ''} 
                          onChange={handleInputChange}
                          placeholder="Select parent gateway"
                        >
                          {availableParentGateways.map(gateway => (
                            <option key={gateway.gateway_id} value={gateway.gateway_id}>
                              {gateway.name} ({gateway.gateway_id})
                            </option>
                          ))}
                        </Select>
                      </FormControl>
                    )}
                    
                    <FormControl>
                      <FormLabel>Location</FormLabel>
                      <Input 
                        name="location" 
                        value={formData.location || ''} 
                        onChange={handleInputChange}
                        placeholder="Physical location"
                      />
                    </FormControl>
                    
                    <FormControl>
                      <FormLabel>Region</FormLabel>
                      <Input 
                        name="region" 
                        value={formData.region || ''} 
                        onChange={handleInputChange}
                        placeholder="Region (e.g., us-west, eu-central)"
                      />
                    </FormControl>
                    
                    <FormControl>
                      <FormLabel>Environment</FormLabel>
                      <Input 
                        name="environment" 
                        value={formData.environment || ''} 
                        onChange={handleInputChange}
                        placeholder="Environment (e.g., production, staging, development)"
                      />
                    </FormControl>
                  </VStack>
                </TabPanel>
                
                <TabPanel>
                  <VStack spacing={4} align="stretch">
                    <FormControl>
                      <FormLabel>Hostname</FormLabel>
                      <Input 
                        name="hostname" 
                        value={formData.hostname || ''} 
                        onChange={handleInputChange}
                        placeholder="Hostname or FQDN"
                      />
                    </FormControl>
                    
                    <FormControl>
                      <FormLabel>IP Address</FormLabel>
                      <Input 
                        name="ip_address" 
                        value={formData.ip_address || ''} 
                        onChange={handleInputChange}
                        placeholder="IP address"
                      />
                    </FormControl>
                    
                    <FormControl>
                      <FormLabel>SSH Port</FormLabel>
                      <Input 
                        name="ssh_port" 
                        type="number"
                        value={formData.ssh_port || 22} 
                        onChange={handleInputChange}
                        placeholder="SSH port (default: 22)"
                      />
                    </FormControl>
                    
                    <FormControl>
                      <FormLabel>API Port</FormLabel>
                      <Input 
                        name="api_port" 
                        type="number"
                        value={formData.api_port || 8000} 
                        onChange={handleInputChange}
                        placeholder="API port (default: 8000)"
                      />
                    </FormControl>
                  </VStack>
                </TabPanel>
                
                <TabPanel>
                  <VStack spacing={4} align="stretch">
                    <FormControl>
                      <FormLabel>Maximum Targets</FormLabel>
                      <Input 
                        name="max_targets" 
                        type="number"
                        value={formData.max_targets || ''} 
                        onChange={handleInputChange}
                        placeholder="Maximum number of targets"
                      />
                    </FormControl>
                    
                    <FormControl>
                      <FormLabel>Maximum Concurrent Sessions</FormLabel>
                      <Input 
                        name="max_concurrent_sessions" 
                        type="number"
                        value={formData.max_concurrent_sessions || ''} 
                        onChange={handleInputChange}
                        placeholder="Maximum concurrent sessions"
                      />
                    </FormControl>
                  </VStack>
                </TabPanel>
                
                <TabPanel>
                  <VStack spacing={4} align="stretch">
                    <FormControl>
                      <FormLabel>Tags</FormLabel>
                      <Wrap spacing={2} mb={2}>
                        {(formData.tags || []).map(tag => (
                          <WrapItem key={tag}>
                            <Tag size="md" colorScheme="blue" borderRadius="full">
                              <TagLabel>{tag}</TagLabel>
                              <TagCloseButton onClick={() => handleRemoveTag(tag)} />
                            </Tag>
                          </WrapItem>
                        ))}
                      </Wrap>
                      <Flex>
                        <Input 
                          value={newTag} 
                          onChange={(e) => setNewTag(e.target.value)}
                          placeholder="Add a tag"
                          mr={2}
                        />
                        <Button onClick={handleAddTag}>Add</Button>
                      </Flex>
                    </FormControl>
                    
                    <FormControl>
                      <FormLabel>Features</FormLabel>
                      <Wrap spacing={2} mb={2}>
                        {(formData.features || []).map(feature => (
                          <WrapItem key={feature}>
                            <Tag size="md" colorScheme="purple" borderRadius="full">
                              <TagLabel>{feature}</TagLabel>
                              <TagCloseButton onClick={() => handleRemoveFeature(feature)} />
                            </Tag>
                          </WrapItem>
                        ))}
                      </Wrap>
                      <Flex>
                        <Input 
                          value={newFeature} 
                          onChange={(e) => setNewFeature(e.target.value)}
                          placeholder="Add a feature"
                          mr={2}
                        />
                        <Button onClick={handleAddFeature}>Add</Button>
                      </Flex>
                    </FormControl>
                  </VStack>
                </TabPanel>
              </TabPanels>
            </Tabs>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onEditClose}>
              Cancel
            </Button>
            <Button colorScheme="blue" onClick={handleUpdateGateway}>
              Update Gateway
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      
      {/* Delete Confirmation Modal */}
      <Modal isOpen={isDeleteOpen} onClose={onDeleteClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Delete Gateway</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text>
              Are you sure you want to permanently delete the gateway 
              <Text as="span" fontWeight="bold"> {selectedGateway?.name}</Text>?
            </Text>
            <Text mt={2} color="red.500">
              This action cannot be undone. All associated data will be permanently removed.
            </Text>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onDeleteClose}>
              Cancel
            </Button>
            <Button colorScheme="red" onClick={handleDeleteGateway}>
              Delete Gateway
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      
      {/* Deactivate Confirmation Modal */}
      <Modal isOpen={isDeactivateOpen} onClose={onDeactivateClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Deactivate Gateway</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text>
              Are you sure you want to deactivate the gateway 
              <Text as="span" fontWeight="bold"> {selectedGateway?.name}</Text>?
            </Text>
            <Text mt={2}>
              The gateway will be marked as inactive and will not be available for target associations.
              You can reactivate it later if needed.
            </Text>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onDeactivateClose}>
              Cancel
            </Button>
            <Button colorScheme="orange" onClick={handleDeactivateGateway}>
              Deactivate Gateway
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default GatewayList;

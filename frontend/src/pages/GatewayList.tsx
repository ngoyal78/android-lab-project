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
  FormControl,
  FormLabel,
  Text,
  useToast,
  Spinner,
  Tag,
  TagLabel,
  TagCloseButton,
  Wrap,
  WrapItem,
  useColorModeValue,
  Grid,
  GridItem,
} from '@chakra-ui/react';
import {
  AddIcon,
  EditIcon,
  DeleteIcon,
  RepeatIcon,
  CloseIcon,
} from '@chakra-ui/icons';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

// Define types for Gateway data
interface Gateway {
  id: number;
  gateway_id: string;
  name: string;
  description?: string;
  gateway_type: 'master' | 'region' | 'site' | 'standalone';
  parent_gateway_id?: string;
  status: 'online' | 'offline' | 'maintenance' | 'degraded';
  hostname?: string;
  ip_address?: string;
  ssh_port?: number;
  api_port?: number;
  location?: string;
  region?: string;
  environment?: string;
  max_targets?: number;
  current_targets: number;
  max_concurrent_sessions?: number;
  current_sessions?: number;
  last_heartbeat?: string;
  tags?: string[];
  features?: string[];
  created_at: string;
  updated_at?: string;
  is_active: boolean;
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
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [formData, setFormData] = useState<GatewayFormData>({
    gateway_id: '',
    name: '',
    gateway_type: 'standalone',
    ssh_port: 22,
    api_port: 8000
  });
  const [selectedGateway, setSelectedGateway] = useState<Gateway | null>(null);
  const [newTag, setNewTag] = useState<string>('');
  const [newFeature, setNewFeature] = useState<string>('');
  const [availableParentGateways, setAvailableParentGateways] = useState<Gateway[]>([]);
  
  const toast = useToast();
  const navigate = useNavigate();
  
  const bgColor = useColorModeValue('white', 'gray.800');
  const formBgColor = useColorModeValue('blue.50', 'blue.900');
  const sectionHeaderColor = useColorModeValue('blue.600', 'blue.200');
  
  // Fetch gateways
  const fetchGateways = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/gateways');
      setGateways(response.data);
      
      // Get available parent gateways (standalone or master/region types)
      const parentGateways = response.data.filter(
        (g: Gateway) => g.gateway_type !== 'site' && g.is_active
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
  }, []);
  
  // Filter gateways based on search
  const filteredGateways = gateways.filter(gateway => {
    return searchTerm === '' || 
      gateway.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      gateway.gateway_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (gateway.description && gateway.description.toLowerCase().includes(searchTerm.toLowerCase()));
  });
  
  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    // Handle numeric fields
    if (name === 'ssh_port' || name === 'api_port' || name === 'max_targets' || name === 'max_concurrent_sessions') {
      const numValue = value === '' ? undefined : parseInt(value, 10);
      setFormData({
        ...formData,
        [name]: numValue
      });
    } else {
      setFormData({
        ...formData,
        [name]: value
      });
    }
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
      fetchGateways();
      resetForm();
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
      fetchGateways();
      resetForm();
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
  
  // Open edit form with selected gateway data
  const openEditForm = (gateway: Gateway) => {
    setSelectedGateway(gateway);
    setFormData({
      gateway_id: gateway.gateway_id,
      name: gateway.name,
      description: gateway.description || '',
      gateway_type: gateway.gateway_type,
      parent_gateway_id: gateway.parent_gateway_id || '',
      hostname: gateway.hostname || '',
      ip_address: gateway.ip_address || '',
      ssh_port: gateway.ssh_port,
      api_port: gateway.api_port,
      location: gateway.location || '',
      region: gateway.region || '',
      environment: gateway.environment || '',
      max_targets: gateway.max_targets,
      max_concurrent_sessions: gateway.max_concurrent_sessions,
      tags: gateway.tags || [],
      features: gateway.features || []
    });
  };
  
  // Navigate to gateway detail page
  const navigateToGatewayDetail = (gatewayId: string) => {
    navigate(`/gateways/${gatewayId}`);
  };
  
  // Get status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'green';
      case 'offline':
        return 'red';
      case 'maintenance':
        return 'orange';
      case 'degraded':
        return 'yellow';
      default:
        return 'gray';
    }
  };
  
  // Get gateway type badge color
  const getTypeColor = (type: string) => {
    switch (type) {
      case 'standalone':
        return 'blue';
      case 'master':
        return 'purple';
      case 'region':
        return 'teal';
      case 'site':
        return 'orange';
      default:
        return 'gray';
    }
  };
  
  // Reset form data for new gateway
  const resetForm = () => {
    setFormData({
      gateway_id: '',
      name: '',
      description: '',
      gateway_type: 'standalone',
      parent_gateway_id: '',
      hostname: '',
      ip_address: '',
      ssh_port: 22,
      api_port: 8000,
      location: '',
      region: '',
      environment: '',
      max_targets: undefined,
      max_concurrent_sessions: undefined,
      tags: [],
      features: []
    });
    setNewTag('');
    setNewFeature('');
    setSelectedGateway(null);
  };
  
  return (
    <Box p={4}>
      <Heading size="lg" mb={6}>Gateway Management</Heading>
      
      <Grid templateColumns="350px 1fr" gap={6}>
        {/* Gateway Form */}
        <GridItem>
          <Box 
            p={4} 
            borderWidth="1px" 
            borderRadius="lg" 
            bg={formBgColor} 
            boxShadow="md"
            height="calc(100vh - 150px)"
            overflowY="auto"
          >
            <Heading size="md" mb={4}>
              {selectedGateway ? 'Edit Gateway' : 'Create New Gateway'}
            </Heading>
            
            {/* Basic Information */}
            <Box mb={6}>
              <Heading size="sm" mb={3} color={sectionHeaderColor}>
                Basic Information
              </Heading>
              <FormControl isRequired mb={3}>
                <FormLabel>Gateway ID</FormLabel>
                <Input 
                  name="gateway_id" 
                  value={formData.gateway_id} 
                  onChange={handleInputChange}
                  placeholder="Unique identifier (e.g., gateway-123)"
                  isReadOnly={!!selectedGateway}
                  bg={selectedGateway ? "gray.100" : undefined}
                />
              </FormControl>
              
              <FormControl isRequired mb={3}>
                <FormLabel>Name</FormLabel>
                <Input 
                  name="name" 
                  value={formData.name} 
                  onChange={handleInputChange}
                  placeholder="Display name"
                />
              </FormControl>
              
              <FormControl mb={3}>
                <FormLabel>Description</FormLabel>
                <Input 
                  name="description" 
                  value={formData.description || ''} 
                  onChange={handleInputChange}
                  placeholder="Optional description"
                />
              </FormControl>
              
              <FormControl isRequired mb={3}>
                <FormLabel>Gateway Type</FormLabel>
                <Select 
                  name="gateway_type" 
                  value={formData.gateway_type} 
                  onChange={handleInputChange}
                >
                  <option value="standalone">Standalone</option>
                  <option value="master">Master</option>
                  <option value="region">Region</option>
                  <option value="site">Site</option>
                </Select>
              </FormControl>
            </Box>
            
            {/* Location & Environment */}
            <Box mb={6}>
              <Heading size="sm" mb={3} color={sectionHeaderColor}>
                Location & Environment
              </Heading>
              <FormControl mb={3}>
                <FormLabel>Location</FormLabel>
                <Input 
                  name="location" 
                  value={formData.location || ''} 
                  onChange={handleInputChange}
                  placeholder="Physical location"
                />
              </FormControl>
              
              <FormControl mb={3}>
                <FormLabel>Region</FormLabel>
                <Input 
                  name="region" 
                  value={formData.region || ''} 
                  onChange={handleInputChange}
                  placeholder="Region (e.g., us-west)"
                />
              </FormControl>
              
              <FormControl mb={3}>
                <FormLabel>Environment</FormLabel>
                <Input 
                  name="environment" 
                  value={formData.environment || ''} 
                  onChange={handleInputChange}
                  placeholder="Environment (e.g., production)"
                />
              </FormControl>
            </Box>
            
            {/* Network Configuration */}
            <Box mb={6}>
              <Heading size="sm" mb={3} color={sectionHeaderColor}>
                Network Configuration
              </Heading>
              <FormControl mb={3}>
                <FormLabel>Hostname</FormLabel>
                <Input 
                  name="hostname" 
                  value={formData.hostname || ''} 
                  onChange={handleInputChange}
                  placeholder="Hostname or FQDN"
                />
              </FormControl>
              
              <FormControl mb={3}>
                <FormLabel>IP Address</FormLabel>
                <Input 
                  name="ip_address" 
                  value={formData.ip_address || ''} 
                  onChange={handleInputChange}
                  placeholder="IP address"
                />
              </FormControl>
              
              <FormControl mb={3}>
                <FormLabel>SSH Port</FormLabel>
                <Input 
                  name="ssh_port" 
                  type="number"
                  value={formData.ssh_port || 22} 
                  onChange={handleInputChange}
                  placeholder="SSH port (default: 22)"
                />
              </FormControl>
              
              <FormControl mb={3}>
                <FormLabel>API Port</FormLabel>
                <Input 
                  name="api_port" 
                  type="number"
                  value={formData.api_port || 8000} 
                  onChange={handleInputChange}
                  placeholder="API port (default: 8000)"
                />
              </FormControl>
            </Box>
            
            <Flex justifyContent="flex-end" mt={4}>
              <Button 
                variant="outline" 
                mr={3} 
                onClick={resetForm}
              >
                Cancel
              </Button>
              <Button 
                colorScheme="blue" 
                onClick={selectedGateway ? handleUpdateGateway : handleCreateGateway}
              >
                {selectedGateway ? 'Update Gateway' : 'Create Gateway'}
              </Button>
            </Flex>
          </Box>
        </GridItem>
        
        {/* Gateway List */}
        <GridItem>
          <Box p={4} borderWidth="1px" borderRadius="lg" bg={bgColor} boxShadow="md">
            {/* Filters */}
            <Flex mb={4}>
              <Input
                placeholder="Search gateways..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                width="300px"
                mr={2}
              />
              
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
                <Table variant="simple">
                  <Thead>
                    <Tr>
                      <Th>Name</Th>
                      <Th>Gateway ID</Th>
                      <Th>Type</Th>
                      <Th>Status</Th>
                      <Th>Location</Th>
                      <Th>Actions</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {filteredGateways.length === 0 ? (
                      <Tr>
                        <Td colSpan={6} textAlign="center">No gateways found</Td>
                      </Tr>
                    ) : (
                      filteredGateways.map(gateway => (
                        <Tr key={gateway.id}>
                          <Td>{gateway.name}</Td>
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
                          <Td>{gateway.location || 'N/A'}</Td>
                          <Td>
                            <IconButton
                              aria-label="Edit gateway"
                              icon={<EditIcon />}
                              size="sm"
                              mr={2}
                              onClick={() => openEditForm(gateway)}
                            />
                            <IconButton
                              aria-label="View gateway details"
                              icon={<AddIcon />}
                              size="sm"
                              onClick={() => navigateToGatewayDetail(gateway.gateway_id)}
                            />
                          </Td>
                        </Tr>
                      ))
                    )}
                  </Tbody>
                </Table>
              </Box>
            )}
          </Box>
        </GridItem>
      </Grid>
    </Box>
  );
};

export default GatewayList;

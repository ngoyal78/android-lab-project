import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Heading,
  Text,
  Flex,
  Badge,
  Spinner,
  Button,
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
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Tag,
  TagLabel,
  Wrap,
  WrapItem,
  useToast,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  Progress,
  Divider,
  Card,
  CardHeader,
  CardBody,
  SimpleGrid,
  useColorModeValue,
  IconButton,
  Tooltip
} from '@chakra-ui/react';
import {
  ArrowBackIcon,
  EditIcon,
  WarningIcon,
  CheckCircleIcon,
  RepeatIcon,
  InfoIcon,
  TimeIcon,
  LinkIcon,
  ExternalLinkIcon
} from '@chakra-ui/icons';
import axios from 'axios';
import { Gateway, GatewayAuditLog, AssociatedTarget } from '../types/gateway';
import TargetGatewayAssociation from '../components/TargetGatewayAssociation';

const GatewayDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  
  const [gateway, setGateway] = useState<Gateway | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [auditLogs, setAuditLogs] = useState<GatewayAuditLog[]>([]);
  const [associatedTargets, setAssociatedTargets] = useState<AssociatedTarget[]>([]);
  const [isDeactivateDialogOpen, setIsDeactivateDialogOpen] = useState<boolean>(false);
  const cancelRef = React.useRef<HTMLButtonElement>(null);
  
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  
  // Fetch gateway details
  const fetchGatewayDetails = async () => {
    setLoading(true);
    try {
      const [gatewayResponse, auditLogsResponse, targetsResponse] = await Promise.all([
        axios.get(`/api/gateways/${id}`),
        axios.get(`/api/gateways/${id}/audit-logs`),
        axios.get(`/api/gateways/${id}/targets`)
      ]);
      
      setGateway(gatewayResponse.data);
      setAuditLogs(auditLogsResponse.data);
      setAssociatedTargets(targetsResponse.data);
    } catch (error) {
      console.error('Error fetching gateway details:', error);
      toast({
        title: 'Error fetching gateway details',
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
    if (id) {
      fetchGatewayDetails();
      
      // Set up refresh interval (every 30 seconds)
      const intervalId = setInterval(fetchGatewayDetails, 30000);
      
      // Clean up interval on component unmount
      return () => clearInterval(intervalId);
    }
  }, [id]);
  
  // Handle gateway deactivation
  const handleDeactivateGateway = async () => {
    if (!gateway) return;
    
    try {
      await axios.post(`/api/gateways/${gateway.gateway_id}/deactivate`, {
        reason: 'Manually deactivated by user'
      });
      toast({
        title: 'Gateway deactivated',
        description: `Gateway ${gateway.name} has been deactivated.`,
        status: 'info',
        duration: 5000,
        isClosable: true,
      });
      setIsDeactivateDialogOpen(false);
      fetchGatewayDetails();
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
  
  // Handle gateway reactivation
  const handleReactivateGateway = async () => {
    if (!gateway) return;
    
    try {
      await axios.put(`/api/gateways/${gateway.gateway_id}`, { is_active: true });
      toast({
        title: 'Gateway reactivated',
        description: `Gateway ${gateway.name} has been reactivated.`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
      fetchGatewayDetails();
    } catch (error) {
      console.error('Error reactivating gateway:', error);
      toast({
        title: 'Error reactivating gateway',
        description: 'Could not reactivate gateway. Please try again later.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
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
  
  if (loading) {
    return (
      <Flex justify="center" align="center" height="400px">
        <Spinner size="xl" />
      </Flex>
    );
  }
  
  if (!gateway) {
    return (
      <Box p={4}>
        <Flex alignItems="center" mb={6}>
          <Button leftIcon={<ArrowBackIcon />} onClick={() => navigate('/gateways')} mr={4}>
            Back to Gateways
          </Button>
          <Heading size="lg">Gateway Not Found</Heading>
        </Flex>
        <Text>The gateway you are looking for does not exist or has been removed.</Text>
      </Box>
    );
  }
  
  return (
    <Box p={4}>
      <Flex alignItems="center" mb={6}>
        <Button leftIcon={<ArrowBackIcon />} onClick={() => navigate('/gateways')} mr={4}>
          Back to Gateways
        </Button>
        <Heading size="lg">{gateway.name}</Heading>
        {!gateway.is_active && (
          <Badge ml={2} colorScheme="red">Inactive</Badge>
        )}
        <Tooltip label="Refresh gateway data">
          <IconButton
            aria-label="Refresh"
            icon={<RepeatIcon />}
            size="sm"
            ml="auto"
            onClick={fetchGatewayDetails}
          />
        </Tooltip>
        <Button
          leftIcon={<EditIcon />}
          colorScheme="blue"
          variant="outline"
          ml={2}
          onClick={() => navigate(`/gateways/${gateway.gateway_id}/edit`)}
        >
          Edit
        </Button>
        {gateway.is_active ? (
          <Button
            leftIcon={<WarningIcon />}
            colorScheme="orange"
            ml={2}
            onClick={() => setIsDeactivateDialogOpen(true)}
          >
            Deactivate
          </Button>
        ) : (
          <Button
            leftIcon={<CheckCircleIcon />}
            colorScheme="green"
            ml={2}
            onClick={handleReactivateGateway}
          >
            Reactivate
          </Button>
        )}
      </Flex>
      
      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6} mb={6}>
        <Card>
          <CardHeader>
            <Heading size="md">Gateway Information</Heading>
          </CardHeader>
          <CardBody>
            <SimpleGrid columns={2} spacing={4}>
              <Box>
                <Text fontWeight="bold">Gateway ID</Text>
                <Text>{gateway.gateway_id}</Text>
              </Box>
              <Box>
                <Text fontWeight="bold">Type</Text>
                <Badge colorScheme={getTypeColor(gateway.gateway_type)}>
                  {gateway.gateway_type}
                </Badge>
              </Box>
              <Box>
                <Text fontWeight="bold">Status</Text>
                <Badge colorScheme={getStatusColor(gateway.status)}>
                  {gateway.status}
                </Badge>
              </Box>
              <Box>
                <Text fontWeight="bold">Last Heartbeat</Text>
                <Badge colorScheme={getHeartbeatStatus(gateway.last_heartbeat).color}>
                  {getHeartbeatStatus(gateway.last_heartbeat).text}
                </Badge>
              </Box>
              <Box>
                <Text fontWeight="bold">Location</Text>
                <Text>{gateway.location || 'N/A'}</Text>
              </Box>
              <Box>
                <Text fontWeight="bold">Region</Text>
                <Text>{gateway.region || 'N/A'}</Text>
              </Box>
              <Box>
                <Text fontWeight="bold">Environment</Text>
                <Text>{gateway.environment || 'N/A'}</Text>
              </Box>
              <Box>
                <Text fontWeight="bold">Created</Text>
                <Text>{formatDate(gateway.created_at)}</Text>
              </Box>
              {gateway.parent_gateway_id && (
                <Box gridColumn="span 2">
                  <Text fontWeight="bold">Parent Gateway</Text>
                  <Button
                    variant="link"
                    colorScheme="blue"
                    leftIcon={<LinkIcon />}
                    onClick={() => navigate(`/gateways/${gateway.parent_gateway_id}`)}
                  >
                    {gateway.parent_gateway_id}
                  </Button>
                </Box>
              )}
              {gateway.description && (
                <Box gridColumn="span 2">
                  <Text fontWeight="bold">Description</Text>
                  <Text>{gateway.description}</Text>
                </Box>
              )}
            </SimpleGrid>
          </CardBody>
        </Card>
        
        <Card>
          <CardHeader>
            <Heading size="md">Health & Resources</Heading>
          </CardHeader>
          <CardBody>
            <Box mb={4}>
              <Flex justify="space-between" align="center" mb={1}>
                <Text fontWeight="bold">Health Score</Text>
                <Text>{gateway.health_check_score !== undefined ? `${gateway.health_check_score}/100` : 'N/A'}</Text>
              </Flex>
              {gateway.health_check_score !== undefined ? (
                <Progress 
                  value={gateway.health_check_score} 
                  colorScheme={
                    gateway.health_check_score > 80 ? "green" :
                    gateway.health_check_score > 50 ? "yellow" : "red"
                  }
                  borderRadius="full"
                  size="md"
                />
              ) : (
                <Text fontSize="sm" color="gray.500">No health data available</Text>
              )}
            </Box>
            
            <SimpleGrid columns={2} spacing={4} mt={4}>
              <Box>
                <Text fontWeight="bold">CPU Usage</Text>
                {gateway.cpu_usage !== undefined ? (
                  <Progress 
                    value={gateway.cpu_usage} 
                    colorScheme={
                      gateway.cpu_usage < 50 ? "green" :
                      gateway.cpu_usage < 80 ? "yellow" : "red"
                    }
                    borderRadius="full"
                    size="sm"
                  />
                ) : (
                  <Text>N/A</Text>
                )}
              </Box>
              <Box>
                <Text fontWeight="bold">Memory Usage</Text>
                {gateway.memory_usage !== undefined ? (
                  <Progress 
                    value={gateway.memory_usage} 
                    colorScheme={
                      gateway.memory_usage < 50 ? "green" :
                      gateway.memory_usage < 80 ? "yellow" : "red"
                    }
                    borderRadius="full"
                    size="sm"
                  />
                ) : (
                  <Text>N/A</Text>
                )}
              </Box>
              <Box>
                <Text fontWeight="bold">Disk Usage</Text>
                {gateway.disk_usage !== undefined ? (
                  <Progress 
                    value={gateway.disk_usage} 
                    colorScheme={
                      gateway.disk_usage < 70 ? "green" :
                      gateway.disk_usage < 90 ? "yellow" : "red"
                    }
                    borderRadius="full"
                    size="sm"
                  />
                ) : (
                  <Text>N/A</Text>
                )}
              </Box>
              <Box>
                <Text fontWeight="bold">Targets</Text>
                <Text>
                  {gateway.current_targets !== undefined ? (
                    <>
                      {gateway.current_targets}
                      {gateway.max_targets && ` / ${gateway.max_targets}`}
                    </>
                  ) : (
                    'N/A'
                  )}
                </Text>
              </Box>
              <Box>
                <Text fontWeight="bold">Sessions</Text>
                <Text>
                  {gateway.current_sessions !== undefined ? (
                    <>
                      {gateway.current_sessions}
                      {gateway.max_concurrent_sessions && ` / ${gateway.max_concurrent_sessions}`}
                    </>
                  ) : (
                    'N/A'
                  )}
                </Text>
              </Box>
              <Box>
                <Text fontWeight="bold">Network</Text>
                <Text>
                  {gateway.hostname || gateway.ip_address ? (
                    <>
                      {gateway.hostname || gateway.ip_address}
                      {gateway.ssh_port && `:${gateway.ssh_port}`}
                    </>
                  ) : (
                    'N/A'
                  )}
                </Text>
              </Box>
            </SimpleGrid>
            
            {gateway.health_check_details && Object.keys(gateway.health_check_details).length > 0 && (
              <Box mt={4}>
                <Text fontWeight="bold" mb={2}>Health Check Details</Text>
                <Box p={2} borderWidth="1px" borderRadius="md" fontSize="sm">
                  <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {JSON.stringify(gateway.health_check_details, null, 2)}
                  </pre>
                </Box>
              </Box>
            )}
          </CardBody>
        </Card>
      </SimpleGrid>
      
      {/* Tags and Features */}
      <Box mb={6} p={4} borderWidth="1px" borderRadius="lg" bg={bgColor}>
        <Flex justify="space-between" align="center" mb={2}>
          <Heading size="sm">Tags & Features</Heading>
        </Flex>
        <Divider mb={4} />
        <Box mb={4}>
          <Text fontWeight="bold" mb={2}>Tags</Text>
          {gateway.tags && gateway.tags.length > 0 ? (
            <Wrap spacing={2}>
              {gateway.tags.map(tag => (
                <WrapItem key={tag}>
                  <Tag size="md" colorScheme="blue" borderRadius="full">
                    <TagLabel>{tag}</TagLabel>
                  </Tag>
                </WrapItem>
              ))}
            </Wrap>
          ) : (
            <Text fontSize="sm" color="gray.500">No tags</Text>
          )}
        </Box>
        <Box>
          <Text fontWeight="bold" mb={2}>Features</Text>
          {gateway.features && gateway.features.length > 0 ? (
            <Wrap spacing={2}>
              {gateway.features.map(feature => (
                <WrapItem key={feature}>
                  <Tag size="md" colorScheme="purple" borderRadius="full">
                    <TagLabel>{feature}</TagLabel>
                  </Tag>
                </WrapItem>
              ))}
            </Wrap>
          ) : (
            <Text fontSize="sm" color="gray.500">No features</Text>
          )}
        </Box>
      </Box>
      
      {/* Tabs for Associated Targets and Audit Logs */}
      <Tabs variant="enclosed" colorScheme="blue">
        <TabList>
          <Tab>Associated Targets</Tab>
          <Tab>Audit Logs ({auditLogs.length})</Tab>
        </TabList>
        <TabPanels>
          <TabPanel>
            <TargetGatewayAssociation 
              gatewayId={gateway.gateway_id} 
              showTitle={false} 
              onAssociationChange={fetchGatewayDetails}
            />
          </TabPanel>
          <TabPanel>
            {auditLogs.length === 0 ? (
              <Text>No audit logs available for this gateway.</Text>
            ) : (
              <Box overflowX="auto">
                <Table variant="simple" size="sm">
                  <Thead>
                    <Tr>
                      <Th>Timestamp</Th>
                      <Th>Action</Th>
                      <Th>User</Th>
                      <Th>Details</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {auditLogs.map(log => (
                      <Tr key={log.id}>
                        <Td whiteSpace="nowrap">{formatDate(log.timestamp)}</Td>
                        <Td>
                          <Badge colorScheme={
                            log.action.includes('created') ? 'green' :
                            log.action.includes('updated') ? 'blue' :
                            log.action.includes('deleted') || log.action.includes('deactivated') ? 'red' :
                            'gray'
                          }>
                            {log.action}
                          </Badge>
                        </Td>
                        <Td>{log.user_name || `User ID: ${log.user_id}` || 'System'}</Td>
                        <Td>
                          {log.details ? (
                            <Tooltip label={JSON.stringify(log.details, null, 2)}>
                              <InfoIcon cursor="pointer" />
                            </Tooltip>
                          ) : (
                            '-'
                          )}
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </Box>
            )}
          </TabPanel>
        </TabPanels>
      </Tabs>
      
      {/* Deactivate Confirmation Dialog */}
      <AlertDialog
        isOpen={isDeactivateDialogOpen}
        leastDestructiveRef={cancelRef}
        onClose={() => setIsDeactivateDialogOpen(false)}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Deactivate Gateway
            </AlertDialogHeader>
            <AlertDialogBody>
              Are you sure you want to deactivate the gateway "{gateway.name}"? 
              The gateway will be marked as inactive and will not be available for target associations.
              You can reactivate it later if needed.
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={() => setIsDeactivateDialogOpen(false)}>
                Cancel
              </Button>
              <Button colorScheme="orange" onClick={handleDeactivateGateway} ml={3}>
                Deactivate
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Box>
  );
};

export default GatewayDetail;

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Calendar, momentLocalizer, Event } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { Button, Modal, Form, Select, DatePicker, TimePicker, message, Spin, Tooltip, Tag, Card, Row, Col, Alert, Divider } from 'antd';
import { InfoCircleOutlined, ClockCircleOutlined, UserOutlined } from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import { 
  ReservationStatus, 
  ReservationPriority, 
  Reservation, 
  ReservationWithDetails,
  ReservationPolicy,
  ReservationSuggestion,
  AvailabilityResponse
} from '../types/reservation';

// Define interfaces for our data types
interface Target {
  id: number;
  name: string;
  device_type: string;
  status: string;
}

interface CalendarEvent extends Event {
  id: number;
  title: string;
  start: Date;
  end: Date;
  resource: ReservationWithDetails;
}

interface FormValues {
  target_id: number;
  start_time: moment.Moment;
  end_time: moment.Moment;
  policy_id?: number;
  target_type?: string;
  duration_minutes?: number;
}

// Extend the AuthContext type to include token
interface AuthContextExtended {
  user: any;
  authToken: string;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const { Option } = Select;
const { RangePicker } = DatePicker;

// Setup the localizer for react-big-calendar
const localizer = momentLocalizer(moment);

// Define event colors based on status
const eventColors = {
  pending: '#faad14',  // Warning yellow
  active: '#52c41a',   // Success green
  completed: '#8c8c8c', // Grey
  cancelled: '#f5222d', // Error red
  expired: '#ff7875',   // Light red
};

// Define priority colors
const priorityColors = {
  low: '#d9d9d9',      // Light grey
  normal: '#1890ff',   // Primary blue
  high: '#fa8c16',     // Orange
  critical: '#f5222d', // Red
};

const Reservations = () => {
  const { user, authToken } = useAuth() as AuthContextExtended;
  const navigate = useNavigate();
  const [targets, setTargets] = useState<Target[]>([]);
  const [reservations, setReservations] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<ReservationWithDetails | null>(null);
  const [suggestions, setSuggestions] = useState<ReservationSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [form] = Form.useForm<FormValues>();
  const [policies, setPolicies] = useState<ReservationPolicy[]>([]);

  // Fetch targets, reservations, and policies on component mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch targets
        const targetsResponse = await axios.get('/api/targets', {
          headers: { Authorization: `Bearer ${authToken}` }
        });
        
        // Fetch reservations
        const reservationsResponse = await axios.get('/api/reservations', {
          headers: { Authorization: `Bearer ${authToken}` }
        });
        
        // Fetch policies
        const policiesResponse = await axios.get('/api/policies', {
          headers: { Authorization: `Bearer ${authToken}` }
        });
        
        // For demo purposes, if no targets are returned, use mock data
        if (targetsResponse.data && targetsResponse.data.length === 0) {
          setTargets([
            {
              id: 1,
              name: 'Pixel 6 Pro',
              device_type: 'physical',
              status: 'available'
            },
            {
              id: 2,
              name: 'Samsung Galaxy S21',
              device_type: 'physical',
              status: 'available'
            },
            {
              id: 3,
              name: 'Emulator - Pixel 4',
              device_type: 'virtual',
              status: 'available'
            }
          ]);
        } else {
          setTargets(targetsResponse.data);
        }
        
        // Transform reservations for the calendar
        const transformedReservations = reservationsResponse.data.map((res: any) => ({
          id: res.id,
          title: `${res.target_name} - ${res.user_username}`,
          start: new Date(res.start_time),
          end: new Date(res.end_time),
          resource: {
            ...res,
            target_name: res.target_name,
            user_username: res.user_username
          }
        }));
        
        setReservations(transformedReservations);
        setPolicies(policiesResponse.data);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching data:', error);
        message.error('Failed to load data');
        setLoading(false);
      }
    };
    
    fetchData();
  }, [authToken]);

  // Handle calendar slot selection (clicking on an empty time slot)
  const handleSelectSlot = ({ start, end }: { start: Date, end: Date }) => {
    form.setFieldsValue({
      start_time: moment(start),
      end_time: moment(end),
    });
    setModalVisible(true);
  };

  // Handle clicking on an existing reservation
  const handleSelectEvent = (event: CalendarEvent) => {
    setSelectedReservation(event.resource);
    setDetailModalVisible(true);
  };

  // Create a new reservation
  const handleCreateReservation = async (values: FormValues) => {
    try {
      const { target_id, start_time, end_time, policy_id } = values;
      
      // Format dates for API
      const formattedStartTime = start_time.toISOString();
      const formattedEndTime = end_time.toISOString();
      
      // Check availability first
      const availabilityResponse = await axios.get(`/api/reservations/availability`, {
        params: {
          target_id,
          start_time: formattedStartTime,
          end_time: formattedEndTime
        },
        headers: { Authorization: `Bearer ${authToken}` }
      });
      
      if (!availabilityResponse.data.available) {
        message.error(`Not available: ${availabilityResponse.data.reason}`);
        return;
      }
      
      // Create the reservation
      const response = await axios.post('/api/reservations', {
        target_id,
        start_time: formattedStartTime,
        end_time: formattedEndTime,
        policy_id: policy_id || null
      }, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      
      // Find target
      const targetFound = targets.find(t => t.id === target_id);
      const targetName = targetFound ? targetFound.name : 'Unknown Target';
      
      // Add the new reservation to the calendar
      const newReservation = {
        id: response.data.id,
        title: `${targetName} - ${user.username}`,
        start: new Date(formattedStartTime),
        end: new Date(formattedEndTime),
        resource: {
          ...response.data,
          target_name: targetName,
          user_username: user.username
        }
      };
      
      setReservations([...reservations, newReservation]);
      setModalVisible(false);
      form.resetFields();
      message.success('Reservation created successfully');
    } catch (error) {
      console.error('Error creating reservation:', error);
      message.error('Failed to create reservation');
    }
  };

  // Cancel a reservation
  const handleCancelReservation = async () => {
    if (!selectedReservation) return;
    
    try {
      await axios.put(`/api/reservations/${selectedReservation.id}`, {
        status: 'cancelled'
      }, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      
      // Update the reservations list
      const updatedReservations = reservations.map(res => {
        if (res.id === selectedReservation.id) {
          return {
            ...res,
            resource: {
              ...res.resource,
              status: 'cancelled' as ReservationStatus
            }
          };
        }
        return res;
      });
      
      setReservations(updatedReservations as CalendarEvent[]);
      setDetailModalVisible(false);
      message.success('Reservation cancelled successfully');
    } catch (error) {
      console.error('Error cancelling reservation:', error);
      message.error('Failed to cancel reservation');
    }
  };

  // Get reservation suggestions
  const handleGetSuggestions = async () => {
    try {
      setLoadingSuggestions(true);
      const targetType = form.getFieldValue('target_type');
      const duration = form.getFieldValue('duration_minutes') || 60;
      
      const response = await axios.get('/api/reservations/suggestions', {
        params: {
          target_type: targetType,
          duration_minutes: duration
        },
        headers: { Authorization: `Bearer ${authToken}` }
      });
      
      setSuggestions(response.data);
      setLoadingSuggestions(false);
    } catch (error) {
      console.error('Error getting suggestions:', error);
      message.error('Failed to get suggestions');
      setLoadingSuggestions(false);
    }
  };

  // Apply a suggestion to the form
  const handleApplySuggestion = (suggestion: ReservationSuggestion) => {
    form.setFieldsValue({
      target_id: suggestion.target_id,
      start_time: moment(suggestion.start_time),
      end_time: moment(suggestion.end_time)
    });
    setSuggestions([]);
  };

  // Custom event component for the calendar
  const EventComponent = ({ event }: { event: CalendarEvent }) => {
    const { resource } = event;
    const statusColor = eventColors[resource.status as keyof typeof eventColors] || '#1890ff';
    const priorityColor = priorityColors[resource.priority as keyof typeof priorityColors] || priorityColors.normal;
    
    return (
      <Tooltip title={
        <div>
          <p><strong>Target:</strong> {resource.target_name}</p>
          <p><strong>User:</strong> {resource.user_username}</p>
          <p><strong>Status:</strong> {resource.status}</p>
          <p><strong>Priority:</strong> {resource.priority}</p>
          <p><strong>Start:</strong> {moment(resource.start_time).format('YYYY-MM-DD HH:mm')}</p>
          <p><strong>End:</strong> {moment(resource.end_time).format('YYYY-MM-DD HH:mm')}</p>
        </div>
      }>
        <div style={{ 
          height: '100%', 
          backgroundColor: statusColor,
          borderLeft: `4px solid ${priorityColor}`,
          padding: '2px 5px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {event.title}
        </div>
      </Tooltip>
    );
  };

  return (
    <div style={{ padding: '20px' }}>
      <h1>Reservations</h1>
      
      <Row gutter={16} style={{ marginBottom: '20px' }}>
        <Col span={24}>
          <Card title="Reservation Calendar">
            <Button 
              type="primary" 
              onClick={() => setModalVisible(true)}
              style={{ marginBottom: '16px' }}
            >
              Create Reservation
            </Button>
            
            {loading ? (
              <div style={{ textAlign: 'center', padding: '50px' }}>
                <Spin size="large" />
              </div>
            ) : (
              <div style={{ height: 600 }}>
                <Calendar
                  localizer={localizer}
                  events={reservations}
                  startAccessor="start"
                  endAccessor="end"
                  selectable
                  onSelectSlot={handleSelectSlot}
                  onSelectEvent={handleSelectEvent}
                  step={15}
                  timeslots={4}
                  defaultView="week"
                  components={{
                    event: EventComponent
                  }}
                />
              </div>
            )}
          </Card>
        </Col>
      </Row>
      
      {/* Create Reservation Modal */}
      <Modal
        title="Create Reservation"
        visible={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setSuggestions([]);
          form.resetFields();
        }}
        footer={null}
        width={800}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreateReservation}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="target_id"
                label="Target Device"
                rules={[{ required: true, message: 'Please select a target device' }]}
              >
                <Select placeholder="Select a target device">
                  {targets.map(target => (
                    <Option key={target.id} value={target.id}>
                      {target.name} ({target.device_type})
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            
            <Col span={12}>
              <Form.Item
                name="policy_id"
                label="Reservation Policy"
              >
                <Select placeholder="Select a policy (optional)">
                  {policies.map(policy => (
                    <Option key={policy.id} value={policy.id}>
                      {policy.name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="start_time"
                label="Start Time"
                rules={[{ required: true, message: 'Please select a start time' }]}
              >
                <DatePicker
                  showTime
                  format="YYYY-MM-DD HH:mm"
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
            
            <Col span={12}>
              <Form.Item
                name="end_time"
                label="End Time"
                rules={[{ required: true, message: 'Please select an end time' }]}
              >
                <DatePicker
                  showTime
                  format="YYYY-MM-DD HH:mm"
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
          </Row>
          
          <Divider>Need suggestions?</Divider>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="target_type"
                label="Target Type"
              >
                <Select placeholder="Filter by target type (optional)">
                  <Option value="physical">Physical</Option>
                  <Option value="virtual">Virtual</Option>
                  <Option value="emulator">Emulator</Option>
                </Select>
              </Form.Item>
            </Col>
            
            <Col span={12}>
              <Form.Item
                name="duration_minutes"
                label="Duration (minutes)"
                initialValue={60}
              >
                <Select>
                  <Option value={30}>30 minutes</Option>
                  <Option value={60}>1 hour</Option>
                  <Option value={120}>2 hours</Option>
                  <Option value={240}>4 hours</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          
          <Button 
            type="dashed" 
            onClick={handleGetSuggestions}
            loading={loadingSuggestions}
            style={{ marginBottom: '16px' }}
          >
            Get Suggestions
          </Button>
          
          {suggestions.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <h4>Suggestions:</h4>
              {suggestions.map((suggestion, index) => (
                <Card 
                  key={index} 
                  size="small" 
                  style={{ marginBottom: '8px' }}
                  hoverable
                  onClick={() => handleApplySuggestion(suggestion)}
                >
                  <Row>
                    <Col span={16}>
                      <strong>{suggestion.target_name}</strong> ({suggestion.device_type})
                      <div>
                        <ClockCircleOutlined /> {moment(suggestion.start_time).format('YYYY-MM-DD HH:mm')} - {moment(suggestion.end_time).format('HH:mm')}
                      </div>
                    </Col>
                    <Col span={8} style={{ textAlign: 'right' }}>
                      <Tag color="blue">Score: {suggestion.score}</Tag>
                      <div>{suggestion.reason}</div>
                    </Col>
                  </Row>
                </Card>
              ))}
            </div>
          )}
          
          <div style={{ textAlign: 'right' }}>
            <Button 
              style={{ marginRight: 8 }} 
              onClick={() => {
                setModalVisible(false);
                setSuggestions([]);
                form.resetFields();
              }}
            >
              Cancel
            </Button>
            <Button type="primary" htmlType="submit">
              Create Reservation
            </Button>
          </div>
        </Form>
      </Modal>
      
      {/* Reservation Details Modal */}
      {selectedReservation && (
        <Modal
          title="Reservation Details"
          visible={detailModalVisible}
          onCancel={() => setDetailModalVisible(false)}
          footer={[
            <Button 
              key="cancel" 
              danger 
              onClick={handleCancelReservation}
              disabled={['completed', 'cancelled', 'expired'].includes(selectedReservation.status)}
            >
              Cancel Reservation
            </Button>,
            <Button key="close" onClick={() => setDetailModalVisible(false)}>
              Close
            </Button>
          ]}
        >
          <div>
            <p><strong>Target:</strong> {selectedReservation.target_name}</p>
            <p><strong>User:</strong> {selectedReservation.user_username}</p>
            <p>
              <strong>Status:</strong> 
              <Tag 
                color={
                  selectedReservation.status === 'active' ? 'green' :
                  selectedReservation.status === 'pending' ? 'orange' :
                  selectedReservation.status === 'completed' ? 'blue' :
                  selectedReservation.status === 'cancelled' ? 'red' :
                  selectedReservation.status === 'expired' ? 'volcano' : 'default'
                }
                style={{ marginLeft: '8px' }}
              >
                {selectedReservation.status}
              </Tag>
            </p>
            <p>
              <strong>Priority:</strong> 
              <Tag 
                color={priorityColors[selectedReservation.priority]}
                style={{ marginLeft: '8px' }}
              >
                {selectedReservation.priority}
              </Tag>
            </p>
            <p><strong>Start Time:</strong> {moment(selectedReservation.start_time).format('YYYY-MM-DD HH:mm')}</p>
            <p><strong>End Time:</strong> {moment(selectedReservation.end_time).format('YYYY-MM-DD HH:mm')}</p>
            
            {selectedReservation.is_admin_override && (
              <Alert
                message="Admin Override"
                description={`This reservation was created with admin override. Reason: ${selectedReservation.override_reason || 'Not specified'}`}
                type="warning"
                showIcon
                style={{ marginTop: '16px' }}
              />
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};

export default Reservations;

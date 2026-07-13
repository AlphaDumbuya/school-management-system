import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  FormControl,
  FormLabel,
  Input,
  Button,
  Select,
  Textarea,
  Stack,
  Alert,
  Badge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Modal,
  ModalDialog,
  Typography,
  LinearProgress,
  CircularProgress,
} from '@mui/joy';
import { FaPlus, FaTrash, FaEdit, FaCheck, FaTimes, FaTest } from 'react-icons/fa';
import { logger } from '@utils/logger';

interface Provider {
  provider_id: string;
  provider_name: 'twilio' | 'brevo' | 'messagebird' | 'custom';
  provider_type: 'sms' | 'whatsapp' | 'both';
  phone_number: string;
  is_primary: boolean;
  enabled: boolean;
  created_at: string;
}

interface ProviderSetupProps {
  tenantId: string;
}

/**
 * SMS & WhatsApp Provider Setup Component
 * Allows administrators to configure SMS/WhatsApp service providers
 */
export const ProviderSetup: React.FC<ProviderSetupProps> = ({ tenantId }) => {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingProvider, setEditingProvider] = useState<Partial<Provider> | null>(null);

  const [formData, setFormData] = useState({
    provider_name: 'twilio' as const,
    provider_type: 'sms' as const,
    api_key: '',
    api_secret: '',
    account_sid: '',
    auth_token: '',
    phone_number: '',
    business_account_id: '',
    cost_per_sms: 0.01,
    cost_per_whatsapp_message: 0.02,
  });

  // Fetch providers on mount
  useEffect(() => {
    fetchProviders();
  }, [tenantId]);

  const fetchProviders = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/v1/sms-whatsapp/providers', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      });

      if (!response.ok) throw new Error('Failed to fetch providers');
      const data = await response.json();
      setProviders(data.data || []);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error fetching providers';
      setError(message);
      logger.error(`Provider fetch error: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAddProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const endpoint = editingProvider?.provider_id
        ? `/api/v1/sms-whatsapp/providers/${editingProvider.provider_id}`
        : '/api/v1/sms-whatsapp/providers';

      const method = editingProvider?.provider_id ? 'PATCH' : 'POST';

      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error('Failed to save provider');

      setSuccess(editingProvider ? 'Provider updated successfully' : 'Provider added successfully');
      setShowModal(false);
      resetForm();
      await fetchProviders();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error saving provider';
      setError(message);
      logger.error(`Provider save error: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProvider = async (providerId: string) => {
    if (!window.confirm('Are you sure you want to delete this provider?')) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/v1/sms-whatsapp/providers/${providerId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      });

      if (!response.ok) throw new Error('Failed to delete provider');

      setSuccess('Provider deleted successfully');
      await fetchProviders();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error deleting provider';
      setError(message);
      logger.error(`Provider delete error: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (providerId: string, enabled: boolean) => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/v1/sms-whatsapp/providers/${providerId}/toggle`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify({ enabled: !enabled }),
        }
      );

      if (!response.ok) throw new Error('Failed to toggle status');

      setSuccess('Provider status updated');
      await fetchProviders();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error updating status';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSetPrimary = async (providerId: string) => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/v1/sms-whatsapp/providers/${providerId}/set-primary`,
        {
          method: 'PUT',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        }
      );

      if (!response.ok) throw new Error('Failed to set primary provider');

      setSuccess('Primary provider updated');
      await fetchProviders();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error setting primary';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async (providerId: string) => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/v1/sms-whatsapp/providers/${providerId}/test`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        }
      );

      if (!response.ok) throw new Error('Connection test failed');
      const data = await response.json();

      setSuccess(`Connection: ${data.data.status}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Connection test failed';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleEditProvider = (provider: Provider) => {
    setEditingProvider(provider);
    setFormData({
      provider_name: provider.provider_name,
      provider_type: provider.provider_type,
      api_key: '',
      api_secret: '',
      account_sid: '',
      auth_token: '',
      phone_number: provider.phone_number,
      business_account_id: '',
      cost_per_sms: 0.01,
      cost_per_whatsapp_message: 0.02,
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({
      provider_name: 'twilio',
      provider_type: 'sms',
      api_key: '',
      api_secret: '',
      account_sid: '',
      auth_token: '',
      phone_number: '',
      business_account_id: '',
      cost_per_sms: 0.01,
      cost_per_whatsapp_message: 0.02,
    });
    setEditingProvider(null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name.includes('cost') ? parseFloat(value) : value,
    }));
  };

  return (
    <Box sx={{ p: 2 }}>
      <Card>
        <CardHeader
          title="SMS & WhatsApp Providers"
          subheader="Configure messaging service providers"
          action={
            <Button
              startDecorator={<FaPlus />}
              onClick={() => {
                resetForm();
                setShowModal(true);
              }}
            >
              Add Provider
            </Button>
          }
        />
        <CardContent>
          {error && <Alert color="danger" sx={{ mb: 2 }}>{error}</Alert>}
          {success && <Alert color="success" sx={{ mb: 2 }}>{success}</Alert>}

          {loading && <LinearProgress />}

          {providers.length === 0 ? (
            <Alert>No providers configured yet. Add one to get started.</Alert>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Provider</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Phone Number</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Primary</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {providers.map((provider) => (
                  <TableRow key={provider.provider_id}>
                    <TableCell>{provider.provider_name}</TableCell>
                    <TableCell>
                      <Badge>{provider.provider_type}</Badge>
                    </TableCell>
                    <TableCell>{provider.phone_number}</TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        color={provider.enabled ? 'success' : 'danger'}
                        onClick={() => handleToggleStatus(provider.provider_id, provider.enabled)}
                      >
                        {provider.enabled ? 'Enabled' : 'Disabled'}
                      </Button>
                    </TableCell>
                    <TableCell>
                      {provider.is_primary ? (
                        <Badge color="primary">Primary</Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="outlined"
                          onClick={() => handleSetPrimary(provider.provider_id)}
                        >
                          Set Primary
                        </Button>
                      )}
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1}>
                        <Button
                          size="sm"
                          variant="outlined"
                          startDecorator={<FaTest />}
                          onClick={() => handleTestConnection(provider.provider_id)}
                        >
                          Test
                        </Button>
                        <Button
                          size="sm"
                          variant="outlined"
                          startDecorator={<FaEdit />}
                          onClick={() => handleEditProvider(provider)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          color="danger"
                          variant="outlined"
                          startDecorator={<FaTrash />}
                          onClick={() => handleDeleteProvider(provider.provider_id)}
                        >
                          Delete
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Provider Form Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)}>
        <ModalDialog>
          <Typography level="h4">
            {editingProvider ? 'Edit Provider' : 'Add New Provider'}
          </Typography>

          <form onSubmit={handleAddProvider}>
            <Stack spacing={2}>
              <FormControl>
                <FormLabel>Provider Name</FormLabel>
                <Select
                  name="provider_name"
                  value={formData.provider_name}
                  onChange={handleInputChange}
                >
                  <option value="twilio">Twilio</option>
                  <option value="brevo">Brevo</option>
                  <option value="messagebird">MessageBird</option>
                  <option value="custom">Custom</option>
                </Select>
              </FormControl>

              <FormControl>
                <FormLabel>Provider Type</FormLabel>
                <Select
                  name="provider_type"
                  value={formData.provider_type}
                  onChange={handleInputChange}
                >
                  <option value="sms">SMS Only</option>
                  <option value="whatsapp">WhatsApp Only</option>
                  <option value="both">Both SMS & WhatsApp</option>
                </Select>
              </FormControl>

              <FormControl>
                <FormLabel>API Key</FormLabel>
                <Input
                  name="api_key"
                  type="password"
                  value={formData.api_key}
                  onChange={handleInputChange}
                  placeholder="Enter API key"
                  required
                />
              </FormControl>

              {formData.provider_name === 'twilio' && (
                <>
                  <FormControl>
                    <FormLabel>Account SID</FormLabel>
                    <Input
                      name="account_sid"
                      value={formData.account_sid}
                      onChange={handleInputChange}
                      placeholder="Enter Account SID"
                    />
                  </FormControl>

                  <FormControl>
                    <FormLabel>Auth Token</FormLabel>
                    <Input
                      name="auth_token"
                      type="password"
                      value={formData.auth_token}
                      onChange={handleInputChange}
                      placeholder="Enter Auth Token"
                    />
                  </FormControl>
                </>
              )}

              <FormControl>
                <FormLabel>Phone Number</FormLabel>
                <Input
                  name="phone_number"
                  value={formData.phone_number}
                  onChange={handleInputChange}
                  placeholder="+1234567890"
                  required
                />
              </FormControl>

              <FormControl>
                <FormLabel>Cost per SMS</FormLabel>
                <Input
                  name="cost_per_sms"
                  type="number"
                  step="0.0001"
                  value={formData.cost_per_sms}
                  onChange={handleInputChange}
                />
              </FormControl>

              <FormControl>
                <FormLabel>Cost per WhatsApp Message</FormLabel>
                <Input
                  name="cost_per_whatsapp_message"
                  type="number"
                  step="0.0001"
                  value={formData.cost_per_whatsapp_message}
                  onChange={handleInputChange}
                />
              </FormControl>

              <Stack direction="row" spacing={1}>
                <Button type="submit" disabled={loading}>
                  {loading ? <CircularProgress size="sm" /> : 'Save'}
                </Button>
                <Button variant="outlined" onClick={() => setShowModal(false)}>
                  Cancel
                </Button>
              </Stack>
            </Stack>
          </form>
        </ModalDialog>
      </Modal>
    </Box>
  );
};

export default ProviderSetup;

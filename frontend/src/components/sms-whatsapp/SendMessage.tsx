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
  LinearProgress,
  CircularProgress,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from '@mui/joy';
import { FaSend, FaCheckCircle, FaTimesCircle } from 'react-icons/fa';
import { logger } from '@utils/logger';

interface Template {
  template_id: string;
  template_name: string;
  template_type: string;
  channel: 'sms' | 'whatsapp';
  sms_content: string;
  variables_required?: string[];
}

interface Recipient {
  id: string;
  name: string;
  phone?: string;
}

interface SendMessageProps {
  tenantId: string;
}

/**
 * Send Message Component
 * Allows users to send SMS/WhatsApp messages
 */
export const SendMessage: React.FC<SendMessageProps> = ({ tenantId }) => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [sentMessages, setSentMessages] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    recipient_ids: [] as string[],
    template_id: '',
    channel: 'sms' as const,
    message_content: '',
    template_variables: {} as Record<string, string>,
  });

  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);

  useEffect(() => {
    fetchTemplates();
  }, [tenantId]);

  const fetchTemplates = async () => {
    try {
      const response = await fetch('/api/v1/sms-whatsapp/templates', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      });

      if (!response.ok) throw new Error('Failed to fetch templates');
      const data = await response.json();
      setTemplates(data.data || []);
    } catch (err) {
      logger.error(`Template fetch error: ${err}`);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (formData.recipient_ids.length === 0) {
        throw new Error('Please select at least one recipient');
      }

      if (!formData.template_id && !formData.message_content) {
        throw new Error('Please select a template or enter a message');
      }

      const payload = {
        recipient_ids: formData.recipient_ids,
        template_id: formData.template_id || undefined,
        channel: formData.channel,
        message_content: formData.message_content || undefined,
        template_variables: Object.keys(formData.template_variables).length > 0
          ? formData.template_variables
          : undefined,
      };

      const endpoint = formData.recipient_ids.length === 1
        ? '/api/v1/sms-whatsapp/messages/send'
        : '/api/v1/sms-whatsapp/messages/bulk-send';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error('Failed to send message');

      const data = await response.json();
      setSuccess(`Message${formData.recipient_ids.length > 1 ? 's' : ''} sent successfully`);
      setSentMessages(data.data || []);
      resetForm();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error sending message';
      setError(message);
      logger.error(`Send message error: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleTemplateChange = (templateId: string) => {
    const template = templates.find(t => t.template_id === templateId);
    setSelectedTemplate(template || null);
    setFormData(prev => ({
      ...prev,
      template_id: templateId,
      channel: template?.channel || 'sms',
    }));

    if (template?.variables_required) {
      const vars: Record<string, string> = {};
      template.variables_required.forEach(v => {
        vars[v] = '';
      });
      setFormData(prev => ({
        ...prev,
        template_variables: vars,
      }));
    }
  };

  const handleVariableChange = (variableName: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      template_variables: {
        ...prev.template_variables,
        [variableName]: value,
      },
    }));
  };

  const handleRecipientToggle = (recipientId: string) => {
    setFormData(prev => ({
      ...prev,
      recipient_ids: prev.recipient_ids.includes(recipientId)
        ? prev.recipient_ids.filter(id => id !== recipientId)
        : [...prev.recipient_ids, recipientId],
    }));
  };

  const resetForm = () => {
    setFormData({
      recipient_ids: [],
      template_id: '',
      channel: 'sms',
      message_content: '',
      template_variables: {},
    });
    setSelectedTemplate(null);
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  return (
    <Box sx={{ p: 2, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
      {/* Send Form */}
      <Card>
        <CardHeader
          title="Send Message"
          subheader="Send SMS or WhatsApp messages"
        />
        <CardContent>
          {error && <Alert color="danger" sx={{ mb: 2 }}>{error}</Alert>}
          {success && <Alert color="success" sx={{ mb: 2 }}>{success}</Alert>}

          {loading && <LinearProgress />}

          <form onSubmit={handleSendMessage}>
            <Stack spacing={2}>
              <FormControl>
                <FormLabel>Channel</FormLabel>
                <Select
                  name="channel"
                  value={formData.channel}
                  onChange={handleInputChange}
                >
                  <option value="sms">SMS</option>
                  <option value="whatsapp">WhatsApp</option>
                </Select>
              </FormControl>

              <FormControl>
                <FormLabel>Message Source</FormLabel>
                <Stack spacing={1}>
                  <Typography level="body-sm">Use Template:</Typography>
                  <Select
                    value={formData.template_id}
                    onChange={(e, value) => handleTemplateChange(value as string)}
                  >
                    <option value="">None</option>
                    {templates.map(t => (
                      <option key={t.template_id} value={t.template_id}>
                        {t.template_name}
                      </option>
                    ))}
                  </Select>
                </Stack>

                {!selectedTemplate && (
                  <>
                    <Typography level="body-sm" sx={{ mt: 2 }}>Or write custom message:</Typography>
                    <Textarea
                      name="message_content"
                      value={formData.message_content}
                      onChange={handleInputChange}
                      placeholder="Enter your message"
                      minRows={4}
                    />
                  </>
                )}
              </FormControl>

              {selectedTemplate?.variables_required && selectedTemplate.variables_required.length > 0 && (
                <Box sx={{ border: '1px solid #ddd', p: 2, borderRadius: 8 }}>
                  <FormLabel>Template Variables</FormLabel>
                  <Stack spacing={1} sx={{ mt: 1 }}>
                    {selectedTemplate.variables_required.map(varName => (
                      <FormControl key={varName}>
                        <FormLabel>{varName}</FormLabel>
                        <Input
                          value={formData.template_variables[varName] || ''}
                          onChange={(e) => handleVariableChange(varName, e.target.value)}
                          placeholder={`Enter ${varName}`}
                        />
                      </FormControl>
                    ))}
                  </Stack>
                </Box>
              )}

              <FormControl>
                <FormLabel>Recipients ({formData.recipient_ids.length} selected)</FormLabel>
                <Box sx={{
                  border: '1px solid #ddd',
                  maxHeight: 200,
                  overflowY: 'auto',
                  p: 1,
                  borderRadius: 4,
                }}>
                  {recipients.length === 0 ? (
                    <Typography level="body-sm">No recipients available</Typography>
                  ) : (
                    <Stack spacing={1}>
                      {recipients.map(recipient => (
                        <Button
                          key={recipient.id}
                          variant={formData.recipient_ids.includes(recipient.id) ? 'solid' : 'outlined'}
                          onClick={() => handleRecipientToggle(recipient.id)}
                          sx={{ justifyContent: 'flex-start' }}
                        >
                          {recipient.name}
                        </Button>
                      ))}
                    </Stack>
                  )}
                </Box>
              </FormControl>

              <Button
                type="submit"
                disabled={loading || formData.recipient_ids.length === 0}
                startDecorator={<FaSend />}
              >
                {loading ? <CircularProgress size="sm" /> : 'Send Message'}
              </Button>
            </Stack>
          </form>
        </CardContent>
      </Card>

      {/* Sent Messages */}
      {sentMessages.length > 0 && (
        <Card>
          <CardHeader
            title="Message Status"
            subheader={`${sentMessages.length} message${sentMessages.length !== 1 ? 's' : ''} sent`}
          />
          <CardContent>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Status</TableCell>
                  <TableCell>Message ID</TableCell>
                  <TableCell>Cost</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sentMessages.map((msg) => (
                  <TableRow key={msg.message_id}>
                    <TableCell>
                      <Chip
                        startDecorator={msg.status === 'sent' ? <FaCheckCircle /> : <FaTimesCircle />}
                        color={msg.status === 'sent' ? 'success' : 'danger'}
                        label={msg.status}
                      />
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.85em' }}>
                      {msg.message_id.substring(0, 8)}...
                    </TableCell>
                    <TableCell>${msg.estimated_cost?.toFixed(4) || '0.00'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default SendMessage;

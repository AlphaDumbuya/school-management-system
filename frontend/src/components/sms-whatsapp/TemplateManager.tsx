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
  Chip,
} from '@mui/joy';
import { FaPlus, FaTrash, FaEdit } from 'react-icons/fa';
import { logger } from '@utils/logger';

interface Template {
  template_id: string;
  template_name: string;
  template_type: string;
  channel: 'sms' | 'whatsapp';
  sms_content: string;
  is_active: boolean;
  estimated_sms_parts: number;
  created_at: string;
}

interface TemplateManagerProps {
  tenantId: string;
}

const TEMPLATE_TYPES = [
  'event_reminder',
  'attendance_alert',
  'grade_notification',
  'payment_reminder',
  'disciplinary_action',
  'enrollment_confirmation',
  'schedule_update',
  'general',
];

const TEMPLATE_EXAMPLES: Record<string, Record<string, string>> = {
  event_reminder: {
    sms: 'Reminder: {{event_name}} on {{date}} at {{time}} at {{location}}',
    whatsapp: '🗓️ Reminder\n\nEvent: {{event_name}}\nDate: {{date}}\nTime: {{time}}\nLocation: {{location}}',
  },
  attendance_alert: {
    sms: 'Attendance alert: {{student_name}} {{status}} for {{subject}} class on {{date}}',
    whatsapp: '📋 Attendance Alert\n\nStudent: {{student_name}}\nStatus: {{status}}\nSubject: {{subject}}\nDate: {{date}}',
  },
  grade_notification: {
    sms: '{{student_name}} received {{grade}} in {{subject}} - {{term}} {{year}}',
    whatsapp: '📊 Grade Report\n\nStudent: {{student_name}}\nGrade: {{grade}}\nSubject: {{subject}}\nTerm: {{term}} {{year}}',
  },
  payment_reminder: {
    sms: 'Payment due: {{amount}} for {{term}} - Due: {{due_date}}',
    whatsapp: '💳 Payment Reminder\n\nAmount: {{amount}}\nTerm: {{term}}\nDue Date: {{due_date}}\nLink: {{payment_link}}',
  },
  disciplinary_action: {
    sms: 'Disciplinary action recorded for {{student_name}}: {{action_type}}',
    whatsapp: '⚠️ Disciplinary Action\n\nStudent: {{student_name}}\nAction: {{action_type}}\nDate: {{date}}\nDetails: {{details}}',
  },
  enrollment_confirmation: {
    sms: 'Enrollment confirmed for {{student_name}} in {{class}} - Ref: {{reference}}',
    whatsapp: '✅ Enrollment Confirmed\n\nStudent: {{student_name}}\nClass: {{class}}\nReference: {{reference}}\nReporting Date: {{date}}',
  },
  schedule_update: {
    sms: 'Schedule update: {{subject}} on {{old_date}} moved to {{new_date}} at {{time}}',
    whatsapp: '📅 Schedule Update\n\nSubject: {{subject}}\nOld Date: {{old_date}}\nNew Date: {{new_date}}\nTime: {{time}}',
  },
  general: {
    sms: '{{message}}',
    whatsapp: '{{message}}',
  },
};

/**
 * SMS & WhatsApp Template Management Component
 * Allows administrators to create and manage message templates
 */
export const TemplateManager: React.FC<TemplateManagerProps> = ({ tenantId }) => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Partial<Template> | null>(null);
  const [selectedType, setSelectedType] = useState<string>('');
  const [selectedChannel, setSelectedChannel] = useState<'sms' | 'whatsapp'>('sms');

  const [formData, setFormData] = useState({
    template_name: '',
    description: '',
    template_type: 'event_reminder' as const,
    channel: 'sms' as const,
    sms_content: '',
    whatsapp_content: '',
    variables_required: [] as string[],
  });

  useEffect(() => {
    fetchTemplates();
  }, [tenantId, selectedType]);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      let url = '/api/v1/sms-whatsapp/templates';
      if (selectedType) {
        url += `?type=${selectedType}`;
      }

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      });

      if (!response.ok) throw new Error('Failed to fetch templates');
      const data = await response.json();
      setTemplates(data.data || []);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error fetching templates';
      setError(message);
      logger.error(`Template fetch error: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const endpoint = editingTemplate?.template_id
        ? `/api/v1/sms-whatsapp/templates/${editingTemplate.template_id}`
        : '/api/v1/sms-whatsapp/templates';

      const method = editingTemplate?.template_id ? 'PATCH' : 'POST';

      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error('Failed to save template');

      setSuccess(editingTemplate ? 'Template updated' : 'Template created');
      setShowModal(false);
      resetForm();
      await fetchTemplates();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error saving template';
      setError(message);
      logger.error(`Template save error: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!window.confirm('Delete this template?')) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/v1/sms-whatsapp/templates/${templateId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      });

      if (!response.ok) throw new Error('Failed to delete template');

      setSuccess('Template deleted');
      await fetchTemplates();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error deleting template';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleEditTemplate = (template: Template) => {
    setEditingTemplate(template);
    setFormData({
      template_name: template.template_name,
      description: '',
      template_type: template.template_type as any,
      channel: template.channel,
      sms_content: template.sms_content,
      whatsapp_content: template.sms_content,
      variables_required: [],
    });
    setShowModal(true);
  };

  const handleUseTemplate = (templateType: string, channel: 'sms' | 'whatsapp') => {
    const example = TEMPLATE_EXAMPLES[templateType]?.[channel] || '';
    setFormData(prev => ({
      ...prev,
      template_type: templateType as any,
      channel,
      sms_content: channel === 'sms' ? example : prev.sms_content,
      whatsapp_content: channel === 'whatsapp' ? example : prev.whatsapp_content,
    }));
    setSelectedChannel(channel);
  };

  const resetForm = () => {
    setFormData({
      template_name: '',
      description: '',
      template_type: 'event_reminder',
      channel: 'sms',
      sms_content: '',
      whatsapp_content: '',
      variables_required: [],
    });
    setEditingTemplate(null);
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

  const extractVariables = (content: string): string[] => {
    const regex = /{{(\w+)}}/g;
    const matches = [...content.matchAll(regex)];
    return [...new Set(matches.map(m => m[1]))];
  };

  return (
    <Box sx={{ p: 2 }}>
      <Card>
        <CardHeader
          title="Message Templates"
          subheader="Create and manage message templates"
          action={
            <Button
              startDecorator={<FaPlus />}
              onClick={() => {
                resetForm();
                setShowModal(true);
              }}
            >
              New Template
            </Button>
          }
        />
        <CardContent>
          {error && <Alert color="danger" sx={{ mb: 2 }}>{error}</Alert>}
          {success && <Alert color="success" sx={{ mb: 2 }}>{success}</Alert>}

          {loading && <LinearProgress />}

          {/* Filter by type */}
          <Box sx={{ mb: 2 }}>
            <FormControl>
              <FormLabel>Filter by Type</FormLabel>
              <Select
                value={selectedType}
                onChange={(e, value) => setSelectedType(value as string)}
              >
                <option value="">All Types</option>
                {TEMPLATE_TYPES.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </Select>
            </FormControl>
          </Box>

          {templates.length === 0 ? (
            <Alert>No templates yet. Create one to get started.</Alert>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Template Name</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Channel</TableCell>
                  <TableCell>SMS Parts</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {templates.map((template) => (
                  <TableRow key={template.template_id}>
                    <TableCell>{template.template_name}</TableCell>
                    <TableCell>
                      <Badge>{template.template_type}</Badge>
                    </TableCell>
                    <TableCell>{template.channel}</TableCell>
                    <TableCell>{template.estimated_sms_parts}</TableCell>
                    <TableCell>
                      <Chip
                        color={template.is_active ? 'success' : 'danger'}
                        label={template.is_active ? 'Active' : 'Inactive'}
                      />
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1}>
                        <Button
                          size="sm"
                          variant="outlined"
                          startDecorator={<FaEdit />}
                          onClick={() => handleEditTemplate(template)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          color="danger"
                          variant="outlined"
                          startDecorator={<FaTrash />}
                          onClick={() => handleDeleteTemplate(template.template_id)}
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

      {/* Template Form Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)}>
        <ModalDialog size="lg">
          <Typography level="h4">
            {editingTemplate ? 'Edit Template' : 'Create Template'}
          </Typography>

          <form onSubmit={handleSaveTemplate}>
            <Stack spacing={2}>
              <FormControl>
                <FormLabel>Template Name</FormLabel>
                <Input
                  name="template_name"
                  value={formData.template_name}
                  onChange={handleInputChange}
                  placeholder="e.g., Event Reminder"
                  required
                />
              </FormControl>

              <FormControl>
                <FormLabel>Template Type</FormLabel>
                <Select
                  name="template_type"
                  value={formData.template_type}
                  onChange={handleInputChange}
                >
                  {TEMPLATE_TYPES.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </Select>
              </FormControl>

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

              {/* Template examples */}
              <Box sx={{ border: '1px solid #ddd', p: 2, borderRadius: 8 }}>
                <Typography level="body-sm" sx={{ mb: 1 }}>Quick Start Examples:</Typography>
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                  {TEMPLATE_TYPES.map(type => (
                    <Button
                      key={type}
                      size="sm"
                      variant="outlined"
                      onClick={() => handleUseTemplate(type, 'sms')}
                    >
                      {type}
                    </Button>
                  ))}
                </Stack>
              </Box>

              <FormControl>
                <FormLabel>Message Content</FormLabel>
                <Textarea
                  name={formData.channel === 'sms' ? 'sms_content' : 'whatsapp_content'}
                  value={formData.channel === 'sms' ? formData.sms_content : formData.whatsapp_content}
                  onChange={handleInputChange}
                  placeholder="Use {{variable}} for dynamic content"
                  minRows={5}
                  required
                />
                <Typography level="body-xs" sx={{ mt: 1, color: 'gray' }}>
                  Variables: {extractVariables(
                    formData.channel === 'sms' ? formData.sms_content : formData.whatsapp_content
                  ).join(', ') || 'None detected'}
                </Typography>
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

export default TemplateManager;

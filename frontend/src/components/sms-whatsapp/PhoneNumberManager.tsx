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
  Checkbox,
} from '@mui/joy';
import { FaPlus, FaTrash, FaEdit, FaCheckCircle, FaClock } from 'react-icons/fa';
import { logger } from '@utils/logger';

interface PhoneNumber {
  phone_id: string;
  phone_number: string;
  country_code: string;
  phone_type: 'personal' | 'home' | 'work' | 'emergency';
  is_primary: boolean;
  sms_enabled: boolean;
  whatsapp_enabled: boolean;
  verified: boolean;
  created_at: string;
}

interface PhoneNumberManagerProps {
  userId?: string;
  isAdmin?: boolean;
}

/**
 * Phone Number Management Component
 * Allows users to add, verify, and manage phone numbers
 */
export const PhoneNumberManager: React.FC<PhoneNumberManagerProps> = ({
  userId,
  isAdmin = false,
}) => {
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [selectedPhone, setSelectedPhone] = useState<PhoneNumber | null>(null);
  const [verificationCode, setVerificationCode] = useState('');

  const [formData, setFormData] = useState({
    phone_number: '',
    country_code: 'US',
    phone_type: 'personal' as const,
    is_primary: false,
    sms_enabled: true,
    whatsapp_enabled: false,
  });

  useEffect(() => {
    fetchPhoneNumbers();
  }, [userId]);

  const fetchPhoneNumbers = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/v1/sms-whatsapp/phone-numbers', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      });

      if (!response.ok) throw new Error('Failed to fetch phone numbers');
      const data = await response.json();
      setPhoneNumbers(data.data || []);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error fetching phone numbers';
      setError(message);
      logger.error(`Phone fetch error: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAddPhoneNumber = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/v1/sms-whatsapp/phone-numbers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error('Failed to add phone number');

      setSuccess('Phone number added. Please verify it.');
      setShowAddModal(false);
      resetForm();
      await fetchPhoneNumbers();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error adding phone';
      setError(message);
      logger.error(`Add phone error: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyPhoneNumber = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!selectedPhone) throw new Error('No phone selected');

      const response = await fetch(
        `/api/v1/sms-whatsapp/phone-numbers/${selectedPhone.phone_id}/verify`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify({ verification_code: verificationCode }),
        }
      );

      if (!response.ok) throw new Error('Invalid verification code');

      setSuccess('Phone number verified successfully');
      setShowVerifyModal(false);
      setVerificationCode('');
      await fetchPhoneNumbers();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error verifying phone';
      setError(message);
      logger.error(`Verify phone error: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async (phoneId: string) => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/v1/sms-whatsapp/phone-numbers/${phoneId}/resend-code`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        }
      );

      if (!response.ok) throw new Error('Failed to resend code');
      setSuccess('Verification code resent');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error resending code';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePhoneNumber = async (phoneId: string) => {
    if (!window.confirm('Delete this phone number?')) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/v1/sms-whatsapp/phone-numbers/${phoneId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      });

      if (!response.ok) throw new Error('Failed to delete phone');
      setSuccess('Phone number deleted');
      await fetchPhoneNumbers();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error deleting phone';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target as HTMLInputElement;
    const fieldValue = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;

    setFormData(prev => ({
      ...prev,
      [name]: fieldValue,
    }));
  };

  const resetForm = () => {
    setFormData({
      phone_number: '',
      country_code: 'US',
      phone_type: 'personal',
      is_primary: false,
      sms_enabled: true,
      whatsapp_enabled: false,
    });
  };

  const openVerifyModal = (phone: PhoneNumber) => {
    setSelectedPhone(phone);
    setShowVerifyModal(true);
  };

  const COUNTRY_CODES = [
    { code: 'NG', name: 'Nigeria (+234)' },
    { code: 'US', name: 'United States (+1)' },
    { code: 'GB', name: 'United Kingdom (+44)' },
    { code: 'CA', name: 'Canada (+1)' },
    { code: 'AU', name: 'Australia (+61)' },
  ];

  return (
    <Box sx={{ p: 2 }}>
      <Card>
        <CardHeader
          title="Phone Numbers"
          subheader="Manage your phone numbers for SMS & WhatsApp"
          action={
            <Button
              startDecorator={<FaPlus />}
              onClick={() => {
                resetForm();
                setShowAddModal(true);
              }}
            >
              Add Number
            </Button>
          }
        />
        <CardContent>
          {error && <Alert color="danger" sx={{ mb: 2 }}>{error}</Alert>}
          {success && <Alert color="success" sx={{ mb: 2 }}>{success}</Alert>}

          {loading && <LinearProgress />}

          {phoneNumbers.length === 0 ? (
            <Alert>No phone numbers added yet. Add one to get started.</Alert>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Phone Number</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Verified</TableCell>
                  <TableCell>SMS</TableCell>
                  <TableCell>WhatsApp</TableCell>
                  <TableCell>Primary</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {phoneNumbers.map((phone) => (
                  <TableRow key={phone.phone_id}>
                    <TableCell sx={{ fontWeight: 'bold' }}>
                      {phone.phone_number}
                    </TableCell>
                    <TableCell>
                      <Badge>{phone.phone_type}</Badge>
                    </TableCell>
                    <TableCell>
                      {phone.verified ? (
                        <Badge color="success" startDecorator={<FaCheckCircle />}>
                          Verified
                        </Badge>
                      ) : (
                        <Badge color="warning" startDecorator={<FaClock />}>
                          Pending
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {phone.sms_enabled ? (
                        <Badge color="success">Enabled</Badge>
                      ) : (
                        <Badge color="neutral">Disabled</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {phone.whatsapp_enabled ? (
                        <Badge color="success">Enabled</Badge>
                      ) : (
                        <Badge color="neutral">Disabled</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {phone.is_primary ? (
                        <Badge color="primary">Primary</Badge>
                      ) : (
                        <Badge color="neutral">Secondary</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1}>
                        {!phone.verified && (
                          <Button
                            size="sm"
                            variant="outlined"
                            onClick={() => openVerifyModal(phone)}
                          >
                            Verify
                          </Button>
                        )}
                        {!phone.verified && (
                          <Button
                            size="sm"
                            variant="outlined"
                            onClick={() => handleResendCode(phone.phone_id)}
                          >
                            Resend
                          </Button>
                        )}
                        <Button
                          size="sm"
                          color="danger"
                          variant="outlined"
                          startDecorator={<FaTrash />}
                          onClick={() => handleDeletePhoneNumber(phone.phone_id)}
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

      {/* Add Phone Modal */}
      <Modal open={showAddModal} onClose={() => setShowAddModal(false)}>
        <ModalDialog>
          <Typography level="h4">Add Phone Number</Typography>

          <form onSubmit={handleAddPhoneNumber}>
            <Stack spacing={2}>
              <FormControl>
                <FormLabel>Country</FormLabel>
                <Select
                  name="country_code"
                  value={formData.country_code}
                  onChange={handleInputChange}
                >
                  {COUNTRY_CODES.map(c => (
                    <option key={c.code} value={c.code}>{c.name}</option>
                  ))}
                </Select>
              </FormControl>

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
                <FormLabel>Phone Type</FormLabel>
                <Select
                  name="phone_type"
                  value={formData.phone_type}
                  onChange={handleInputChange}
                >
                  <option value="personal">Personal</option>
                  <option value="home">Home</option>
                  <option value="work">Work</option>
                  <option value="emergency">Emergency</option>
                </Select>
              </FormControl>

              <FormControl>
                <Checkbox
                  label="SMS Enabled"
                  name="sms_enabled"
                  checked={formData.sms_enabled}
                  onChange={handleInputChange}
                />
              </FormControl>

              <FormControl>
                <Checkbox
                  label="WhatsApp Enabled"
                  name="whatsapp_enabled"
                  checked={formData.whatsapp_enabled}
                  onChange={handleInputChange}
                />
              </FormControl>

              <FormControl>
                <Checkbox
                  label="Set as Primary"
                  name="is_primary"
                  checked={formData.is_primary}
                  onChange={handleInputChange}
                />
              </FormControl>

              <Stack direction="row" spacing={1}>
                <Button type="submit" disabled={loading}>
                  {loading ? <CircularProgress size="sm" /> : 'Add'}
                </Button>
                <Button variant="outlined" onClick={() => setShowAddModal(false)}>
                  Cancel
                </Button>
              </Stack>
            </Stack>
          </form>
        </ModalDialog>
      </Modal>

      {/* Verify Phone Modal */}
      <Modal open={showVerifyModal} onClose={() => setShowVerifyModal(false)}>
        <ModalDialog>
          <Typography level="h4">Verify Phone Number</Typography>
          <Typography level="body-sm">
            Enter the verification code sent to {selectedPhone?.phone_number}
          </Typography>

          <form onSubmit={handleVerifyPhoneNumber}>
            <Stack spacing={2}>
              <FormControl>
                <FormLabel>Verification Code</FormLabel>
                <Input
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  placeholder="000000"
                  maxLength={6}
                  required
                />
              </FormControl>

              <Stack direction="row" spacing={1}>
                <Button type="submit" disabled={loading || verificationCode.length !== 6}>
                  {loading ? <CircularProgress size="sm" /> : 'Verify'}
                </Button>
                <Button variant="outlined" onClick={() => setShowVerifyModal(false)}>
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

export default PhoneNumberManager;

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Grid,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  LinearProgress,
  Alert,
  Select,
  FormControl,
  FormLabel,
  Stack,
} from '@mui/joy';
import { FaCheckCircle, FaTimesCircle, FaDollarSign, FaChartBar } from 'react-icons/fa';
import { logger } from '@utils/logger';

interface AnalyticsData {
  analytics_date: string;
  channel: 'sms' | 'whatsapp';
  provider_name: string;
  messages_sent: number;
  messages_delivered: number;
  messages_failed: number;
  messages_bounced: number;
  total_cost: number;
  delivery_rate: string;
}

interface AnalyticsDashboardProps {
  tenantId: string;
}

/**
 * SMS & WhatsApp Analytics Dashboard
 * Displays messaging statistics and analytics
 */
export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ tenantId }) => {
  const [analytics, setAnalytics] = useState<AnalyticsData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState({
    channel: 'all' as 'all' | 'sms' | 'whatsapp',
    date_from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    date_to: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    fetchAnalytics();
  }, [tenantId, filters]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      let url = '/api/v1/sms-whatsapp/analytics?';
      if (filters.channel !== 'all') {
        url += `channel=${filters.channel}&`;
      }
      if (filters.date_from) {
        url += `date_from=${filters.date_from}&`;
      }
      if (filters.date_to) {
        url += `date_to=${filters.date_to}`;
      }

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      });

      if (!response.ok) throw new Error('Failed to fetch analytics');
      const data = await response.json();
      setAnalytics(data.data || []);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error fetching analytics';
      setError(message);
      logger.error(`Analytics fetch error: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  // Calculate totals
  const totals = {
    sent: analytics.reduce((sum, a) => sum + (a.messages_sent || 0), 0),
    delivered: analytics.reduce((sum, a) => sum + (a.messages_delivered || 0), 0),
    failed: analytics.reduce((sum, a) => sum + (a.messages_failed || 0), 0),
    bounced: analytics.reduce((sum, a) => sum + (a.messages_bounced || 0), 0),
    cost: analytics.reduce((sum, a) => sum + (a.total_cost || 0), 0),
  };

  const deliveryRate = totals.sent > 0
    ? ((totals.delivered / totals.sent) * 100).toFixed(2)
    : '0.00';

  const failureRate = totals.sent > 0
    ? ((totals.failed / totals.sent) * 100).toFixed(2)
    : '0.00';

  return (
    <Box sx={{ p: 2 }}>
      {/* Filters */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction="row" spacing={2}>
            <FormControl sx={{ minWidth: 120 }}>
              <FormLabel>Channel</FormLabel>
              <Select
                value={filters.channel}
                onChange={(e, value) =>
                  setFilters(prev => ({ ...prev, channel: value as any }))
                }
              >
                <option value="all">All Channels</option>
                <option value="sms">SMS</option>
                <option value="whatsapp">WhatsApp</option>
              </Select>
            </FormControl>

            <FormControl sx={{ minWidth: 150 }}>
              <FormLabel>From Date</FormLabel>
              <Input
                type="date"
                value={filters.date_from}
                onChange={(e) =>
                  setFilters(prev => ({ ...prev, date_from: e.target.value }))
                }
              />
            </FormControl>

            <FormControl sx={{ minWidth: 150 }}>
              <FormLabel>To Date</FormLabel>
              <Input
                type="date"
                value={filters.date_to}
                onChange={(e) =>
                  setFilters(prev => ({ ...prev, date_to: e.target.value }))
                }
              />
            </FormControl>
          </Stack>
        </CardContent>
      </Card>

      {error && <Alert color="danger" sx={{ mb: 2 }}>{error}</Alert>}

      {loading && <LinearProgress />}

      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Stat>
                <StatLabel>Total Sent</StatLabel>
                <StatNumber>{totals.sent.toLocaleString()}</StatNumber>
                <StatHelpText sx={{ color: 'blue' }}>Messages</StatHelpText>
              </Stat>
            </CardContent>
          </Card>
        </Grid>

        <Grid xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Stat>
                <StatLabel>Delivered</StatLabel>
                <StatNumber sx={{ color: 'green' }}>
                  {totals.delivered.toLocaleString()}
                </StatNumber>
                <StatHelpText>{deliveryRate}% delivery rate</StatHelpText>
              </Stat>
            </CardContent>
          </Card>
        </Grid>

        <Grid xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Stat>
                <StatLabel>Failed</StatLabel>
                <StatNumber sx={{ color: 'red' }}>
                  {totals.failed.toLocaleString()}
                </StatNumber>
                <StatHelpText>{failureRate}% failure rate</StatHelpText>
              </Stat>
            </CardContent>
          </Card>
        </Grid>

        <Grid xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Stat>
                <StatLabel>Total Cost</StatLabel>
                <StatNumber sx={{ color: 'orange' }}>
                  ${totals.cost.toFixed(2)}
                </StatNumber>
                <StatHelpText>Across all providers</StatHelpText>
              </Stat>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Detailed Table */}
      <Card>
        <CardHeader
          title="Daily Analytics"
          subheader={`${analytics.length} days of data`}
        />
        <CardContent>
          {analytics.length === 0 ? (
            <Alert>No analytics data available for the selected period.</Alert>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Channel</TableCell>
                  <TableCell>Provider</TableCell>
                  <TableCell>Sent</TableCell>
                  <TableCell>Delivered</TableCell>
                  <TableCell>Failed</TableCell>
                  <TableCell>Cost</TableCell>
                  <TableCell>Rate</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {analytics.map((record, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      {new Date(record.analytics_date).toLocaleDateString()}
                    </TableCell>
                    <TableCell sx={{ textTransform: 'uppercase' }}>
                      {record.channel}
                    </TableCell>
                    <TableCell>{record.provider_name}</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>
                      {record.messages_sent.toLocaleString()}
                    </TableCell>
                    <TableCell sx={{ color: 'green' }}>
                      {record.messages_delivered.toLocaleString()}
                    </TableCell>
                    <TableCell sx={{ color: 'red' }}>
                      {record.messages_failed.toLocaleString()}
                    </TableCell>
                    <TableCell sx={{ color: 'orange' }}>
                      ${record.total_cost.toFixed(2)}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>
                      {record.delivery_rate}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Summary Statistics */}
      <Card sx={{ mt: 2 }}>
        <CardHeader title="Summary" />
        <CardContent>
          <Grid container spacing={2}>
            <Grid xs={12} sm={6} md={3}>
              <Stat variant="outlined">
                <StatLabel>Average Delivery Rate</StatLabel>
                <StatNumber sx={{ color: 'green' }}>{deliveryRate}%</StatNumber>
              </Stat>
            </Grid>
            <Grid xs={12} sm={6} md={3}>
              <Stat variant="outlined">
                <StatLabel>Average Failure Rate</StatLabel>
                <StatNumber sx={{ color: 'red' }}>{failureRate}%</StatNumber>
              </Stat>
            </Grid>
            <Grid xs={12} sm={6} md={3}>
              <Stat variant="outlined">
                <StatLabel>Average Cost per SMS</StatLabel>
                <StatNumber>
                  ${totals.sent > 0 ? (totals.cost / totals.sent).toFixed(4) : '0.00'}
                </StatNumber>
              </Stat>
            </Grid>
            <Grid xs={12} sm={6} md={3}>
              <Stat variant="outlined">
                <StatLabel>Total Messages</StatLabel>
                <StatNumber>{totals.sent.toLocaleString()}</StatNumber>
              </Stat>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </Box>
  );
};

export default AnalyticsDashboard;

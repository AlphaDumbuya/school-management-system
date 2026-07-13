import React, { useState } from 'react';
import {
  Box,
  Container,
  Tabs,
  TabList,
  Tab,
  TabPanel,
  Sheet,
  Typography,
} from '@mui/joy';
import {
  FaCog,
  FaEnvelope,
  FaPhone,
  FaChartBar,
  FaEdit,
  FaSend,
} from 'react-icons/fa';
import { MainLayout } from '@components/layout/MainLayout';
import ProviderSetup from '@components/sms-whatsapp/ProviderSetup';
import TemplateManager from '@components/sms-whatsapp/TemplateManager';
import SendMessage from '@components/sms-whatsapp/SendMessage';
import PhoneNumberManager from '@components/sms-whatsapp/PhoneNumberManager';
import AnalyticsDashboard from '@components/sms-whatsapp/AnalyticsDashboard';

interface TabConfig {
  label: string;
  icon: React.ReactNode;
  component: React.ReactNode;
  adminOnly?: boolean;
}

/**
 * SMS & WhatsApp Dashboard Page
 * Central hub for SMS/WhatsApp messaging management
 */
export const SMSWhatsAppDashboard: React.FC = () => {
  const [selectedTab, setSelectedTab] = useState(0);
  const [tenantId] = useState(localStorage.getItem('tenant_id') || '');
  const [userRole] = useState(localStorage.getItem('user_role') || '');

  const isAdmin = ['admin', 'principal'].includes(userRole);

  const tabs: TabConfig[] = [
    {
      label: 'Manage Providers',
      icon: <FaCog />,
      component: <ProviderSetup tenantId={tenantId} />,
      adminOnly: true,
    },
    {
      label: 'Templates',
      icon: <FaEdit />,
      component: <TemplateManager tenantId={tenantId} />,
      adminOnly: true,
    },
    {
      label: 'Send Message',
      icon: <FaSend />,
      component: <SendMessage tenantId={tenantId} />,
    },
    {
      label: 'My Phone Numbers',
      icon: <FaPhone />,
      component: <PhoneNumberManager />,
    },
    {
      label: 'Analytics',
      icon: <FaChartBar />,
      component: <AnalyticsDashboard tenantId={tenantId} />,
      adminOnly: true,
    },
  ];

  // Filter tabs based on user role
  const visibleTabs = tabs.filter(tab => !tab.adminOnly || isAdmin);

  return (
    <MainLayout>
      <Container maxWidth="xl" sx={{ py: 3 }}>
        {/* Page Header */}
        <Sheet
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            p: 2,
            mb: 3,
            borderRadius: 'md',
            boxShadow: 'sm',
          }}
        >
          <div>
            <Typography level="h2" component="h1">
              💬 SMS & WhatsApp Management
            </Typography>
            <Typography level="body-sm" sx={{ mt: 1, color: 'neutral.600' }}>
              Manage messaging providers, templates, and communications
            </Typography>
          </div>
        </Sheet>

        {/* Tabs */}
        <Sheet sx={{ borderRadius: 'md', overflow: 'hidden', boxShadow: 'md' }}>
          <Tabs
            value={selectedTab}
            onChange={(event, value) => setSelectedTab(value as number)}
            sx={{ p: 0 }}
          >
            <TabList
              sx={{
                display: 'flex',
                backgroundColor: 'neutral.100',
                borderBottom: '2px solid',
                borderColor: 'neutral.200',
                p: 0,
              }}
            >
              {visibleTabs.map((tab, idx) => (
                <Tab
                  key={idx}
                  icon={tab.icon}
                  label={tab.label}
                  sx={{
                    flex: 1,
                    py: 2,
                    px: 3,
                    fontSize: '0.95rem',
                    fontWeight: 500,
                    borderBottom: selectedTab === idx ? '3px solid' : 'none',
                    borderColor: selectedTab === idx ? 'primary.main' : 'transparent',
                    '&:hover': {
                      backgroundColor: 'neutral.200',
                    },
                  }}
                />
              ))}
            </TabList>

            {/* Tab Panels */}
            {visibleTabs.map((tab, idx) => (
              <TabPanel key={idx} value={idx} sx={{ p: 0 }}>
                <Box sx={{ backgroundColor: '#fafafa', minHeight: 'calc(100vh - 300px)' }}>
                  {tab.component}
                </Box>
              </TabPanel>
            ))}
          </Tabs>
        </Sheet>

        {/* Footer Help */}
        <Sheet
          sx={{
            mt: 3,
            p: 2,
            borderRadius: 'md',
            backgroundColor: 'info.100',
            borderLeft: '4px solid',
            borderColor: 'info.main',
          }}
        >
          <Typography level="body-sm">
            <strong>Quick Tips:</strong>
          </Typography>
          <Typography level="body-xs" sx={{ mt: 1, whiteSpace: 'pre-wrap' }}>
            • <strong>Providers:</strong> Configure your SMS/WhatsApp service providers (Twilio, Brevo, MessageBird)
            <br />
            • <strong>Templates:</strong> Create reusable message templates with variables for consistent communications
            <br />
            • <strong>Send:</strong> Send individual or bulk messages to recipients
            <br />
            • <strong>Phone Numbers:</strong> Add and verify your phone numbers for receiving/sending messages
            <br />
            • <strong>Analytics:</strong> Track message delivery, costs, and communication metrics
          </Typography>
        </Sheet>
      </Container>
    </MainLayout>
  );
};

export default SMSWhatsAppDashboard;

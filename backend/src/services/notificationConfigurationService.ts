import { NotificationConfiguration, NotificationChannel, NotificationPreferenceTemplate, ConfigurationResponse } from '../types/configuration';

/**
 * Notification Configuration Service
 * Manages notification settings and preferences
 */
export class NotificationConfigurationService {
  private configurations: Map<string, NotificationConfiguration> = new Map();
  private templates: Map<string, NotificationPreferenceTemplate> = new Map();

  /**
   * Initialize default notification configurations
   */
  initializeDefaults(): void {
    const defaultConfigs: NotificationConfiguration[] = [
      {
        id: 'notif-attendance',
        type: 'attendance',
        enabled: true,
        channels: [
          { name: 'email', enabled: true, template: 'attendance_alert' },
          { name: 'sms', enabled: true },
          { name: 'in-app', enabled: true },
        ],
        recipientTypes: ['student', 'parent', 'teacher'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'notif-grades',
        type: 'grades',
        enabled: true,
        channels: [
          { name: 'email', enabled: true, template: 'grade_notification' },
          { name: 'in-app', enabled: true },
          { name: 'push', enabled: true },
        ],
        recipientTypes: ['student', 'parent'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'notif-fees',
        type: 'fees',
        enabled: true,
        channels: [
          { name: 'email', enabled: true, template: 'fee_reminder' },
          { name: 'sms', enabled: true },
          { name: 'in-app', enabled: true },
        ],
        recipientTypes: ['parent'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'notif-events',
        type: 'events',
        enabled: true,
        channels: [
          { name: 'email', enabled: true },
          { name: 'in-app', enabled: true },
          { name: 'push', enabled: true },
        ],
        recipientTypes: ['student', 'parent', 'teacher'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'notif-system',
        type: 'system',
        enabled: true,
        channels: [
          { name: 'email', enabled: true },
          { name: 'in-app', enabled: true },
        ],
        recipientTypes: ['principal', 'super_admin'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    defaultConfigs.forEach(config => this.configurations.set(config.id, config));

    // Initialize default template
    const defaultTemplate: NotificationPreferenceTemplate = {
      id: 'template-default',
      name: 'Default Notification Preferences',
      description: 'Default notification settings for all users',
      preferences: defaultConfigs,
      isDefault: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.templates.set(defaultTemplate.id, defaultTemplate);
  }

  /**
   * Get all notification configurations
   */
  async getAllConfigurations(): Promise<NotificationConfiguration[]> {
    if (this.configurations.size === 0) {
      this.initializeDefaults();
    }
    return Array.from(this.configurations.values());
  }

  /**
   * Get configuration by type
   */
  async getConfigurationByType(type: string): Promise<NotificationConfiguration | null> {
    if (this.configurations.size === 0) {
      this.initializeDefaults();
    }

    const configs = Array.from(this.configurations.values());
    return configs.find(c => c.type === type) || null;
  }

  /**
   * Update notification configuration
   */
  async updateConfiguration(configId: string, updates: Partial<NotificationConfiguration>): Promise<ConfigurationResponse<NotificationConfiguration>> {
    try {
      const config = this.configurations.get(configId);
      if (!config) {
        return {
          success: false,
          error: 'Configuration not found',
          timestamp: new Date().toISOString(),
        };
      }

      const updated: NotificationConfiguration = {
        ...config,
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      this.configurations.set(configId, updated);

      return {
        success: true,
        data: updated,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Enable/disable notification channel
   */
  async toggleChannel(configId: string, channelName: string, enabled: boolean): Promise<ConfigurationResponse<NotificationConfiguration>> {
    try {
      const config = this.configurations.get(configId);
      if (!config) {
        return {
          success: false,
          error: 'Configuration not found',
          timestamp: new Date().toISOString(),
        };
      }

      const channel = config.channels.find(c => c.name === channelName);
      if (!channel) {
        return {
          success: false,
          error: 'Channel not found',
          timestamp: new Date().toISOString(),
        };
      }

      channel.enabled = enabled;
      config.updatedAt = new Date().toISOString();

      return {
        success: true,
        data: config,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Enable/disable entire notification type
   */
  async toggleNotificationType(configId: string, enabled: boolean): Promise<ConfigurationResponse<NotificationConfiguration>> {
    try {
      const config = this.configurations.get(configId);
      if (!config) {
        return {
          success: false,
          error: 'Configuration not found',
          timestamp: new Date().toISOString(),
        };
      }

      config.enabled = enabled;
      config.updatedAt = new Date().toISOString();

      return {
        success: true,
        data: config,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Create preference template
   */
  async createTemplate(
    name: string,
    description: string,
    preferences: NotificationConfiguration[]
  ): Promise<ConfigurationResponse<NotificationPreferenceTemplate>> {
    try {
      const template: NotificationPreferenceTemplate = {
        id: `template-${Date.now()}`,
        name,
        description,
        preferences,
        isDefault: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      this.templates.set(template.id, template);

      return {
        success: true,
        data: template,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get all templates
   */
  async getAllTemplates(): Promise<NotificationPreferenceTemplate[]> {
    if (this.templates.size === 0) {
      this.initializeDefaults();
    }
    return Array.from(this.templates.values());
  }

  /**
   * Get template by ID
   */
  async getTemplate(templateId: string): Promise<NotificationPreferenceTemplate | null> {
    return this.templates.get(templateId) || null;
  }

  /**
   * Get default template
   */
  async getDefaultTemplate(): Promise<NotificationPreferenceTemplate | null> {
    if (this.templates.size === 0) {
      this.initializeDefaults();
    }

    const templates = Array.from(this.templates.values());
    return templates.find(t => t.isDefault) || null;
  }

  /**
   * Apply template to user/group
   */
  async applyTemplate(templateId: string): Promise<ConfigurationResponse<NotificationConfiguration[]>> {
    try {
      const template = await this.getTemplate(templateId);
      if (!template) {
        return {
          success: false,
          error: 'Template not found',
          timestamp: new Date().toISOString(),
        };
      }

      // Clear existing configurations
      this.configurations.clear();

      // Apply template preferences
      template.preferences.forEach(pref => {
        this.configurations.set(pref.id, { ...pref });
      });

      return {
        success: true,
        data: template.preferences,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Check if notification should be sent
   */
  async shouldNotify(
    type: string,
    channel: 'email' | 'sms' | 'push' | 'in-app',
    recipientType: string
  ): Promise<boolean> {
    const config = await this.getConfigurationByType(type);
    if (!config || !config.enabled) return false;

    const channelConfig = config.channels.find(c => c.name === channel);
    if (!channelConfig || !channelConfig.enabled) return false;

    return config.recipientTypes.includes(recipientType);
  }

  /**
   * Get notification status
   */
  async getNotificationStatus(): Promise<{
    enabledTypes: number;
    disabledTypes: number;
    totalChannels: number;
    enabledChannels: number;
  }> {
    const configs = await this.getAllConfigurations();

    const enabledTypes = configs.filter(c => c.enabled).length;
    const disabledTypes = configs.filter(c => !c.enabled).length;

    let totalChannels = 0;
    let enabledChannels = 0;

    configs.forEach(config => {
      config.channels.forEach(channel => {
        totalChannels++;
        if (channel.enabled) enabledChannels++;
      });
    });

    return {
      enabledTypes,
      disabledTypes,
      totalChannels,
      enabledChannels,
    };
  }

  /**
   * Get enabled channels for notification type
   */
  async getEnabledChannels(type: string): Promise<string[]> {
    const config = await this.getConfigurationByType(type);
    if (!config || !config.enabled) return [];

    return config.channels.filter(c => c.enabled).map(c => c.name);
  }

  /**
   * Bulk update channel status
   */
  async bulkUpdateChannels(
    channelName: string,
    enabled: boolean
  ): Promise<ConfigurationResponse<NotificationConfiguration[]>> {
    try {
      const configs = await this.getAllConfigurations();

      configs.forEach(config => {
        const channel = config.channels.find(c => c.name === channelName);
        if (channel) {
          channel.enabled = enabled;
          config.updatedAt = new Date().toISOString();
        }
      });

      return {
        success: true,
        data: configs,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }
}

export default new NotificationConfigurationService();

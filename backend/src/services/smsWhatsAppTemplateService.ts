import db from '@utils/database';
import { logger } from '@utils/logger';
import {
  SMSWhatsAppTemplate,
  CreateTemplateRequest,
  MessageTemplateType,
} from '@types/sms-whatsapp';

/**
 * SMS & WhatsApp Template Service
 * Manages message templates for different notification types
 */
class SMSWhatsAppTemplateService {
  /**
   * Create a new template
   */
  async createTemplate(
    tenantId: string,
    request: CreateTemplateRequest,
    userId: string
  ): Promise<SMSWhatsAppTemplate> {
    try {
      // Check if template already exists
      const existing = await db('sms_whatsapp_templates')
        .where({
          tenant_id: tenantId,
          template_name: request.template_name,
        })
        .first();

      if (existing) {
        throw new Error('Template with this name already exists');
      }

      const smsLength = request.sms_content.length;
      const smsParts = Math.ceil(smsLength / 160);

      const [template] = await db('sms_whatsapp_templates')
        .insert({
          tenant_id: tenantId,
          template_name: request.template_name,
          description: request.description,
          template_type: request.template_type,
          channel: request.channel,
          sms_content: request.sms_content,
          whatsapp_content: request.whatsapp_content,
          variables_required: request.variables_required ? JSON.stringify(request.variables_required) : null,
          message_prefix: request.message_prefix,
          estimated_length: smsLength,
          estimated_sms_parts: smsParts,
          created_by: userId,
          created_at: db.fn.now(),
          updated_at: db.fn.now(),
        })
        .returning('*');

      logger.info(`Template created: ${template.template_id}`);
      return this.formatTemplate(template);
    } catch (error) {
      logger.error(`Error creating template: ${error}`);
      throw new Error(`Failed to create template: ${error}`);
    }
  }

  /**
   * Get template by ID
   */
  async getTemplateById(templateId: string): Promise<SMSWhatsAppTemplate | null> {
    try {
      const template = await db('sms_whatsapp_templates')
        .where({ template_id: templateId })
        .first();

      return template ? this.formatTemplate(template) : null;
    } catch (error) {
      logger.error(`Error fetching template: ${error}`);
      throw new Error(`Failed to fetch template: ${error}`);
    }
  }

  /**
   * Get templates by type and channel
   */
  async getTemplatesByType(
    tenantId: string,
    templateType: MessageTemplateType,
    channel?: string
  ): Promise<SMSWhatsAppTemplate[]> {
    try {
      let query = db('sms_whatsapp_templates')
        .where({
          tenant_id: tenantId,
          template_type: templateType,
          is_active: true,
        });

      if (channel) {
        query = query.where({ channel });
      }

      const templates = await query.orderBy('created_at', 'desc');
      return templates.map(t => this.formatTemplate(t));
    } catch (error) {
      logger.error(`Error fetching templates by type: ${error}`);
      throw new Error(`Failed to fetch templates: ${error}`);
    }
  }

  /**
   * Get all templates for tenant
   */
  async getTemplatesByTenant(
    tenantId: string,
    channel?: string,
    isActive?: boolean
  ): Promise<SMSWhatsAppTemplate[]> {
    try {
      let query = db('sms_whatsapp_templates').where({ tenant_id: tenantId });

      if (channel) {
        query = query.where({ channel });
      }

      if (isActive !== undefined) {
        query = query.where({ is_active: isActive });
      }

      const templates = await query.orderBy('created_at', 'desc');
      return templates.map(t => this.formatTemplate(t));
    } catch (error) {
      logger.error(`Error fetching tenant templates: ${error}`);
      throw new Error(`Failed to fetch templates: ${error}`);
    }
  }

  /**
   * Update template
   */
  async updateTemplate(
    templateId: string,
    updates: Partial<CreateTemplateRequest>
  ): Promise<SMSWhatsAppTemplate> {
    try {
      const updateData: Record<string, any> = {
        updated_at: db.fn.now(),
      };

      if (updates.template_name) updateData.template_name = updates.template_name;
      if (updates.description) updateData.description = updates.description;
      if (updates.sms_content) {
        updateData.sms_content = updates.sms_content;
        updateData.estimated_length = updates.sms_content.length;
        updateData.estimated_sms_parts = Math.ceil(updates.sms_content.length / 160);
      }
      if (updates.whatsapp_content) updateData.whatsapp_content = updates.whatsapp_content;
      if (updates.variables_required) updateData.variables_required = JSON.stringify(updates.variables_required);
      if (updates.message_prefix !== undefined) updateData.message_prefix = updates.message_prefix;

      const [template] = await db('sms_whatsapp_templates')
        .where({ template_id: templateId })
        .update(updateData)
        .returning('*');

      if (!template) {
        throw new Error('Template not found');
      }

      logger.info(`Template updated: ${templateId}`);
      return this.formatTemplate(template);
    } catch (error) {
      logger.error(`Error updating template: ${error}`);
      throw new Error(`Failed to update template: ${error}`);
    }
  }

  /**
   * Approve template
   */
  async approveTemplate(templateId: string, userId: string): Promise<SMSWhatsAppTemplate> {
    try {
      const [template] = await db('sms_whatsapp_templates')
        .where({ template_id: templateId })
        .update({
          approved_by: userId,
          approved_at: db.fn.now(),
          updated_at: db.fn.now(),
        })
        .returning('*');

      if (!template) {
        throw new Error('Template not found');
      }

      logger.info(`Template approved: ${templateId}`);
      return this.formatTemplate(template);
    } catch (error) {
      logger.error(`Error approving template: ${error}`);
      throw new Error(`Failed to approve template: ${error}`);
    }
  }

  /**
   * Deactivate template
   */
  async deactivateTemplate(templateId: string): Promise<SMSWhatsAppTemplate> {
    try {
      const [template] = await db('sms_whatsapp_templates')
        .where({ template_id: templateId })
        .update({
          is_active: false,
          updated_at: db.fn.now(),
        })
        .returning('*');

      if (!template) {
        throw new Error('Template not found');
      }

      logger.info(`Template deactivated: ${templateId}`);
      return this.formatTemplate(template);
    } catch (error) {
      logger.error(`Error deactivating template: ${error}`);
      throw new Error(`Failed to deactivate template: ${error}`);
    }
  }

  /**
   * Activate template
   */
  async activateTemplate(templateId: string): Promise<SMSWhatsAppTemplate> {
    try {
      const [template] = await db('sms_whatsapp_templates')
        .where({ template_id: templateId })
        .update({
          is_active: true,
          updated_at: db.fn.now(),
        })
        .returning('*');

      if (!template) {
        throw new Error('Template not found');
      }

      logger.info(`Template activated: ${templateId}`);
      return this.formatTemplate(template);
    } catch (error) {
      logger.error(`Error activating template: ${error}`);
      throw new Error(`Failed to activate template: ${error}`);
    }
  }

  /**
   * Delete template
   */
  async deleteTemplate(templateId: string): Promise<void> {
    try {
      // Check if template is in use
      const inUse = await db('message_schedules')
        .where({ template_id: templateId })
        .first();

      if (inUse) {
        throw new Error('Cannot delete template that is in use');
      }

      const deleted = await db('sms_whatsapp_templates')
        .where({ template_id: templateId })
        .delete();

      if (deleted === 0) {
        throw new Error('Template not found');
      }

      logger.info(`Template deleted: ${templateId}`);
    } catch (error) {
      logger.error(`Error deleting template: ${error}`);
      throw new Error(`Failed to delete template: ${error}`);
    }
  }

  /**
   * Get template usage statistics
   */
  async getTemplateStats(templateId: string): Promise<Record<string, any>> {
    try {
      const messageCount = await db('sms_whatsapp_messages')
        .where({ template_id: templateId })
        .count('* as count')
        .first();

      const deliveredCount = await db('sms_whatsapp_messages')
        .where({ template_id: templateId, status: 'delivered' })
        .count('* as count')
        .first();

      const failedCount = await db('sms_whatsapp_messages')
        .where({ template_id: templateId, status: 'failed' })
        .count('* as count')
        .first();

      const scheduleCount = await db('message_schedules')
        .where({ template_id: templateId, status: 'active' })
        .count('* as count')
        .first();

      return {
        total_messages_sent: messageCount.count,
        messages_delivered: deliveredCount.count,
        messages_failed: failedCount.count,
        active_schedules: scheduleCount.count,
        delivery_rate: messageCount.count > 0 ? (deliveredCount.count / messageCount.count * 100).toFixed(2) : 0,
      };
    } catch (error) {
      logger.error(`Error fetching template stats: ${error}`);
      throw new Error(`Failed to fetch template stats: ${error}`);
    }
  }

  /**
   * Private helper methods
   */

  private formatTemplate(template: any): SMSWhatsAppTemplate {
    return {
      ...template,
      variables_required: template.variables_required
        ? JSON.parse(template.variables_required)
        : undefined,
    };
  }
}

export default new SMSWhatsAppTemplateService();

import { CustomField, CustomFieldOption, CustomFieldValidation, ConfigurationResponse } from '../types/configuration';

/**
 * Custom Field Management Service
 * Manages custom fields for various entities
 */
export class CustomFieldService {
  private customFields: Map<string, CustomField> = new Map();
  private entityFields: Map<string, string[]> = new Map(); // Map of entity type to field IDs

  /**
   * Create custom field
   */
  async createCustomField(
    entityType: string,
    fieldName: string,
    fieldLabel: string,
    fieldType: string,
    options?: {
      required?: boolean;
      defaultValue?: any;
      options?: CustomFieldOption[];
      validation?: CustomFieldValidation;
    }
  ): Promise<ConfigurationResponse<CustomField>> {
    try {
      // Validate field name
      if (!this.isValidFieldName(fieldName)) {
        return {
          success: false,
          error: 'Invalid field name. Use only alphanumeric characters and underscores.',
          timestamp: new Date().toISOString(),
        };
      }

      // Validate field type
      const validTypes = ['text', 'number', 'date', 'select', 'checkbox', 'textarea', 'email', 'phone'];
      if (!validTypes.includes(fieldType)) {
        return {
          success: false,
          error: `Invalid field type. Valid types: ${validTypes.join(', ')}`,
          timestamp: new Date().toISOString(),
        };
      }

      // Validate select field has options
      if (fieldType === 'select' && (!options?.options || options.options.length === 0)) {
        return {
          success: false,
          error: 'Select field must have options',
          timestamp: new Date().toISOString(),
        };
      }

      const field: CustomField = {
        id: `field-${Date.now()}`,
        entityType,
        fieldName,
        fieldLabel,
        fieldType,
        required: options?.required || false,
        defaultValue: options?.defaultValue,
        options: options?.options,
        validation: options?.validation,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      this.customFields.set(field.id, field);

      // Add to entity fields map
      if (!this.entityFields.has(entityType)) {
        this.entityFields.set(entityType, []);
      }
      this.entityFields.get(entityType)!.push(field.id);

      return {
        success: true,
        data: field,
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
   * Get all custom fields for entity type
   */
  async getFieldsByEntityType(entityType: string): Promise<CustomField[]> {
    const fieldIds = this.entityFields.get(entityType) || [];
    const fields: CustomField[] = [];

    fieldIds.forEach(fieldId => {
      const field = this.customFields.get(fieldId);
      if (field && field.isActive) {
        fields.push(field);
      }
    });

    return fields;
  }

  /**
   * Get custom field by ID
   */
  async getCustomField(fieldId: string): Promise<CustomField | null> {
    return this.customFields.get(fieldId) || null;
  }

  /**
   * Update custom field
   */
  async updateCustomField(fieldId: string, updates: Partial<CustomField>): Promise<ConfigurationResponse<CustomField>> {
    try {
      const field = this.customFields.get(fieldId);
      if (!field) {
        return {
          success: false,
          error: 'Custom field not found',
          timestamp: new Date().toISOString(),
        };
      }

      // Validate updates
      if (updates.fieldName && !this.isValidFieldName(updates.fieldName)) {
        return {
          success: false,
          error: 'Invalid field name',
          timestamp: new Date().toISOString(),
        };
      }

      const updated: CustomField = {
        ...field,
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      this.customFields.set(fieldId, updated);

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
   * Delete custom field
   */
  async deleteCustomField(fieldId: string): Promise<ConfigurationResponse<void>> {
    try {
      const field = this.customFields.get(fieldId);
      if (!field) {
        return {
          success: false,
          error: 'Custom field not found',
          timestamp: new Date().toISOString(),
        };
      }

      // Mark as inactive instead of deleting
      field.isActive = false;
      field.updatedAt = new Date().toISOString();

      return {
        success: true,
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
   * Validate custom field value
   */
  async validateFieldValue(fieldId: string, value: any): Promise<{ valid: boolean; errors: string[] }> {
    const field = await this.getCustomField(fieldId);
    if (!field) {
      return { valid: false, errors: ['Field not found'] };
    }

    const errors: string[] = [];

    // Check required
    if (field.required && (value === null || value === undefined || value === '')) {
      errors.push(`${field.fieldLabel} is required`);
      return { valid: false, errors };
    }

    // Skip validation for empty optional fields
    if (!field.required && (value === null || value === undefined || value === '')) {
      return { valid: true, errors: [] };
    }

    // Type validation
    switch (field.fieldType) {
      case 'number':
        if (isNaN(Number(value))) {
          errors.push(`${field.fieldLabel} must be a number`);
        }
        break;

      case 'email':
        if (!this.isValidEmail(value)) {
          errors.push(`${field.fieldLabel} must be a valid email`);
        }
        break;

      case 'phone':
        if (!this.isValidPhone(value)) {
          errors.push(`${field.fieldLabel} must be a valid phone number`);
        }
        break;

      case 'date':
        if (!this.isValidDate(value)) {
          errors.push(`${field.fieldLabel} must be a valid date (YYYY-MM-DD)`);
        }
        break;

      case 'select':
        if (field.options && !field.options.some(o => o.value === value)) {
          errors.push(`${field.fieldLabel} must be one of: ${field.options.map(o => o.label).join(', ')}`);
        }
        break;

      case 'checkbox':
        if (typeof value !== 'boolean') {
          errors.push(`${field.fieldLabel} must be a boolean value`);
        }
        break;

      case 'text':
      case 'textarea':
        if (typeof value !== 'string') {
          errors.push(`${field.fieldLabel} must be text`);
        }
        break;
    }

    // Length validation
    if (field.validation) {
      if (field.validation.minLength && String(value).length < field.validation.minLength) {
        errors.push(`${field.fieldLabel} must be at least ${field.validation.minLength} characters`);
      }
      if (field.validation.maxLength && String(value).length > field.validation.maxLength) {
        errors.push(`${field.fieldLabel} must be at most ${field.validation.maxLength} characters`);
      }

      // Number validation
      if (field.fieldType === 'number') {
        const num = Number(value);
        if (field.validation.min !== undefined && num < field.validation.min) {
          errors.push(`${field.fieldLabel} must be at least ${field.validation.min}`);
        }
        if (field.validation.max !== undefined && num > field.validation.max) {
          errors.push(`${field.fieldLabel} must be at most ${field.validation.max}`);
        }
      }

      // Pattern validation
      if (field.validation.pattern) {
        const regex = new RegExp(field.validation.pattern);
        if (!regex.test(String(value))) {
          errors.push(`${field.fieldLabel} has invalid format`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get field schema for entity type
   */
  async getEntitySchema(entityType: string): Promise<any> {
    const fields = await this.getFieldsByEntityType(entityType);

    const schema: any = {
      type: 'object',
      properties: {},
      required: [],
    };

    fields.forEach(field => {
      const fieldSchema: any = {
        type: this.getJsonSchemaType(field.fieldType),
        description: field.fieldLabel,
      };

      if (field.options) {
        fieldSchema.enum = field.options.map(o => o.value);
      }

      if (field.fieldType === 'number') {
        if (field.validation?.min !== undefined) fieldSchema.minimum = field.validation.min;
        if (field.validation?.max !== undefined) fieldSchema.maximum = field.validation.max;
      }

      if (field.fieldType === 'text' || field.fieldType === 'textarea') {
        if (field.validation?.minLength) fieldSchema.minLength = field.validation.minLength;
        if (field.validation?.maxLength) fieldSchema.maxLength = field.validation.maxLength;
      }

      schema.properties[field.fieldName] = fieldSchema;

      if (field.required) {
        schema.required.push(field.fieldName);
      }
    });

    return schema;
  }

  /**
   * Duplicate field from another entity
   */
  async duplicateField(sourceFieldId: string, targetEntityType: string): Promise<ConfigurationResponse<CustomField>> {
    try {
      const sourceField = await this.getCustomField(sourceFieldId);
      if (!sourceField) {
        return {
          success: false,
          error: 'Source field not found',
          timestamp: new Date().toISOString(),
        };
      }

      return this.createCustomField(
        targetEntityType,
        sourceField.fieldName,
        sourceField.fieldLabel,
        sourceField.fieldType,
        {
          required: sourceField.required,
          defaultValue: sourceField.defaultValue,
          options: sourceField.options,
          validation: sourceField.validation,
        }
      );
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Private helper methods
   */
  private isValidFieldName(name: string): boolean {
    const fieldNameRegex = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
    return fieldNameRegex.test(name);
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private isValidPhone(phone: string): boolean {
    const phoneRegex = /^[+]?[\d\s\-()]+$/;
    return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
  }

  private isValidDate(date: string): boolean {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) return false;
    const d = new Date(date);
    return d instanceof Date && !isNaN(d.getTime());
  }

  private getJsonSchemaType(fieldType: string): string {
    switch (fieldType) {
      case 'number':
        return 'number';
      case 'checkbox':
        return 'boolean';
      case 'date':
        return 'string'; // format: date
      case 'email':
      case 'phone':
      case 'text':
      case 'textarea':
      case 'select':
      default:
        return 'string';
    }
  }

  /**
   * Get field statistics
   */
  async getFieldStatistics(): Promise<{
    totalFields: number;
    activeFields: number;
    inactiveFields: number;
    fieldsByType: Record<string, number>;
    fieldsByEntity: Record<string, number>;
  }> {
    const stats = {
      totalFields: this.customFields.size,
      activeFields: 0,
      inactiveFields: 0,
      fieldsByType: {} as Record<string, number>,
      fieldsByEntity: {} as Record<string, number>,
    };

    this.customFields.forEach(field => {
      if (field.isActive) stats.activeFields++;
      else stats.inactiveFields++;

      // Count by type
      stats.fieldsByType[field.fieldType] = (stats.fieldsByType[field.fieldType] || 0) + 1;

      // Count by entity
      stats.fieldsByEntity[field.entityType] = (stats.fieldsByEntity[field.entityType] || 0) + 1;
    });

    return stats;
  }
}

export default new CustomFieldService();

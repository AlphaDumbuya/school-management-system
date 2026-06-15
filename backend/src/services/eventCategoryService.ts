/**
 * Event Category Service
 * Handles event category management
 * Phase 2.2 - Events Management Module
 */

import db from '../utils/database.js';
import { EventCategory } from '../types/event.js';
import logger from '../utils/logger.js';

export class EventCategoryService {
  /**
   * Create a new event category
   */
  async createCategory(
    tenantId: string,
    data: {
      name: string;
      description?: string;
      color?: string;
      icon?: string;
      display_order?: number;
    }
  ): Promise<EventCategory> {
    try {
      const [category] = await db('event_categories')
        .insert({
          tenant_id: tenantId,
          name: data.name,
          description: data.description,
          color: data.color || this.getDefaultColor(),
          icon: data.icon,
          display_order: data.display_order || 0,
          is_system: false,
          active: true,
        })
        .returning('*');

      logger.info(`Event category created: ${category.category_id}`, {
        tenantId,
        categoryName: data.name,
      });

      return category;
    } catch (error) {
      logger.error('Error creating event category:', error);
      throw new Error('Failed to create event category');
    }
  }

  /**
   * Update event category
   */
  async updateCategory(
    categoryId: string,
    tenantId: string,
    data: {
      name?: string;
      description?: string;
      color?: string;
      icon?: string;
      display_order?: number;
      active?: boolean;
    }
  ): Promise<EventCategory> {
    try {
      // Check if category exists and is not a system category
      const existing = await db('event_categories')
        .where({ category_id: categoryId, tenant_id: tenantId })
        .first();

      if (!existing) {
        throw new Error('Category not found');
      }

      if (existing.is_system) {
        throw new Error('Cannot update system category');
      }

      const [updated] = await db('event_categories')
        .where({ category_id: categoryId, tenant_id: tenantId })
        .update({
          ...data,
          updated_at: db.fn.now(),
        })
        .returning('*');

      logger.info(`Event category updated: ${categoryId}`, { tenantId });

      return updated;
    } catch (error) {
      logger.error('Error updating event category:', error);
      throw error;
    }
  }

  /**
   * Delete event category
   */
  async deleteCategory(categoryId: string, tenantId: string): Promise<void> {
    try {
      const category = await db('event_categories')
        .where({ category_id: categoryId, tenant_id: tenantId })
        .first();

      if (!category) {
        throw new Error('Category not found');
      }

      if (category.is_system) {
        throw new Error('Cannot delete system category');
      }

      // Check if category is in use
      const eventCount = await db('event_category_mappings')
        .where({ category_id: categoryId })
        .count('* as count')
        .first();

      if (eventCount && parseInt(eventCount.count as string) > 0) {
        throw new Error('Cannot delete category that is in use');
      }

      await db('event_categories')
        .where({ category_id: categoryId, tenant_id: tenantId })
        .delete();

      logger.info(`Event category deleted: ${categoryId}`, { tenantId });
    } catch (error) {
      logger.error('Error deleting event category:', error);
      throw error;
    }
  }

  /**
   * Get category by ID
   */
  async getCategory(categoryId: string, tenantId: string): Promise<EventCategory> {
    try {
      const category = await db('event_categories')
        .where({ category_id: categoryId, tenant_id: tenantId })
        .first();

      if (!category) {
        throw new Error('Category not found');
      }

      return category;
    } catch (error) {
      logger.error('Error getting event category:', error);
      throw error;
    }
  }

  /**
   * List all categories for tenant
   */
  async listCategories(
    tenantId: string,
    filters?: { active?: boolean }
  ): Promise<EventCategory[]> {
    try {
      let query = db('event_categories')
        .where({ tenant_id: tenantId })
        .orderBy('display_order', 'asc')
        .orderBy('name', 'asc');

      if (filters?.active !== undefined) {
        query = query.where({ active: filters.active });
      }

      const categories = await query;

      return categories;
    } catch (error) {
      logger.error('Error listing event categories:', error);
      throw new Error('Failed to list event categories');
    }
  }

  /**
   * Assign categories to event
   */
  async assignCategoriesToEvent(
    eventId: string,
    categoryIds: string[]
  ): Promise<void> {
    try {
      // Remove existing mappings
      await db('event_category_mappings').where({ event_id: eventId }).delete();

      // Insert new mappings
      if (categoryIds.length > 0) {
        await db('event_category_mappings').insert(
          categoryIds.map((categoryId) => ({
            event_id: eventId,
            category_id: categoryId,
          }))
        );
      }

      logger.info(`Categories assigned to event: ${eventId}`, {
        count: categoryIds.length,
      });
    } catch (error) {
      logger.error('Error assigning categories to event:', error);
      throw new Error('Failed to assign categories');
    }
  }

  /**
   * Get categories for event
   */
  async getEventCategories(eventId: string): Promise<EventCategory[]> {
    try {
      const categories = await db('event_categories')
        .join(
          'event_category_mappings',
          'event_categories.category_id',
          'event_category_mappings.category_id'
        )
        .where('event_category_mappings.event_id', eventId)
        .select('event_categories.*');

      return categories;
    } catch (error) {
      logger.error('Error getting event categories:', error);
      throw new Error('Failed to get event categories');
    }
  }

  /**
   * Get category statistics
   */
  async getCategoryStats(tenantId: string): Promise<
    Array<{
      category_id: string;
      category_name: string;
      event_count: number;
      color: string;
    }>
  > {
    try {
      const stats = await db('event_categories')
        .leftJoin(
          'event_category_mappings',
          'event_categories.category_id',
          'event_category_mappings.category_id'
        )
        .leftJoin('events', function () {
          this.on('event_category_mappings.event_id', '=', 'events.event_id').andOn(
            'events.status',
            '=',
            db.raw('?', ['published'])
          );
        })
        .where('event_categories.tenant_id', tenantId)
        .where('event_categories.active', true)
        .groupBy('event_categories.category_id', 'event_categories.name', 'event_categories.color')
        .select(
          'event_categories.category_id',
          'event_categories.name as category_name',
          'event_categories.color',
          db.raw('COUNT(DISTINCT events.event_id) as event_count')
        )
        .orderBy('event_count', 'desc');

      return stats.map((stat) => ({
        ...stat,
        event_count: parseInt(stat.event_count as string),
      }));
    } catch (error) {
      logger.error('Error getting category stats:', error);
      throw new Error('Failed to get category statistics');
    }
  }

  /**
   * Initialize system categories for new tenant
   */
  async initializeSystemCategories(tenantId: string): Promise<void> {
    try {
      const systemCategories = [
        {
          name: 'Academic',
          description: 'Academic events including exams, lectures, and workshops',
          color: '#3B82F6',
          icon: 'academic',
        },
        {
          name: 'Sports',
          description: 'Sports events including matches, tournaments, and training',
          color: '#10B981',
          icon: 'sports',
        },
        {
          name: 'Cultural',
          description: 'Cultural events including concerts, plays, and exhibitions',
          color: '#8B5CF6',
          icon: 'cultural',
        },
        {
          name: 'Administrative',
          description: 'Administrative events including staff meetings and PTAs',
          color: '#6B7280',
          icon: 'administrative',
        },
        {
          name: 'Social',
          description: 'Social events including parties, gatherings, and celebrations',
          color: '#F59E0B',
          icon: 'social',
        },
      ];

      for (const [index, category] of systemCategories.entries()) {
        await db('event_categories').insert({
          tenant_id: tenantId,
          name: category.name,
          description: category.description,
          color: category.color,
          icon: category.icon,
          is_system: true,
          display_order: index + 1,
          active: true,
        });
      }

      logger.info(`System categories initialized for tenant: ${tenantId}`);
    } catch (error) {
      logger.error('Error initializing system categories:', error);
      throw new Error('Failed to initialize system categories');
    }
  }

  /**
   * Get default color for category
   */
  private getDefaultColor(): string {
    const colors = [
      '#3B82F6',
      '#10B981',
      '#8B5CF6',
      '#F59E0B',
      '#EF4444',
      '#14B8A6',
      '#EC4899',
      '#6366F1',
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }
}

export default new EventCategoryService();

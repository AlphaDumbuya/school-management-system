import type { Knex } from 'knex';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '@middleware/errorHandler';
import { logger } from '@utils/logger';

/**
 * Phase 21.1: Help Documentation Service
 * 
 * Provides comprehensive help documentation system:
 * - Help article management
 * - Search functionality
 * - Context-sensitive help
 * - Category organization
 * - FAQ management
 */

export interface HelpArticle {
  id: string;
  tenantId: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  contextPath?: string;
  viewCount: number;
  helpfulCount: number;
  unhelpfulCount: number;
  videoUrl?: string;
  createdAt: Date;
  updatedAt: Date;
  isPublished: boolean;
}

export interface FAQ {
  id: string;
  tenantId: string;
  question: string;
  answer: string;
  category: string;
  viewCount: number;
  helpfulCount: number;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export class HelpDocumentationService {
  private db: Knex;

  /**
   * Initializes help documentation service
   * @param database - Knex database instance
   */
  constructor(database: Knex) {
    this.db = database;
    logger.info('HelpDocumentationService initialized');
  }

  /**
   * Creates help article
   * @param tenantId - Tenant ID
   * @param article - Article data
   */
  async createArticle(tenantId: string, article: Omit<HelpArticle, 'id' | 'tenantId' | 'viewCount' | 'helpfulCount' | 'unhelpfulCount' | 'createdAt' | 'updatedAt'>): Promise<HelpArticle> {
    try {
      const articleId = uuidv4();
      const now = new Date();

      await this.db('help_articles').insert({
        id: articleId,
        tenant_id: tenantId,
        title: article.title,
        content: article.content,
        category: article.category,
        tags: JSON.stringify(article.tags || []),
        context_path: article.contextPath || null,
        video_url: article.videoUrl || null,
        view_count: 0,
        helpful_count: 0,
        unhelpful_count: 0,
        is_published: article.isPublished ?? true,
        created_at: now,
        updated_at: now,
      });

      logger.info(`Help article created: ${articleId}`);

      return {
        id: articleId,
        tenantId,
        ...article,
        viewCount: 0,
        helpfulCount: 0,
        unhelpfulCount: 0,
        createdAt: now,
        updatedAt: now,
      };
    } catch (error) {
      logger.error('Failed to create help article', error);
      throw new AppError('Failed to create help article', 500);
    }
  }

  /**
   * Searches help articles
   * @param tenantId - Tenant ID
   * @param query - Search query
   * @param category - Filter by category
   * @param limit - Result limit
   */
  async searchArticles(
    tenantId: string,
    query: string,
    category?: string,
    limit: number = 20
  ): Promise<HelpArticle[]> {
    try {
      let searchQuery = this.db('help_articles')
        .where('tenant_id', tenantId)
        .where('is_published', true);

      if (category) {
        searchQuery = searchQuery.where('category', category);
      }

      if (query) {
        searchQuery = searchQuery.whereRaw(
          `LOWER(title) LIKE LOWER(?) OR LOWER(content) LIKE LOWER(?)`,
          [`%${query}%`, `%${query}%`]
        );
      }

      const articles = await searchQuery
        .orderBy('view_count', 'desc')
        .limit(limit)
        .select();

      return articles.map((a: any) => ({
        id: a.id,
        tenantId: a.tenant_id,
        title: a.title,
        content: a.content,
        category: a.category,
        tags: JSON.parse(a.tags || '[]'),
        contextPath: a.context_path,
        viewCount: a.view_count,
        helpfulCount: a.helpful_count,
        unhelpfulCount: a.unhelpful_count,
        videoUrl: a.video_url,
        isPublished: a.is_published,
        createdAt: a.created_at,
        updatedAt: a.updated_at,
      }));
    } catch (error) {
      logger.error('Failed to search help articles', error);
      throw new AppError('Failed to search help articles', 500);
    }
  }

  /**
   * Gets context-sensitive help
   * @param tenantId - Tenant ID
   * @param contextPath - Page/feature path
   */
  async getContextHelp(tenantId: string, contextPath: string): Promise<HelpArticle | null> {
    try {
      const article = await this.db('help_articles')
        .where('tenant_id', tenantId)
        .where('context_path', contextPath)
        .where('is_published', true)
        .first();

      if (!article) {
        return null;
      }

      // Increment view count
      await this.db('help_articles')
        .where('id', article.id)
        .increment('view_count', 1);

      return {
        id: article.id,
        tenantId: article.tenant_id,
        title: article.title,
        content: article.content,
        category: article.category,
        tags: JSON.parse(article.tags || '[]'),
        contextPath: article.context_path,
        viewCount: article.view_count + 1,
        helpfulCount: article.helpful_count,
        unhelpfulCount: article.unhelpful_count,
        videoUrl: article.video_url,
        isPublished: article.is_published,
        createdAt: article.created_at,
        updatedAt: article.updated_at,
      };
    } catch (error) {
      logger.error('Failed to get context help', error);
      throw new AppError('Failed to get context help', 500);
    }
  }

  /**
   * Gets article by ID
   * @param articleId - Article ID
   * @param tenantId - Tenant ID
   */
  async getArticle(articleId: string, tenantId: string): Promise<HelpArticle> {
    try {
      const article = await this.db('help_articles')
        .where('id', articleId)
        .where('tenant_id', tenantId)
        .first();

      if (!article) {
        throw new AppError('Help article not found', 404);
      }

      // Increment view count
      await this.db('help_articles')
        .where('id', articleId)
        .increment('view_count', 1);

      return {
        id: article.id,
        tenantId: article.tenant_id,
        title: article.title,
        content: article.content,
        category: article.category,
        tags: JSON.parse(article.tags || '[]'),
        contextPath: article.context_path,
        viewCount: article.view_count + 1,
        helpfulCount: article.helpful_count,
        unhelpfulCount: article.unhelpful_count,
        videoUrl: article.video_url,
        isPublished: article.is_published,
        createdAt: article.created_at,
        updatedAt: article.updated_at,
      };
    } catch (error) {
      logger.error('Failed to get help article', error);
      throw error;
    }
  }

  /**
   * Marks article as helpful
   * @param articleId - Article ID
   */
  async markHelpful(articleId: string): Promise<void> {
    try {
      await this.db('help_articles')
        .where('id', articleId)
        .increment('helpful_count', 1);

      logger.debug(`Article marked helpful: ${articleId}`);
    } catch (error) {
      logger.error('Failed to mark article helpful', error);
    }
  }

  /**
   * Marks article as unhelpful
   * @param articleId - Article ID
   */
  async markUnhelpful(articleId: string): Promise<void> {
    try {
      await this.db('help_articles')
        .where('id', articleId)
        .increment('unhelpful_count', 1);

      logger.debug(`Article marked unhelpful: ${articleId}`);
    } catch (error) {
      logger.error('Failed to mark article unhelpful', error);
    }
  }

  /**
   * Gets articles by category
   * @param tenantId - Tenant ID
   * @param category - Category name
   * @param limit - Result limit
   */
  async getByCategory(tenantId: string, category: string, limit: number = 50): Promise<HelpArticle[]> {
    try {
      const articles = await this.db('help_articles')
        .where('tenant_id', tenantId)
        .where('category', category)
        .where('is_published', true)
        .orderBy('view_count', 'desc')
        .limit(limit)
        .select();

      return articles.map((a: any) => ({
        id: a.id,
        tenantId: a.tenant_id,
        title: a.title,
        content: a.content,
        category: a.category,
        tags: JSON.parse(a.tags || '[]'),
        contextPath: a.context_path,
        viewCount: a.view_count,
        helpfulCount: a.helpful_count,
        unhelpfulCount: a.unhelpful_count,
        videoUrl: a.video_url,
        isPublished: a.is_published,
        createdAt: a.created_at,
        updatedAt: a.updated_at,
      }));
    } catch (error) {
      logger.error('Failed to get articles by category', error);
      throw new AppError('Failed to get articles by category', 500);
    }
  }

  /**
   * Gets help categories
   * @param tenantId - Tenant ID
   */
  async getCategories(tenantId: string): Promise<{ name: string; count: number }[]> {
    try {
      const categories = await this.db('help_articles')
        .where('tenant_id', tenantId)
        .where('is_published', true)
        .groupBy('category')
        .select(
          this.db.raw('category as name'),
          this.db.raw('COUNT(*) as count')
        );

      return categories;
    } catch (error) {
      logger.error('Failed to get categories', error);
      throw new AppError('Failed to get categories', 500);
    }
  }

  /**
   * Creates FAQ entry
   * @param tenantId - Tenant ID
   * @param faq - FAQ data
   */
  async createFAQ(
    tenantId: string,
    faq: Omit<FAQ, 'id' | 'tenantId' | 'viewCount' | 'createdAt' | 'updatedAt'>
  ): Promise<FAQ> {
    try {
      const faqId = uuidv4();
      const now = new Date();

      await this.db('help_faqs').insert({
        id: faqId,
        tenant_id: tenantId,
        question: faq.question,
        answer: faq.answer,
        category: faq.category,
        display_order: faq.displayOrder || 0,
        view_count: 0,
        helpful_count: 0,
        created_at: now,
        updated_at: now,
      });

      logger.info(`FAQ created: ${faqId}`);

      return {
        id: faqId,
        tenantId,
        ...faq,
        viewCount: 0,
        createdAt: now,
        updatedAt: now,
      };
    } catch (error) {
      logger.error('Failed to create FAQ', error);
      throw new AppError('Failed to create FAQ', 500);
    }
  }

  /**
   * Gets FAQs
   * @param tenantId - Tenant ID
   * @param category - Filter by category
   */
  async getFAQs(tenantId: string, category?: string): Promise<FAQ[]> {
    try {
      let query = this.db('help_faqs')
        .where('tenant_id', tenantId);

      if (category) {
        query = query.where('category', category);
      }

      const faqs = await query
        .orderBy('display_order', 'asc')
        .select();

      return faqs.map((f: any) => ({
        id: f.id,
        tenantId: f.tenant_id,
        question: f.question,
        answer: f.answer,
        category: f.category,
        viewCount: f.view_count,
        helpfulCount: f.helpful_count,
        displayOrder: f.display_order,
        createdAt: f.created_at,
        updatedAt: f.updated_at,
      }));
    } catch (error) {
      logger.error('Failed to get FAQs', error);
      throw new AppError('Failed to get FAQs', 500);
    }
  }
}

export default HelpDocumentationService;

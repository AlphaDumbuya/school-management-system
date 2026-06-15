import type { Knex } from 'knex';

/**
 * Phase 2.2 - Events Management Module Migration
 * 
 * Creates tables for:
 * - Events (school events, activities, calendar)
 * - Event categories
 * - Event registrations (RSVP)
 * - Event recurrence (recurring events)
 * - Event notifications
 * - Event attendance
 * 
 * @param knex - Knex instance
 */
export async function up(knex: Knex): Promise<void> {
  // Create event_categories table
  await knex.schema.createTable('event_categories', (table) => {
    table.uuid('category_id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.string('name', 100).notNullable();
    table.text('description');
    table.string('color', 7); // Hex color code
    table.string('icon', 50);
    table.boolean('is_system').defaultTo(false);
    table.integer('display_order').defaultTo(0);
    table.boolean('active').defaultTo(true);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    
    table.unique(['tenant_id', 'name']);
    table.index('tenant_id');
  });

  // Create events table
  await knex.schema.createTable('events', (table) => {
    table.uuid('event_id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.string('title', 255).notNullable();
    table.text('description');
    table.string('event_type', 50).notNullable(); // 'single', 'multi_day', 'recurring'
    table.timestamp('start_date').notNullable();
    table.timestamp('end_date').notNullable();
    table.boolean('all_day').defaultTo(false);
    table.string('location', 255);
    table.string('location_type', 50); // 'on_campus', 'off_campus', 'virtual'
    table.text('venue_details');
    table.integer('capacity');
    table.uuid('organizer_id').notNullable().references('id').inTable('users');
    table.string('status', 50).defaultTo('draft'); // 'draft', 'published', 'cancelled', 'completed'
    table.string('visibility', 50).defaultTo('public'); // 'public', 'private', 'role_specific'
    table.jsonb('visible_to_roles'); // Array of role names for role_specific visibility
    table.boolean('registration_required').defaultTo(false);
    table.timestamp('registration_deadline');
    table.boolean('approval_required').defaultTo(false);
    table.boolean('allow_guests').defaultTo(false);
    table.integer('max_guests_per_registration').defaultTo(0);
    table.string('image_url', 500);
    table.string('external_link', 500);
    table.boolean('reminder_enabled').defaultTo(true);
    table.jsonb('reminder_intervals'); // Array of hours before event [24, 1]
    table.jsonb('metadata');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.uuid('created_by').references('id').inTable('users');
    table.uuid('updated_by').references('id').inTable('users');
    
    table.index('tenant_id');
    table.index('organizer_id');
    table.index(['start_date', 'end_date']);
    table.index('status');
    table.index('event_type');
  });

  // Create event_category_mappings table
  await knex.schema.createTable('event_category_mappings', (table) => {
    table.uuid('event_id').notNullable().references('event_id').inTable('events').onDelete('CASCADE');
    table.uuid('category_id').notNullable().references('category_id').inTable('event_categories').onDelete('CASCADE');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    
    table.primary(['event_id', 'category_id']);
  });

  // Create event_registrations table
  await knex.schema.createTable('event_registrations', (table) => {
    table.uuid('registration_id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('event_id').notNullable().references('event_id').inTable('events').onDelete('CASCADE');
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('status', 50).defaultTo('pending'); // 'pending', 'confirmed', 'cancelled', 'waitlist'
    table.string('rsvp_status', 50); // 'going', 'maybe', 'not_going'
    table.integer('guests_count').defaultTo(0);
    table.jsonb('registration_data'); // Custom form responses
    table.string('approval_status', 50); // 'pending', 'approved', 'rejected'
    table.uuid('approved_by').references('id').inTable('users');
    table.timestamp('approved_at');
    table.timestamp('check_in_time');
    table.timestamp('check_out_time');
    table.string('attendance_status', 50); // 'present', 'absent', 'late', 'excused'
    table.text('notes');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    table.unique(['event_id', 'user_id']);
    table.index('event_id');
    table.index('user_id');
    table.index('status');
  });

  // Create event_recurrence table
  await knex.schema.createTable('event_recurrence', (table) => {
    table.uuid('recurrence_id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('event_id').notNullable().references('event_id').inTable('events').onDelete('CASCADE');
    table.uuid('parent_event_id').references('event_id').inTable('events');
    table.string('recurrence_pattern', 50).notNullable(); // 'daily', 'weekly', 'monthly', 'custom'
    table.integer('recurrence_interval').defaultTo(1);
    table.jsonb('recurrence_days'); // [0,1,2,3,4,5,6] for days of week
    table.timestamp('recurrence_end_date');
    table.integer('recurrence_count');
    table.jsonb('exception_dates'); // Array of exception dates
    table.timestamp('created_at').defaultTo(knex.fn.now());
    
    table.index('event_id');
    table.index('parent_event_id');
  });

  // Create event_notifications table
  await knex.schema.createTable('event_notifications', (table) => {
    table.uuid('notification_id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('event_id').notNullable().references('event_id').inTable('events').onDelete('CASCADE');
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('notification_type', 50).notNullable(); // 'reminder', 'update', 'cancellation', 'confirmation'
    table.timestamp('scheduled_time').notNullable();
    table.boolean('sent').defaultTo(false);
    table.timestamp('sent_at');
    table.jsonb('channels'); // ['email', 'sms', 'in_app']
    table.jsonb('metadata');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    
    table.index('event_id');
    table.index('user_id');
    table.index(['scheduled_time', 'sent']);
  });

  // Create event_attendance table
  await knex.schema.createTable('event_attendance', (table) => {
    table.uuid('attendance_id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('event_id').notNullable().references('event_id').inTable('events').onDelete('CASCADE');
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.timestamp('check_in_time');
    table.timestamp('check_out_time');
    table.string('attendance_method', 50); // 'manual', 'qr_code', 'automatic'
    table.uuid('marked_by').references('id').inTable('users');
    table.string('status', 50).defaultTo('present'); // 'present', 'absent', 'late', 'excused'
    table.text('notes');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    table.unique(['event_id', 'user_id']);
    table.index('event_id');
    table.index('user_id');
  });

  // Insert system categories
  await knex('event_categories').insert([
    {
      category_id: knex.raw('gen_random_uuid()'),
      tenant_id: knex.raw('(SELECT id FROM tenants LIMIT 1)'),
      name: 'Academic',
      description: 'Academic events including exams, lectures, and workshops',
      color: '#3B82F6',
      icon: 'academic',
      is_system: true,
      display_order: 1,
      active: true
    },
    {
      category_id: knex.raw('gen_random_uuid()'),
      tenant_id: knex.raw('(SELECT id FROM tenants LIMIT 1)'),
      name: 'Sports',
      description: 'Sports events including matches, tournaments, and training',
      color: '#10B981',
      icon: 'sports',
      is_system: true,
      display_order: 2,
      active: true
    },
    {
      category_id: knex.raw('gen_random_uuid()'),
      tenant_id: knex.raw('(SELECT id FROM tenants LIMIT 1)'),
      name: 'Cultural',
      description: 'Cultural events including concerts, plays, and exhibitions',
      color: '#8B5CF6',
      icon: 'cultural',
      is_system: true,
      display_order: 3,
      active: true
    },
    {
      category_id: knex.raw('gen_random_uuid()'),
      tenant_id: knex.raw('(SELECT id FROM tenants LIMIT 1)'),
      name: 'Administrative',
      description: 'Administrative events including staff meetings and PTAs',
      color: '#6B7280',
      icon: 'administrative',
      is_system: true,
      display_order: 4,
      active: true
    },
    {
      category_id: knex.raw('gen_random_uuid()'),
      tenant_id: knex.raw('(SELECT id FROM tenants LIMIT 1)'),
      name: 'Social',
      description: 'Social events including parties, gatherings, and celebrations',
      color: '#F59E0B',
      icon: 'social',
      is_system: true,
      display_order: 5,
      active: true
    },
    {
      category_id: knex.raw('gen_random_uuid()'),
      tenant_id: knex.raw('(SELECT id FROM tenants LIMIT 1)'),
      name: 'Community Service',
      description: 'Community service and volunteer events',
      color: '#EF4444',
      icon: 'community',
      is_system: true,
      display_order: 6,
      active: true
    },
    {
      category_id: knex.raw('gen_random_uuid()'),
      tenant_id: knex.raw('(SELECT id FROM tenants LIMIT 1)'),
      name: 'Field Trip',
      description: 'Educational field trips and excursions',
      color: '#14B8A6',
      icon: 'field_trip',
      is_system: true,
      display_order: 7,
      active: true
    },
    {
      category_id: knex.raw('gen_random_uuid()'),
      tenant_id: knex.raw('(SELECT id FROM tenants LIMIT 1)'),
      name: 'Fundraising',
      description: 'Fundraising events and activities',
      color: '#EC4899',
      icon: 'fundraising',
      is_system: true,
      display_order: 8,
      active: true
    },
    {
      category_id: knex.raw('gen_random_uuid()'),
      tenant_id: knex.raw('(SELECT id FROM tenants LIMIT 1)'),
      name: 'Orientation',
      description: 'Orientation events for new students and staff',
      color: '#6366F1',
      icon: 'orientation',
      is_system: true,
      display_order: 9,
      active: true
    },
    {
      category_id: knex.raw('gen_random_uuid()'),
      tenant_id: knex.raw('(SELECT id FROM tenants LIMIT 1)'),
      name: 'Graduation',
      description: 'Graduation ceremonies and related events',
      color: '#F97316',
      icon: 'graduation',
      is_system: true,
      display_order: 10,
      active: true
    }
  ]);

  console.log('✅ Phase 2.2 Events Management migration completed successfully');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('event_attendance');
  await knex.schema.dropTableIfExists('event_notifications');
  await knex.schema.dropTableIfExists('event_recurrence');
  await knex.schema.dropTableIfExists('event_registrations');
  await knex.schema.dropTableIfExists('event_category_mappings');
  await knex.schema.dropTableIfExists('events');
  await knex.schema.dropTableIfExists('event_categories');
  
  console.log('✅ Phase 2.2 Events Management migration rolled back successfully');
}

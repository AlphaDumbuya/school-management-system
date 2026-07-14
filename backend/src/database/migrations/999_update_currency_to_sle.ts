import type { Knex } from 'knex';

/**
 * Migration: Update Currency to SLE (Sierra Leonean Leone)
 * Updates all currency references from SLE/USD to SLE
 */

export async function up(knex: Knex): Promise<void> {
  console.log('Starting currency migration to SLE...');

  // Check if tenants table has currency column
  const hasTenantsCurrency = await knex.schema.hasColumn('tenants', 'currency');
  
  if (hasTenantsCurrency) {
    await knex('tenants').update({ currency: 'SLE' });
    console.log('✓ Updated tenants currency to SLE');
  }

  // Check if system_settings table exists and has currency
  const hasSystemSettings = await knex.schema.hasTable('system_settings');
  if (hasSystemSettings) {
    const hasCurrencySetting = await knex.schema.hasColumn('system_settings', 'value');
    if (hasCurrencySetting) {
      await knex('system_settings')
        .where('key', 'currency')
        .update({ value: 'SLE' });
      
      // Insert if doesn't exist
      const exists = await knex('system_settings').where('key', 'currency').first();
      if (!exists) {
        await knex('system_settings').insert({
          key: 'currency',
          value: 'SLE',
          description: 'System currency (Sierra Leonean Leone)',
        });
      }
      console.log('✓ Updated system_settings currency to SLE');
    }
  }

  // Update any hardcoded currency references in fee_types descriptions
  const hasFeeTypes = await knex.schema.hasTable('fee_types');
  if (hasFeeTypes) {
    await knex.raw(`
      UPDATE fee_types 
      SET description = REPLACE(REPLACE(description, 'SLE', 'SLE'), 'Le', 'Le')
      WHERE description LIKE '%SLE%' OR description LIKE '%Le%'
    `);
    console.log('✓ Updated fee_types descriptions');
  }

  // Update payment method descriptions if they contain currency
  const hasPayments = await knex.schema.hasTable('payments');
  if (hasPayments) {
    const hasNotesColumn = await knex.schema.hasColumn('payments', 'notes');
    if (hasNotesColumn) {
      await knex.raw(`
        UPDATE payments 
        SET notes = REPLACE(REPLACE(notes, 'SLE', 'SLE'), 'Le', 'Le')
        WHERE notes LIKE '%SLE%' OR notes LIKE '%Le%'
      `);
      console.log('✓ Updated payments notes');
    }
  }

  console.log('✅ Currency migration to SLE completed successfully!');
}

export async function down(knex: Knex): Promise<void> {
  console.log('Rolling back currency migration...');
  
  // Revert to SLE (or your previous currency)
  const hasTenantsCurrency = await knex.schema.hasColumn('tenants', 'currency');
  if (hasTenantsCurrency) {
    await knex('tenants').update({ currency: 'SLE' });
  }

  const hasSystemSettings = await knex.schema.hasTable('system_settings');
  if (hasSystemSettings) {
    await knex('system_settings')
      .where('key', 'currency')
      .update({ value: 'SLE' });
  }

  // Revert fee_types descriptions
  const hasFeeTypes = await knex.schema.hasTable('fee_types');
  if (hasFeeTypes) {
    await knex.raw(`
      UPDATE fee_types 
      SET description = REPLACE(description, 'SLE', 'SLE')
      WHERE description LIKE '%SLE%'
    `);
  }

  // Revert payments notes
  const hasPayments = await knex.schema.hasTable('payments');
  if (hasPayments) {
    const hasNotesColumn = await knex.schema.hasColumn('payments', 'notes');
    if (hasNotesColumn) {
      await knex.raw(`
        UPDATE payments 
        SET notes = REPLACE(notes, 'SLE', 'SLE')
        WHERE notes LIKE '%SLE%'
      `);
    }
  }

  console.log('✅ Currency rollback completed');
}

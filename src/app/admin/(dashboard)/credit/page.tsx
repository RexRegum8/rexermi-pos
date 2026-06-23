import React from 'react';
import { dbQuery } from '@/lib/db';
import CreditClient from './CreditClient';

export const metadata = { title: 'Crédito y Puntos — Admin Rexermi' };
export const dynamic = 'force-dynamic';

export default async function AdminCreditPage() {
  // Fetch initial configuration
  const configRows = await dbQuery<{ key: string; value: string }[]>(
    `SELECT \`key\`, value FROM settings WHERE \`key\` LIKE 'credit_%' OR \`key\` LIKE 'loyalty_%'`
  );
  
  const initialConfig: Record<string, string> = {
    credit_enabled: '0',
    credit_mode: 'free',
    credit_schedule_mode: 'always',
    credit_schedule_start: '08:00',
    credit_schedule_end: '18:00',
    credit_schedule_days: '1,2,3,4,5',
    credit_season_start: '',
    credit_season_end: '',
    loyalty_points_per_dollar: '0.1',
    loyalty_points_to_credit_multiplier: '2.0',
    loyalty_min_points_for_credit: '50',
    loyalty_initial_points: '100',
  };

  configRows.forEach(r => {
    initialConfig[r.key] = r.value || '';
  });

  return (
    <>
      <div className="admin-topbar">
        <h1>💳 Gestión de Crédito y Fidelidad</h1>
      </div>
      <CreditClient initialConfig={initialConfig} />
    </>
  );
}

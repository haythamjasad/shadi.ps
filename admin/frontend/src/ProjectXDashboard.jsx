import React, { useMemo, useState } from 'react';
import { PROJECT_X_API_BASE, projectXApi } from './projectXApi.js';

export default function ProjectXDashboard({ currentAdmin }) {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const permissionSummary = useMemo(() => {
    if (currentAdmin?.is_super_admin) return 'Super Admin';
    const canRead = !!currentAdmin?.permissions?.project_x?.read;
    const canManage = !!currentAdmin?.permissions?.project_x?.manage;
    return `read: ${canRead ? 'yes' : 'no'} | manage: ${canManage ? 'yes' : 'no'}`;
  }, [currentAdmin]);

  const checkHealth = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await projectXApi.get('/health');
      setHealth(result);
    } catch (err) {
      setError(err.message || 'Failed to reach Project X API');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="card">
      <h2 style={{ marginTop: 0 }}>Project X</h2>
      <p className="muted">Starter internal module connected through the shared project API client.</p>
      <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
        <div><strong>API Base:</strong> {PROJECT_X_API_BASE}</div>
        <div><strong>Permissions:</strong> {permissionSummary}</div>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
        <button type="button" onClick={checkHealth} disabled={loading}>
          {loading ? 'Checking...' : 'Check API Health'}
        </button>
      </div>

      {error ? <div className="error">{error}</div> : null}
      {health ? (
        <pre style={{ margin: 0, background: '#f6f6f6', padding: 12, borderRadius: 8, overflow: 'auto' }}>
          {JSON.stringify(health, null, 2)}
        </pre>
      ) : null}
    </section>
  );
}

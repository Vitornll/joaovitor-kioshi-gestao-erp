import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Modal, StatCard, Badge, EmptyState, formatDate, formatDateTime } from '../components/ui';
import type { ComplianceLicense } from '../lib/types';

interface AuditRow {
  id: string;
  action: string;
  entity_type: string;
  created_at: string;
  profiles?: { full_name: string } | null;
}

export default function Conformidade() {
  const [licenses, setLicenses] = useState<ComplianceLicense[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', license_type: '', issue_date: '', expiry_date: '', notes: '' });

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const [l, a] = await Promise.all([
      supabase.from('compliance_licenses').select('*').order('expiry_date'),
      supabase.from('audit_log').select('*, profiles(full_name)').order('created_at', { ascending: false }).limit(10),
    ]);
    setLicenses(l.data ?? []);
    setAudit((a.data as AuditRow[]) ?? []);
    setLoading(false);
  }

  const in60 = new Date();
  in60.setDate(in60.getDate() + 60);
  const regular = licenses.filter((l) => !l.expiry_date || new Date(l.expiry_date) > in60).length;
  const renewingSoon = licenses.filter((l) => l.expiry_date && new Date(l.expiry_date) <= in60).length;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await supabase.from('compliance_licenses').insert({
      name: form.name,
      license_type: form.license_type || null,
      issue_date: form.issue_date || null,
      expiry_date: form.expiry_date || null,
      notes: form.notes || null,
    });
    setSaving(false);
    setShowModal(false);
    setForm({ name: '', license_type: '', issue_date: '', expiry_date: '', notes: '' });
    load();
  }

  return (
    <div>
      <div className="section-row">
        <p className="content-subtitle" style={{ margin: 0 }}>
          Licenças, controles químicos e a trilha de auditoria em um único lugar.
        </p>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          + Adicionar licença
        </button>
      </div>

      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <StatCard label="Licenças regulares" value={regular} accent="brand" />
        <StatCard label="Renovação próxima" value={renewingSoon} hint="Vencimento nos próximos 60 dias" accent="warning" />
        <StatCard label="Ações auditadas" value={audit.length} hint="Últimos registros" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 20 }}>
        <div className="card">
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            <div className="modal-eyebrow">Prazos importantes</div>
            <h3>Licenças e registros</h3>
          </div>
          {loading ? (
            <EmptyState>Carregando…</EmptyState>
          ) : licenses.length === 0 ? (
            <EmptyState>Nenhuma licença ou registro cadastrado.</EmptyState>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Licença</th>
                  <th>Validade</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {licenses.map((l) => (
                  <tr key={l.id}>
                    <td style={{ fontWeight: 600 }}>
                      {l.name}
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400 }}>{l.license_type}</div>
                    </td>
                    <td>{formatDate(l.expiry_date)}</td>
                    <td>
                      {l.expiry_date && new Date(l.expiry_date) <= in60 && (
                        <Badge tone={new Date(l.expiry_date) < new Date() ? 'danger' : 'warning'}>
                          {new Date(l.expiry_date) < new Date() ? 'Vencida' : 'Renovar'}
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            <div className="modal-eyebrow">Rastreabilidade</div>
            <h3>Últimas ações auditadas</h3>
          </div>
          {audit.length === 0 ? (
            <EmptyState>Nenhuma ação registrada ainda.</EmptyState>
          ) : (
            <div>
              {audit.map((a) => (
                <div key={a.id} style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                    {a.profiles?.full_name ?? 'Sistema'} · {a.action}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {a.entity_type} · {formatDateTime(a.created_at)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <Modal
          eyebrow="Conformidade"
          title="Adicionar licença"
          onClose={() => setShowModal(false)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>
                Cancelar
              </button>
              <button className="btn btn-primary" form="license-form" disabled={saving}>
                {saving ? 'Salvando…' : 'Salvar licença'}
              </button>
            </>
          }
        >
          <form id="license-form" onSubmit={save}>
            <div className="field">
              <label>Nome da licença</label>
              <input required placeholder="Ex.: Licença de funcionamento, Receituário agronômico" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="field">
              <label>Tipo</label>
              <input value={form.license_type} onChange={(e) => setForm({ ...form, license_type: e.target.value })} />
            </div>
            <div className="field-row">
              <div className="field">
                <label>Emissão</label>
                <input type="date" value={form.issue_date} onChange={(e) => setForm({ ...form, issue_date: e.target.value })} />
              </div>
              <div className="field">
                <label>Validade</label>
                <input type="date" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} />
              </div>
            </div>
            <div className="field">
              <label>Observações</label>
              <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

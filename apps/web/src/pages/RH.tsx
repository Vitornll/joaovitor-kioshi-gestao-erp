import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Modal, StatCard, Badge, EmptyState, formatDate } from '../components/ui';
import type { Employee, Profile } from '../lib/types';

export default function RH() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [detail, setDetail] = useState<Employee | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    full_name: '',
    cargo: '',
    admission_date: '',
    cnh_number: '',
    cnh_validity: '',
    aso_validity: '',
    profile_id: '',
  });

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const [{ data }, { data: profilesData }] = await Promise.all([
      supabase.from('employees').select('*').order('full_name'),
      supabase.from('profiles').select('*').order('full_name'),
    ]);
    setEmployees(data ?? []);
    setProfiles(profilesData ?? []);
    setLoading(false);
  }

  const in30 = new Date();
  in30.setDate(in30.getDate() + 30);
  const asoExpiring = employees.filter((e) => e.aso_validity && new Date(e.aso_validity) <= in30).length;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await supabase.from('employees').insert({
      full_name: form.full_name,
      cargo: form.cargo || null,
      admission_date: form.admission_date || null,
      cnh_number: form.cnh_number || null,
      cnh_validity: form.cnh_validity || null,
      aso_validity: form.aso_validity || null,
      profile_id: form.profile_id || null,
    });
    setSaving(false);
    setShowModal(false);
    setForm({ full_name: '', cargo: '', admission_date: '', cnh_number: '', cnh_validity: '', aso_validity: '', profile_id: '' });
    load();
  }

  return (
    <div>
      <div className="section-row">
        <p className="content-subtitle" style={{ margin: 0 }}>
          Cadastro da equipe, documentos, treinamentos e certificados (ASO, NR-35, manuseio de químicos).
        </p>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          + Novo colaborador
        </button>
      </div>

      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <StatCard label="Colaboradores ativos" value={employees.filter((e) => e.active).length} accent="brand" />
        <StatCard label="ASO vencendo em 30 dias" value={asoExpiring} accent="warning" />
      </div>

      <div className="card">
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <div className="modal-eyebrow">Equipe</div>
          <h3>Colaboradores</h3>
        </div>
        {loading ? (
          <EmptyState>Carregando…</EmptyState>
        ) : employees.length === 0 ? (
          <EmptyState>Nenhum colaborador cadastrado.</EmptyState>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Cargo</th>
                <th>Admissão</th>
                <th>ASO</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => (
                <tr key={e.id}>
                  <td style={{ fontWeight: 600 }}>{e.full_name}</td>
                  <td>{e.cargo || '—'}</td>
                  <td>{formatDate(e.admission_date)}</td>
                  <td>
                    {formatDate(e.aso_validity)}{' '}
                    {e.aso_validity && new Date(e.aso_validity) <= in30 && (
                      <Badge tone={new Date(e.aso_validity) < new Date() ? 'danger' : 'warning'}>
                        {new Date(e.aso_validity) < new Date() ? 'Vencido' : 'Vence em breve'}
                      </Badge>
                    )}
                  </td>
                  <td>
                    <button className="btn btn-secondary btn-sm" onClick={() => setDetail(e)}>
                      Ver cadastro
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <Modal
          eyebrow="Recursos Humanos"
          title="Novo colaborador"
          onClose={() => setShowModal(false)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>
                Cancelar
              </button>
              <button className="btn btn-primary" form="employee-form" disabled={saving}>
                {saving ? 'Salvando…' : 'Salvar colaborador'}
              </button>
            </>
          }
        >
          <form id="employee-form" onSubmit={save}>
            <div className="field">
              <label>Nome completo</label>
              <input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div className="field-row">
              <div className="field">
                <label>Cargo</label>
                <input placeholder="Ex.: Desinsetizador" value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} />
              </div>
              <div className="field">
                <label>Data de admissão</label>
                <input type="date" value={form.admission_date} onChange={(e) => setForm({ ...form, admission_date: e.target.value })} />
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label>CNH (número)</label>
                <input value={form.cnh_number} onChange={(e) => setForm({ ...form, cnh_number: e.target.value })} />
              </div>
              <div className="field">
                <label>Validade da CNH</label>
                <input type="date" value={form.cnh_validity} onChange={(e) => setForm({ ...form, cnh_validity: e.target.value })} />
              </div>
            </div>
            <div className="field">
              <label>ASO — válido até</label>
              <input type="date" value={form.aso_validity} onChange={(e) => setForm({ ...form, aso_validity: e.target.value })} />
            </div>
            <div className="field">
              <label>Login no sistema (opcional)</label>
              <select value={form.profile_id} onChange={(e) => setForm({ ...form, profile_id: e.target.value })}>
                <option value="">Sem login vinculado</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name} ({p.role})
                  </option>
                ))}
              </select>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                Vincular o login do técnico permite que o produto informado na execução do serviço baixe automaticamente do estoque.
              </p>
            </div>
          </form>
        </Modal>
      )}

      {detail && (
        <Modal eyebrow={detail.cargo ?? 'Colaborador'} title={detail.full_name} onClose={() => setDetail(null)} footer={<button className="btn btn-secondary" onClick={() => setDetail(null)}>Fechar</button>}>
          <div className="field-row">
            <div>
              <label>Admissão</label>
              <p style={{ margin: 0 }}>{formatDate(detail.admission_date)}</p>
            </div>
            <div>
              <label>CNH</label>
              <p style={{ margin: 0 }}>
                {detail.cnh_number || 'Não informado'} {detail.cnh_validity ? `· válida até ${formatDate(detail.cnh_validity)}` : ''}
              </p>
            </div>
          </div>
          <div style={{ marginTop: 14 }}>
            <label>ASO</label>
            <p style={{ margin: 0 }}>{formatDate(detail.aso_validity)}</p>
          </div>
          <div style={{ marginTop: 14 }}>
            <label>Login no sistema</label>
            <p style={{ margin: 0 }}>{profiles.find((p) => p.id === detail.profile_id)?.full_name || 'Sem login vinculado'}</p>
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 18 }}>
            Documentos, treinamentos e fotos podem ser anexados em uma próxima etapa (upload de arquivos).
          </p>
        </Modal>
      )}
    </div>
  );
}

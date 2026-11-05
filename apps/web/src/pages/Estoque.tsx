import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Modal, StatCard, Badge, EmptyState, formatDate } from '../components/ui';
import type { Product, ProductLot, Employee } from '../lib/types';

type ProductWithLots = Product & { product_lots: ProductLot[] };

const CATEGORY_LABEL: Record<string, string> = { quimico: 'Químico', epi: 'EPI', equipamento: 'Equipamento', outro: 'Outro' };

export default function Estoque() {
  const [products, setProducts] = useState<ProductWithLots[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showProductModal, setShowProductModal] = useState(false);
  const [showLotModal, setShowLotModal] = useState<ProductWithLots | null>(null);
  const [saving, setSaving] = useState(false);

  const [productForm, setProductForm] = useState({ name: '', category: 'quimico' as Product['category'], unit: 'un', min_stock: '' });
  const [lotForm, setLotForm] = useState({ lot_number: '', expiry_date: '', quantity_central: '' });

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const [p, e] = await Promise.all([
      supabase.from('products').select('*, product_lots(*)').order('name'),
      supabase.from('employees').select('*').eq('active', true),
    ]);
    setProducts((p.data as ProductWithLots[]) ?? []);
    setEmployees(e.data ?? []);
    setLoading(false);
  }

  const totalLots = products.reduce((s, p) => s + p.product_lots.length, 0);
  const belowMin = products.filter((p) => p.product_lots.reduce((s, l) => s + Number(l.quantity_central), 0) < p.min_stock).length;
  const in30 = new Date();
  in30.setDate(in30.getDate() + 30);
  const expiringSoon = products.flatMap((p) => p.product_lots).filter((l) => l.expiry_date && new Date(l.expiry_date) <= in30).length;

  async function saveProduct(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await supabase.from('products').insert({
      name: productForm.name,
      category: productForm.category,
      unit: productForm.unit,
      min_stock: Number(productForm.min_stock) || 0,
    });
    setSaving(false);
    setShowProductModal(false);
    setProductForm({ name: '', category: 'quimico', unit: 'un', min_stock: '' });
    load();
  }

  async function saveLot(e: React.FormEvent) {
    e.preventDefault();
    if (!showLotModal) return;
    setSaving(true);
    await supabase.from('product_lots').insert({
      product_id: showLotModal.id,
      lot_number: lotForm.lot_number,
      expiry_date: lotForm.expiry_date || null,
      quantity_central: Number(lotForm.quantity_central) || 0,
    });
    setSaving(false);
    setShowLotModal(null);
    setLotForm({ lot_number: '', expiry_date: '', quantity_central: '' });
    load();
  }

  return (
    <div>
      <div className="section-row">
        <p className="content-subtitle" style={{ margin: 0 }}>
          Produtos químicos, EPIs e equipamentos — lotes, validade e estoque mínimo.
        </p>
        <button className="btn btn-primary" onClick={() => setShowProductModal(true)}>
          + Novo produto
        </button>
      </div>

      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <StatCard label="Produtos cadastrados" value={products.length} accent="brand" />
        <StatCard label="Itens abaixo do mínimo" value={belowMin} accent="danger" />
        <StatCard label="Lotes vencendo em 30 dias" value={expiringSoon} accent="warning" />
        <StatCard label="Lotes cadastrados" value={totalLots} />
      </div>

      <div className="card">
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <div className="modal-eyebrow">Atenção aos lotes</div>
          <h3>Produtos em uso</h3>
        </div>
        {loading ? (
          <EmptyState>Carregando…</EmptyState>
        ) : products.length === 0 ? (
          <EmptyState>Nenhum produto cadastrado no estoque.</EmptyState>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Produto</th>
                <th>Categoria</th>
                <th>Total em estoque</th>
                <th>Mínimo</th>
                <th>Situação</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const total = p.product_lots.reduce((s, l) => s + Number(l.quantity_central), 0);
                const low = total < p.min_stock;
                return (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 600 }}>{p.name}</td>
                    <td>{CATEGORY_LABEL[p.category]}</td>
                    <td>
                      {total} {p.unit}
                    </td>
                    <td>
                      {p.min_stock} {p.unit}
                    </td>
                    <td>
                      <Badge tone={low ? 'danger' : 'success'}>{low ? 'Abaixo do mínimo' : 'OK'}</Badge>
                    </td>
                    <td>
                      <button className="btn btn-secondary btn-sm" onClick={() => setShowLotModal(p)}>
                        + Lote
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <div className="modal-eyebrow">Lotes por produto</div>
          <h3>Validades e quantidades</h3>
        </div>
        {products.flatMap((p) => p.product_lots).length === 0 ? (
          <EmptyState>Nenhum lote cadastrado.</EmptyState>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Produto</th>
                <th>Lote</th>
                <th>Validade</th>
                <th>Quantidade</th>
              </tr>
            </thead>
            <tbody>
              {products.flatMap((p) =>
                p.product_lots.map((l) => (
                  <tr key={l.id}>
                    <td>{p.name}</td>
                    <td>{l.lot_number}</td>
                    <td>
                      {formatDate(l.expiry_date)}
                      {l.expiry_date && new Date(l.expiry_date) <= in30 && (
                        <Badge tone={new Date(l.expiry_date) < new Date() ? 'danger' : 'warning'}> {new Date(l.expiry_date) < new Date() ? 'Vencido' : 'Vence em breve'}</Badge>
                      )}
                    </td>
                    <td>
                      {l.quantity_central} {p.unit}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {showProductModal && (
        <Modal
          eyebrow="Estoque"
          title="Novo produto"
          onClose={() => setShowProductModal(false)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setShowProductModal(false)}>
                Cancelar
              </button>
              <button className="btn btn-primary" form="product-form" disabled={saving}>
                {saving ? 'Salvando…' : 'Salvar produto'}
              </button>
            </>
          }
        >
          <form id="product-form" onSubmit={saveProduct}>
            <div className="field">
              <label>Nome do produto</label>
              <input required value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} />
            </div>
            <div className="field-row">
              <div className="field">
                <label>Categoria</label>
                <select value={productForm.category} onChange={(e) => setProductForm({ ...productForm, category: e.target.value as Product['category'] })}>
                  <option value="quimico">Químico</option>
                  <option value="epi">EPI</option>
                  <option value="equipamento">Equipamento</option>
                  <option value="outro">Outro</option>
                </select>
              </div>
              <div className="field">
                <label>Unidade</label>
                <input placeholder="un, L, kg…" value={productForm.unit} onChange={(e) => setProductForm({ ...productForm, unit: e.target.value })} />
              </div>
            </div>
            <div className="field">
              <label>Estoque mínimo</label>
              <input type="number" value={productForm.min_stock} onChange={(e) => setProductForm({ ...productForm, min_stock: e.target.value })} />
            </div>
          </form>
        </Modal>
      )}

      {showLotModal && (
        <Modal
          eyebrow="Estoque"
          title={`Novo lote — ${showLotModal.name}`}
          onClose={() => setShowLotModal(null)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setShowLotModal(null)}>
                Cancelar
              </button>
              <button className="btn btn-primary" form="lot-form" disabled={saving}>
                {saving ? 'Salvando…' : 'Salvar lote'}
              </button>
            </>
          }
        >
          <form id="lot-form" onSubmit={saveLot}>
            <div className="field">
              <label>Número do lote</label>
              <input required value={lotForm.lot_number} onChange={(e) => setLotForm({ ...lotForm, lot_number: e.target.value })} />
            </div>
            <div className="field-row">
              <div className="field">
                <label>Validade</label>
                <input type="date" value={lotForm.expiry_date} onChange={(e) => setLotForm({ ...lotForm, expiry_date: e.target.value })} />
              </div>
              <div className="field">
                <label>Quantidade</label>
                <input type="number" value={lotForm.quantity_central} onChange={(e) => setLotForm({ ...lotForm, quantity_central: e.target.value })} />
              </div>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Plus, Search, Edit2, Trash2, Package, Tag } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ImageUpload } from '@/components/ui/ImageUpload';
import { formatCurrency } from '@/lib/utils';
import type { Product, Category } from '@/types';

const DEFAULT_CATEGORIES = ['Milk', 'Curd', 'Buttermilk', 'Paneer', 'Butter', 'Ghee', 'Cheese', 'Ice Cream', 'Sweets', 'Flavoured Milk'];

export function Products() {
  const { showToast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [showCategories, setShowCategories] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const [prodRes, catRes] = await Promise.all([
      supabase.from('products').select('*, category:categories(*)').order('name'),
      supabase.from('categories').select('*').order('name'),
    ]);
    setProducts(prodRes.data as Product[] ?? []);
    setCategories(catRes.data as Category[] ?? []);

    // Seed default categories if none exist
    if ((catRes.data ?? []).length === 0) {
      for (const name of DEFAULT_CATEGORIES) {
        await supabase.from('categories').insert({ name });
      }
      const { data: newCats } = await supabase.from('categories').select('*').order('name');
      setCategories(newCats as Category[] ?? []);
    }
    setLoading(false);
  };

  const filtered = products.filter((p) => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase()) || p.barcode.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCat === 'all' || p.category_id === filterCat;
    return matchSearch && matchCat;
  });

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from('products').delete().eq('id', deleteId);
    if (error) showToast(error.message, 'error');
    else { showToast('Product deleted', 'success'); load(); }
    setDeleteId(null);
  };

  return (
    <div className="p-4 lg:p-8 space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
          />
        </div>
        <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)} className="px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 outline-none">
          <option value="all">All Categories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button onClick={() => setShowCategories(true)} className="px-4 py-2.5 rounded-xl bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 flex items-center gap-2">
          <Tag className="w-4 h-4" /> Categories
        </button>
        <button onClick={() => { setEditing(null); setShowForm(true); }} className="px-4 py-2.5 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Product
        </button>
      </div>

      {loading ? (
        <p className="text-gray-500 text-center py-8">Loading products...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400">No products found. Click "Add Product" to create one.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Product</th>
                  <th className="px-4 py-3 text-left font-medium hidden md:table-cell">SKU/Barcode</th>
                  <th className="px-4 py-3 text-left font-medium hidden lg:table-cell">Category</th>
                  <th className="px-4 py-3 text-right font-medium">Purchase</th>
                  <th className="px-4 py-3 text-right font-medium">Selling</th>
                  <th className="px-4 py-3 text-right font-medium">Stock</th>
                  <th className="px-4 py-3 text-center font-medium">Status</th>
                  <th className="px-4 py-3 text-center font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {p.image_url ? (
                          <img src={p.image_url} alt="" className="w-8 h-8 rounded-lg object-cover" />
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-xs font-bold text-blue-400">{p.name.charAt(0)}</div>
                        )}
                        <span className="font-medium text-gray-900">{p.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{p.sku || '-'} / {p.barcode || '-'}</td>
                    <td className="px-4 py-3 text-gray-500 hidden lg:table-cell">{p.category?.name ?? '-'}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(p.purchase_price)}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">{formatCurrency(p.selling_price)}</td>
                    <td className={`px-4 py-3 text-right font-medium ${p.stock <= p.min_stock ? 'text-red-600' : 'text-gray-900'}`}>{p.stock} {p.unit}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {p.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => { setEditing(p); setShowForm(true); }} className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => setDeleteId(p.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showForm && <ProductForm product={editing} categories={categories} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
      {showCategories && <CategoryManager categories={categories} onClose={() => setShowCategories(false)} onChanged={load} />}
      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete} title="Delete Product" message="Are you sure you want to delete this product? This cannot be undone." confirmLabel="Delete" danger />
    </div>
  );
}

function ProductForm({ product, categories, onClose, onSaved }: {
  product: Product | null;
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { showToast } = useToast();
  const [form, setForm] = useState({
    name: product?.name ?? '',
    sku: product?.sku ?? '',
    barcode: product?.barcode ?? '',
    category_id: product?.category_id ?? '',
    brand: product?.brand ?? '',
    unit: product?.unit ?? 'pcs',
    purchase_price: product?.purchase_price ?? 0,
    selling_price: product?.selling_price ?? 0,
    mrp: product?.mrp ?? 0,
    gst: product?.gst ?? 0,
    stock: product?.stock ?? 0,
    min_stock: product?.min_stock ?? 0,
    batch_number: product?.batch_number ?? '',
    expiry_date: product?.expiry_date ?? '',
    image_url: product?.image_url ?? '',
    is_active: product?.is_active ?? true,
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.name.trim()) { showToast('Product name is required', 'error'); return; }
    setSaving(true);
    const payload = { ...form, expiry_date: form.expiry_date || null, category_id: form.category_id || null };
    const { error } = product
      ? await supabase.from('products').update(payload).eq('id', product.id)
      : await supabase.from('products').insert(payload);
    if (error) showToast(error.message, 'error');
    else { showToast(product ? 'Product updated' : 'Product added', 'success'); onSaved(); }
    setSaving(false);
  };

  const field = (key: string, label: string, type = 'text') => (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input
        type={type}
        value={String(form[key as keyof typeof form] ?? '')}
        onChange={(e) => setForm({ ...form, [key]: type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value })}
        className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-blue-500 outline-none text-sm"
      />
    </div>
  );

  return (
    <Modal open onClose={onClose} title={product ? 'Edit Product' : 'Add Product'} size="xl">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="col-span-2">{field('name', 'Product Name *')}</div>
        {field('sku', 'SKU')}
        {field('barcode', 'Barcode')}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
          <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-blue-500 outline-none text-sm">
            <option value="">None</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        {field('brand', 'Brand')}
        {field('unit', 'Unit')}
        {field('purchase_price', 'Purchase Price', 'number')}
        {field('selling_price', 'Selling Price', 'number')}
        {field('mrp', 'MRP', 'number')}
        {field('gst', 'GST %', 'number')}
        {field('stock', 'Stock', 'number')}
        {field('min_stock', 'Min Stock', 'number')}
        {field('batch_number', 'Batch Number')}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Expiry Date</label>
          <input type="date" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-blue-500 outline-none text-sm" />
        </div>
        <div className="col-span-2 lg:col-span-1">
          <ImageUpload
            value={form.image_url}
            onChange={(url) => setForm({ ...form, image_url: url })}
            label="Product Image"
            shape="square"
            size="sm"
          />
        </div>
        <div className="flex items-center gap-2 pt-5">
          <input type="checkbox" id="is_active" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="w-4 h-4 rounded" />
          <label htmlFor="is_active" className="text-sm text-gray-700">Active</label>
        </div>
      </div>
      <div className="flex gap-3 justify-end mt-5">
        <button onClick={onClose} className="px-4 py-2 rounded-lg text-gray-700 font-medium hover:bg-gray-100">Cancel</button>
        <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-60">
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </Modal>
  );
}

function CategoryManager({ categories, onClose, onChanged }: {
  categories: Category[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const { showToast } = useToast();
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');

  const addCategory = async () => {
    if (!name.trim()) return;
    const { error } = await supabase.from('categories').insert({ name, description: desc });
    if (error) showToast(error.message, 'error');
    else { showToast('Category added', 'success'); setName(''); setDesc(''); onChanged(); }
  };

  const deleteCategory = async (id: string) => {
    const { error } = await supabase.from('categories').delete().eq('id', id);
    if (error) showToast(error.message, 'error');
    else { showToast('Category deleted', 'success'); onChanged(); }
  };

  return (
    <Modal open onClose={onClose} title="Manage Categories" size="md">
      <div className="space-y-3 mb-4">
        {categories.map((c) => (
          <div key={c.id} className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50">
            <div>
              <p className="font-medium text-gray-900 text-sm">{c.name}</p>
              <p className="text-xs text-gray-500">{c.description}</p>
            </div>
            <button onClick={() => deleteCategory(c.id)} className="p-1.5 rounded-lg text-red-500 hover:bg-red-50">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
      <div className="border-t pt-4 space-y-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Category name" className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-blue-500 outline-none text-sm" />
        <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Description (optional)" className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-blue-500 outline-none text-sm" />
        <button onClick={addCategory} className="w-full py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 flex items-center justify-center gap-2">
          <Plus className="w-4 h-4" /> Add Category
        </button>
      </div>
    </Modal>
  );
}

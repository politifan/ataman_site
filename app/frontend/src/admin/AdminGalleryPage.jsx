import { useEffect, useMemo, useState } from "react";
import {
  adminCreateGallery,
  adminDeleteGallery,
  adminListGallery,
  adminUploadFile,
  adminUpdateGallery,
  toMediaUrl
} from "../api";

const initialForm = {
  title: "",
  description: "",
  image_path: "",
  category: "",
  sort_order: 0,
  is_active: true
};

export default function AdminGalleryPage() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState("cards");
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setRows(await adminListGallery());
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const categories = useMemo(() => {
    const unique = new Set(rows.map((row) => row.category).filter(Boolean));
    return Array.from(unique).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (categoryFilter !== "all" && (row.category || "") !== categoryFilter) return false;
      if (statusFilter === "active" && !row.is_active) return false;
      if (statusFilter === "inactive" && row.is_active) return false;
      if (!q) return true;
      return [row.title, row.image_path, row.description]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
    });
  }, [rows, query, categoryFilter, statusFilter]);

  const stats = useMemo(() => {
    const active = rows.filter((row) => row.is_active).length;
    const categorized = rows.filter((row) => row.category).length;
    return {
      total: rows.length,
      active,
      categories: categories.length,
      categorized
    };
  }, [rows, categories]);

  function resetFilters() {
    setQuery("");
    setCategoryFilter("all");
    setStatusFilter("all");
  }

  function openCreate() {
    setEditingId(null);
    setForm(initialForm);
    setModalOpen(true);
  }

  function openEdit(row) {
    setEditingId(row.id);
    setForm({
      title: row.title,
      description: row.description || "",
      image_path: row.image_path,
      category: row.category || "",
      sort_order: row.sort_order || 0,
      is_active: row.is_active
    });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingId(null);
    setForm(initialForm);
  }

  async function save(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      const payload = {
        ...form,
        sort_order: Number(form.sort_order || 0)
      };
      if (!payload.title.trim() || !payload.image_path.trim()) {
        throw new Error("Title и image_path обязательны.");
      }
      if (editingId) {
        await adminUpdateGallery(editingId, payload);
        setMessage("Элемент обновлен.");
      } else {
        await adminCreateGallery(payload);
        setMessage("Элемент создан.");
      }
      await load();
      closeModal();
    } catch (err) {
      setError(err.message);
    }
  }

  async function onUploadFile(file) {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const result = await adminUploadFile(file, "gallery");
      setForm((prev) => ({ ...prev, image_path: result.path }));
      setMessage("Файл загружен. Путь подставлен в форму.");
    } catch (err) {
      setError(err.message || "Не удалось загрузить файл.");
    } finally {
      setUploading(false);
    }
  }

  async function remove(id) {
    if (!window.confirm("Удалить элемент галереи?")) return;
    try {
      await adminDeleteGallery(id);
      setMessage("Элемент удален.");
      await load();
      if (editingId === id) closeModal();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section>
      <header className="admin-head">
        <div>
          <h1>Галерея</h1>
          <p className="muted">Показано: {filtered.length} из {rows.length}</p>
        </div>
        <button className="btn-main small" type="button" onClick={openCreate}>
          Новый элемент
        </button>
      </header>

      <div className="admin-toolbar">
        <input
          className="admin-filter-input"
          placeholder="Поиск: title / path / description"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
          <option value="all">Все категории</option>
          {categories.map((category) => (
            <option key={category} value={category}>{category}</option>
          ))}
        </select>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="all">Все статусы</option>
          <option value="active">Только активные</option>
          <option value="inactive">Только неактивные</option>
        </select>
        <div className="admin-view-toggle">
          <button
            type="button"
            className={viewMode === "cards" ? "is-active" : ""}
            onClick={() => setViewMode("cards")}
          >
            Карточки
          </button>
          <button
            type="button"
            className={viewMode === "table" ? "is-active" : ""}
            onClick={() => setViewMode("table")}
          >
            Таблица
          </button>
        </div>
        <button type="button" className="admin-ghost-btn" onClick={resetFilters}>
          Сбросить
        </button>
      </div>

      <div className="admin-kpi-grid">
        <article className="admin-kpi-card">
          <p>Всего материалов</p>
          <strong>{stats.total}</strong>
        </article>
        <article className="admin-kpi-card">
          <p>Активные</p>
          <strong>{stats.active}</strong>
        </article>
        <article className="admin-kpi-card">
          <p>Категории</p>
          <strong>{stats.categories}</strong>
        </article>
        <article className="admin-kpi-card">
          <p>С заполненной категорией</p>
          <strong>{stats.categorized}</strong>
        </article>
      </div>

      {error ? <p className="err">{error}</p> : null}
      {message ? <p className="ok">{message}</p> : null}
      {loading ? <p className="muted">Загрузка...</p> : null}
      {!loading && filtered.length === 0 ? (
        <div className="admin-empty">
          <h3>Изображения не найдены</h3>
          <p>Проверьте фильтры или добавьте новый элемент в галерею.</p>
        </div>
      ) : null}

      {!loading && filtered.length > 0 && viewMode === "table" ? (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Title</th>
                <th>Path</th>
                <th>Category</th>
                <th>Sort</th>
                <th>Статус</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id}>
                  <td>{row.id}</td>
                  <td>{row.title}</td>
                  <td>{row.image_path}</td>
                  <td>{row.category || "-"}</td>
                  <td>{row.sort_order || 0}</td>
                  <td>{row.is_active ? "Активен" : "Скрыт"}</td>
                  <td className="admin-actions-inline">
                    <button type="button" onClick={() => openEdit(row)}>Ред.</button>
                    <button type="button" className="danger" onClick={() => remove(row.id)}>Удал.</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {!loading && filtered.length > 0 && viewMode === "cards" ? (
        <div className="admin-list">
          {filtered.map((row) => (
            <article key={row.id} className="admin-list-item">
              <div>
                <strong>{row.title}</strong>
                <p>{row.image_path}</p>
                <div className="admin-tags">
                  <span>{row.category || "Без категории"}</span>
                  <span>{row.is_active ? "Активен" : "Скрыт"}</span>
                  <span>sort: {row.sort_order || 0}</span>
                </div>
                <div className="admin-thumb">
                  <img src={toMediaUrl(row.image_path)} alt={row.title} />
                </div>
              </div>
              <div className="admin-actions">
                <button type="button" onClick={() => openEdit(row)}>Ред.</button>
                <button type="button" className="danger" onClick={() => remove(row.id)}>Удал.</button>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {modalOpen ? (
        <div className="admin-modal" onClick={closeModal}>
          <div className="admin-modal-panel" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="admin-modal-close" onClick={closeModal} aria-label="Закрыть">×</button>
            <form className="admin-form" onSubmit={save}>
              <h2>{editingId ? `Редактирование #${editingId}` : "Создание элемента"}</h2>
              <label>
                Title
                <input
                  value={form.title}
                  onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                  required
                />
              </label>
              <label>
                Description
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                />
              </label>
              <label>
                Загрузка файла
                <input
                  type="file"
                  accept="image/*,video/*"
                  onChange={(event) => onUploadFile(event.target.files?.[0])}
                />
                <small className="muted">{uploading ? "Загрузка..." : "Загрузите медиа и путь подставится автоматически."}</small>
              </label>
              <label>
                Image path (относительно /media)
                <input
                  value={form.image_path}
                  onChange={(event) => setForm((prev) => ({ ...prev, image_path: event.target.value }))}
                  required
                />
              </label>
              <label>
                Category
                <input
                  value={form.category}
                  onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
                />
              </label>
              <label>
                Sort order
                <input
                  type="number"
                  value={form.sort_order}
                  onChange={(event) => setForm((prev) => ({ ...prev, sort_order: Number(event.target.value) }))}
                />
              </label>
              <label className="inline">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(event) => setForm((prev) => ({ ...prev, is_active: event.target.checked }))}
                />
                Active
              </label>
              <button className="btn-main" type="submit">Сохранить</button>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}

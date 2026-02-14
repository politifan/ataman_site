import { useEffect, useMemo, useState } from "react";
import {
  adminCreateService,
  adminDeleteService,
  adminListServices,
  adminUploadFile,
  adminUpdateService
} from "../api";

const basePayload = {
  slug: "",
  title: "",
  category: "",
  category_label: "",
  format_mode: "group_and_individual",
  teaser: "",
  duration: "",
  pricing: {},
  about: [],
  suitable_for: [],
  host: {},
  important: [],
  dress_code: [],
  contraindications: [],
  media: [],
  age_restriction: "",
  is_draft: false,
  is_active: true
};

function normalizeTextareaLines(value) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function toEditor(service) {
  const row = service || basePayload;
  return {
    ...basePayload,
    ...row,
    pricing_text: JSON.stringify(row.pricing || {}, null, 2),
    about_text: (row.about || []).join("\n"),
    suitable_for_text: (row.suitable_for || []).join("\n"),
    important_text: (row.important || []).join("\n"),
    dress_code_text: (row.dress_code || []).join("\n"),
    contraindications_text: (row.contraindications || []).join("\n"),
    media_text: (row.media || []).join("\n"),
    host_name: row.host?.name || "",
    host_bio: row.host?.bio || ""
  };
}

function toPayload(editor) {
  let pricing = {};
  try {
    pricing = editor.pricing_text ? JSON.parse(editor.pricing_text) : {};
  } catch (_) {
    throw new Error("Поле pricing должно быть валидным JSON.");
  }

  return {
    slug: editor.slug.trim(),
    title: editor.title.trim(),
    category: editor.category.trim() || null,
    category_label: editor.category_label.trim() || null,
    format_mode: editor.format_mode,
    teaser: editor.teaser.trim() || null,
    duration: editor.duration.trim() || null,
    pricing,
    about: normalizeTextareaLines(editor.about_text),
    suitable_for: normalizeTextareaLines(editor.suitable_for_text),
    host: {
      name: editor.host_name.trim(),
      bio: editor.host_bio.trim()
    },
    important: normalizeTextareaLines(editor.important_text),
    dress_code: normalizeTextareaLines(editor.dress_code_text),
    contraindications: normalizeTextareaLines(editor.contraindications_text),
    media: normalizeTextareaLines(editor.media_text),
    age_restriction: editor.age_restriction.trim() || null,
    is_draft: Boolean(editor.is_draft),
    is_active: Boolean(editor.is_active)
  };
}

export default function AdminServicesPage() {
  const [items, setItems] = useState([]);
  const [editor, setEditor] = useState(toEditor(null));
  const [editingId, setEditingId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [viewMode, setViewMode] = useState("cards");
  const [query, setQuery] = useState("");
  const [formatFilter, setFormatFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [uploading, setUploading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await adminListServices();
      setItems(data);
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((row) => {
      if (formatFilter !== "all" && row.format_mode !== formatFilter) return false;
      if (statusFilter === "active" && !row.is_active) return false;
      if (statusFilter === "inactive" && row.is_active) return false;
      if (!q) return true;
      return [row.title, row.slug, row.category_label, row.category]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
    });
  }, [items, query, formatFilter, statusFilter]);

  const stats = useMemo(() => {
    const active = items.filter((item) => item.is_active).length;
    const draft = items.filter((item) => item.is_draft).length;
    const categories = new Set(items.map((item) => item.category || item.category_label).filter(Boolean)).size;
    return {
      total: items.length,
      active,
      draft,
      categories
    };
  }, [items]);

  function resetFilters() {
    setQuery("");
    setFormatFilter("all");
    setStatusFilter("all");
  }

  function openCreate() {
    setEditingId(null);
    setEditor(toEditor(null));
    setModalOpen(true);
    setMessage("");
    setError("");
  }

  function openEdit(row) {
    setEditingId(row.id);
    setEditor(toEditor(row));
    setModalOpen(true);
    setMessage("");
    setError("");
  }

  function closeModal() {
    setModalOpen(false);
    setEditingId(null);
    setEditor(toEditor(null));
  }

  async function save(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      const payload = toPayload(editor);
      if (!payload.slug || !payload.title) throw new Error("Slug и title обязательны.");
      if (editingId) {
        await adminUpdateService(editingId, payload);
        setMessage("Услуга обновлена.");
      } else {
        await adminCreateService(payload);
        setMessage("Услуга создана.");
      }
      await load();
      closeModal();
    } catch (err) {
      setError(err.message || "Ошибка сохранения.");
    }
  }

  async function remove(id) {
    if (!window.confirm("Удалить услугу?")) return;
    try {
      await adminDeleteService(id);
      setMessage("Услуга удалена.");
      await load();
      if (editingId === id) closeModal();
    } catch (err) {
      setError(err.message);
    }
  }

  async function onUploadServiceMedia(file) {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const result = await adminUploadFile(file, "services");
      setEditor((prev) => ({
        ...prev,
        media_text: [prev.media_text, result.path].filter(Boolean).join("\n")
      }));
      setMessage("Файл загружен и добавлен в media.");
    } catch (err) {
      setError(err.message || "Не удалось загрузить файл.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <section>
      <header className="admin-head">
        <div>
          <h1>Услуги</h1>
          <p className="muted">Показано: {filtered.length} из {items.length}</p>
        </div>
        <button className="btn-main small" type="button" onClick={openCreate}>
          Новая услуга
        </button>
      </header>

      <div className="admin-toolbar">
        <input
          className="admin-filter-input"
          placeholder="Поиск: title / slug / категория"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <select value={formatFilter} onChange={(event) => setFormatFilter(event.target.value)}>
          <option value="all">Все форматы</option>
          <option value="group_and_individual">Групповые + индивидуальные</option>
          <option value="individual_only">Только индивидуальные</option>
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
          <p>Всего услуг</p>
          <strong>{stats.total}</strong>
        </article>
        <article className="admin-kpi-card">
          <p>Активные</p>
          <strong>{stats.active}</strong>
        </article>
        <article className="admin-kpi-card">
          <p>Черновики</p>
          <strong>{stats.draft}</strong>
        </article>
        <article className="admin-kpi-card">
          <p>Категории</p>
          <strong>{stats.categories}</strong>
        </article>
      </div>

      {error ? <p className="err">{error}</p> : null}
      {message ? <p className="ok">{message}</p> : null}

      {loading ? <p className="muted">Загрузка...</p> : null}
      {!loading && filtered.length === 0 ? (
        <div className="admin-empty">
          <h3>Ничего не найдено</h3>
          <p>Сбросьте фильтры или измените поисковый запрос.</p>
        </div>
      ) : null}

      {!loading && filtered.length > 0 && viewMode === "table" ? (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Title</th>
                <th>Slug</th>
                <th>Format</th>
                <th>Статус</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id}>
                  <td>{row.id}</td>
                  <td>{row.title}</td>
                  <td>{row.slug}</td>
                  <td>{row.format_mode}</td>
                  <td>{row.is_active ? "Активна" : "Скрыта"}</td>
                  <td className="admin-actions-inline">
                    <button type="button" onClick={() => openEdit(row)}>
                      Ред.
                    </button>
                    <button type="button" className="danger" onClick={() => remove(row.id)}>
                      Удал.
                    </button>
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
                <p>{row.slug}</p>
                <div className="admin-tags">
                  <span>{row.format_mode === "individual_only" ? "Индивидуально" : "Группа + индивидуально"}</span>
                  <span>{row.category_label || row.category || "Без категории"}</span>
                  <span>{row.is_active ? "Активна" : "Скрыта"}</span>
                </div>
              </div>
              <div className="admin-actions">
                <button type="button" onClick={() => openEdit(row)}>
                  Ред.
                </button>
                <button type="button" className="danger" onClick={() => remove(row.id)}>
                  Удал.
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {modalOpen ? (
        <div className="admin-modal" onClick={closeModal}>
          <div className="admin-modal-panel" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="admin-modal-close" onClick={closeModal} aria-label="Закрыть">
              ×
            </button>
            <form className="admin-form" onSubmit={save}>
              <h2>{editingId ? `Редактирование #${editingId}` : "Создание услуги"}</h2>
              <label>
                Slug
                <input
                  value={editor.slug}
                  onChange={(event) => setEditor((prev) => ({ ...prev, slug: event.target.value }))}
                  required
                />
              </label>
              <label>
                Title
                <input
                  value={editor.title}
                  onChange={(event) => setEditor((prev) => ({ ...prev, title: event.target.value }))}
                  required
                />
              </label>
              <label>
                Category
                <input
                  value={editor.category}
                  onChange={(event) => setEditor((prev) => ({ ...prev, category: event.target.value }))}
                />
              </label>
              <label>
                Category label
                <input
                  value={editor.category_label}
                  onChange={(event) => setEditor((prev) => ({ ...prev, category_label: event.target.value }))}
                />
              </label>
              <label>
                Format
                <select
                  value={editor.format_mode}
                  onChange={(event) => setEditor((prev) => ({ ...prev, format_mode: event.target.value }))}
                >
                  <option value="group_and_individual">group_and_individual</option>
                  <option value="individual_only">individual_only</option>
                </select>
              </label>
              <label>
                Teaser
                <textarea
                  rows={2}
                  value={editor.teaser}
                  onChange={(event) => setEditor((prev) => ({ ...prev, teaser: event.target.value }))}
                />
              </label>
              <label>
                Duration
                <input
                  value={editor.duration}
                  onChange={(event) => setEditor((prev) => ({ ...prev, duration: event.target.value }))}
                />
              </label>
              <label>
                Pricing (JSON)
                <textarea
                  rows={5}
                  value={editor.pricing_text}
                  onChange={(event) => setEditor((prev) => ({ ...prev, pricing_text: event.target.value }))}
                />
              </label>
              <label>
                About (1 строка = 1 пункт)
                <textarea
                  rows={4}
                  value={editor.about_text}
                  onChange={(event) => setEditor((prev) => ({ ...prev, about_text: event.target.value }))}
                />
              </label>
              <label>
                Suitable_for (1 строка = 1 пункт)
                <textarea
                  rows={4}
                  value={editor.suitable_for_text}
                  onChange={(event) => setEditor((prev) => ({ ...prev, suitable_for_text: event.target.value }))}
                />
              </label>
              <label>
                Important (1 строка = 1 пункт)
                <textarea
                  rows={3}
                  value={editor.important_text}
                  onChange={(event) => setEditor((prev) => ({ ...prev, important_text: event.target.value }))}
                />
              </label>
              <label>
                Dress code
                <textarea
                  rows={3}
                  value={editor.dress_code_text}
                  onChange={(event) => setEditor((prev) => ({ ...prev, dress_code_text: event.target.value }))}
                />
              </label>
              <label>
                Contraindications
                <textarea
                  rows={3}
                  value={editor.contraindications_text}
                  onChange={(event) => setEditor((prev) => ({ ...prev, contraindications_text: event.target.value }))}
                />
              </label>
              <label>
                Upload media
                <input
                  type="file"
                  accept="image/*,video/*"
                  onChange={(event) => onUploadServiceMedia(event.target.files?.[0])}
                />
                <small className="muted">{uploading ? "Загрузка..." : "Файл сохранится в uploads/services."}</small>
              </label>
              <label>
                Media paths (1 строка = 1 путь)
                <textarea
                  rows={3}
                  value={editor.media_text}
                  onChange={(event) => setEditor((prev) => ({ ...prev, media_text: event.target.value }))}
                />
              </label>
              <label>
                Host name
                <input
                  value={editor.host_name}
                  onChange={(event) => setEditor((prev) => ({ ...prev, host_name: event.target.value }))}
                />
              </label>
              <label>
                Host bio
                <textarea
                  rows={2}
                  value={editor.host_bio}
                  onChange={(event) => setEditor((prev) => ({ ...prev, host_bio: event.target.value }))}
                />
              </label>
              <label>
                Age restriction
                <input
                  value={editor.age_restriction}
                  onChange={(event) => setEditor((prev) => ({ ...prev, age_restriction: event.target.value }))}
                />
              </label>
              <label className="inline">
                <input
                  type="checkbox"
                  checked={editor.is_draft}
                  onChange={(event) => setEditor((prev) => ({ ...prev, is_draft: event.target.checked }))}
                />
                Draft
              </label>
              <label className="inline">
                <input
                  type="checkbox"
                  checked={editor.is_active}
                  onChange={(event) => setEditor((prev) => ({ ...prev, is_active: event.target.checked }))}
                />
                Active
              </label>
              <button className="btn-main" type="submit">
                Сохранить
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}

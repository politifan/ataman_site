import { useEffect, useState } from "react";
import {
  adminCreateService,
  adminDeleteService,
  adminListServices,
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
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

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

  function startCreate() {
    setEditingId(null);
    setEditor(toEditor(null));
    setMessage("");
    setError("");
  }

  function startEdit(row) {
    setEditingId(row.id);
    setEditor(toEditor(row));
    setMessage("");
    setError("");
  }

  async function save(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      const payload = toPayload(editor);
      if (!payload.slug || !payload.title) {
        throw new Error("Slug и title обязательны.");
      }
      if (editingId) {
        await adminUpdateService(editingId, payload);
        setMessage("Услуга обновлена.");
      } else {
        await adminCreateService(payload);
        setMessage("Услуга создана.");
      }
      await load();
      if (!editingId) startCreate();
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
      if (editingId === id) startCreate();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section>
      <header className="admin-head">
        <h1>Услуги</h1>
        <button className="btn-main small" type="button" onClick={startCreate}>
          Новая услуга
        </button>
      </header>

      {error ? <p className="err">{error}</p> : null}
      {message ? <p className="ok">{message}</p> : null}

      <div className="admin-grid">
        <div className="admin-list">
          {loading ? <p>Загрузка...</p> : null}
          {items.map((row) => (
            <article key={row.id} className="admin-list-item">
              <div>
                <strong>{row.title}</strong>
                <p>{row.slug}</p>
              </div>
              <div className="admin-actions">
                <button type="button" onClick={() => startEdit(row)}>
                  Ред.
                </button>
                <button type="button" className="danger" onClick={() => remove(row.id)}>
                  Удал.
                </button>
              </div>
            </article>
          ))}
        </div>

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
              onChange={(event) =>
                setEditor((prev) => ({ ...prev, contraindications_text: event.target.value }))
              }
            />
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
    </section>
  );
}

import { useEffect, useState } from "react";
import {
  adminCreateGallery,
  adminDeleteGallery,
  adminListGallery,
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
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    try {
      setRows(await adminListGallery());
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function resetForm() {
    setEditingId(null);
    setForm(initialForm);
  }

  function editRow(row) {
    setEditingId(row.id);
    setForm({
      title: row.title,
      description: row.description || "",
      image_path: row.image_path,
      category: row.category || "",
      sort_order: row.sort_order || 0,
      is_active: row.is_active
    });
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
      resetForm();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(id) {
    if (!window.confirm("Удалить элемент галереи?")) return;
    try {
      await adminDeleteGallery(id);
      setMessage("Элемент удален.");
      await load();
      if (editingId === id) resetForm();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section>
      <header className="admin-head">
        <h1>Галерея</h1>
        <button className="btn-main small" type="button" onClick={resetForm}>
          Новый элемент
        </button>
      </header>

      {error ? <p className="err">{error}</p> : null}
      {message ? <p className="ok">{message}</p> : null}

      <div className="admin-grid">
        <div className="admin-list">
          {rows.map((row) => (
            <article key={row.id} className="admin-list-item">
              <div>
                <strong>{row.title}</strong>
                <p>{row.image_path}</p>
                <div className="admin-thumb">
                  <img src={toMediaUrl(row.image_path)} alt={row.title} />
                </div>
              </div>
              <div className="admin-actions">
                <button type="button" onClick={() => editRow(row)}>
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
          <button className="btn-main" type="submit">
            Сохранить
          </button>
        </form>
      </div>
    </section>
  );
}

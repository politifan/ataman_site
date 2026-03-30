import { useEffect, useMemo, useState } from "react";
import {
  adminCreatePressVideo,
  adminDeletePressVideo,
  adminListPressVideos,
  adminUpdatePressVideo,
  adminUploadFile,
  toMediaUrl
} from "../api";

const initialForm = {
  title: "",
  description: "",
  source_name: "",
  video_path: "",
  poster_path: "",
  external_url: "",
  sort_order: 0,
  is_active: true
};

function isVideoUrl(value = "") {
  return /\.(mp4|webm|mov|m4v)$/i.test(String(value || ""));
}

export default function AdminPressPage() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadingPoster, setUploadingPoster] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    try {
      setRows(await adminListPressVideos());
      setError("");
    } catch (err) {
      setError(err.message || "Не удалось загрузить видео.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      return [row.title, row.description, row.source_name, row.video_path, row.external_url]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
    });
  }, [rows, query]);

  function openCreate() {
    setEditingId(null);
    setForm(initialForm);
    setModalOpen(true);
    setError("");
    setMessage("");
  }

  function openEdit(row) {
    setEditingId(row.id);
    setForm({
      title: row.title,
      description: row.description || "",
      source_name: row.source_name || "",
      video_path: row.video_path || "",
      poster_path: row.poster_path || "",
      external_url: row.external_url || "",
      sort_order: row.sort_order || 0,
      is_active: row.is_active
    });
    setModalOpen(true);
    setError("");
    setMessage("");
  }

  function closeModal() {
    setModalOpen(false);
    setEditingId(null);
    setForm(initialForm);
  }

  async function uploadVideo(file) {
    if (!file) return;
    setUploadingVideo(true);
    setError("");
    try {
      const result = await adminUploadFile(file, "videos");
      setForm((prev) => ({ ...prev, video_path: result.path }));
      setMessage("Видео загружено.");
    } catch (err) {
      setError(err.message || "Не удалось загрузить видео.");
    } finally {
      setUploadingVideo(false);
    }
  }

  async function uploadPoster(file) {
    if (!file) return;
    setUploadingPoster(true);
    setError("");
    try {
      const result = await adminUploadFile(file, "videos");
      setForm((prev) => ({ ...prev, poster_path: result.path }));
      setMessage("Постер загружен.");
    } catch (err) {
      setError(err.message || "Не удалось загрузить постер.");
    } finally {
      setUploadingPoster(false);
    }
  }

  async function save(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      const payload = {
        ...form,
        title: form.title.trim(),
        description: form.description.trim() || null,
        source_name: form.source_name.trim() || null,
        video_path: form.video_path.trim() || null,
        poster_path: form.poster_path.trim() || null,
        external_url: form.external_url.trim() || null,
        sort_order: Number(form.sort_order || 0),
        is_active: Boolean(form.is_active)
      };

      if (!payload.title) {
        throw new Error("Введите название видео.");
      }
      if (!payload.video_path && !payload.external_url) {
        throw new Error("Загрузите видео или укажите внешнюю ссылку.");
      }

      if (editingId) {
        await adminUpdatePressVideo(editingId, payload);
        setMessage("Видео обновлено.");
      } else {
        await adminCreatePressVideo(payload);
        setMessage("Видео добавлено.");
      }
      await load();
      closeModal();
    } catch (err) {
      setError(err.message || "Не удалось сохранить видео.");
    }
  }

  async function remove(id) {
    if (!window.confirm("Удалить видео?")) return;
    try {
      await adminDeletePressVideo(id);
      setMessage("Видео удалено.");
      await load();
    } catch (err) {
      setError(err.message || "Не удалось удалить видео.");
    }
  }

  return (
    <section>
      <header className="admin-head">
        <div>
          <h1>О нас в СМИ</h1>
          <p className="muted">Показано: {filtered.length} из {rows.length}</p>
        </div>
        <button className="btn-main small" type="button" onClick={openCreate}>
          Новое видео
        </button>
      </header>

      <div className="admin-toolbar">
        <input
          className="admin-filter-input"
          placeholder="Поиск по названию, описанию, ссылке"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      {error ? <p className="err">{error}</p> : null}
      {message ? <p className="ok">{message}</p> : null}
      {loading ? <p className="muted">Загрузка...</p> : null}

      {!loading && filtered.length === 0 ? (
        <div className="admin-empty">
          <h3>Видео пока нет</h3>
          <p>Добавьте первый ролик для страницы «О нас в СМИ».</p>
        </div>
      ) : null}

      {!loading && filtered.length > 0 ? (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Название</th>
                <th>Источник</th>
                <th>Файл / ссылка</th>
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
                  <td>{row.source_name || "-"}</td>
                  <td>{row.video_path || row.external_url || "-"}</td>
                  <td>{row.sort_order || 0}</td>
                  <td>{row.is_active ? "Активно" : "Скрыто"}</td>
                  <td className="admin-actions-inline">
                    <button type="button" onClick={() => openEdit(row)}>
                      Изм.
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

      {modalOpen ? (
        <div className="admin-modal" onClick={closeModal}>
          <div className="admin-modal-panel" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="admin-modal-close" onClick={closeModal} aria-label="Закрыть">
              ×
            </button>
            <form className="admin-form" onSubmit={save}>
              <h2>{editingId ? `Редактирование видео #${editingId}` : "Новое видео"}</h2>

              <label>
                Название
                <input
                  value={form.title}
                  onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                  placeholder="Например: Репортаж о студии"
                  required
                />
              </label>

              <label>
                Краткое описание
                <textarea
                  rows={4}
                  value={form.description}
                  onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                  placeholder="О чем это видео"
                />
              </label>

              <label>
                Источник / подпись
                <input
                  value={form.source_name}
                  onChange={(event) => setForm((prev) => ({ ...prev, source_name: event.target.value }))}
                  placeholder="ТВ, мероприятие, интервью"
                />
              </label>

              <div className="admin-press-form-grid">
                <label>
                  Файл видео
                  <input
                    value={form.video_path}
                    onChange={(event) => setForm((prev) => ({ ...prev, video_path: event.target.value }))}
                    placeholder="uploads/videos/..."
                  />
                </label>

                <label>
                  Внешняя ссылка
                  <input
                    value={form.external_url}
                    onChange={(event) => setForm((prev) => ({ ...prev, external_url: event.target.value }))}
                    placeholder="https://..."
                  />
                </label>
              </div>

              <div className="admin-media-add-row">
                <input type="file" accept="video/*" onChange={(event) => uploadVideo(event.target.files?.[0])} />
                <small className="muted">{uploadingVideo ? "Загрузка видео..." : "Загрузка файла с компьютера"}</small>
              </div>

              <div className="admin-press-form-grid">
                <label>
                  Постер
                  <input
                    value={form.poster_path}
                    onChange={(event) => setForm((prev) => ({ ...prev, poster_path: event.target.value }))}
                    placeholder="uploads/videos/...jpg"
                  />
                </label>

                <label>
                  Sort order
                  <input
                    type="number"
                    value={form.sort_order}
                    onChange={(event) => setForm((prev) => ({ ...prev, sort_order: event.target.value }))}
                  />
                </label>
              </div>

              <div className="admin-media-add-row">
                <input type="file" accept="image/*" onChange={(event) => uploadPoster(event.target.files?.[0])} />
                <small className="muted">{uploadingPoster ? "Загрузка постера..." : "Необязательно, но полезно"}</small>
              </div>

              {form.video_path && isVideoUrl(form.video_path) ? (
                <div className="admin-video-preview">
                  <video controls preload="metadata" src={toMediaUrl(form.video_path)} poster={form.poster_path ? toMediaUrl(form.poster_path) : undefined} />
                </div>
              ) : null}

              <label className="inline">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(event) => setForm((prev) => ({ ...prev, is_active: event.target.checked }))}
                />
                Показывать на сайте
              </label>

              <button className="btn-main" type="submit">
                {editingId ? "Сохранить изменения" : "Добавить видео"}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}

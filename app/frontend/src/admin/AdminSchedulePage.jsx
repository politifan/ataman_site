import { useEffect, useState } from "react";
import {
  adminCreateSchedule,
  adminDeleteSchedule,
  adminListSchedule,
  adminUpdateSchedule,
  adminListServices
} from "../api";

const initialForm = {
  service_id: "",
  start_time: "",
  end_time: "",
  max_participants: 1,
  current_participants: 0,
  is_individual: false,
  is_active: true
};

function toInputDate(value) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function toPayload(form) {
  if (!form.service_id) throw new Error("Выберите услугу.");
  if (!form.start_time || !form.end_time) throw new Error("Укажите дату и время.");
  return {
    service_id: Number(form.service_id),
    start_time: new Date(form.start_time).toISOString(),
    end_time: new Date(form.end_time).toISOString(),
    max_participants: Number(form.max_participants),
    current_participants: Number(form.current_participants),
    is_individual: Boolean(form.is_individual),
    is_active: Boolean(form.is_active)
  };
}

export default function AdminSchedulePage() {
  const [rows, setRows] = useState([]);
  const [services, setServices] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    try {
      const [events, svc] = await Promise.all([adminListSchedule(), adminListServices()]);
      setRows(events);
      setServices(svc);
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
      service_id: String(row.service_id),
      start_time: toInputDate(row.start_time),
      end_time: toInputDate(row.end_time),
      max_participants: row.max_participants,
      current_participants: row.current_participants,
      is_individual: row.is_individual,
      is_active: row.is_active
    });
  }

  async function save(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      const payload = toPayload(form);
      if (editingId) {
        await adminUpdateSchedule(editingId, payload);
        setMessage("Событие обновлено.");
      } else {
        await adminCreateSchedule(payload);
        setMessage("Событие создано.");
      }
      await load();
      resetForm();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(id) {
    if (!window.confirm("Удалить событие?")) return;
    try {
      await adminDeleteSchedule(id);
      setMessage("Событие удалено.");
      await load();
      if (editingId === id) resetForm();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section>
      <header className="admin-head">
        <h1>Расписание</h1>
        <button className="btn-main small" type="button" onClick={resetForm}>
          Новое событие
        </button>
      </header>
      {error ? <p className="err">{error}</p> : null}
      {message ? <p className="ok">{message}</p> : null}

      <div className="admin-grid">
        <div className="admin-list">
          {rows.map((row) => (
            <article key={row.id} className="admin-list-item">
              <div>
                <strong>{row.service_title || row.service_slug}</strong>
                <p>
                  {new Date(row.start_time).toLocaleString("ru-RU")} -{" "}
                  {new Date(row.end_time).toLocaleString("ru-RU")}
                </p>
                <p>
                  {row.current_participants}/{row.max_participants} {row.is_individual ? "• индивидуально" : ""}
                </p>
              </div>
              <div className="admin-actions">
                <button type="button" onClick={() => editRow(row)}>
                  Ред.
                </button>
                <button className="danger" type="button" onClick={() => remove(row.id)}>
                  Удал.
                </button>
              </div>
            </article>
          ))}
        </div>

        <form className="admin-form" onSubmit={save}>
          <h2>{editingId ? `Редактирование #${editingId}` : "Создание события"}</h2>
          <label>
            Услуга
            <select
              value={form.service_id}
              onChange={(event) => setForm((prev) => ({ ...prev, service_id: event.target.value }))}
              required
            >
              <option value="">Выберите услугу</option>
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            Старт
            <input
              type="datetime-local"
              value={form.start_time}
              onChange={(event) => setForm((prev) => ({ ...prev, start_time: event.target.value }))}
              required
            />
          </label>
          <label>
            Конец
            <input
              type="datetime-local"
              value={form.end_time}
              onChange={(event) => setForm((prev) => ({ ...prev, end_time: event.target.value }))}
              required
            />
          </label>
          <label>
            Макс. участников
            <input
              type="number"
              min={1}
              value={form.max_participants}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, max_participants: Number(event.target.value) }))
              }
            />
          </label>
          <label>
            Текущих участников
            <input
              type="number"
              min={0}
              value={form.current_participants}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, current_participants: Number(event.target.value) }))
              }
            />
          </label>
          <label className="inline">
            <input
              type="checkbox"
              checked={form.is_individual}
              onChange={(event) => setForm((prev) => ({ ...prev, is_individual: event.target.checked }))}
            />
            Индивидуальное
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

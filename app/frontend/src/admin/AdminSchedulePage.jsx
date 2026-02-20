import { useEffect, useMemo, useState } from "react";
import {
  adminCreateSchedule,
  adminDeleteSchedule,
  adminListSchedule,
  adminUpdateSchedule,
  adminListServices
} from "../api";
import AdminSelect from "./AdminSelect";

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

function formatEventDateTime(value) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export default function AdminSchedulePage() {
  const [rows, setRows] = useState([]);
  const [services, setServices] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState("cards");
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedServiceId, setSelectedServiceId] = useState(null);
  const [returnServiceModalId, setReturnServiceModalId] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [events, svc] = await Promise.all([adminListSchedule(), adminListServices()]);
      setRows(events);
      setServices(svc);
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
    return rows.filter((row) => {
      if (typeFilter === "group" && row.is_individual) return false;
      if (typeFilter === "individual" && !row.is_individual) return false;
      if (statusFilter === "active" && !row.is_active) return false;
      if (statusFilter === "inactive" && row.is_active) return false;
      if (!q) return true;
      return [row.service_title, row.service_slug]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
    });
  }, [rows, query, typeFilter, statusFilter]);

  const stats = useMemo(() => {
    const active = rows.filter((row) => row.is_active).length;
    const individual = rows.filter((row) => row.is_individual).length;
    const avgLoad = rows.length
      ? Math.round(
          (rows.reduce(
            (acc, row) => acc + row.current_participants / Math.max(1, row.max_participants),
            0
          ) /
            rows.length) *
            100
        )
      : 0;
    return {
      total: rows.length,
      active,
      individual,
      avgLoad
    };
  }, [rows]);

  const groupedServices = useMemo(() => {
    const grouped = new Map();
    filtered.forEach((row) => {
      const key = String(row.service_id);
      const current = grouped.get(key) || {
        service_id: row.service_id,
        service_title: row.service_title || row.service_slug || `Услуга #${row.service_id}`,
        service_slug: row.service_slug || "",
        events: []
      };
      current.events.push(row);
      grouped.set(key, current);
    });
    return Array.from(grouped.values())
      .map((item) => ({
        ...item,
        events: [...item.events].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
      }))
      .sort((a, b) => {
        const aStart = a.events[0] ? new Date(a.events[0].start_time).getTime() : 0;
        const bStart = b.events[0] ? new Date(b.events[0].start_time).getTime() : 0;
        return aStart - bStart;
      });
  }, [filtered]);

  const selectedServiceGroup = useMemo(() => {
    if (selectedServiceId === null) return null;
    return groupedServices.find((item) => String(item.service_id) === String(selectedServiceId)) || null;
  }, [groupedServices, selectedServiceId]);

  function resetFilters() {
    setQuery("");
    setTypeFilter("all");
    setStatusFilter("all");
  }

  function openCreate() {
    setEditingId(null);
    setReturnServiceModalId(null);
    setForm(initialForm);
    setModalOpen(true);
  }

  function openServiceModal(serviceId) {
    setSelectedServiceId(serviceId);
  }

  function closeServiceModal() {
    setSelectedServiceId(null);
  }

  function openEdit(row, options = {}) {
    if (options.returnToServiceId !== undefined) {
      setReturnServiceModalId(options.returnToServiceId);
    } else {
      setReturnServiceModalId(null);
    }
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
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingId(null);
    setForm(initialForm);
    if (returnServiceModalId !== null) {
      setSelectedServiceId(returnServiceModalId);
      setReturnServiceModalId(null);
    }
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
      closeModal();
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
      if (editingId === id) closeModal();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section>
      <header className="admin-head">
        <div>
          <h1>Расписание</h1>
          <p className="muted">Показано: {filtered.length} из {rows.length}</p>
        </div>
        <button className="btn-main small" type="button" onClick={openCreate}>
          Новое событие
        </button>
      </header>

      <div className="admin-toolbar">
        <input
          className="admin-filter-input"
          placeholder="Поиск: услуга / slug"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <AdminSelect
          value={typeFilter}
          onChange={(nextValue) => setTypeFilter(nextValue)}
          options={[
            { value: "all", label: "Все типы" },
            { value: "group", label: "Групповые" },
            { value: "individual", label: "Индивидуальные" }
          ]}
        />
        <AdminSelect
          value={statusFilter}
          onChange={(nextValue) => setStatusFilter(nextValue)}
          options={[
            { value: "all", label: "Все статусы" },
            { value: "active", label: "Только активные" },
            { value: "inactive", label: "Только неактивные" }
          ]}
        />
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
          <p>Всего событий</p>
          <strong>{stats.total}</strong>
        </article>
        <article className="admin-kpi-card">
          <p>Активные</p>
          <strong>{stats.active}</strong>
        </article>
        <article className="admin-kpi-card">
          <p>Индивидуальные</p>
          <strong>{stats.individual}</strong>
        </article>
        <article className="admin-kpi-card">
          <p>Средняя загрузка</p>
          <strong>{stats.avgLoad}%</strong>
        </article>
      </div>

      {error ? <p className="err">{error}</p> : null}
      {message ? <p className="ok">{message}</p> : null}
      {loading ? <p className="muted">Загрузка...</p> : null}
      {!loading && filtered.length === 0 ? (
        <div className="admin-empty">
          <h3>Событий по фильтру не найдено</h3>
          <p>Измените фильтры, чтобы увидеть данные.</p>
        </div>
      ) : null}

      {!loading && filtered.length > 0 && viewMode === "table" ? (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Услуга</th>
                <th>Начало</th>
                <th>Конец</th>
                <th>Места</th>
                <th>Тип</th>
                <th>Статус</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id}>
                  <td>{row.id}</td>
                  <td>{row.service_title || row.service_slug}</td>
                  <td>{new Date(row.start_time).toLocaleString("ru-RU")}</td>
                  <td>{new Date(row.end_time).toLocaleString("ru-RU")}</td>
                  <td>{row.current_participants}/{row.max_participants}</td>
                  <td>{row.is_individual ? "Индивидуальное" : "Групповое"}</td>
                  <td>{row.is_active ? "Активно" : "Скрыто"}</td>
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
          {groupedServices.map((group) => (
            <button
              key={group.service_id}
              type="button"
              className="admin-list-item admin-schedule-service-card"
              onClick={() => openServiceModal(group.service_id)}
            >
              <div>
                <strong>{group.service_title}</strong>
                <p>
                  Дат в расписании: {group.events.length}
                </p>
                <p>
                  Ближайшая: {group.events[0] ? formatEventDateTime(group.events[0].start_time) : "-"}
                </p>
              </div>
              <div className="admin-actions">
                <span className="admin-link-btn">Открыть даты</span>
              </div>
            </button>
          ))}
        </div>
      ) : null}

      {selectedServiceGroup ? (
        <div className="admin-modal" onClick={closeServiceModal}>
          <div className="admin-modal-panel" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="admin-modal-close" onClick={closeServiceModal} aria-label="Закрыть">×</button>
            <div className="admin-form">
              <h2>{selectedServiceGroup.service_title}</h2>
              <p className="muted">Событий: {selectedServiceGroup.events.length}</p>
              <div className="admin-schedule-events-grid">
                {selectedServiceGroup.events.map((row) => (
                  <article key={row.id} className="admin-schedule-event-row">
                    <div>
                      <strong>{formatEventDateTime(row.start_time)}</strong>
                      <p>
                        {row.current_participants}/{row.max_participants} - {row.is_individual ? "индивидуально" : "группа"} - {row.is_active ? "активно" : "скрыто"}
                      </p>
                    </div>
                    <div className="admin-actions-inline">
                      <button
                        type="button"
                        onClick={() => {
                          closeServiceModal();
                          openEdit(row, { returnToServiceId: selectedServiceGroup.service_id });
                        }}
                      >
                        Ред.
                      </button>
                      <button type="button" className="danger" onClick={() => remove(row.id)}>Удал.</button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {modalOpen ? (
        <div className="admin-modal" onClick={closeModal}>
          <div className="admin-modal-panel" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="admin-modal-close" onClick={closeModal} aria-label="Закрыть">×</button>
            <form className="admin-form" onSubmit={save}>
              <h2>{editingId ? `Редактирование #${editingId}` : "Создание события"}</h2>
              <label>
                Услуга
                <AdminSelect
                  value={form.service_id}
                  onChange={(nextValue) => setForm((prev) => ({ ...prev, service_id: String(nextValue) }))}
                  options={[
                    { value: "", label: "Выберите услугу" },
                    ...services.map((service) => ({ value: String(service.id), label: service.title }))
                  ]}
                />
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
                  onChange={(event) => setForm((prev) => ({ ...prev, max_participants: Number(event.target.value) }))}
                />
              </label>
              <label>
                Текущих участников
                <input
                  type="number"
                  min={0}
                  value={form.current_participants}
                  onChange={(event) => setForm((prev) => ({ ...prev, current_participants: Number(event.target.value) }))}
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
              <button className="btn-main" type="submit">Сохранить</button>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}

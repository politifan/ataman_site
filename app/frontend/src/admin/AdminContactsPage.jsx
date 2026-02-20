import { useEffect, useState } from "react";
import {
  adminDeleteContact,
  adminListContacts,
  adminUpdateContactStatus
} from "../api";
import AdminSelect from "./AdminSelect";

const CONTACT_STATUSES = ["new", "read", "replied"];

function formatDateTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("ru-RU");
}

function toApiDate(value, isEnd = false) {
  if (!value) return "";
  return `${value}T${isEnd ? "23:59:59" : "00:00:00"}`;
}

export default function AdminContactsPage() {
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState({
    status: "",
    search: "",
    date_from: "",
    date_to: ""
  });
  const [statusDraft, setStatusDraft] = useState({});
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    try {
      const contactsData = await adminListContacts({
        status: filters.status,
        search: filters.search,
        date_from: toApiDate(filters.date_from, false),
        date_to: toApiDate(filters.date_to, true)
      });
      setRows(contactsData);
      setStatusDraft(Object.fromEntries(contactsData.map((item) => [item.id, item.status])));
      setError("");
    } catch (err) {
      setError(err.message || "Не удалось загрузить сообщения.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function applyFilters(event) {
    event.preventDefault();
    await load();
  }

  function clearFilters() {
    setFilters({ status: "", search: "", date_from: "", date_to: "" });
    setTimeout(() => load(), 0);
  }

  async function onUpdateStatus(id) {
    try {
      await adminUpdateContactStatus(id, statusDraft[id]);
      setMessage(`Статус сообщения #${id} обновлен.`);
      await load();
    } catch (err) {
      setError(err.message || "Не удалось обновить статус.");
    }
  }

  async function onDelete(id) {
    if (!window.confirm("Удалить сообщение?")) return;
    try {
      await adminDeleteContact(id);
      setMessage(`Сообщение #${id} удалено.`);
      await load();
      if (selected?.id === id) setSelected(null);
    } catch (err) {
      setError(err.message || "Не удалось удалить сообщение.");
    }
  }

  return (
    <section>
      <header className="admin-head">
        <div>
          <h1>Сообщения</h1>
          <p className="muted">Найдено: {rows.length}</p>
        </div>
      </header>

      <form className="admin-toolbar admin-toolbar-contacts" onSubmit={applyFilters}>
        <AdminSelect
          value={filters.status}
          onChange={(nextValue) => setFilters((prev) => ({ ...prev, status: nextValue }))}
          options={[
            { value: "", label: "Все статусы" },
            ...CONTACT_STATUSES.map((status) => ({ value: status, label: status }))
          ]}
        />
        <input
          className="admin-filter-input"
          value={filters.search}
          onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
          placeholder="Поиск: имя / email / телефон / текст"
        />
        <input
          type="date"
          value={filters.date_from}
          onChange={(event) => setFilters((prev) => ({ ...prev, date_from: event.target.value }))}
        />
        <input
          type="date"
          value={filters.date_to}
          onChange={(event) => setFilters((prev) => ({ ...prev, date_to: event.target.value }))}
        />
        <button type="submit" className="btn-main small">Применить</button>
        <button type="button" className="admin-ghost-btn" onClick={clearFilters}>Сбросить</button>
      </form>

      {error ? <p className="err">{error}</p> : null}
      {message ? <p className="ok">{message}</p> : null}
      {loading ? <p className="muted">Загрузка...</p> : null}

      {!loading ? (
        <div className="admin-table-wrap">
          <table className="admin-table admin-contacts-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Контакт</th>
                <th>Сообщение</th>
                <th>Дата</th>
                <th>Статус</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => (
                <tr key={item.id}>
                  <td>{item.id}</td>
                  <td>
                    <strong>{item.name}</strong>
                    <p>{item.email}</p>
                    <p>{item.phone || "-"}</p>
                  </td>
                  <td>
                    <button type="button" className="admin-link-btn" onClick={() => setSelected(item)}>
                      Просмотреть сообщение
                    </button>
                  </td>
                  <td>{formatDateTime(item.created_at)}</td>
                  <td>
                    <div className="admin-status-edit">
                      <AdminSelect
                        value={statusDraft[item.id] || item.status}
                        onChange={(nextValue) =>
                          setStatusDraft((prev) => ({
                            ...prev,
                            [item.id]: nextValue
                          }))
                        }
                        options={CONTACT_STATUSES.map((status) => ({ value: status, label: status }))}
                      />
                      <button type="button" onClick={() => onUpdateStatus(item.id)}>Сохранить</button>
                    </div>
                  </td>
                  <td className="admin-actions-inline">
                    <button type="button" className="danger" onClick={() => onDelete(item.id)}>Удалить</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {selected ? (
        <div className="admin-modal" onClick={() => setSelected(null)}>
          <div className="admin-modal-panel" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="admin-modal-close" onClick={() => setSelected(null)} aria-label="Закрыть">
              ×
            </button>
            <div className="admin-form">
              <h2>Сообщение #{selected.id}</h2>
              <p><strong>Имя:</strong> {selected.name}</p>
              <p><strong>Email:</strong> {selected.email}</p>
              <p><strong>Телефон:</strong> {selected.phone || "-"}</p>
              <p><strong>Дата:</strong> {formatDateTime(selected.created_at)}</p>
              <label>
                Текст сообщения
                <textarea value={selected.message || ""} rows={8} readOnly />
              </label>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

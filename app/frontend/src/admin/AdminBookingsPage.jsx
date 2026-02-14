import { useEffect, useMemo, useState } from "react";
import {
  adminDeleteBooking,
  adminListBookings,
  adminListServices,
  adminUpdateBookingStatus
} from "../api";

const BOOKING_STATUSES = ["pending", "waiting_payment", "confirmed", "cancelled"];

function formatDateTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("ru-RU");
}

function toApiDate(value, isEnd = false) {
  if (!value) return "";
  return `${value}T${isEnd ? "23:59:59" : "00:00:00"}`;
}

export default function AdminBookingsPage() {
  const [rows, setRows] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [filters, setFilters] = useState({
    status: "",
    service_id: "",
    search: "",
    date_from: "",
    date_to: ""
  });
  const [statusDraft, setStatusDraft] = useState({});

  async function load() {
    setLoading(true);
    try {
      const params = {
        status: filters.status,
        service_id: filters.service_id,
        search: filters.search,
        date_from: toApiDate(filters.date_from, false),
        date_to: toApiDate(filters.date_to, true)
      };
      const [bookingsData, servicesData] = await Promise.all([adminListBookings(params), adminListServices()]);
      setRows(bookingsData);
      setServices(servicesData);
      setStatusDraft(Object.fromEntries(bookingsData.map((item) => [item.id, item.status])));
      setError("");
    } catch (err) {
      setError(err.message || "Не удалось загрузить бронирования.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeFiltersCount = useMemo(() => {
    return Object.values(filters).filter(Boolean).length;
  }, [filters]);

  async function applyFilters(event) {
    event.preventDefault();
    await load();
  }

  function clearFilters() {
    setFilters({
      status: "",
      service_id: "",
      search: "",
      date_from: "",
      date_to: ""
    });
    setTimeout(() => load(), 0);
  }

  async function onUpdateStatus(bookingId) {
    try {
      const nextStatus = statusDraft[bookingId];
      if (!nextStatus) return;
      await adminUpdateBookingStatus(bookingId, nextStatus);
      setMessage(`Статус заявки #${bookingId} обновлен.`);
      await load();
    } catch (err) {
      setError(err.message || "Не удалось обновить статус.");
    }
  }

  async function onDelete(bookingId) {
    if (!window.confirm("Удалить бронирование?")) return;
    try {
      await adminDeleteBooking(bookingId);
      setMessage(`Бронирование #${bookingId} удалено.`);
      await load();
    } catch (err) {
      setError(err.message || "Не удалось удалить бронирование.");
    }
  }

  return (
    <section>
      <header className="admin-head">
        <div>
          <h1>Бронирования</h1>
          <p className="muted">Найдено: {rows.length}</p>
        </div>
      </header>

      <form className="admin-toolbar admin-toolbar-bookings" onSubmit={applyFilters}>
        <select value={filters.status} onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}>
          <option value="">Все статусы</option>
          {BOOKING_STATUSES.map((status) => (
            <option key={status} value={status}>{status}</option>
          ))}
        </select>

        <select
          value={filters.service_id}
          onChange={(event) => setFilters((prev) => ({ ...prev, service_id: event.target.value }))}
        >
          <option value="">Все услуги</option>
          {services.map((service) => (
            <option key={service.id} value={service.id}>{service.title}</option>
          ))}
        </select>

        <input
          className="admin-filter-input"
          value={filters.search}
          onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
          placeholder="Поиск: имя / телефон / email / payment_id"
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
        <button type="button" className="admin-ghost-btn" onClick={clearFilters}>Сбросить ({activeFiltersCount})</button>
      </form>

      {error ? <p className="err">{error}</p> : null}
      {message ? <p className="ok">{message}</p> : null}
      {loading ? <p className="muted">Загрузка...</p> : null}

      {!loading ? (
        <div className="admin-table-wrap">
          <table className="admin-table admin-bookings-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Клиент</th>
                <th>Услуга и дата</th>
                <th>Оплата</th>
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
                    <p>{item.phone}</p>
                    <p>{item.email}</p>
                  </td>
                  <td>
                    <strong>{item.service_title || `Событие #${item.schedule_event_id}`}</strong>
                    <p>{formatDateTime(item.event_start_time)}</p>
                  </td>
                  <td>
                    <p>{item.payment_status || "-"}</p>
                    <p>{item.payment_amount ? `${item.payment_amount} RUB` : "-"}</p>
                    <small>{item.payment_id || ""}</small>
                  </td>
                  <td>
                    <div className="admin-status-edit">
                      <select
                        value={statusDraft[item.id] || item.status}
                        onChange={(event) =>
                          setStatusDraft((prev) => ({
                            ...prev,
                            [item.id]: event.target.value
                          }))
                        }
                      >
                        {BOOKING_STATUSES.map((status) => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
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
    </section>
  );
}

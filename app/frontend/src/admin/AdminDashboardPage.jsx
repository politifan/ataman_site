import { useEffect, useState } from "react";
import { adminDashboardStats, adminListBookings, adminListContacts } from "../api";

function formatDateTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("ru-RU");
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [statsData, bookingsData, contactsData] = await Promise.all([
          adminDashboardStats(),
          adminListBookings(),
          adminListContacts({ status: "new" })
        ]);
        setStats(statsData);
        setBookings(bookingsData.slice(0, 8));
        setContacts(contactsData.slice(0, 8));
        setError("");
      } catch (err) {
        setError(err.message || "Не удалось загрузить dashboard.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <section>
      {error ? <p className="err">{error}</p> : null}
      {loading ? <p className="muted">Загрузка...</p> : null}

      <div className="admin-kpi-grid admin-kpi-grid-six">
        <article className="admin-kpi-card">
          <p>Услуги</p>
          <strong>{stats?.services ?? 0}</strong>
        </article>
        <article className="admin-kpi-card">
          <p>События</p>
          <strong>{stats?.schedule_events ?? 0}</strong>
        </article>
        <article className="admin-kpi-card">
          <p>Брони всего</p>
          <strong>{stats?.bookings_total ?? 0}</strong>
        </article>
        <article className="admin-kpi-card">
          <p>Брони в работе</p>
          <strong>{stats?.bookings_pending ?? 0}</strong>
        </article>
        <article className="admin-kpi-card">
          <p>Новые контакты</p>
          <strong>{stats?.contacts_new ?? 0}</strong>
        </article>
        <article className="admin-kpi-card">
          <p>Материалы галереи</p>
          <strong>{stats?.gallery_items ?? 0}</strong>
        </article>
      </div>

      <div className="admin-dashboard-grid">
        <article className="admin-dashboard-panel">
          <header>
            <h2>Последние бронирования</h2>
          </header>
          <div className="admin-mini-list">
            {bookings.length === 0 ? <p className="muted">Нет данных.</p> : null}
            {bookings.map((item) => (
              <div key={item.id} className="admin-mini-row">
                <div>
                  <strong>{item.name}</strong>
                  <p>{item.service_title || `Событие #${item.schedule_event_id}`}</p>
                  <small>{formatDateTime(item.event_start_time)}</small>
                </div>
                <span className={`admin-status-pill is-${item.status}`}>{item.status}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="admin-dashboard-panel">
          <header>
            <h2>Новые сообщения</h2>
          </header>
          <div className="admin-mini-list">
            {contacts.length === 0 ? <p className="muted">Нет новых сообщений.</p> : null}
            {contacts.map((item) => (
              <div key={item.id} className="admin-mini-row">
                <div>
                  <strong>{item.name}</strong>
                  <p>{item.email}</p>
                  <small>{formatDateTime(item.created_at)}</small>
                </div>
                <span className={`admin-status-pill is-${item.status}`}>{item.status}</span>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}

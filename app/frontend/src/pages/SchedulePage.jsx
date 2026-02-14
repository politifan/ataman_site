import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { getSchedule, getSite } from "../api";

function normalizeContactHref(value) {
  if (!value) return "#";
  if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("tel:") || value.startsWith("mailto:")) {
    return value;
  }
  if (value.startsWith("@")) return `https://t.me/${value.slice(1)}`;
  return value;
}

function formatDateTime(value) {
  const date = new Date(value);
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

export default function SchedulePage() {
  const [items, setItems] = useState([]);
  const [site, setSite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [scheduleData, siteData] = await Promise.all([getSchedule(), getSite()]);
        setItems(scheduleData);
        setSite(siteData);
      } catch (err) {
        setError(err.message || "Не удалось загрузить расписание.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const grouped = useMemo(() => {
    const map = new Map();
    items.forEach((item) => {
      const key = item.service_slug;
      if (!map.has(key)) {
        map.set(key, {
          slug: item.service_slug,
          title: item.service_title,
          events: []
        });
      }
      map.get(key).events.push(item);
    });
    return Array.from(map.values());
  }, [items]);

  if (loading) return <div className="state-page">Загрузка...</div>;
  if (error) return <div className="state-page">Ошибка: {error}</div>;

  const telegramHref = normalizeContactHref(site?.contacts?.telegram || "");

  return (
    <div className="page-common">
      <div className="container">
        <div className="page-common-head">
          <Link className="back-link" to="/">
            ← На главную
          </Link>
          <h1>Расписание практик</h1>
          <p>Актуальные даты групповых и индивидуальных сессий.</p>
        </div>

        <section className="schedule-grid">
          {grouped.map((group) => (
            <article key={group.slug} className="schedule-service-card">
              <header>
                <h2>{group.title}</h2>
                <Link to={`/services/${group.slug}`}>Открыть услугу</Link>
              </header>
              <div className="schedule-service-events">
                {group.events.map((event) => (
                  <div key={event.id} className="schedule-service-event">
                    <p>{formatDateTime(event.start_time)}</p>
                    <span>
                      {event.is_individual
                        ? "Индивидуальный формат"
                        : `Свободно мест: ${event.available_spots}/${event.max_participants}`}
                    </span>
                    {!event.is_individual ? (
                      <Link to={`/services/${group.slug}#service-booking`}>Записаться</Link>
                    ) : telegramHref !== "#" ? (
                      <a href={telegramHref} target="_blank" rel="noreferrer">
                        Telegram
                      </a>
                    ) : (
                      <span className="muted">Свяжитесь с администратором</span>
                    )}
                  </div>
                ))}
              </div>
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}

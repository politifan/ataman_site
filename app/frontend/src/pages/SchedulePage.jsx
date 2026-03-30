import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { getSchedule } from "../api";

function formatDateTime(value) {
  const date = new Date(value);
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

export default function SchedulePage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        setItems(await getSchedule());
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
                        ? "Индивидуальный слот доступен онлайн"
                        : `Свободно мест: ${event.available_spots}/${event.max_participants}`}
                    </span>
                    <Link to={`/services/${group.slug}?event=${event.id}#service-booking`}>Записаться</Link>
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

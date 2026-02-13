import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { getSchedule, getServices, getSite, toMediaUrl } from "../api";

function formatDateTime(value) {
  const date = new Date(value);
  const day = new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).format(date);
  const time = new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
  return `${day}, ${time}`;
}

export default function HomePage() {
  const [site, setSite] = useState(null);
  const [services, setServices] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const [siteData, serviceData, scheduleData] = await Promise.all([
          getSite(),
          getServices(),
          getSchedule()
        ]);
        setSite(siteData);
        setServices(serviceData);
        setSchedule(scheduleData);
      } catch (err) {
        setError(err.message || "Не удалось загрузить данные.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const grouped = useMemo(() => {
    return {
      group: services.filter((item) => item.format_mode === "group_and_individual"),
      individual: services.filter((item) => item.format_mode === "individual_only")
    };
  }, [services]);

  if (loading) {
    return <div className="state-page">Загрузка...</div>;
  }

  if (error) {
    return <div className="state-page">Ошибка: {error}</div>;
  }

  const heroImage = site?.home_image ? toMediaUrl(site.home_image) : "";

  return (
    <div className="page-home">
      <header
        className="hero"
        style={{
          backgroundImage: heroImage
            ? `linear-gradient(180deg, rgba(13, 21, 58, 0.55), rgba(13, 21, 58, 0.75)), url("${heroImage}")`
            : "linear-gradient(180deg, #1b245c, #0f1848)"
        }}
      >
        <div className="hero-content">
          <p className="hero-brand">{site?.brand}</p>
          <h1>{site?.tagline}</h1>
          <p>{site?.subline}</p>
          <a href="#services" className="btn-main">
            Смотреть услуги
          </a>
        </div>
      </header>

      <main className="container">
        <section id="services" className="section">
          <div className="section-head">
            <h2>УСЛУГИ</h2>
            <p>Доступен групповой и индивидуальный формат</p>
          </div>

          <h3 className="category-title">ЗВУКОТЕРАПИЯ / ТЕЛЕСНО-ТРАНСФОРМАЦИОННЫЕ ПРАКТИКИ</h3>
          <div className="service-grid">
            {grouped.group.map((service) => (
              <article key={service.slug} className="service-card">
                <h4>{service.title}</h4>
                <p>{service.teaser}</p>
                <div className="service-meta">
                  <span>{service.duration}</span>
                  {service.pricing?.group?.price_per_person ? (
                    <span>от {service.pricing.group.price_per_person} руб.</span>
                  ) : null}
                </div>
                <Link to={`/services/${service.slug}`} className="btn-ghost">
                  Открыть услугу
                </Link>
              </article>
            ))}
          </div>

          <h3 className="category-title">ТОЛЬКО ИНДИВИДУАЛЬНЫЕ ПРАКТИКИ</h3>
          <div className="service-grid">
            {grouped.individual.map((service) => (
              <article key={service.slug} className="service-card">
                <h4>{service.title}</h4>
                <p>{service.teaser}</p>
                <div className="service-meta">
                  <span>{service.duration}</span>
                  {service.pricing?.fixed?.price ? <span>{service.pricing.fixed.price} руб.</span> : null}
                </div>
                <Link to={`/services/${service.slug}`} className="btn-ghost">
                  Открыть услугу
                </Link>
              </article>
            ))}
          </div>
        </section>

        <section className="section schedule-block">
          <div className="section-head">
            <h2>РАСПИСАНИЕ</h2>
            <p>Текущие события и доступные места</p>
          </div>
          <div className="schedule-list">
            {schedule.map((item) => (
              <article key={item.id} className="schedule-item">
                <div>
                  <h4>{item.service_title}</h4>
                  {item.is_individual ? (
                    <p>Индивидуальный формат по согласованию</p>
                  ) : (
                    <p>{formatDateTime(item.start_time)}</p>
                  )}
                </div>
                <div className="schedule-right">
                  {item.is_individual ? (
                    <a
                      href={site?.contacts?.telegram || "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-main small"
                    >
                      Telegram
                    </a>
                  ) : (
                    <>
                      <span>
                        Мест: {item.available_spots}/{item.max_participants}
                      </span>
                      <Link to={`/services/${item.service_slug}`} className="btn-main small">
                        Записаться
                      </Link>
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

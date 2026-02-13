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

function formatPrice(value) {
  if (typeof value !== "number") return "";
  return new Intl.NumberFormat("ru-RU").format(value);
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
  const nextGroupEvent = schedule.find((item) => !item.is_individual);
  const contactLink = site?.contacts?.telegram || site?.contacts?.phone || "#";
  const totalPractices = services.length;
  const groupPractices = grouped.group.length;
  const visibleSchedule = schedule.slice(0, 8);

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
          <div className="hero-topline">
            <p className="hero-brand">{site?.brand}</p>
            <a href={contactLink} target="_blank" rel="noreferrer" className="hero-contact">
              Связаться
            </a>
          </div>

          <div className="hero-panel">
            <p className="hero-kicker">Студия звукотерапии и телесных практик</p>
            <h1>{site?.tagline}</h1>
            <p>{site?.subline}</p>

            <div className="hero-actions">
              <a href="#services" className="btn-main">
                Смотреть услуги
              </a>
              <a href="#schedule" className="btn-ghost">
                Ближайшие события
              </a>
            </div>

            <div className="hero-stats">
              <div>
                <span>{totalPractices}</span>
                <p>практик в каталоге</p>
              </div>
              <div>
                <span>{groupPractices}</span>
                <p>групповых форматов</p>
              </div>
              <div>
                <span>{nextGroupEvent ? formatDateTime(nextGroupEvent.start_time) : "Актуализируется"}</span>
                <p>ближайший старт</p>
              </div>
            </div>
          </div>
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
                <div className="service-card-top">
                  <p className="service-badge">{service.category_label || "Практика"}</p>
                  <p className="service-format">Группа + индивидуально</p>
                </div>
                <h4>{service.title}</h4>
                <p>{service.teaser}</p>
                <div className="service-meta">
                  <span>{service.duration}</span>
                  {service.pricing?.group?.price_per_person ? (
                    <span>от {formatPrice(service.pricing.group.price_per_person)} руб.</span>
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
                <div className="service-card-top">
                  <p className="service-badge">{service.category_label || "Практика"}</p>
                  <p className="service-format">Индивидуально</p>
                </div>
                <h4>{service.title}</h4>
                <p>{service.teaser}</p>
                <div className="service-meta">
                  <span>{service.duration}</span>
                  {service.pricing?.fixed?.price ? <span>{formatPrice(service.pricing.fixed.price)} руб.</span> : null}
                </div>
                <Link to={`/services/${service.slug}`} className="btn-ghost">
                  Открыть услугу
                </Link>
              </article>
            ))}
          </div>
        </section>

        <section id="schedule" className="section schedule-block">
          <div className="section-head">
            <h2>РАСПИСАНИЕ</h2>
            <p>Текущие события и доступные места</p>
          </div>
          <div className="schedule-list">
            {visibleSchedule.map((item) => (
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
                      <span className={item.available_spots > 0 ? "spots-open" : "spots-closed"}>
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

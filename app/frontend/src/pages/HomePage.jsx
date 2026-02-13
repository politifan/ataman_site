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

function getServicePrice(service) {
  if (service?.pricing?.group?.price_per_person) {
    return `от ${formatPrice(service.pricing.group.price_per_person)} руб.`;
  }
  if (service?.pricing?.fixed?.price) {
    return `${formatPrice(service.pricing.fixed.price)} руб.`;
  }
  if (service?.pricing?.individual?.price) {
    return `${formatPrice(service.pricing.individual.price)} руб.`;
  }
  return "По запросу";
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
    return <div className="state-page home-state">Загрузка...</div>;
  }

  if (error) {
    return <div className="state-page home-state">Ошибка: {error}</div>;
  }

  const heroImage = site?.home_image ? toMediaUrl(site.home_image) : "";
  const nextGroupEvent = schedule.find((item) => !item.is_individual);
  const contactLink = site?.contacts?.telegram || site?.contacts?.phone || "#";
  const totalPractices = services.length;
  const groupPractices = grouped.group.length;
  const visibleSchedule = schedule.slice(0, 8);

  return (
    <div className="page-home home-shell">
      <header
        className="home-hero"
        style={{
          backgroundImage: heroImage
            ? `linear-gradient(135deg, rgba(9, 17, 46, 0.73), rgba(11, 25, 59, 0.8)), url("${heroImage}")`
            : "linear-gradient(135deg, #07102c 0%, #0d1f4c 65%, #102a60 100%)"
        }}
      >
        <div className="container home-hero-wrap">
          <nav className="home-nav">
            <p>{site?.brand}</p>
            <div className="home-nav-links">
              <a href="#services">Услуги</a>
              <a href="#schedule">Расписание</a>
              <a href={contactLink} target="_blank" rel="noreferrer" className="home-contact-btn">
                Контакты
              </a>
            </div>
          </nav>

          <div className="home-hero-grid">
            <div className="home-hero-copy">
              <p className="home-kicker">Sound Therapy Studio</p>
              <h1>{site?.tagline}</h1>
              <p>{site?.subline}</p>
              <div className="home-actions">
                <a href="#services" className="home-btn home-btn-primary">
                  Выбрать практику
                </a>
                <a href="#schedule" className="home-btn home-btn-soft">
                  Смотреть даты
                </a>
              </div>
            </div>

            <div className="home-hero-side">
              <article className="home-next-event">
                <p>Ближайший групповой старт</p>
                <h3>{nextGroupEvent ? nextGroupEvent.service_title : "Расписание обновляется"}</h3>
                <span>{nextGroupEvent ? formatDateTime(nextGroupEvent.start_time) : "Следите за анонсами"}</span>
              </article>

              <div className="home-stats-grid">
                <article>
                  <h4>{totalPractices}</h4>
                  <p>практик в каталоге</p>
                </article>
                <article>
                  <h4>{groupPractices}</h4>
                  <p>групповых форматов</p>
                </article>
                <article>
                  <h4>{schedule.length}</h4>
                  <p>событий в расписании</p>
                </article>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container home-main">
        <section id="services" className="home-section">
          <div className="home-section-head">
            <p>Каталог</p>
            <h2>Услуги студии</h2>
            <span>Выберите формат, который подходит вашему состоянию и запросу.</span>
          </div>

          <div className="home-service-block">
            <div className="home-category-head">
              <h3>Групповые и комбинированные форматы</h3>
              <p>Практики в пространстве студии с поддержкой ведущего.</p>
            </div>
            <div className="home-service-grid">
              {grouped.group.map((service) => (
                <article key={service.slug} className="home-service-card">
                  <p className="home-service-badge">{service.category_label || "Практика"}</p>
                  <h4>{service.title}</h4>
                  <p>{service.teaser}</p>
                  <div className="home-service-meta">
                    <span>{service.duration || "Время по согласованию"}</span>
                    <strong>{getServicePrice(service)}</strong>
                  </div>
                  <Link to={`/services/${service.slug}`}>Открыть услугу</Link>
                </article>
              ))}
            </div>
          </div>

          <div className="home-service-block">
            <div className="home-category-head">
              <h3>Индивидуальные практики</h3>
              <p>Персональные сессии в более глубоком, камерном формате.</p>
            </div>
            <div className="home-service-grid">
              {grouped.individual.map((service) => (
                <article key={service.slug} className="home-service-card">
                  <p className="home-service-badge">{service.category_label || "Практика"}</p>
                  <h4>{service.title}</h4>
                  <p>{service.teaser}</p>
                  <div className="home-service-meta">
                    <span>{service.duration || "Время по согласованию"}</span>
                    <strong>{getServicePrice(service)}</strong>
                  </div>
                  <Link to={`/services/${service.slug}`}>Открыть услугу</Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="schedule" className="home-section home-schedule-section">
          <div className="home-section-head">
            <p>Календарь</p>
            <h2>Ближайшее расписание</h2>
            <span>Актуальные даты, свободные места и быстрый переход к записи.</span>
          </div>

          <div className="home-schedule-list">
            {visibleSchedule.map((item) => (
              <article key={item.id} className="home-schedule-card">
                <div className="home-schedule-main">
                  <h4>{item.service_title}</h4>
                  <p>{item.is_individual ? "Индивидуальный формат по согласованию" : formatDateTime(item.start_time)}</p>
                </div>
                <div className="home-schedule-side">
                  {item.is_individual ? (
                    <a href={contactLink} target="_blank" rel="noreferrer">
                      Написать в Telegram
                    </a>
                  ) : (
                    <>
                      <span className={item.available_spots > 0 ? "open" : "closed"}>
                        Мест: {item.available_spots}/{item.max_participants}
                      </span>
                      <Link to={`/services/${item.service_slug}`}>Записаться</Link>
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

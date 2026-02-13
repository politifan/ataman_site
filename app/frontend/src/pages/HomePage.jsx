import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { getSchedule, getServices, getSite, toMediaUrl } from "../api";

const STAR_POINTS = Array.from({ length: 72 }, (_, index) => ({
  x: (index * 19.7) % 100,
  y: (index * 31.3) % 100,
  size: 1 + (index % 4) * 0.6,
  delay: ((index * 0.37) % 6).toFixed(2),
  speed: 3 + (index % 5)
}));

const CONSTELLATIONS = [
  {
    id: "orion",
    x: "8%",
    y: "18%",
    scale: 1.05,
    drift: "18s",
    points: [
      [14, 10],
      [25, 22],
      [42, 20],
      [54, 34],
      [38, 48],
      [21, 46],
      [60, 12]
    ],
    links: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [2, 6]
    ]
  },
  {
    id: "lyra",
    x: "66%",
    y: "24%",
    scale: 0.9,
    drift: "22s",
    points: [
      [18, 12],
      [33, 20],
      [44, 34],
      [28, 46],
      [12, 34]
    ],
    links: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 0]
    ]
  },
  {
    id: "pleiades",
    x: "40%",
    y: "64%",
    scale: 0.8,
    drift: "20s",
    points: [
      [16, 14],
      [28, 18],
      [39, 16],
      [45, 28],
      [33, 33],
      [22, 32],
      [12, 26]
    ],
    links: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 6],
      [6, 0]
    ]
  }
];

const RITUAL_PATH = [
  {
    phase: "◑ Настройка",
    title: "Синхронизация с телом",
    text: "Мягко снимаем поверхностное напряжение через дыхание, звук и внимание к ощущениям."
  },
  {
    phase: "◐ Погружение",
    title: "Работа с глубинным состоянием",
    text: "Выбираем практику под запрос: восстановление энергии, баланс эмоций или очищение от перегруза."
  },
  {
    phase: "◒ Интеграция",
    title: "Закрепление внутренней опоры",
    text: "После сессии фиксируем результат, чтобы спокойствие и ясность сохранялись в повседневности."
  }
];

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

function normalizeContactHref(value) {
  if (!value) return "#";
  if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("tel:") || value.startsWith("mailto:")) {
    return value;
  }
  if (value.includes("@")) {
    return `mailto:${value}`;
  }
  if (value.startsWith("@")) {
    return `https://t.me/${value.slice(1)}`;
  }
  if (/^\+?[\d\s\-()]+$/.test(value)) {
    return `tel:${value.replace(/[^\d+]/g, "")}`;
  }
  return value;
}

function isVideoAsset(path = "") {
  return /\.(mp4|mov|webm|m4v)$/i.test(path);
}

function prettifyMediaName(path = "") {
  const file = path.split("/").pop() || "";
  const base = file.replace(/\.[^.]+$/, "");
  const cleaned = base.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return "Без названия";
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function prettifyMediaGroup(path = "") {
  const parts = path.split("/").filter(Boolean);
  if (parts.length < 2) return "Общий раздел";
  const group = parts[parts.length - 2];
  const cleaned = group.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function MysticSky() {
  return (
    <div className="mystic-sky" aria-hidden="true">
      <div className="mystic-nebula mystic-nebula-a" />
      <div className="mystic-nebula mystic-nebula-b" />
      <div className="mystic-nebula mystic-nebula-c" />

      {STAR_POINTS.map((star, index) => (
        <span
          key={`star-${index}`}
          className="mystic-star"
          style={{
            "--x": `${star.x}%`,
            "--y": `${star.y}%`,
            "--size": `${star.size}px`,
            "--delay": `${star.delay}s`,
            "--speed": `${star.speed}s`
          }}
        />
      ))}

      {CONSTELLATIONS.map((constellation) => (
        <svg
          key={constellation.id}
          className="mystic-constellation"
          style={{
            "--x": constellation.x,
            "--y": constellation.y,
            "--scale": constellation.scale,
            "--duration": constellation.drift
          }}
          viewBox="0 0 72 60"
          role="presentation"
        >
          {constellation.links.map(([a, b], lineIndex) => (
            <line
              key={`${constellation.id}-line-${lineIndex}`}
              x1={constellation.points[a][0]}
              y1={constellation.points[a][1]}
              x2={constellation.points[b][0]}
              y2={constellation.points[b][1]}
            />
          ))}
          {constellation.points.map((point, pointIndex) => (
            <circle key={`${constellation.id}-point-${pointIndex}`} cx={point[0]} cy={point[1]} r="1.8" />
          ))}
        </svg>
      ))}
    </div>
  );
}

function ServiceCard({ service }) {
  const cover = service.media?.[0] || "";
  const coverSrc = cover ? toMediaUrl(cover) : "";
  const coverIsVideo = isVideoAsset(cover);

  return (
    <article className="mystic-service-card">
      <div className="mystic-service-cover">
        {coverSrc ? (
          coverIsVideo ? (
            <video src={coverSrc} muted loop autoPlay playsInline preload="metadata" />
          ) : (
            <img src={coverSrc} alt={service.title} loading="lazy" />
          )
        ) : (
          <div className="mystic-service-cover-fallback" />
        )}
      </div>
      <p className="mystic-service-badge">{service.category_label || "Практика"}</p>
      <h4>{service.title}</h4>
      <p>{service.teaser}</p>
      <div className="mystic-service-meta">
        <span>{service.duration || "Время по согласованию"}</span>
        <strong>{getServicePrice(service)}</strong>
      </div>
      <Link to={`/services/${service.slug}`}>Подробнее</Link>
    </article>
  );
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
        const [siteData, serviceData, scheduleData] = await Promise.all([getSite(), getServices(), getSchedule()]);
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

  const grouped = useMemo(
    () => ({
      group: services.filter((item) => item.format_mode === "group_and_individual"),
      individual: services.filter((item) => item.format_mode === "individual_only")
    }),
    [services]
  );
  const showcaseMedia = useMemo(() => {
    const seen = new Set();
    const list = [];

    if (site?.home_image) {
      seen.add(site.home_image);
      list.push({
        path: site.home_image,
        title: "Зал студии",
        subtitle: "Главный зал под звездным небом",
        label: prettifyMediaName(site.home_image),
        group: "Пространство",
        isVideo: isVideoAsset(site.home_image)
      });
    }

    for (const service of services) {
      for (const path of service.media || []) {
        if (seen.has(path)) continue;
        seen.add(path);
        list.push({
          path,
          title: service.title,
          subtitle: service.category_label || "Практика",
          label: prettifyMediaName(path),
          group: prettifyMediaGroup(path),
          isVideo: isVideoAsset(path)
        });
      }
    }
    return list;
  }, [services, site?.home_image]);

  if (loading) {
    return <div className="state-page mystic-state">Загрузка...</div>;
  }

  if (error) {
    return <div className="state-page mystic-state">Ошибка: {error}</div>;
  }

  const heroImage = site?.home_image ? toMediaUrl(site.home_image) : "";
  const nextGroupEvent = schedule.find((item) => !item.is_individual);
  const telegramHref = normalizeContactHref(site?.contacts?.telegram || "");
  const phoneHref = normalizeContactHref(site?.contacts?.phone || "");
  const emailHref = normalizeContactHref(site?.contacts?.email || "");
  const contactHref = telegramHref !== "#" ? telegramHref : phoneHref;
  const contactIsExternal = contactHref.startsWith("http://") || contactHref.startsWith("https://");
  const visibleSchedule = schedule.slice(0, 8);
  const heroBackdrop = heroImage
    ? `linear-gradient(145deg, rgba(5, 12, 34, 0.5), rgba(5, 12, 34, 0.78)), url("${heroImage}")`
    : "linear-gradient(145deg, rgba(8, 19, 52, 0.72), rgba(8, 19, 52, 0.92))";

  return (
    <div className="mystic-home">
      <header className="mystic-header">
        <div className="container mystic-header-wrap">
          <a href="#top" className="mystic-header-brand">
            {site?.brand || "ATMAN"}
          </a>
          <nav className="mystic-header-nav">
            <a href="#services">Услуги</a>
            <a href="#schedule">Расписание</a>
            <a href="#gallery">Галерея</a>
          </nav>
          <a
            href={contactHref}
            className="mystic-header-cta"
            {...(contactIsExternal ? { target: "_blank", rel: "noreferrer" } : {})}
          >
            Связаться
          </a>
        </div>
      </header>

      <section
        id="top"
        className="mystic-hero"
        style={{
          backgroundImage: heroImage
            ? `linear-gradient(135deg, rgba(4, 10, 28, 0.67), rgba(4, 10, 28, 0.84)), url("${heroImage}")`
            : "linear-gradient(135deg, #050a1f, #081435 62%, #132d64)"
        }}
      >
        <MysticSky />

        <div className="container mystic-hero-wrap">
          <div className="mystic-hero-grid">
            <div className="mystic-hero-copy mystic-reveal">
              <p className="mystic-kicker">Space Of Inner Balance</p>
              <h1>{site?.tagline}</h1>
              <p>{site?.subline}</p>
              <div className="mystic-actions">
                <a href="#services" className="mystic-btn mystic-btn-primary">
                  Подобрать практику
                </a>
                <a href="#schedule" className="mystic-btn mystic-btn-secondary">
                  Смотреть расписание
                </a>
              </div>
              <div className="mystic-ritual-line">
                <span>Звукотерапия</span>
                <span>Медитации</span>
                <span>Телесные практики</span>
              </div>
            </div>

            <aside className="mystic-orbit mystic-reveal" style={{ animationDelay: "120ms" }}>
              <article className="mystic-orbit-card">
                <p>Ближайшее групповое событие</p>
                <h3>{nextGroupEvent ? nextGroupEvent.service_title : "Расписание обновляется"}</h3>
                <span>{nextGroupEvent ? formatDateTime(nextGroupEvent.start_time) : "Следите за анонсами"}</span>
              </article>

              <div className="mystic-metrics">
                <article>
                  <h4>{services.length}</h4>
                  <p>практик</p>
                </article>
                <article>
                  <h4>{grouped.group.length}</h4>
                  <p>групповых</p>
                </article>
                <article>
                  <h4>{schedule.length}</h4>
                  <p>событий</p>
                </article>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <main className="container mystic-main">
        <section className="mystic-section mystic-space mystic-reveal">
          <div className="mystic-space-media" style={{ backgroundImage: heroBackdrop }}>
            <div className="mystic-space-copy">
              <p>Атмосфера студии</p>
              <h2>Зал под звездным небом для глубоких практик</h2>
              <span>
                Мягкий свет, акустика, текстиль и тишина пространства помогают быстрее войти в медитативное
                состояние и восстановить внутренний ритм.
              </span>
            </div>
          </div>
        </section>

        <section id="services" className="mystic-section mystic-reveal">
          <div className="mystic-section-head">
            <p>Каталог практик</p>
            <h2>Программы для восстановления и внутренней настройки</h2>
            <span>Каждая практика работает с разными состояниями: от стресса и усталости до глубокой перезагрузки.</span>
          </div>

          <div className="mystic-service-group">
            <header>
              <h3>Групповые и комбинированные форматы</h3>
              <p>Поддерживающая атмосфера и мягкое погружение в практику.</p>
            </header>
            <div className="mystic-service-grid">
              {grouped.group.map((service) => (
                <ServiceCard key={service.slug} service={service} />
              ))}
            </div>
          </div>

          <div className="mystic-service-group">
            <header>
              <h3>Индивидуальные форматы</h3>
              <p>Точечная работа с личным запросом и более глубоким сопровождением.</p>
            </header>
            <div className="mystic-service-grid">
              {grouped.individual.map((service) => (
                <ServiceCard key={service.slug} service={service} />
              ))}
            </div>
          </div>
        </section>

        <section className="mystic-section mystic-path mystic-reveal" style={{ animationDelay: "60ms" }}>
          <div className="mystic-section-head">
            <p>Навигация по состоянию</p>
            <h2>Путь практики: от тишины к ясности</h2>
            <span>Каждый этап мягко подводит к следующему и формирует устойчивый внутренний результат.</span>
          </div>

          <div className="mystic-path-grid">
            {RITUAL_PATH.map((item) => (
              <article key={item.title} className="mystic-path-card">
                <p>{item.phase}</p>
                <h3>{item.title}</h3>
                <span>{item.text}</span>
              </article>
            ))}
          </div>
        </section>

        <section id="gallery" className="mystic-section mystic-gallery mystic-reveal" style={{ animationDelay: "90ms" }}>
          <div className="mystic-section-head">
            <p>Фото и видео</p>
            <h2>Визуальная атмосфера практик</h2>
            <span>Реальные кадры пространства и форматов занятий. Всего медиа: {showcaseMedia.length}.</span>
          </div>

          <div className="mystic-gallery-grid">
            {showcaseMedia.map((item) => (
              <article key={item.path} className="mystic-gallery-card">
                {item.isVideo ? (
                  <video src={toMediaUrl(item.path)} muted loop autoPlay playsInline preload="metadata" />
                ) : (
                  <img src={toMediaUrl(item.path)} alt={item.title} loading="lazy" />
                )}
                <div className="mystic-gallery-overlay">
                  <small>{item.group}</small>
                  <strong>{item.label}</strong>
                  <p>{item.title}</p>
                  <span>{item.isVideo ? "Видео" : "Фото"} • {item.subtitle}</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="schedule" className="mystic-section mystic-schedule mystic-reveal" style={{ animationDelay: "120ms" }}>
          <div className="mystic-section-head">
            <p>Календарь событий</p>
            <h2>Ближайшие даты и свободные места</h2>
            <span>Выберите событие и переходите к записи в один шаг.</span>
          </div>

          <div className="mystic-schedule-list">
            {visibleSchedule.map((item) => (
              <article key={item.id} className="mystic-schedule-card">
                <div className="mystic-schedule-main">
                  <h4>{item.service_title}</h4>
                  <p>{item.is_individual ? "Индивидуальный формат по согласованию" : formatDateTime(item.start_time)}</p>
                </div>

                <div className="mystic-schedule-side">
                  {item.is_individual ? (
                    <a href={contactHref} {...(contactIsExternal ? { target: "_blank", rel: "noreferrer" } : {})}>
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

      <footer className="mystic-footer">
        <div className="container mystic-footer-wrap">
          <div className="mystic-footer-col">
            <h3>{site?.brand || "ATMAN"}</h3>
            <p>Пространство звукотерапии, медитаций и телесной трансформации.</p>
          </div>
          <div className="mystic-footer-col">
            <h4>Навигация</h4>
            <a href="#services">Услуги</a>
            <a href="#gallery">Галерея</a>
            <a href="#schedule">Расписание</a>
          </div>
          <div className="mystic-footer-col">
            <h4>Контакты</h4>
            <a href={telegramHref} target="_blank" rel="noreferrer">
              Telegram
            </a>
            <a href={phoneHref}>{site?.contacts?.phone || "Телефон"}</a>
            <a href={emailHref}>{site?.contacts?.email || "Email"}</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

import { Link } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { getSchedule, getServices, getSite, toMediaUrl } from "../api";

const STAR_POINTS = Array.from({ length: 72 }, (_, index) => ({
  x: (index * 19.7) % 100,
  y: (index * 31.3) % 100,
  size: 1 + (index % 4) * 0.6,
  delay: ((index * 0.37) % 6).toFixed(2),
  speed: 3 + (index % 5)
}));

const SHOOTING_STARS = Array.from({ length: 7 }, (_, index) => ({
  x: 10 + ((index * 13.5) % 80),
  y: 8 + ((index * 9.3) % 44),
  length: 120 + (index % 3) * 45,
  delay: (index * 2.2).toFixed(2),
  duration: 6.8 + (index % 4) * 1.3
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

const HOME_ICONS = {
  duration: toMediaUrl("ikonki/svg/duration.svg"),
  group: toMediaUrl("ikonki/svg/group_practice.svg"),
  individual: toMediaUrl("ikonki/svg/individual_session.svg")
};

// Fine tune cover cropping per service card (x y):
// Example: "35% 45%" -> move focus left/down.
const COVER_POSITION_BY_SLUG = {
  "soundhealing-drum": "50% 42%",
  "gong-bowls-meditation": "50% 44%",
  "gong-hammocks-meditation": "50% 48%",
  "nail-standing": "50% 50%",
  "chakra-path": "50% 48%",
  "leela-game": "50% 46%",
  "vibro-bath-gong-bowls": "50% 48%",
  "vibro-bath-crystal-bowls": "50% 50%",
  "bila-bells-harmonization": "50% 46%",
  "systemic-constellations": "50% 44%",
  "hypnosis-path-to-self": "50% 50%"
};

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

function transliterateToRu(input = "") {
  const source = String(input);
  const lower = source.toLowerCase();
  const patterns = [
    ["shch", "щ"],
    ["yo", "ё"],
    ["zh", "ж"],
    ["kh", "х"],
    ["ts", "ц"],
    ["ch", "ч"],
    ["sh", "ш"],
    ["yu", "ю"],
    ["ya", "я"],
    ["a", "а"],
    ["b", "б"],
    ["v", "в"],
    ["g", "г"],
    ["d", "д"],
    ["e", "е"],
    ["z", "з"],
    ["i", "и"],
    ["j", "й"],
    ["k", "к"],
    ["l", "л"],
    ["m", "м"],
    ["n", "н"],
    ["o", "о"],
    ["p", "п"],
    ["r", "р"],
    ["s", "с"],
    ["t", "т"],
    ["u", "у"],
    ["f", "ф"],
    ["h", "х"],
    ["c", "к"],
    ["y", "ы"],
    ["x", "кс"],
    ["q", "к"]
  ];

  let out = "";
  let idx = 0;
  while (idx < lower.length) {
    let replaced = false;
    for (const [latin, cyr] of patterns) {
      if (lower.startsWith(latin, idx)) {
        out += cyr;
        idx += latin.length;
        replaced = true;
        break;
      }
    }
    if (!replaced) {
      out += source[idx];
      idx += 1;
    }
  }
  return out.replace(/\s+/g, " ").trim();
}

function autoRu(value = "") {
  if (!value) return "";
  if (/[А-Яа-яЁё]/.test(value)) return value;
  if (!/^[A-Za-z0-9\s'".,!?()\-_/]+$/.test(value)) return value;
  const translated = transliterateToRu(value);
  return translated.charAt(0).toUpperCase() + translated.slice(1);
}

function prettifyMediaName(path = "") {
  const file = path.split("/").pop() || "";
  const base = file.replace(/\.[^.]+$/, "");
  const cleaned = base.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return "Без названия";
  const localized = autoRu(cleaned);
  return localized.charAt(0).toUpperCase() + localized.slice(1);
}

function prettifyMediaGroup(path = "") {
  const parts = path.split("/").filter(Boolean);
  if (parts.length < 2) return "Общий раздел";
  const group = parts[parts.length - 2];
  const cleaned = group.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  const localized = autoRu(cleaned);
  return localized.charAt(0).toUpperCase() + localized.slice(1);
}

function MysticSky() {
  return (
    <div className="mystic-sky" aria-hidden="true">
      <div className="mystic-nebula mystic-nebula-a" />
      <div className="mystic-nebula mystic-nebula-b" />
      <div className="mystic-nebula mystic-nebula-c" />

      <div className="mystic-symbol mystic-symbol-dharma">
        <svg viewBox="0 0 120 120" role="presentation">
          <circle cx="60" cy="60" r="38" />
          <circle cx="60" cy="60" r="10" />
          {[0, 45, 90, 135].map((angle) => (
            <g key={`dharma-spoke-${angle}`} transform={`rotate(${angle} 60 60)`}>
              <line x1="60" y1="16" x2="60" y2="104" />
              <line x1="16" y1="60" x2="104" y2="60" />
            </g>
          ))}
        </svg>
      </div>

      <div className="mystic-symbol mystic-symbol-lotus">
        <svg viewBox="0 0 220 120" role="presentation">
          <ellipse cx="110" cy="74" rx="28" ry="26" />
          <ellipse cx="72" cy="78" rx="22" ry="20" transform="rotate(-18 72 78)" />
          <ellipse cx="148" cy="78" rx="22" ry="20" transform="rotate(18 148 78)" />
          <ellipse cx="42" cy="90" rx="16" ry="14" transform="rotate(-28 42 90)" />
          <ellipse cx="178" cy="90" rx="16" ry="14" transform="rotate(28 178 90)" />
          <path d="M40 102 C78 112, 142 112, 180 102" />
        </svg>
      </div>

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

      {SHOOTING_STARS.map((star, index) => (
        <span
          key={`shoot-${index}`}
          className="mystic-shooting-star"
          style={{
            "--x": `${star.x}%`,
            "--y": `${star.y}%`,
            "--len": `${star.length}px`,
            "--delay": `${star.delay}s`,
            "--duration": `${star.duration}s`
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

function ServiceCard({ service, index = 0 }) {
  const cover = service.media?.[0] || "";
  const coverSrc = cover ? toMediaUrl(cover) : "";
  const coverIsVideo = isVideoAsset(cover);
  const coverPosition = COVER_POSITION_BY_SLUG[service.slug] || "50% 50%";

  return (
    <article className="mystic-service-card is-enter" style={{ "--card-delay": `${Math.min(index, 10) * 60}ms` }}>
      <div className="mystic-service-cover">
        {coverSrc ? (
          coverIsVideo ? (
            <video
              src={coverSrc}
              muted
              loop
              autoPlay
              playsInline
              preload="metadata"
              style={{ objectPosition: coverPosition }}
            />
          ) : (
            <img src={coverSrc} alt={service.title} loading="lazy" style={{ objectPosition: coverPosition }} />
          )
        ) : (
          <div className="mystic-service-cover-fallback" />
        )}
      </div>
      <p className="mystic-service-badge">{autoRu(service.category_label || "Практика")}</p>
      <h4>{autoRu(service.title || "")}</h4>
      <p>{autoRu(service.teaser || "")}</p>
      <div className="mystic-service-meta">
        <span>
          <img src={HOME_ICONS.duration} alt="" aria-hidden="true" />
          {service.duration || "Время по согласованию"}
        </span>
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
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [showAllGroupServices, setShowAllGroupServices] = useState(false);
  const [showAllIndividualServices, setShowAllIndividualServices] = useState(false);
  const [activeServiceTab, setActiveServiceTab] = useState("group");
  const [isServiceSwitching, setIsServiceSwitching] = useState(false);
  const servicePanelRef = useRef(null);
  const tabScrollReadyRef = useRef(false);
  const serviceSwitchTimerRef = useRef(null);
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

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === "Escape") {
        setSelectedMedia(null);
      }
    }

    if (selectedMedia) {
      window.addEventListener("keydown", onKeyDown);
      document.body.style.overflow = "hidden";
    }

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [selectedMedia]);

  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll(".mystic-reveal"));
    if (!nodes.length) return undefined;

    const variants = [
      "mystic-reveal-up",
      "mystic-reveal-right",
      "mystic-reveal-left",
      "mystic-reveal-zoom",
      "mystic-reveal-soft"
    ];

    nodes.forEach((node, index) => {
      const variant = variants[index % variants.length];
      node.classList.add(variant);
    });

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.18, rootMargin: "0px 0px -6% 0px" }
    );

    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [loading]);

  useEffect(() => {
    if (!tabScrollReadyRef.current) {
      tabScrollReadyRef.current = true;
      return;
    }
    if (!servicePanelRef.current) return;
    if (!window.matchMedia("(max-width: 980px)").matches) return;
    const y = servicePanelRef.current.getBoundingClientRect().top + window.scrollY - 92;
    window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
  }, [activeServiceTab]);

  useEffect(() => {
    return () => {
      if (serviceSwitchTimerRef.current) {
        clearTimeout(serviceSwitchTimerRef.current);
      }
    };
  }, []);

  function handleServiceTabChange(nextTab) {
    if (nextTab === activeServiceTab || isServiceSwitching) return;
    setIsServiceSwitching(true);
    serviceSwitchTimerRef.current = setTimeout(() => {
      setActiveServiceTab(nextTab);
      requestAnimationFrame(() => setIsServiceSwitching(false));
    }, 170);
  }

  const grouped = useMemo(
    () => ({
      group: services.filter((item) => item.format_mode === "group_and_individual"),
      individual: services.filter((item) => item.format_mode === "individual_only")
    }),
    [services]
  );
  const groupPreview = showAllGroupServices ? grouped.group : grouped.group.slice(0, 4);
  const individualPreview = showAllIndividualServices ? grouped.individual : grouped.individual.slice(0, 4);
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
          title: autoRu(service.title || ""),
          subtitle: autoRu(service.category_label || "Практика"),
          label: prettifyMediaName(path),
          group: prettifyMediaGroup(path),
          isVideo: isVideoAsset(path)
        });
      }
    }
    return list.slice(0, 6);
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
  const phone2Href = normalizeContactHref(site?.contacts?.phone_2 || "");
  const emailHref = normalizeContactHref(site?.contacts?.email || "");
  const vkHref = normalizeContactHref(site?.contacts?.vk || "");
  const rutubeHref = normalizeContactHref(site?.contacts?.rutube || "");
  const orgName = site?.organization?.name || "";
  const orgInn = site?.organization?.inn || "";
  const orgOgrnip = site?.organization?.ogrnip || "";
  const metrikaId = String(site?.analytics?.metrika_id || "").trim();
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
                <a href="#services">Каталог</a>
                <Link to="/schedule">Расписание</Link>
                <Link to="/gallery">Галерея</Link>
                <Link to="/contacts">Контакты</Link>
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
                <button
                  type="button"
                  onClick={() => {
                    handleServiceTabChange("group");
                    document.getElementById("services")?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                >
                  <img src={HOME_ICONS.group} alt="" aria-hidden="true" />
                  Звукотерапия
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleServiceTabChange("group");
                    document.getElementById("services")?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                >
                  <img src={HOME_ICONS.group} alt="" aria-hidden="true" />
                  Медитации
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleServiceTabChange("group");
                    document.getElementById("services")?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                >
                  <img src={HOME_ICONS.individual} alt="" aria-hidden="true" />
                  Телесные практики
                </button>
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

          <div className="mystic-service-tabs" role="tablist" aria-label="Форматы услуг">
            <button
              type="button"
              role="tab"
              aria-selected={activeServiceTab === "group"}
              className={`mystic-service-tab ${activeServiceTab === "group" ? "is-active" : ""}`}
              onClick={() => handleServiceTabChange("group")}
            >
              Групповые и комбинированные
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeServiceTab === "individual"}
              className={`mystic-service-tab ${activeServiceTab === "individual" ? "is-active" : ""}`}
              onClick={() => handleServiceTabChange("individual")}
            >
              Индивидуальные
            </button>
          </div>

          {activeServiceTab === "group" ? (
            <div
              ref={servicePanelRef}
              className={`mystic-service-group mystic-service-panel ${isServiceSwitching ? "is-switching" : ""}`}
              role="tabpanel"
            >
              <header>
                <h3>Групповые и комбинированные форматы</h3>
                <p>Поддерживающая атмосфера и мягкое погружение в практику.</p>
              </header>
              <div key={`group-${showAllGroupServices ? "all" : "preview"}`} className="mystic-service-grid">
                {groupPreview.map((service, index) => (
                  <ServiceCard key={service.slug} service={service} index={index} />
                ))}
              </div>
              {grouped.group.length > 4 ? (
                <div className="mystic-service-toggle-wrap">
                  <button
                    type="button"
                    className="mystic-service-toggle"
                    onClick={() => setShowAllGroupServices((value) => !value)}
                  >
                    {showAllGroupServices ? "Свернуть список" : `Показать все (${grouped.group.length})`}
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <div
              ref={servicePanelRef}
              className={`mystic-service-group mystic-service-panel ${isServiceSwitching ? "is-switching" : ""}`}
              role="tabpanel"
            >
              <header>
                <h3>Индивидуальные форматы</h3>
                <p>Точечная работа с личным запросом и более глубоким сопровождением.</p>
              </header>
              <div key={`individual-${showAllIndividualServices ? "all" : "preview"}`} className="mystic-service-grid">
                {individualPreview.map((service, index) => (
                  <ServiceCard key={service.slug} service={service} index={index} />
                ))}
              </div>
              {grouped.individual.length > 4 ? (
                <div className="mystic-service-toggle-wrap">
                  <button
                    type="button"
                    className="mystic-service-toggle"
                    onClick={() => setShowAllIndividualServices((value) => !value)}
                  >
                    {showAllIndividualServices ? "Свернуть список" : `Показать все (${grouped.individual.length})`}
                  </button>
                </div>
              ) : null}
            </div>
          )}
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
            <p>Фото практик</p>
            <h2>Атмосфера пространства</h2>
            <span>Короткая подборка: {showcaseMedia.length} фото.</span>
          </div>

          <div className="mystic-gallery-frame is-expanded" id="gallery-content">
            <div className="mystic-gallery-grid">
              {showcaseMedia.map((item) => (
                <article key={item.path} className="mystic-gallery-card">
                  <button
                    type="button"
                    className="mystic-gallery-open"
                    onClick={() => setSelectedMedia(item)}
                    aria-label={`Открыть: ${item.label}`}
                  >
                    {item.isVideo ? (
                      <video src={toMediaUrl(item.path)} muted loop autoPlay playsInline preload="metadata" />
                    ) : (
                      <img src={toMediaUrl(item.path)} alt={item.title} loading="lazy" />
                    )}
                  </button>
                </article>
              ))}
            </div>
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
                  <h4>{autoRu(item.service_title || "")}</h4>
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

      {selectedMedia ? (
        <div className="mystic-lightbox" role="dialog" aria-modal="true" onClick={() => setSelectedMedia(null)}>
          <div className="mystic-lightbox-panel" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="mystic-lightbox-close" onClick={() => setSelectedMedia(null)} aria-label="Закрыть">
              ×
            </button>
            <div className="mystic-lightbox-media">
              {selectedMedia.isVideo ? (
                <video src={toMediaUrl(selectedMedia.path)} controls autoPlay playsInline preload="metadata" />
              ) : (
                <img src={toMediaUrl(selectedMedia.path)} alt={selectedMedia.title} loading="eager" />
              )}
            </div>
            <div className="mystic-lightbox-meta">
              <small>{selectedMedia.group}</small>
              <p>{selectedMedia.title}</p>
              <span>{selectedMedia.isVideo ? "Видео" : "Фото"} • {selectedMedia.subtitle}</span>
            </div>
          </div>
        </div>
      ) : null}

      <footer className="mystic-footer">
        <div className="container mystic-footer-wrap">
          <div className="mystic-footer-col">
            <h3>{site?.brand || "ATMAN"}</h3>
            <p>Пространство звукотерапии, медитаций и телесной трансформации.</p>
            {orgName ? <p>{orgName}</p> : null}
            {orgInn ? <p>ИНН {orgInn}</p> : null}
            {orgOgrnip ? <p>ОГРНИП {orgOgrnip}</p> : null}
          </div>
          <div className="mystic-footer-col">
            <h4>Навигация</h4>
            <Link to="/services">Услуги</Link>
            <Link to="/gallery">Галерея</Link>
            <Link to="/schedule">Расписание</Link>
            <Link to="/contacts">Контакты</Link>
          </div>
          <div className="mystic-footer-col">
            <h4>Документы</h4>
            <Link to="/legal/offer">Оферта</Link>
            <Link to="/legal/privacy">Политика конфиденциальности</Link>
            <Link to="/legal/personal-data">Согласие на ПД</Link>
            <Link to="/legal/marketing">Согласие на рассылку</Link>
            <Link to="/legal/terms">Условия услуг</Link>
          </div>
          <div className="mystic-footer-col">
            <h4>Контакты</h4>
            <a href={telegramHref} target="_blank" rel="noreferrer">
              Telegram
            </a>
            <a href={phoneHref}>{site?.contacts?.phone || "Телефон"}</a>
            {site?.contacts?.phone_2 ? <a href={phone2Href}>{site.contacts.phone_2}</a> : null}
            <a href={emailHref}>{site?.contacts?.email || "Email"}</a>
            {site?.contacts?.address ? <p>{site.contacts.address}</p> : null}
            {site?.contacts?.working_hours ? <p>{site.contacts.working_hours}</p> : null}
            {site?.contacts?.vk ? (
              <a href={vkHref} target="_blank" rel="noreferrer">
                VK
              </a>
            ) : null}
            {site?.contacts?.rutube ? (
              <a href={rutubeHref} target="_blank" rel="noreferrer">
                RuTube
              </a>
            ) : null}
            {metrikaId ? (
              <a
                href={`https://metrika.yandex.ru/dashboard?id=${encodeURIComponent(metrikaId)}`}
                target="_blank"
                rel="noreferrer"
              >
                Статистика
              </a>
            ) : null}
          </div>
        </div>
      </footer>
    </div>
  );
}

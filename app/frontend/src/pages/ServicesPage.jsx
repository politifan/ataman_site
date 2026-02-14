import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { getServices, getSite, toMediaUrl } from "../api";

function isVideoAsset(path = "") {
  return /\.(mp4|webm|mov|m4v)$/i.test(path);
}

function formatPrice(value) {
  if (typeof value !== "number") return "По запросу";
  return `${new Intl.NumberFormat("ru-RU").format(value)} руб.`;
}

function servicePriceLabel(service) {
  if (service?.pricing?.group?.price_per_person) return `от ${formatPrice(service.pricing.group.price_per_person)}`;
  if (service?.pricing?.fixed?.price) return formatPrice(service.pricing.fixed.price);
  if (service?.pricing?.individual?.price) return formatPrice(service.pricing.individual.price);
  return "По запросу";
}

export default function ServicesPage() {
  const [site, setSite] = useState(null);
  const [services, setServices] = useState([]);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [siteData, serviceData] = await Promise.all([getSite(), getServices()]);
        setSite(siteData);
        setServices(serviceData);
        setError("");
      } catch (err) {
        setError(err.message || "Не удалось загрузить каталог услуг.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return services.filter((service) => {
      if (tab === "group" && service.format_mode !== "group_and_individual") return false;
      if (tab === "individual" && service.format_mode !== "individual_only") return false;
      if (!q) return true;
      return [service.title, service.category_label, service.teaser]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
    });
  }, [services, query, tab]);

  if (loading) return <div className="state-page">Загрузка...</div>;
  if (error) return <div className="state-page">Ошибка: {error}</div>;

  return (
    <div className="page-common page-services">
      <div className="container">
        <header className="page-common-head">
          <div>
            <p>{site?.brand || "ATMAN"}</p>
            <h1>Каталог практик</h1>
            <span>Выберите формат участия и найдите программу под ваш запрос.</span>
          </div>
          <div className="page-common-actions">
            <Link className="back-link" to="/">
              ← На главную
            </Link>
            <Link className="btn-main small" to="/schedule">
              Расписание
            </Link>
          </div>
        </header>

        <section className="page-common-panel services-filter-panel">
          <div className="services-tabs" role="tablist" aria-label="Формат услуг">
            <button type="button" className={tab === "all" ? "is-active" : ""} onClick={() => setTab("all")}>Все</button>
            <button type="button" className={tab === "group" ? "is-active" : ""} onClick={() => setTab("group")}>
              Групповые
            </button>
            <button
              type="button"
              className={tab === "individual" ? "is-active" : ""}
              onClick={() => setTab("individual")}
            >
              Индивидуальные
            </button>
          </div>
          <input
            className="services-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск по названию и описанию"
          />
        </section>

        <section className="services-page-grid">
          {filtered.map((service) => {
            const cover = service.media?.[0] || "";
            const coverUrl = cover ? toMediaUrl(cover) : "";
            return (
              <article key={service.slug} className="services-page-card">
                <div className="services-page-cover">
                  {coverUrl ? (
                    isVideoAsset(cover) ? (
                      <video src={coverUrl} muted loop autoPlay playsInline preload="metadata" />
                    ) : (
                      <img src={coverUrl} alt={service.title} loading="lazy" />
                    )
                  ) : (
                    <div className="services-page-cover-fallback" />
                  )}
                </div>
                <p className="services-page-category">{service.category_label || "Практика"}</p>
                <h2>{service.title}</h2>
                <p>{service.teaser || "Описание уточняется."}</p>
                <div className="services-page-meta">
                  <span>{service.duration || "По согласованию"}</span>
                  <strong>{servicePriceLabel(service)}</strong>
                </div>
                <Link className="btn-main small" to={`/services/${service.slug}`}>
                  Открыть услугу
                </Link>
              </article>
            );
          })}
        </section>
      </div>
    </div>
  );
}

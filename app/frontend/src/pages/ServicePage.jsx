import { Link, useParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { getSchedule, getService, submitBooking, toMediaUrl } from "../api";

function formatDateTime(value) {
  const date = new Date(value);
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function formatPrice(value) {
  if (typeof value !== "number") return "";
  return new Intl.NumberFormat("ru-RU").format(value);
}

const initialForm = {
  name: "",
  phone: "",
  email: "",
  comment: "",
  privacy_policy: false,
  personal_data: false,
  terms: false
};

const INFO_ICONS = {
  suitable: "ikonki/praktika_podhodit_vam_esli.png",
  important: "ikonki/vazhno.png",
  dress: "ikonki/forma_odezhdy.png"
};

function InfoList({ title, items, icon }) {
  if (!items?.length) return null;
  return (
    <>
      <div className="service-copy-head">
        {icon ? <img src={toMediaUrl(icon)} alt="" aria-hidden="true" /> : null}
        <h2>{title}</h2>
      </div>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </>
  );
}

export default function ServicePage() {
  const { slug } = useParams();
  const [service, setService] = useState(null);
  const [schedule, setSchedule] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedMedia, setSelectedMedia] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setError("");
        const [serviceData, scheduleData] = await Promise.all([getService(slug), getSchedule(slug)]);
        setService(serviceData);
        setSchedule(scheduleData);
      } catch (err) {
        setError(err.message || "Не удалось загрузить услугу.");
      }
    }
    load();
  }, [slug]);

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === "Escape") setSelectedMedia("");
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

  const selectedEvent = useMemo(() => {
    return schedule.find((item) => !item.is_individual && item.available_spots > 0) || null;
  }, [schedule]);
  const nextEvents = useMemo(() => {
    return schedule.filter((item) => !item.is_individual).slice(0, 4);
  }, [schedule]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!selectedEvent) {
      setError("Нет доступных групповых событий для онлайн-бронирования.");
      return;
    }

    setSending(true);
    setError("");
    setSuccess("");

    try {
      const response = await submitBooking({
        schedule_id: selectedEvent.id,
        ...form
      });
      if (response.confirmation_url) {
        window.location.href = response.confirmation_url;
        return;
      }
      setSuccess("Заявка создана. Ссылка на оплату пока недоступна.");
      setForm(initialForm);
    } catch (err) {
      setError(err.message || "Не удалось отправить заявку.");
    } finally {
      setSending(false);
    }
  }

  if (error && !service) {
    return <div className="state-page">Ошибка: {error}</div>;
  }

  if (!service) {
    return <div className="state-page">Загрузка...</div>;
  }

  const heroImage = service.media?.[0] ? toMediaUrl(service.media[0]) : "";

  return (
    <div className="page-service">
      <div className="container">
        <Link className="back-link" to="/">
          ← На главную
        </Link>

        <header
          className="service-hero"
          style={{
            backgroundImage: heroImage
              ? `linear-gradient(180deg, rgba(22, 35, 80, 0.15), rgba(22, 35, 80, 0.75)), url("${heroImage}")`
              : "linear-gradient(180deg, #f3efe8, #e6dfd4)"
          }}
        >
          <div>
            <p className="service-category">{service.category_label}</p>
            <h1>{service.title}</h1>
            <p>{service.teaser}</p>
          </div>
        </header>

        <section className="section service-layout">
          <article className="service-main">
            <div className="service-copy-head">
              <h2>О ПРАКТИКЕ</h2>
            </div>
            {service.about?.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}

            <InfoList title="ПРАКТИКА ПОДОЙДЕТ, ЕСЛИ" items={service.suitable_for} icon={INFO_ICONS.suitable} />
            <InfoList title="ВАЖНО" items={service.important} icon={INFO_ICONS.important} />
            <InfoList title="ФОРМА ОДЕЖДЫ" items={service.dress_code} icon={INFO_ICONS.dress} />

            {service.contraindications?.length ? (
              <>
                <h2>ПРОТИВОПОКАЗАНИЯ</h2>
                <ul>
                  {service.contraindications.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </>
            ) : null}
          </article>

          <aside className="service-side">
            <div className="side-card">
              <h3>ДЕТАЛИ</h3>
              <div className="detail-row">
                <span>Длительность</span>
                <strong>{service.duration || "По запросу"}</strong>
              </div>
              {service.pricing?.group ? (
                <div className="detail-row">
                  <span>Группа</span>
                  <strong>{formatPrice(service.pricing.group.price_per_person)} руб.</strong>
                </div>
              ) : null}
              {service.pricing?.individual ? (
                <div className="detail-row">
                  <span>Индивидуально</span>
                  <strong>{formatPrice(service.pricing.individual.price)} руб.</strong>
                </div>
              ) : null}
              {service.pricing?.fixed ? (
                <div className="detail-row">
                  <span>Стоимость</span>
                  <strong>{formatPrice(service.pricing.fixed.price)} руб.</strong>
                </div>
              ) : null}
              {service.age_restriction ? (
                <div className="detail-row">
                  <span>Возраст</span>
                  <strong>{service.age_restriction}</strong>
                </div>
              ) : null}
            </div>

            {nextEvents.length ? (
              <div className="side-card">
                <h3>БЛИЖАЙШИЕ ДАТЫ</h3>
                <div className="event-list">
                  {nextEvents.map((item) => (
                    <div key={item.id} className="event-list-item">
                      <p>{formatDateTime(item.start_time)}</p>
                      <span>
                        Мест: {item.available_spots}/{item.max_participants}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {!service.is_draft && selectedEvent ? (
              <form className="side-card booking-form" onSubmit={handleSubmit}>
                <h3>ЗАПИСЬ ОНЛАЙН</h3>
                <p className="muted">Ближайшая группа: {formatDateTime(selectedEvent.start_time)}</p>
                <input
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Ваше имя"
                  required
                />
                <input
                  value={form.phone}
                  onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
                  placeholder="Телефон"
                  required
                />
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                  placeholder="Email"
                  required
                />
                <textarea
                  value={form.comment}
                  onChange={(event) => setForm((prev) => ({ ...prev, comment: event.target.value }))}
                  placeholder="Комментарий"
                  rows={3}
                />
                <label>
                  <input
                    type="checkbox"
                    checked={form.privacy_policy}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, privacy_policy: event.target.checked }))
                    }
                    required
                  />
                  Политика конфиденциальности
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={form.personal_data}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, personal_data: event.target.checked }))
                    }
                    required
                  />
                  Согласие на обработку данных
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={form.terms}
                    onChange={(event) => setForm((prev) => ({ ...prev, terms: event.target.checked }))}
                    required
                  />
                  Условия оказания услуг
                </label>
                <button className="btn-main" type="submit" disabled={sending}>
                  {sending ? "Отправка..." : "Отправить заявку"}
                </button>
                {success ? <p className="ok">{success}</p> : null}
                {error ? <p className="err">{error}</p> : null}
              </form>
            ) : (
              <div className="side-card">
                <h3>ЗАПИСЬ</h3>
                <p>
                  Для этой услуги запись проходит через администратора. Напишите в Telegram или позвоните для
                  согласования удобного времени.
                </p>
              </div>
            )}
          </aside>
        </section>

        {service.media?.length ? (
          <section className="section">
            <h2>ФОТО</h2>
            <div className="media-grid">
              {service.media.map((path) => (
                <figure key={path}>
                  <button
                    type="button"
                    className="service-media-open"
                    onClick={() => setSelectedMedia(path)}
                    aria-label="Открыть изображение"
                  >
                    <img src={toMediaUrl(path)} alt={service.title} loading="lazy" />
                  </button>
                </figure>
              ))}
            </div>
          </section>
        ) : null}
      </div>

      {selectedMedia ? (
        <div className="service-lightbox" role="dialog" aria-modal="true" onClick={() => setSelectedMedia("")}>
          <div className="service-lightbox-panel" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="service-lightbox-close" onClick={() => setSelectedMedia("")} aria-label="Закрыть">
              ×
            </button>
            <img src={toMediaUrl(selectedMedia)} alt={service.title} loading="eager" />
          </div>
        </div>
      ) : null}
    </div>
  );
}

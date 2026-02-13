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

const initialForm = {
  name: "",
  phone: "",
  email: "",
  comment: "",
  privacy_policy: false,
  personal_data: false,
  terms: false
};

export default function ServicePage() {
  const { slug } = useParams();
  const [service, setService] = useState(null);
  const [schedule, setSchedule] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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

  const selectedEvent = useMemo(() => {
    return schedule.find((item) => !item.is_individual && item.available_spots > 0) || null;
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
            <h2>О ПРАКТИКЕ</h2>
            {service.about?.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}

            {service.suitable_for?.length ? (
              <>
                <h2>ПРАКТИКА ПОДОЙДЕТ, ЕСЛИ</h2>
                <ul>
                  {service.suitable_for.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </>
            ) : null}

            {service.important?.length ? (
              <>
                <h2>ВАЖНО</h2>
                <ul>
                  {service.important.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </>
            ) : null}

            {service.dress_code?.length ? (
              <>
                <h2>ФОРМА ОДЕЖДЫ</h2>
                <ul>
                  {service.dress_code.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </>
            ) : null}

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
              <p>
                <strong>Длительность:</strong> {service.duration}
              </p>
              {service.pricing?.group ? (
                <p>
                  <strong>Группа:</strong> {service.pricing.group.price_per_person} руб.
                </p>
              ) : null}
              {service.pricing?.individual ? (
                <p>
                  <strong>Индивидуально:</strong> {service.pricing.individual.price} руб.
                </p>
              ) : null}
              {service.pricing?.fixed ? (
                <p>
                  <strong>Стоимость:</strong> {service.pricing.fixed.price} руб.
                </p>
              ) : null}
              {service.age_restriction ? (
                <p>
                  <strong>Возраст:</strong> {service.age_restriction}
                </p>
              ) : null}
            </div>

            {!service.is_draft && selectedEvent ? (
              <form className="side-card booking-form" onSubmit={handleSubmit}>
                <h3>ЗАПИСЬ ОНЛАЙН</h3>
                <p className="muted">Ближайшее событие: {formatDateTime(selectedEvent.start_time)}</p>
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
                  Для этой услуги используется индивидуальная запись через администратора или контент в стадии
                  подготовки.
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
                  <img src={toMediaUrl(path)} alt={service.title} loading="lazy" />
                </figure>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}

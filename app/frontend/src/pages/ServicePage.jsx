import { Link, useParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { getSchedule, getService, submitBooking, toMediaUrl } from "../api";

const SERVICE_ICONS = {
  duration: toMediaUrl("ikonki/svg/duration.svg"),
  group: toMediaUrl("ikonki/svg/group_practice.svg"),
  individual: toMediaUrl("ikonki/svg/individual_session.svg"),
  suitable: toMediaUrl("ikonki/svg/practice_suits_you.svg"),
  important: toMediaUrl("ikonki/svg/important.svg"),
  dress: toMediaUrl("ikonki/svg/dress_code.svg")
};

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

function formatModeLabel(value) {
  if (value === "individual_only") return "Индивидуальный формат";
  if (value === "group_and_individual") return "Групповой и индивидуальный формат";
  return "Формат уточняется";
}

function getLoadPercent(current, total) {
  if (!total || total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((current / total) * 100)));
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

function InfoList({ title, items, icon }) {
  if (!items?.length) return null;
  return (
    <>
      <div className="service-copy-head">
        {icon ? <img className="service-title-icon" src={icon} alt="" aria-hidden="true" /> : null}
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
  const [bookingMode, setBookingMode] = useState("group");
  const [selectedScheduleId, setSelectedScheduleId] = useState("");
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

  const groupEvents = useMemo(() => schedule.filter((item) => !item.is_individual), [schedule]);
  const individualEvents = useMemo(() => schedule.filter((item) => item.is_individual), [schedule]);
  const groupBookingEvents = useMemo(() => groupEvents.filter((item) => item.available_spots > 0), [groupEvents]);
  const individualBookingEvents = useMemo(
    () => individualEvents.filter((item) => item.available_spots > 0),
    [individualEvents]
  );
  const selectedEvent = useMemo(() => {
    const source = bookingMode === "individual" ? individualBookingEvents : groupBookingEvents;
    return source.find((item) => String(item.id) === String(selectedScheduleId)) || source[0] || null;
  }, [bookingMode, selectedScheduleId, groupBookingEvents, individualBookingEvents]);
  const nextEvents = useMemo(() => {
    return groupEvents.slice(0, 4);
  }, [groupEvents]);

  useEffect(() => {
    const hasIndividual = individualBookingEvents.length > 0;
    const hasGroup = groupBookingEvents.length > 0;
    if (!hasGroup && hasIndividual) {
      setBookingMode("individual");
    } else if (hasGroup && !hasIndividual) {
      setBookingMode("group");
    }
  }, [groupBookingEvents.length, individualBookingEvents.length]);

  useEffect(() => {
    const source = bookingMode === "individual" ? individualBookingEvents : groupBookingEvents;
    if (!source.length) {
      setSelectedScheduleId("");
      return;
    }
    setSelectedScheduleId((prev) => {
      if (prev && source.some((item) => String(item.id) === String(prev))) {
        return prev;
      }
      return String(source[0].id);
    });
  }, [bookingMode, groupBookingEvents, individualBookingEvents]);

  useEffect(() => {
    const supportsGroup = service?.format_mode === "group_and_individual" && Boolean(service?.pricing?.group || service?.pricing?.fixed);
    const supportsIndividual = service?.format_mode === "individual_only" || Boolean(service?.pricing?.individual || service?.pricing?.fixed);
    if (!supportsGroup && supportsIndividual && bookingMode !== "individual") {
      setBookingMode("individual");
      return;
    }
    if (supportsGroup && !supportsIndividual && bookingMode !== "group") {
      setBookingMode("group");
    }
  }, [service, bookingMode]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!selectedScheduleId) {
      setError("Нет доступных дат для записи.");
      return;
    }

    setSending(true);
    setError("");
    setSuccess("");

    try {
      const response = await submitBooking({
        schedule_id: Number(selectedScheduleId),
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
  const hasHost = Boolean(service.host?.name || service.host?.bio);
  const formatLabel = formatModeLabel(service.format_mode);
  const supportsGroup = service.format_mode === "group_and_individual" && Boolean(service.pricing?.group || service.pricing?.fixed);
  const supportsIndividual = service.format_mode === "individual_only" || Boolean(service.pricing?.individual || service.pricing?.fixed);
  const canBookGroup = supportsGroup && groupBookingEvents.length > 0;
  const canBookIndividual = supportsIndividual && individualBookingEvents.length > 0;
  const activeBookingEvents = bookingMode === "individual" ? individualBookingEvents : groupBookingEvents;

  return (
    <div className="page-service">
      <div className="container">
        <div className="service-top-actions">
          <Link className="back-link" to="/">
            ← На главную
          </Link>
          <div className="service-top-buttons">
            <a href="#service-details">О практике</a>
            <a href="#service-media">Фото</a>
            <a href="#service-booking">Запись</a>
          </div>
        </div>

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

        <section className="service-meta-strip">
          <div className="service-meta-pill">
            <div className="service-meta-pill-head">
              <img src={SERVICE_ICONS.group} alt="" aria-hidden="true" />
            </div>
            <span>Формат</span>
            <strong>{formatLabel}</strong>
          </div>
          <div className="service-meta-pill">
            <div className="service-meta-pill-head">
              <img src={SERVICE_ICONS.duration} alt="" aria-hidden="true" />
            </div>
            <span>Длительность</span>
            <strong>{service.duration || "По согласованию"}</strong>
          </div>
          <div className="service-meta-pill">
            <span>Возраст</span>
            <strong>{service.age_restriction || "Без ограничений"}</strong>
          </div>
          <div className="service-meta-pill">
            <span>Ближайших дат</span>
            <strong>{nextEvents.length}</strong>
          </div>
        </section>

        <section id="service-details" className="section service-layout">
          <article className="service-main">
            <div className="service-copy-head">
              <h2>О ПРАКТИКЕ</h2>
            </div>
            {service.about?.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}

            <InfoList title="ПРАКТИКА ПОДОЙДЕТ, ЕСЛИ" items={service.suitable_for} icon={SERVICE_ICONS.suitable} />
            <InfoList title="ВАЖНО" items={service.important} icon={SERVICE_ICONS.important} />
            <InfoList title="ФОРМА ОДЕЖДЫ" items={service.dress_code} icon={SERVICE_ICONS.dress} />

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

            {hasHost ? (
              <div className="service-host-card">
                <p className="service-host-kicker">Проводник практики</p>
                {service.host?.name ? <h3>{service.host.name}</h3> : null}
                {service.host?.bio ? <p>{service.host.bio}</p> : null}
              </div>
            ) : null}

            {service.media?.length ? (
              <section id="service-media" className="service-media-section service-media-section-inflow">
                <div className="service-section-head">
                  <h2>ФОТО И АТМОСФЕРА</h2>
                  <p>{service.media.length} изображений, кликните для увеличения</p>
                </div>
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
          </article>

          <aside id="service-booking" className="service-side">
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
                      <span>Свободно мест: {item.available_spots}</span>
                      <div className="event-progress">
                        <div
                          className="event-progress-bar"
                          style={{ width: `${getLoadPercent(item.current_participants, item.max_participants)}%` }}
                        />
                      </div>
                      <small>
                        {item.current_participants}/{item.max_participants} занято
                      </small>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {!service.is_draft && (supportsGroup || supportsIndividual) ? (
              <form className="side-card booking-form" onSubmit={handleSubmit}>
                <h3>ЗАПИСЬ ОНЛАЙН</h3>
                {(supportsGroup && supportsIndividual) || service.format_mode === "group_and_individual" ? (
                  <div className="booking-mode-switch" role="tablist" aria-label="Формат записи">
                    <button
                      type="button"
                      className={bookingMode === "group" ? "is-active" : ""}
                      onClick={() => setBookingMode("group")}
                      disabled={!supportsGroup}
                    >
                      Групповая
                    </button>
                    <button
                      type="button"
                      className={bookingMode === "individual" ? "is-active" : ""}
                      onClick={() => setBookingMode("individual")}
                      disabled={!supportsIndividual}
                    >
                      Индивидуальная
                    </button>
                  </div>
                ) : null}
                <p className="muted">
                  {selectedEvent
                    ? bookingMode === "individual"
                      ? `Ближайшая индивидуальная дата: ${formatDateTime(selectedEvent.start_time)}`
                      : `Ближайшая группа: ${formatDateTime(selectedEvent.start_time)}`
                    : "Выберите дату из расписания"}
                </p>
                {activeBookingEvents.length ? (
                  <label className="booking-select-label">
                    <span>Дата и время</span>
                    <select
                      value={selectedScheduleId}
                      onChange={(event) => setSelectedScheduleId(event.target.value)}
                      required
                    >
                      {activeBookingEvents.map((item) => (
                        <option key={item.id} value={item.id}>
                          {formatDateTime(item.start_time)} • мест {item.available_spots}/{item.max_participants}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <p className="muted">
                    {bookingMode === "individual"
                      ? "Для индивидуального формата пока нет опубликованных дат в расписании. Укажите в какое время вы бы хотели прийти (минимум за 48 часов) и мы свяжемся с вами для уточнения."
                      : "Для данного направления пока нет опубликованных дат в расписании."}
                  </p>
                )}
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
                <label className="booking-check">
                  <input
                    type="checkbox"
                    checked={form.privacy_policy}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, privacy_policy: event.target.checked }))
                    }
                    required
                  />
                  <span>
                    <span className="booking-check-box" aria-hidden="true" />
                    <span className="booking-check-text">
                      Я согласен с{" "}
                      <Link to="/legal/privacy" target="_blank" rel="noreferrer">
                        политикой конфиденциальности
                      </Link>
                    </span>
                  </span>
                </label>
                <label className="booking-check">
                  <input
                    type="checkbox"
                    checked={form.personal_data}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, personal_data: event.target.checked }))
                    }
                    required
                  />
                  <span>
                    <span className="booking-check-box" aria-hidden="true" />
                    <span className="booking-check-text">
                      Я согласен с{" "}
                      <Link to="/legal/personal-data" target="_blank" rel="noreferrer">
                        обработкой персональных данных
                      </Link>
                    </span>
                  </span>
                </label>
                <label className="booking-check">
                  <input
                    type="checkbox"
                    checked={form.terms}
                    onChange={(event) => setForm((prev) => ({ ...prev, terms: event.target.checked }))}
                    required
                  />
                  <span>
                    <span className="booking-check-box" aria-hidden="true" />
                    <span className="booking-check-text">
                      Я согласен с{" "}
                      <Link to="/legal/terms" target="_blank" rel="noreferrer">
                        условиями оказания услуг
                      </Link>
                    </span>
                  </span>
                </label>
                <button className="btn-main" type="submit" disabled={sending || !selectedScheduleId}>
                  {sending ? "Отправка..." : "Отправить заявку"}
                </button>
                {success ? <p className="ok">{success}</p> : null}
                {error ? <p className="err">{error}</p> : null}
              </form>
            ) : (
              <div className="side-card">
                <h3>ЗАПИСЬ</h3>
                <p>
                  Для этой услуги запись согласовывается вручную. Напишите в Telegram или позвоните для
                  согласования удобного времени.
                </p>
              </div>
            )}
          </aside>
        </section>

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

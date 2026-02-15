import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { getSite, submitContact } from "../api";

function normalizeContactHref(value) {
  if (!value) return "#";
  if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("tel:") || value.startsWith("mailto:")) {
    return value;
  }
  if (value.startsWith("@")) return `https://t.me/${value.slice(1)}`;
  if (/^[+\d\s\-()]+$/.test(value)) return `tel:${value.replace(/[^\d+]/g, "")}`;
  if (value.includes("@")) return `mailto:${value}`;
  return value;
}

const initialForm = {
  name: "",
  email: "",
  phone: "",
  message: ""
};

export default function ContactsPage() {
  const [site, setSite] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        setSite(await getSite());
      } catch (err) {
        setError(err.message || "Не удалось загрузить контакты.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function onSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setSuccess("");
    setError("");
    try {
      const result = await submitContact({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        message: form.message.trim()
      });
      setSuccess(result.message || "Сообщение отправлено.");
      setForm(initialForm);
    } catch (err) {
      setError(err.message || "Не удалось отправить сообщение.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="state-page">Загрузка...</div>;

  const telegram = normalizeContactHref(site?.contacts?.telegram || "");
  const vk = normalizeContactHref(site?.contacts?.vk || "");
  const rutube = normalizeContactHref(site?.contacts?.rutube || "");
  const phone = normalizeContactHref(site?.contacts?.phone || "");
  const phone2 = normalizeContactHref(site?.contacts?.phone_2 || "");
  const email = normalizeContactHref(site?.contacts?.email || "");

  return (
    <div className="page-common page-contacts">
      <div className="container">
        <header className="page-common-head">
          <div>
            <p>{site?.brand || "ATMAN"}</p>
            <h1>Контакты</h1>
            <span>Напишите нам, и мы свяжемся с вами для подбора удобного формата практики.</span>
          </div>
          <div className="page-common-actions">
            <Link className="back-link" to="/">
              ← На главную
            </Link>
          </div>
        </header>

        <section className="contacts-grid">
          <article className="page-common-panel contacts-card">
            <h2>Связаться напрямую</h2>
            <div className="contacts-list">
              <a href={telegram} target="_blank" rel="noreferrer">Telegram</a>
              <a href={phone}>{site?.contacts?.phone || "Телефон"}</a>
              {site?.contacts?.phone_2 ? <a href={phone2}>{site.contacts.phone_2}</a> : null}
              <a href={email}>{site?.contacts?.email || "Email"}</a>
              {site?.contacts?.address ? <p>{site.contacts.address}</p> : null}
              {site?.contacts?.working_hours ? <p>{site.contacts.working_hours}</p> : null}
              {site?.contacts?.vk ? (
                <a href={vk} target="_blank" rel="noreferrer">VK</a>
              ) : null}
              {site?.contacts?.rutube ? (
                <a href={rutube} target="_blank" rel="noreferrer">RuTube</a>
              ) : null}
            </div>
            <div className="contacts-legal-links">
              <Link to="/legal/privacy">Политика конфиденциальности</Link>
              <Link to="/legal/personal-data">Согласие на обработку ПД</Link>
              <Link to="/legal/terms">Условия оказания услуг</Link>
              <Link to="/legal/offer">Публичная оферта</Link>
              <Link to="/legal/marketing">Согласие на рассылку</Link>
            </div>
          </article>

          <article className="page-common-panel contacts-card">
            <h2>Форма обратной связи</h2>
            <form className="contacts-form" onSubmit={onSubmit}>
              <input
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Ваше имя"
                required
              />
              <input
                type="email"
                value={form.email}
                onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                placeholder="Email"
                required
              />
              <input
                value={form.phone}
                onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
                placeholder="Телефон"
              />
              <textarea
                value={form.message}
                onChange={(event) => setForm((prev) => ({ ...prev, message: event.target.value }))}
                placeholder="Ваш запрос"
                rows={5}
                required
              />
              <button className="btn-main" type="submit" disabled={submitting}>
                {submitting ? "Отправка..." : "Отправить сообщение"}
              </button>
            </form>
            {success ? <p className="ok">{success}</p> : null}
            {error ? <p className="err">{error}</p> : null}
          </article>
        </section>
      </div>
    </div>
  );
}

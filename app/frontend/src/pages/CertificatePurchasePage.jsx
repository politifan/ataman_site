import { Link } from "react-router-dom";
import { useState } from "react";
import { purchaseCertificate } from "../api";

const initialForm = {
  amount: "5000",
  recipient_name: "",
  sender_name: "",
  note: "",
  buyer_name: "",
  buyer_email: "",
  buyer_phone: ""
};

function formatCurrency(value) {
  const amount = Number(value || 0);
  if (!amount) return "";
  return `${new Intl.NumberFormat("ru-RU").format(amount)} руб.`;
}

export default function CertificatePurchasePage() {
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  async function onSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const payload = await purchaseCertificate({
        amount: Number(form.amount),
        recipient_name: form.recipient_name.trim() || null,
        sender_name: form.sender_name.trim() || null,
        note: form.note.trim() || null,
        buyer_name: form.buyer_name.trim(),
        buyer_email: form.buyer_email.trim(),
        buyer_phone: form.buyer_phone.trim() || null
      });
      setResult(payload);
      setForm(initialForm);
    } catch (err) {
      setError(err.message || "Не удалось оформить сертификат.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page-common page-certificate-purchase">
      <div className="container">
        <header className="page-common-head">
          <div>
            <p>Подарочные сертификаты</p>
            <h1>Подарите практику Атман</h1>
            <span>Электронный сертификат с персональным оформлением и красивой ссылкой для получателя.</span>
          </div>
          <div className="page-common-actions">
            <Link className="back-link" to="/">
              ← На главную
            </Link>
          </div>
        </header>

        <section className="page-common-panel certificate-purchase-panel">
          <div className="certificate-purchase-preview">
            <p>Номинал</p>
            <strong>{formatCurrency(form.amount) || "Введите сумму"}</strong>
            <span>После оплаты сертификат появится в админке, где вы сможете вручную выпустить его и погасить.</span>
          </div>

          <form className="certificate-purchase-form" onSubmit={onSubmit}>
            <label>
              Номинал, руб.
              <input
                type="number"
                min={500}
                step={100}
                value={form.amount}
                onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))}
                required
              />
            </label>
            <label>
              Кому (получатель)
              <input
                value={form.recipient_name}
                onChange={(event) => setForm((prev) => ({ ...prev, recipient_name: event.target.value }))}
                placeholder="Имя получателя"
              />
            </label>
            <label>
              От кого (отправитель)
              <input
                value={form.sender_name}
                onChange={(event) => setForm((prev) => ({ ...prev, sender_name: event.target.value }))}
                placeholder="Имя отправителя"
              />
            </label>
            <label>
              Ваше имя
              <input
                value={form.buyer_name}
                onChange={(event) => setForm((prev) => ({ ...prev, buyer_name: event.target.value }))}
                required
              />
            </label>
            <label>
              Ваш email
              <input
                type="email"
                value={form.buyer_email}
                onChange={(event) => setForm((prev) => ({ ...prev, buyer_email: event.target.value }))}
                required
              />
            </label>
            <label>
              Телефон
              <input
                value={form.buyer_phone}
                onChange={(event) => setForm((prev) => ({ ...prev, buyer_phone: event.target.value }))}
              />
            </label>
            <label>
              Комментарий
              <textarea
                rows={3}
                value={form.note}
                onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))}
                placeholder="Пожелания по оформлению"
              />
            </label>
            <button className="btn-main" type="submit" disabled={submitting}>
              {submitting ? "Оформляем..." : "Оплатить и создать сертификат"}
            </button>
            {error ? <p className="err">{error}</p> : null}
          </form>
        </section>

        {result ? (
          <section className="page-common-panel certificate-result-panel">
            <h2>Сертификат создан</h2>
            <p>
              Код: <strong>{result.certificate_code}</strong>
            </p>
            <p>Статус: {result.status}</p>
            <a className="btn-main small" href={result.public_url} target="_blank" rel="noreferrer">
              Открыть публичную ссылку
            </a>
          </section>
        ) : null}
      </div>
    </div>
  );
}

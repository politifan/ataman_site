import { Link, useParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { getCertificate } from "../api";

function formatCurrency(value) {
  return `${new Intl.NumberFormat("ru-RU").format(Number(value || 0))} руб.`;
}

function formatDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).format(new Date(value));
}

function statusLabel(status) {
  if (status === "paid") return "Оплачен";
  if (status === "issued") return "Выпущен";
  if (status === "redeemed") return "Погашен";
  if (status === "cancelled") return "Отменен";
  return status;
}

export default function CertificatePublicPage() {
  const { code } = useParams();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        setItem(await getCertificate(code));
        setError("");
      } catch (err) {
        setError(err.message || "Сертификат не найден.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [code]);

  const subtitle = useMemo(() => {
    if (!item) return "";
    if (item.status === "redeemed") return "Сертификат уже использован.";
    if (item.status === "issued") return "Сертификат готов к использованию.";
    return "Сертификат оформляется администратором.";
  }, [item]);

  if (loading) return <div className="state-page">Загрузка сертификата...</div>;
  if (error) return <div className="state-page">Ошибка: {error}</div>;
  if (!item) return <div className="state-page">Сертификат не найден.</div>;

  return (
    <div className="page-common page-certificate-public">
      <div className="container">
        <header className="page-common-head">
          <div>
            <p>Atman Gift Certificate</p>
            <h1>Подарочный сертификат</h1>
            <span>{subtitle}</span>
          </div>
          <div className="page-common-actions">
            <Link className="back-link" to="/">
              ← На главную
            </Link>
          </div>
        </header>

        <section className="certificate-template">
          <p className="certificate-template-kicker">STUDIO ATMAN</p>
          <h2>{formatCurrency(item.amount)}</h2>
          <div className="certificate-template-grid">
            <div>
              <small>Кому</small>
              <strong>{item.recipient_name || "Получатель не указан"}</strong>
            </div>
            <div>
              <small>От кого</small>
              <strong>{item.sender_name || "Отправитель не указан"}</strong>
            </div>
            <div>
              <small>Номер</small>
              <strong>{item.code}</strong>
            </div>
            <div>
              <small>Дата оформления</small>
              <strong>{formatDate(item.created_at)}</strong>
            </div>
          </div>
          {item.note ? <p className="certificate-template-note">{item.note}</p> : null}
          <div className="certificate-template-footer">
            <span className={`admin-status-pill is-${item.status}`}>{statusLabel(item.status)}</span>
            <span>{item.issued_by ? `Подпись: ${item.issued_by}` : "Подпись будет добавлена администратором"}</span>
          </div>
        </section>
      </div>
    </div>
  );
}

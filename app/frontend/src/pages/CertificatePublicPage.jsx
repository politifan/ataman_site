import { Link, useParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { getCertificate, getSite, toMediaUrl } from "../api";

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
  if (status === "paid") return "Оформляется";
  if (status === "issued") return "Готов к использованию";
  if (status === "redeemed") return "Погашен";
  if (status === "cancelled") return "Отменен";
  return status;
}

function formatDays(value) {
  const n = Number(value || 0);
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} день`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} дня`;
  return `${n} дней`;
}

function validityLabel(mode, days) {
  if (mode === "1m") return "1 месяц";
  if (mode === "custom_days") return days ? formatDays(days) : "по дням";
  return "3 месяца";
}

export default function CertificatePublicPage() {
  const { code } = useParams();
  const [item, setItem] = useState(null);
  const [site, setSite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [certificateData, siteData] = await Promise.all([getCertificate(code), getSite()]);
        setItem(certificateData);
        setSite(siteData);
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

  const photoUrl = useMemo(() => {
    const path = site?.home_image || "";
    return path ? toMediaUrl(path) : "";
  }, [site?.home_image]);

  if (loading) return <div className="state-page">Загрузка сертификата...</div>;
  if (error) return <div className="state-page">Ошибка: {error}</div>;
  if (!item) return <div className="state-page">Сертификат не найден.</div>;

  return (
    <div className="page-common page-certificate-public">
      <div className="container">
        <header className="certificate-hero">
          <div className="certificate-hero-main">
            <p className="certificate-brand">{site?.brand || "АТМАН"}</p>
            <p className="certificate-brand-sub">студия духовных и телесных практик</p>
            <div className="certificate-contacts">
              <p>📍 {site?.contacts?.address || "ул. Симбирская 11, 1 этаж"}</p>
              <p>☎ {site?.contacts?.phone || "+7 937 700 35 00"}</p>
            </div>
          </div>
          <div className="certificate-hero-photo-wrap" aria-hidden="true">
            {photoUrl ? (
              <img src={photoUrl} alt="" className="certificate-hero-photo" />
            ) : (
              <div className="certificate-hero-photo certificate-hero-photo-fallback">ATMAN</div>
            )}
          </div>
        </header>

        <section className="certificate-sheet">
          <div className="certificate-sheet-top">
            <div>
              <p className="certificate-sheet-kicker">Подарочный сертификат</p>
              <h1>{formatCurrency(item.amount)}</h1>
              <p className="certificate-sheet-subtitle">{subtitle}</p>
            </div>
            <span className={`certificate-status is-${item.status}`}>{statusLabel(item.status)}</span>
          </div>

          <div className="certificate-fields">
            <article>
              <small>Кому</small>
              <strong>{item.recipient_name || "Получатель не указан"}</strong>
            </article>
            {!item.sender_hidden ? (
              <article>
                <small>От кого</small>
                <strong>{item.sender_name || "Отправитель не указан"}</strong>
              </article>
            ) : null}
            <article>
              <small>Номер сертификата</small>
              <strong>{item.code}</strong>
            </article>
            <article>
              <small>Дата оформления</small>
              <strong>{formatDate(item.created_at)}</strong>
            </article>
            <article>
              <small>Срок действия</small>
              <strong>{validityLabel(item.validity_mode, item.validity_days)}</strong>
            </article>
            <article>
              <small>Действителен до</small>
              <strong>{item.expires_at ? formatDate(item.expires_at) : "После выпуска администратором"}</strong>
            </article>
          </div>

          {item.note ? <p className="certificate-template-note">{item.note}</p> : null}

          <div className="certificate-sheet-footer">
            <span>{item.issued_by ? `Подпись: ${item.issued_by}` : "Подпись будет добавлена администратором"}</span>
            <span>Atman Studio</span>
          </div>
        </section>

        <div className="certificate-page-actions">
          <Link className="back-link" to="/">
            ← На главную
          </Link>
        </div>
      </div>
    </div>
  );
}

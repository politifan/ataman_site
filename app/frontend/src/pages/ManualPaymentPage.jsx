import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getManualPayment, reportManualTransfer } from "../api";

function formatPrice(value) {
  return new Intl.NumberFormat("ru-RU").format(Number(value || 0));
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "long",
    timeStyle: "short"
  }).format(new Date(value));
}

function paymentState(status) {
  if (status === "manual_confirmed") {
    return {
      label: "Запись подтверждена",
      text: "Администратор проверил перевод. Ваша запись подтверждена.",
      tone: "success"
    };
  }
  if (status === "manual_rejected") {
    return {
      label: "Перевод не подтверждён",
      text: "Администратор не смог подтвердить перевод. Свяжитесь со студией для уточнения.",
      tone: "failed"
    };
  }
  if (status === "waiting_manual_confirmation") {
    return {
      label: "Ожидаем проверку",
      text: "Не закрывайте страницу. Статус обновится автоматически, проверка может занять до 10 минут.",
      tone: "waiting"
    };
  }
  return {
    label: "Ожидаем перевод",
    text: "Переведите точную сумму по реквизитам ниже, затем сообщите нам об оплате.",
    tone: "ready"
  };
}

export default function ManualPaymentPage() {
  const [searchParams] = useSearchParams();
  const bookingId = searchParams.get("booking_id") || "";
  const token = searchParams.get("token") || "";
  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [waitingModalOpen, setWaitingModalOpen] = useState(false);
  const waitingNoticeShown = useRef(false);

  useEffect(() => {
    let timer = null;
    let cancelled = false;

    async function load() {
      if (!bookingId || !token) {
        setError("Ссылка на оплату неполная.");
        setLoading(false);
        return;
      }
      let shouldContinuePolling = true;
      try {
        const result = await getManualPayment(bookingId, token);
        if (cancelled) return;
        setPayment(result);
        setError("");
        shouldContinuePolling = !["manual_confirmed", "manual_rejected"].includes(result.payment_status);
      } catch (err) {
        if (!cancelled) setError(err.message || "Не удалось загрузить реквизиты.");
      } finally {
        if (!cancelled) {
          setLoading(false);
          if (shouldContinuePolling) timer = window.setTimeout(load, 3000);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [bookingId, token]);

  useEffect(() => {
    if (payment?.payment_status === "waiting_manual_confirmation" && !waitingNoticeShown.current) {
      waitingNoticeShown.current = true;
      setWaitingModalOpen(true);
    }
    if (["manual_confirmed", "manual_rejected"].includes(payment?.payment_status)) {
      setWaitingModalOpen(false);
    }
  }, [payment?.payment_status]);

  const state = useMemo(() => paymentState(payment?.payment_status), [payment?.payment_status]);

  async function copyCardNumber() {
    try {
      await navigator.clipboard.writeText(payment.card_number);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch (_) {
      setCopied(false);
    }
  }

  async function handleTransferReported() {
    setSending(true);
    setError("");
    try {
      const result = await reportManualTransfer(bookingId, token);
      setPayment((prev) => ({
        ...prev,
        booking_status: result.booking_status,
        payment_status: result.payment_status
      }));
    } catch (err) {
      setError(err.message || "Не удалось отправить сообщение об оплате.");
    } finally {
      setSending(false);
    }
  }

  if (loading) return <div className="state-page">Загрузка реквизитов...</div>;
  if (!payment) return <div className="state-page">Ошибка: {error || "Заявка не найдена."}</div>;

  const canReport = payment.payment_status === "awaiting_transfer";

  return (
    <div className="page-common page-manual-payment">
      <div className="container">
        <header className="manual-payment-head">
          <Link className="back-link" to="/">← На главную</Link>
          <p>Ручное подтверждение оплаты</p>
          <h1>Перевод по реквизитам</h1>
          <span>Место зарезервировано. Переведите указанную сумму и сообщите об оплате.</span>
        </header>

        <section className="manual-payment-layout">
          <article className="manual-payment-card">
            <div className="manual-payment-card-top">
              <span>{payment.bank}</span>
              <strong>{formatPrice(payment.amount)} ₽</strong>
            </div>
            <div className="manual-payment-card-number">
              <small>Номер карты</small>
              <strong>{payment.card_number}</strong>
              <button type="button" onClick={copyCardNumber}>{copied ? "Скопировано" : "Скопировать"}</button>
            </div>
            <div className="manual-payment-recipient">
              <small>Получатель</small>
              <strong>{payment.recipient}</strong>
            </div>
          </article>

          <aside className="manual-payment-summary">
            <div className={`manual-payment-status is-${state.tone}`}>
              <p>{state.label}</p>
              <span>{state.text}</span>
            </div>
            <dl>
              <div>
                <dt>Услуга</dt>
                <dd>{payment.service_title}</dd>
              </div>
              <div>
                <dt>Дата</dt>
                <dd>{formatDateTime(payment.event_start_time)}</dd>
              </div>
              <div>
                <dt>Сумма</dt>
                <dd>{formatPrice(payment.amount)} ₽</dd>
              </div>
              <div>
                <dt>Номер заявки</dt>
                <dd>#{payment.booking_id}</dd>
              </div>
            </dl>
            <p className="manual-payment-instructions">{payment.instructions}</p>
            <button className="btn-main" type="button" onClick={handleTransferReported} disabled={!canReport || sending}>
              {sending ? "Отправка..." : canReport ? "Я перевёл" : state.label}
            </button>
            {error ? <p className="err">{error}</p> : null}
          </aside>
        </section>
      </div>
      {waitingModalOpen ? (
        <div className="manual-payment-modal" role="dialog" aria-modal="true" aria-labelledby="manual-payment-modal-title">
          <section className="manual-payment-modal-panel">
            <p>Проверка перевода</p>
            <h2 id="manual-payment-modal-title">Не закрывайте эту страницу</h2>
            <span>
              Администратор проверяет поступление перевода. Обычно это занимает несколько минут, но иногда ожидание
              может занять до 10 минут. Статус записи обновится здесь автоматически.
            </span>
            <button className="btn-main" type="button" onClick={() => setWaitingModalOpen(false)}>
              Понятно, жду подтверждения
            </button>
          </section>
        </div>
      ) : null}
    </div>
  );
}

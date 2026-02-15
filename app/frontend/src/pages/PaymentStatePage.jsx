import { Link, useParams, useSearchParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { checkPaymentStatus } from "../api";

const STATE_META = {
  success: {
    title: "Оплата подтверждена",
    text: "Спасибо! Ваша запись успешно оплачена. Подтверждение уже зафиксировано в системе."
  },
  waiting: {
    title: "Ожидание подтверждения оплаты",
    text: "Платеж создан. Мы проверяем его статус. Страница обновится автоматически."
  },
  failed: {
    title: "Оплата не завершена",
    text: "Платеж не был подтвержден. Вы можете повторить оплату или связаться с нами."
  }
};

function mapStatusToState(status = "") {
  if (status === "succeeded") return "success";
  if (status === "waiting_for_capture" || status === "pending") return "waiting";
  if (status === "canceled" || status === "cancelled" || status === "failed") return "failed";
  return "waiting";
}

export default function PaymentStatePage() {
  const { state } = useParams();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [statusData, setStatusData] = useState(null);
  const [error, setError] = useState("");

  const paymentId = searchParams.get("payment_id") || "";
  const safeState = STATE_META[state] ? state : "waiting";

  useEffect(() => {
    let timer = null;
    let cancelled = false;

    async function loadStatus() {
      if (!paymentId) {
        setLoading(false);
        return;
      }

      try {
        const result = await checkPaymentStatus(paymentId);
        if (cancelled) return;
        setStatusData(result);
        setError("");

        const resolved = mapStatusToState(result.status);
        if (resolved === "waiting") {
          timer = window.setTimeout(loadStatus, 7000);
        }
      } catch (err) {
        if (cancelled) return;
        setError(err.message || "Не удалось проверить статус оплаты.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadStatus();

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [paymentId]);

  const effectiveState = useMemo(() => {
    if (!statusData?.status) return safeState;
    return mapStatusToState(statusData.status);
  }, [safeState, statusData?.status]);

  const meta = STATE_META[effectiveState];

  return (
    <div className="page-common page-payment-state">
      <div className="container">
        <section className="page-common-panel payment-state-card">
          <p>Платеж ЮKassa</p>
          <h1>{meta.title}</h1>
          <span>{meta.text}</span>

          {paymentId ? (
            <div className="payment-state-meta">
              <div>
                <small>ID платежа</small>
                <strong>{paymentId}</strong>
              </div>
              <div>
                <small>Статус</small>
                <strong>{statusData?.status || "pending"}</strong>
              </div>
              <div>
                <small>Статус брони</small>
                <strong>{statusData?.booking_status || "pending"}</strong>
              </div>
            </div>
          ) : null}

          {loading ? <p className="muted">Проверка статуса...</p> : null}
          {error ? <p className="err">{error}</p> : null}

          <div className="payment-state-actions">
            <Link className="btn-main" to="/">
              На главную
            </Link>
            <Link className="btn-ghost" to="/schedule">
              К расписанию
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}

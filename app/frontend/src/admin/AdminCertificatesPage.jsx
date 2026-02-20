import { useEffect, useState } from "react";
import { adminListCertificates, adminUpdateCertificate } from "../api";
import AdminSelect from "./AdminSelect";

const STATUS_OPTIONS = [
  { value: "", label: "Все статусы" },
  { value: "paid", label: "Оплачен" },
  { value: "issued", label: "Выпущен" },
  { value: "redeemed", label: "Погашен" },
  { value: "cancelled", label: "Отменен" }
];

const VALIDITY_OPTIONS = [
  { value: "3m", label: "3 месяца" },
  { value: "1m", label: "1 месяц" },
  { value: "custom_days", label: "Другое (в днях)" }
];

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("ru-RU");
}

function formatAmount(value) {
  return `${new Intl.NumberFormat("ru-RU").format(Number(value || 0))} руб.`;
}

function formatValidity(mode, days) {
  if (mode === "1m") return "1 месяц";
  if (mode === "custom_days") return days ? `${days} дн.` : "Другое";
  return "3 месяца";
}

export default function AdminCertificatesPage() {
  const [rows, setRows] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    try {
      const data = await adminListCertificates({ status: statusFilter, search });
      setRows(data);
      setError("");
    } catch (err) {
      setError(err.message || "Не удалось загрузить сертификаты.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openEdit(row) {
    setSelected(row);
    setDraft({
      amount: String(row.amount || ""),
      recipient_name: row.recipient_name || "",
      sender_name: row.sender_name || "",
      sender_hidden: Boolean(row.sender_hidden),
      note: row.note || "",
      buyer_name: row.buyer_name || "",
      buyer_email: row.buyer_email || "",
      buyer_phone: row.buyer_phone || "",
      status: row.status || "paid",
      issued_by: row.issued_by || "",
      validity_mode: row.validity_mode || "3m",
      validity_days: row.validity_days ? String(row.validity_days) : ""
    });
  }

  function closeEdit() {
    setSelected(null);
    setDraft(null);
  }

  async function save() {
    if (!selected || !draft) return;
    const validityMode = draft.validity_mode || "3m";
    const validityDays = validityMode === "custom_days" ? Number(draft.validity_days) : null;
    if (validityMode === "custom_days" && (!Number.isFinite(validityDays) || validityDays < 1)) {
      setError("Для варианта «другое» укажите срок в днях.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");
    try {
      await adminUpdateCertificate(selected.id, {
        amount: Number(draft.amount),
        recipient_name: draft.recipient_name.trim() || null,
        sender_name: draft.sender_name.trim() || null,
        sender_hidden: Boolean(draft.sender_hidden),
        note: draft.note.trim() || null,
        buyer_name: draft.buyer_name.trim(),
        buyer_email: draft.buyer_email.trim(),
        buyer_phone: draft.buyer_phone.trim() || null,
        status: draft.status,
        issued_by: draft.issued_by.trim() || null,
        validity_mode: validityMode,
        validity_days: validityMode === "custom_days" ? validityDays : null
      });
      setMessage(`Сертификат ${selected.code} обновлен.`);
      await load();
      closeEdit();
    } catch (err) {
      setError(err.message || "Не удалось сохранить изменения.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <header className="admin-head">
        <div>
          <h1>Сертификаты</h1>
          <p className="muted">Всего: {rows.length}</p>
        </div>
      </header>

      <form
        className="admin-toolbar"
        onSubmit={(event) => {
          event.preventDefault();
          load();
        }}
      >
        <input
          className="admin-filter-input"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Поиск: код / получатель / email"
        />
        <AdminSelect value={statusFilter} onChange={(nextValue) => setStatusFilter(nextValue)} options={STATUS_OPTIONS} />
        <div />
        <button type="submit" className="btn-main small">Применить</button>
        <button
          type="button"
          className="admin-ghost-btn"
          onClick={() => {
            setStatusFilter("");
            setSearch("");
            setTimeout(() => load(), 0);
          }}
        >
          Сбросить
        </button>
      </form>

      {error ? <p className="err">{error}</p> : null}
      {message ? <p className="ok">{message}</p> : null}
      {loading ? <p className="muted">Загрузка...</p> : null}

      {!loading ? (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Код</th>
                <th>Сумма</th>
                <th>Кому / от кого</th>
                <th>Покупатель</th>
                <th>Статус</th>
                <th>Ссылка</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <strong>{row.code}</strong>
                    <p>{formatDate(row.created_at)}</p>
                  </td>
                  <td>{formatAmount(row.amount)}</td>
                  <td>
                    <p>Кому: {row.recipient_name || "-"}</p>
                    <p>От: {row.sender_hidden ? "скрыто" : (row.sender_name || "-")}</p>
                  </td>
                  <td>
                    <p>{row.buyer_name}</p>
                    <p>{row.buyer_email}</p>
                    <p>{row.buyer_phone || "-"}</p>
                  </td>
                  <td>
                    <span className={`admin-status-pill is-${row.status}`}>{row.status}</span>
                    <p>Срок: {formatValidity(row.validity_mode, row.validity_days)}</p>
                    <p>Действует до: {formatDate(row.expires_at)}</p>
                    <p>Выпуск: {formatDate(row.issued_at)}</p>
                    <p>Погашение: {formatDate(row.redeemed_at)}</p>
                  </td>
                  <td>
                    <a className="admin-link-btn" href={`/certificates/${row.code}`} target="_blank" rel="noreferrer">
                      Открыть
                    </a>
                  </td>
                  <td className="admin-actions-inline">
                    <button type="button" onClick={() => openEdit(row)}>Ред.</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {selected && draft ? (
        <div className="admin-modal" onClick={closeEdit}>
          <div className="admin-modal-panel" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="admin-modal-close" onClick={closeEdit} aria-label="Закрыть">×</button>
            <div className="admin-form">
              <h2>Сертификат {selected.code}</h2>
              <label>
                Номинал, руб.
                <input
                  type="number"
                  min={500}
                  step={100}
                  value={draft.amount}
                  onChange={(event) => setDraft((prev) => ({ ...prev, amount: event.target.value }))}
                />
              </label>
              <label>
                Кому
                <input
                  value={draft.recipient_name}
                  onChange={(event) => setDraft((prev) => ({ ...prev, recipient_name: event.target.value }))}
                />
              </label>
              <label>
                От кого
                <input
                  value={draft.sender_name}
                  onChange={(event) => setDraft((prev) => ({ ...prev, sender_name: event.target.value }))}
                  disabled={draft.sender_hidden}
                />
              </label>
              <label className="admin-checkbox-row">
                <input
                  type="checkbox"
                  checked={Boolean(draft.sender_hidden)}
                  onChange={(event) => setDraft((prev) => ({ ...prev, sender_hidden: event.target.checked }))}
                />
                <span>Скрыть отправителя в сертификате</span>
              </label>
              <label>
                Подпись / кто выпустил
                <input
                  value={draft.issued_by}
                  onChange={(event) => setDraft((prev) => ({ ...prev, issued_by: event.target.value }))}
                  placeholder="Например: Администратор Атман"
                />
              </label>
              <label>
                Статус
                <AdminSelect
                  value={draft.status}
                  onChange={(nextValue) => setDraft((prev) => ({ ...prev, status: nextValue }))}
                  options={STATUS_OPTIONS.filter((item) => item.value)}
                />
              </label>
              <label>
                Срок действия
                <AdminSelect
                  value={draft.validity_mode}
                  onChange={(nextValue) =>
                    setDraft((prev) => ({
                      ...prev,
                      validity_mode: nextValue,
                      validity_days: nextValue === "custom_days" ? prev.validity_days : ""
                    }))
                  }
                  options={VALIDITY_OPTIONS}
                />
              </label>
              {draft.validity_mode === "custom_days" ? (
                <label>
                  Срок в днях
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={draft.validity_days}
                    onChange={(event) => setDraft((prev) => ({ ...prev, validity_days: event.target.value }))}
                  />
                </label>
              ) : null}
              <label>
                Комментарий
                <textarea
                  rows={3}
                  value={draft.note}
                  onChange={(event) => setDraft((prev) => ({ ...prev, note: event.target.value }))}
                />
              </label>
              <label>
                Имя покупателя
                <input
                  value={draft.buyer_name}
                  onChange={(event) => setDraft((prev) => ({ ...prev, buyer_name: event.target.value }))}
                />
              </label>
              <label>
                Email покупателя
                <input
                  type="email"
                  value={draft.buyer_email}
                  onChange={(event) => setDraft((prev) => ({ ...prev, buyer_email: event.target.value }))}
                />
              </label>
              <label>
                Телефон покупателя
                <input
                  value={draft.buyer_phone}
                  onChange={(event) => setDraft((prev) => ({ ...prev, buyer_phone: event.target.value }))}
                />
              </label>

              <button className="btn-main" type="button" onClick={save} disabled={saving}>
                {saving ? "Сохраняем..." : "Сохранить"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

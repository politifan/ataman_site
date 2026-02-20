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

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("ru-RU");
}

function formatAmount(value) {
  return `${new Intl.NumberFormat("ru-RU").format(Number(value || 0))} руб.`;
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
      note: row.note || "",
      buyer_name: row.buyer_name || "",
      buyer_email: row.buyer_email || "",
      buyer_phone: row.buyer_phone || "",
      status: row.status || "paid",
      issued_by: row.issued_by || ""
    });
  }

  function closeEdit() {
    setSelected(null);
    setDraft(null);
  }

  async function save() {
    if (!selected || !draft) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await adminUpdateCertificate(selected.id, {
        amount: Number(draft.amount),
        recipient_name: draft.recipient_name.trim() || null,
        sender_name: draft.sender_name.trim() || null,
        note: draft.note.trim() || null,
        buyer_name: draft.buyer_name.trim(),
        buyer_email: draft.buyer_email.trim(),
        buyer_phone: draft.buyer_phone.trim() || null,
        status: draft.status,
        issued_by: draft.issued_by.trim() || null
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
                    <p>От: {row.sender_name || "-"}</p>
                  </td>
                  <td>
                    <p>{row.buyer_name}</p>
                    <p>{row.buyer_email}</p>
                    <p>{row.buyer_phone || "-"}</p>
                  </td>
                  <td>
                    <span className={`admin-status-pill is-${row.status}`}>{row.status}</span>
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
                />
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

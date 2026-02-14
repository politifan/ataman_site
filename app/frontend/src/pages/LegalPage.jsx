import { Link, useParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { getLegalPage, getLegalPages } from "../api";

export default function LegalPage() {
  const { slug } = useParams();
  const [page, setPage] = useState(null);
  const [allPages, setAllPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [current, all] = await Promise.all([getLegalPage(slug), getLegalPages()]);
        setPage(current);
        setAllPages(all);
        setError("");
      } catch (err) {
        setError(err.message || "Не удалось загрузить юридическую страницу.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [slug]);

  const paragraphs = useMemo(() => {
    const text = String(page?.content || "").trim();
    if (!text) return [];
    return text.split(/\n{2,}/).map((item) => item.trim()).filter(Boolean);
  }, [page?.content]);

  if (loading) return <div className="state-page">Загрузка...</div>;
  if (error) return <div className="state-page">Ошибка: {error}</div>;
  if (!page) return <div className="state-page">Документ не найден.</div>;

  return (
    <div className="page-common page-legal">
      <div className="container">
        <header className="page-common-head">
          <div>
            <p>Юридическая информация</p>
            <h1>{page.title}</h1>
            <span>Обновляемый документ для клиентов студии.</span>
          </div>
          <div className="page-common-actions">
            <Link className="back-link" to="/contacts">
              ← К контактам
            </Link>
          </div>
        </header>

        <section className="legal-layout">
          <article className="page-common-panel legal-content">
            {paragraphs.length ? (
              paragraphs.map((paragraph, index) => <p key={`${page.slug}-${index}`}>{paragraph}</p>)
            ) : (
              <p>{page.content}</p>
            )}
          </article>

          <aside className="page-common-panel legal-sidebar">
            <h2>Все документы</h2>
            <nav>
              {allPages.map((item) => (
                <Link key={item.slug} to={`/legal/${item.slug}`} className={item.slug === page.slug ? "is-active" : ""}>
                  {item.title}
                </Link>
              ))}
            </nav>
          </aside>
        </section>
      </div>
    </div>
  );
}

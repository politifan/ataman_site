import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { getGallery, toMediaUrl } from "../api";

const HIDDEN_MEDIA_PATHS = new Set(["foto_dlya_uslug/lila/img_6366.jpg"]);
const CATEGORY_LABELS = {
  all: "Все",
  studio: "Пространство студии",
  reference: "Референсы",
  "soundhealing-drum": "Саундхилинг с шаманским бубном",
  "gong-bowls-meditation": "Гонг-медитация с поющими чашами",
  "gong-hammocks-meditation": "Гонг-медитация в гамаках",
  "nail-standing": "Гвоздестояние",
  "chakra-path": "Чакровая дорожка",
  "leela-game": "Трансформационная игра Лила",
  "vibro-bath-gong-bowls": "Вибро-акустическая ванна (гонги и тибетские чаши)",
  "vibro-bath-crystal-bowls": "Вибро-акустическая ванна (хрустальные чаши)",
  "bila-bells-harmonization": "Гармонизация с Била-колоколами",
  "systemic-constellations": "Системные расстановки по Хеллингеру",
  "hypnosis-path-to-self": "Гипнопрактика «Путь к себе»",
  "shamanic-energy-practice": "Энергопрактика с шаманским бубном"
};

function categoryLabel(value) {
  if (!value) return "";
  if (CATEGORY_LABELS[value]) return CATEGORY_LABELS[value];
  return value.replace(/[-_]+/g, " ").trim();
}

export default function GalleryPage() {
  const [items, setItems] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedImage, setSelectedImage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        setItems(await getGallery());
      } catch (err) {
        setError(err.message || "Не удалось загрузить галерею.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    function onKey(event) {
      if (event.key === "Escape") setSelectedImage(null);
    }
    if (selectedImage) {
      window.addEventListener("keydown", onKey);
      document.body.style.overflow = "hidden";
    }
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [selectedImage]);

  const categories = useMemo(() => {
    const unique = new Set(items.map((item) => item.category).filter(Boolean));
    return ["all", ...Array.from(unique)];
  }, [items]);

  const filtered = useMemo(() => {
    const visible = items.filter((item) => !HIDDEN_MEDIA_PATHS.has(item.image_path));
    if (selectedCategory === "all") return visible;
    return visible.filter((item) => item.category === selectedCategory);
  }, [items, selectedCategory]);

  if (loading) return <div className="state-page">Загрузка...</div>;
  if (error) return <div className="state-page">Ошибка: {error}</div>;

  return (
    <div className="page-common">
      <div className="container">
        <div className="page-common-head">
          <Link className="back-link" to="/">
            ← На главную
          </Link>
          <h1>Галерея</h1>
          <p>Фото и визуальные материалы студии.</p>
        </div>

        <div className="gallery-filters">
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              className={selectedCategory === category ? "is-active" : ""}
              onClick={() => setSelectedCategory(category)}
            >
              {categoryLabel(category)}
            </button>
          ))}
        </div>

        <section className="gallery-grid-page">
          {filtered.map((item) => (
            <article key={item.id} className="gallery-grid-item-page">
              <button type="button" onClick={() => setSelectedImage(item)} aria-label="Открыть изображение">
                <img src={toMediaUrl(item.image_path)} alt={item.title} loading="lazy" />
              </button>
              <div>
                <h3>{item.title}</h3>
                {item.description ? <p>{item.description}</p> : null}
              </div>
            </article>
          ))}
        </section>
      </div>

      {selectedImage ? (
        <div className="service-lightbox" role="dialog" aria-modal="true" onClick={() => setSelectedImage(null)}>
          <div className="service-lightbox-panel" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="service-lightbox-close"
              onClick={() => setSelectedImage(null)}
              aria-label="Закрыть"
            >
              ×
            </button>
            <img src={toMediaUrl(selectedImage.image_path)} alt={selectedImage.title} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

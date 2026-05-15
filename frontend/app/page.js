import Link from "next/link";

const features = [
  {
    title: "Dạy số",
    text: "Nhận diện số từ 1 đến 10 với hình ảnh vui nhộn và đếm đồ vật.",
    href: "/dashboard/numbers",
  },
  {
    title: "Dạy chữ",
    text: "Làm quen bảng chữ cái qua thẻ chữ lớn, màu sắc tươi sáng và ví dụ dễ nhớ.",
    href: "/dashboard/letters",
  },
  {
    title: "Dạy hình vẽ",
    text: "Phân biệt hình tròn, hình vuông, tam giác và các hình cơ bản khác.",
    href: "/dashboard/shapes",
  },
];

export default function HomePage() {
  return (
    <main className="landing">
      <section className="hero">
        <div className="hero-copy">
          <span className="badge">KidLearn</span>
          <h1>Học vui mỗi ngày cho bé</h1>
          <p>
            Trang web học tập thân thiện, giúp bé làm quen với số, chữ và hình
            qua giao diện rực rỡ, dễ dùng.
          </p>
          <div className="hero-actions">
            <Link className="btn primary" href="/register">
              Tạo tài khoản
            </Link>
            <Link className="btn secondary" href="/login">
              Đăng nhập
            </Link>
          </div>
        </div>
        <div className="hero-illustration">
          <div className="floating-card number-card">1 2 3</div>
          <div className="floating-card letter-card">A B C</div>
          <div className="floating-card shape-card">◯ △ □</div>
        </div>
      </section>

      <section className="feature-grid">
        {features.map((feature) => (
          <article className="feature-card" key={feature.title}>
            <h2>{feature.title}</h2>
            <p>{feature.text}</p>
          </article>
        ))}
      </section>
    </main>
  );
}


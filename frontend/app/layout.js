import "./globals.css";

export const metadata = {
  title: "KidLearn",
  description: "Trang web học số, học chữ và học hình cho bé",
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}


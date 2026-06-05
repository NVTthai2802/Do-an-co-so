import AuthForm from "../../components/AuthForm";

export default function LoginPage({ searchParams }) {
  return <AuthForm mode="login" resetSuccess={searchParams?.reset === "success"} />;
}


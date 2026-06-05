import ResetPasswordForm from "../../components/ResetPasswordForm";

export default function ResetPasswordPage({ searchParams }) {
  return <ResetPasswordForm token={searchParams?.token || ""} />;
}

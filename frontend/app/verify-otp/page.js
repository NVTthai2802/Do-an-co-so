import VerifyOtpForm from "../../components/VerifyOtpForm";

export default function VerifyOtpPage({ searchParams }) {
  return (
    <VerifyOtpForm
      initialVerification={{
        token: searchParams?.token || "",
        email: searchParams?.email || "",
        code: searchParams?.code || "",
        resendAfterSeconds: Number(searchParams?.resend_after_seconds || "60"),
        otpExpiresInSeconds: Number(searchParams?.otp_expires_in_seconds || "600"),
      }}
    />
  );
}

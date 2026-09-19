import { BrandMark } from "@/shared";
import { LoginForm } from "@/features/auth";

export default function LoginPage() {
  return (
    <div className="bg-grain flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-md items-center px-5 py-6 sm:px-8">
        <BrandMark />
      </header>
      <main className="mx-auto flex w-full max-w-md grow flex-col justify-center px-5 pb-16 sm:px-8">
        <LoginForm />
      </main>
    </div>
  );
}

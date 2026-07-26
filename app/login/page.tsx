import { redirect } from "next/navigation";

type LoginRedirectProps = {
  searchParams: Promise<{
    next?: string | string[];
    error?: string | string[];
    auth_error?: string | string[];
  }>;
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function safeNextPath(value: string | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return null;
  }

  return value;
}

export default async function LoginRedirect({
  searchParams,
}: LoginRedirectProps) {
  const supplied = await searchParams;

  const nextPath = safeNextPath(firstValue(supplied.next));
  const error =
    firstValue(supplied.auth_error) ||
    firstValue(supplied.error);

  const destination = new URLSearchParams();

  if (nextPath) {
    destination.set("next", nextPath);
  }

  if (error) {
    destination.set("auth_error", error);
  }

  const query = destination.toString();

  redirect(query ? `/?${query}` : "/");
}
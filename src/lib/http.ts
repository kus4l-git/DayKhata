import { NextResponse } from "next/server";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function forbidden() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export function tooManyRequests(resetAt?: number) {
  const headers: HeadersInit = {};
  if (resetAt) headers["Retry-After"] = String(Math.ceil((resetAt - Date.now()) / 1000));
  return NextResponse.json({ error: "Too many requests" }, { status: 429, headers });
}

export function serverError() {
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

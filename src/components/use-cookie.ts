"use client";

import { useSyncExternalStore } from "react";

// The server sets these cookies as Secure in production, and browsers won't let
// a non-Secure write replace a Secure cookie.
const secure = () => (location.protocol === "https:" ? "; secure" : "");

// An empty value deletes the cookie.
export function writeCookie(name: string, value: string, maxAge: number) {
  document.cookie = value
    ? `${name}=${value}; path=/; max-age=${maxAge}; samesite=lax${secure()}`
    : `${name}=; path=/; max-age=0${secure()}`;
}

function readCookie(name: string) {
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match?.[1] ?? "";
}

// One stable subscribe function per event, so useSyncExternalStore doesn't
// resubscribe on every render.
const subscribers = new Map<string, (onChange: () => void) => () => void>();

function subscribeTo(event: string) {
  let subscribe = subscribers.get(event);
  if (!subscribe) {
    subscribe = (onChange) => {
      window.addEventListener(event, onChange);
      // Another tab may have changed the cookie.
      window.addEventListener("focus", onChange);
      return () => {
        window.removeEventListener(event, onChange);
        window.removeEventListener("focus", onChange);
      };
    };
    subscribers.set(event, subscribe);
  }
  return subscribe;
}

// The raw cookie value, re-read whenever `event` fires or the window regains
// focus. Returns a string so snapshots compare by value; prerendered HTML sees "".
export function useCookie(name: string, event: string) {
  return useSyncExternalStore(subscribeTo(event), () => readCookie(name), () => "");
}

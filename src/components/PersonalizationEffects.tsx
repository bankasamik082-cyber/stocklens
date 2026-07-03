"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import type { UserProfile } from "@/lib/profile";

function apply(profile: UserProfile) {
  // Beginner mode: metric tooltips rendered prominently (see globals.css)
  if (profile.experience_level) {
    document.body.setAttribute("data-exp", profile.experience_level.toLowerCase());
  } else {
    document.body.removeAttribute("data-exp");
  }
  // Advanced mode defaults to compact density — only if the user has never
  // chosen a density themselves.
  try {
    if (profile.experience_level === "Advanced" && !localStorage.getItem("sl-density")) {
      document.body.setAttribute("data-density", "compact");
    }
  } catch {}
}

// Fetches the user profile once per session, caches it for the navbar avatar,
// and applies experience-level personalization to <body>.
export function PersonalizationEffects() {
  const pathname = usePathname();
  const isAuthedArea = !["/", "/login"].includes(pathname);

  useEffect(() => {
    if (!isAuthedArea) return;

    // Apply instantly from cache, then refresh from the server
    try {
      const cached = localStorage.getItem("sl-profile");
      if (cached) apply(JSON.parse(cached) as UserProfile);
    } catch {}

    let cancelled = false;
    fetch("/api/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d?.profile) return;
        try {
          localStorage.setItem("sl-profile", JSON.stringify(d.profile));
          window.dispatchEvent(new Event("sl-profile-updated"));
        } catch {}
        apply(d.profile as UserProfile);
      })
      .catch(() => {});

    const onUpdate = () => {
      try {
        const cached = localStorage.getItem("sl-profile");
        if (cached) apply(JSON.parse(cached) as UserProfile);
      } catch {}
    };
    window.addEventListener("sl-profile-updated", onUpdate);
    return () => {
      cancelled = true;
      window.removeEventListener("sl-profile-updated", onUpdate);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthedArea]);

  return null;
}

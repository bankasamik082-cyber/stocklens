"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";

export type AnimationSpeed = "fast" | "normal" | "reduced";
export type DataDensity = "compact" | "comfortable" | "spacious";

interface Prefs {
  animationSpeed: AnimationSpeed;
  dataDensity: DataDensity;
  setAnimationSpeed: (v: AnimationSpeed) => void;
  setDataDensity: (v: DataDensity) => void;
}

const PreferencesContext = createContext<Prefs>({
  animationSpeed: "normal",
  dataDensity: "comfortable",
  setAnimationSpeed: () => {},
  setDataDensity: () => {},
});

function applyToBody(anim: AnimationSpeed, density: DataDensity) {
  document.body.setAttribute("data-anim", anim);
  document.body.setAttribute("data-density", density);
}

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [animationSpeed, setAnimSpeed] = useState<AnimationSpeed>("normal");
  const [dataDensity, setDensity] = useState<DataDensity>("comfortable");

  useEffect(() => {
    try {
      const anim = localStorage.getItem("sl-anim") as AnimationSpeed | null;
      const density = localStorage.getItem("sl-density") as DataDensity | null;
      const a = anim && ["fast", "normal", "reduced"].includes(anim) ? anim : "normal";
      const d = density && ["compact", "comfortable", "spacious"].includes(density) ? density : "comfortable";
      setAnimSpeed(a);
      setDensity(d);
      applyToBody(a, d);
    } catch {}
  }, []);

  const setAnimationSpeed = useCallback((v: AnimationSpeed) => {
    setAnimSpeed(v);
    try { localStorage.setItem("sl-anim", v); } catch {}
    applyToBody(v, (document.body.getAttribute("data-density") as DataDensity) || "comfortable");
  }, []);

  const setDataDensity = useCallback((v: DataDensity) => {
    setDensity(v);
    try { localStorage.setItem("sl-density", v); } catch {}
    applyToBody((document.body.getAttribute("data-anim") as AnimationSpeed) || "normal", v);
  }, []);

  return (
    <PreferencesContext.Provider
      value={{ animationSpeed, dataDensity, setAnimationSpeed, setDataDensity }}
    >
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  return useContext(PreferencesContext);
}

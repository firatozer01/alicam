"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

/**
 * prefers-reduced-motion.
 *
 * useSyncExternalStore ile okunuyor: useState + useEffect ikilisi hem
 * react-hooks/set-state-in-effect kuralina takiliyor hem de sunucuda
 * matchMedia olmadigi icin ilk cizimde yanlis deger veriyor. Sunucu
 * anlik gorusu her zaman false: HTML hareketli surumle uretilir,
 * tarayici baglandiginda kendi degerine gecer.
 */
const MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeMotion(onChange: () => void): () => void {
  const media = window.matchMedia(MOTION_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function readMotion(): boolean {
  return window.matchMedia(MOTION_QUERY).matches;
}

function serverMotion(): boolean {
  return false;
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribeMotion, readMotion, serverMotion);
}

/**
 * Bir medya sorgusunun su anki durumu. Akis kaç sütun cizecegini bundan
 * bulur: yarim satir kalmasin diye kart sayisi sütun sayisina bolunur.
 */
function makeMediaStore(query: string) {
  return {
    subscribe(onChange: () => void) {
      const media = window.matchMedia(query);
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    read() {
      return window.matchMedia(query).matches;
    },
  };
}

const PHONE = makeMediaStore("(max-width: 600px)");
const TABLET = makeMediaStore("(max-width: 900px)");
const LAPTOP = makeMediaStore("(max-width: 1280px)");

function serverFalse(): boolean {
  return false;
}

/** Akis kart izgarasindaki sütun sayisi; marketplace.module.css ile ayni esikler. */
export function useFeedColumns(): number {
  const phone = useSyncExternalStore(PHONE.subscribe, PHONE.read, serverFalse);
  const tablet = useSyncExternalStore(TABLET.subscribe, TABLET.read, serverFalse);
  const laptop = useSyncExternalStore(LAPTOP.subscribe, LAPTOP.read, serverFalse);

  if (phone) return 1;
  if (tablet) return 2;
  if (laptop) return 3;
  return 4;
}

/** Telefonda kategori kutulari akordeon olur. */
export function useIsPhone(): boolean {
  return useSyncExternalStore(PHONE.subscribe, PHONE.read, serverFalse);
}

/**
 * Ekrana girdiginde bir kez tetiklenen gozlemci.
 *
 * Donen ref'i izlenecek ogeye baglamak yeterli; deger yalnizca
 * gorunurluge girdiginde true olur ve bir daha degismez.
 */
export function useInView<T extends HTMLElement>(enabled = true): [(node: T | null) => void, boolean] {
  const [seen, setSeen] = useState(false);
  const observer = useRef<IntersectionObserver | null>(null);

  useEffect(() => () => { observer.current?.disconnect(); }, []);

  const ref = useCallback((node: T | null) => {
    observer.current?.disconnect();
    observer.current = null;

    if (!node) return;
    if (!enabled || typeof IntersectionObserver === "undefined") return;

    const io = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      setSeen(true);
      io.disconnect();
    }, { threshold: 0.15, rootMargin: "0px 0px -40px 0px" });

    io.observe(node);
    observer.current = io;
  }, [enabled]);

  return [ref, seen || !enabled];
}

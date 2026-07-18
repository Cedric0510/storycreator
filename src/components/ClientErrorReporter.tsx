"use client";

import { useEffect } from "react";

import { installClientErrorReporter } from "@/lib/clientErrorReporter";

/** Installe le rapporteur d'erreurs navigateur (actif en production reelle). */
export function ClientErrorReporter() {
  useEffect(() => {
    installClientErrorReporter();
  }, []);
  return null;
}

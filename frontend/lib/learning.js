"use client";

import { getToken } from "./auth";
import { request } from "./api";

export async function recordLearningResult(payload) {
  const token = getToken();
  if (!token) {
    return null;
  }

  try {
    return await request("/learning-results", {
      method: "POST",
      token,
      body: payload,
    });
  } catch {
    return null;
  }
}

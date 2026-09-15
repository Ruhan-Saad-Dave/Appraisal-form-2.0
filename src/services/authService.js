import { api } from "./api";
import { clearUserSession, storeUserSession } from "../auth/session";
import { refreshSchoolsOnce } from "./schoolsService";

export const login = async (email, password) => {
  const data = await api.post("/auth/login", { email, password });
  // Make sure the live schools list (incl. admin-created "dynamic" schools) is loaded BEFORE we
  // canonicalise and persist this user's school - otherwise a dynamic-school user's `school`
  // gets stored empty and their review queue / routing never matches. Non-blocking on failure.
  await refreshSchoolsOnce().catch(() => {});
  storeUserSession({ token: data.token, profile: data.profile });
  return data;
};

export const register = async (profilePayload, password) => {
  return await api.post("/auth/register", { ...profilePayload, password });
};

export const getMe = async () => {
  return await api.get("/auth/me");
};

export const updateProfile = async (payload) => {
  return await api.put("/auth/me", payload);
};

export const changePassword = async (currentPassword, newPassword) => {
  return await api.post("/auth/change-password", {
    current_password: currentPassword,
    new_password: newPassword,
  });
};

export const forgotPassword = async (email) => {
  return await api.post("/auth/forgot-password", {
    email,
    redirect_url: `${window.location.origin}/reset-password`,
  });
};

export const resetPassword = async (token, newPassword) => {
  return await api.post("/auth/reset-password", {
    token,
    new_password: newPassword,
  });
};

export const logout = () => {
  clearUserSession();
};

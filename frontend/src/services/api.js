// CreditVision — API Service Layer
const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const getToken = () => localStorage.getItem('cv_token');
const getRole  = () => localStorage.getItem('cv_role');
const getUserId = () => localStorage.getItem('cv_uid');

const headers = (extra = {}) => ({
  'Content-Type': 'application/json',
  ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
  ...extra,
});

async function req(method, path, body = null) {
  const opts = { method, headers: headers() };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  if (res.status === 401) {
    localStorage.clear();
    window.location.href = '/login';
    return;
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Request failed');
  return data;
}

// ── AUTH ──
export async function login(userId, password) {
  const form = new URLSearchParams({ username: userId, password });
  const res = await fetch(`${BASE}/api/v1/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Login failed');
  localStorage.setItem('cv_token', data.access_token);
  localStorage.setItem('cv_role',  data.role);
  localStorage.setItem('cv_uid',   data.user_id);
  localStorage.setItem('cv_name',  data.full_name);
  return data;
}

export async function logout() {
  try { await req('POST', '/api/v1/auth/logout'); } catch {}
  localStorage.clear();
}

// ── ADMIN ──
export const getAdminStats     = ()          => req('GET',  '/api/v1/admin/stats');
export const listUsers         = ()          => req('GET',  '/api/v1/admin/users');
export const createUser        = (payload)   => req('POST', '/api/v1/admin/users', payload);
export const deleteUser        = (uid)       => req('DELETE', `/api/v1/admin/users/${encodeURIComponent(uid)}`);
export const deleteApplicantAdmin = (id)     => req('DELETE', `/api/v1/admin/applicants/${id}`);
export const getAllApplicants  = ()          => req('GET',  '/api/v1/admin/applicants');
export const getActivityLogs   = (limit=100) => req('GET',  `/api/v1/admin/activity?limit=${limit}`);

// ── LENDER ──
export const scoreApplicant    = (payload)   => req('POST', '/api/v1/score', payload);
export const getApproved       = ()          => req('GET',  '/api/v1/lender/approved');
export const getLenderHistory  = (limit=200) => req('GET',  `/api/v1/lender/history?limit=${limit}`);
export const getLenderApplicant= (id)        => req('GET',  `/api/v1/lender/history/${id}`);
export const getLenderStats    = ()          => req('GET',  '/api/v1/lender/stats');
export const updateDecision    = (id, body)  => req('PATCH', `/api/v1/lender/history/${id}/decision`, body);
export const sendResultMail    = (id)        => req('POST', `/api/v1/lender/history/${id}/send-mail`);

// ── EVALUATION HELPERS ──
export const getTestData       = ()          => req('GET',  '/api/v1/test-data');
export const checkApplicantExists = (id)      => req('GET',  `/api/v1/applicants/check/${id}`);

// ── UTILS ──
export { getRole, getUserId, getToken };
export const isAuth = () => !!getToken();
export const isAdmin  = () => getRole() === 'admin';
export const isLender = () => getRole() === 'lender';

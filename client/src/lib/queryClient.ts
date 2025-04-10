import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

// Fonction pour effectuer une requête HTTP GET
export async function apiGet<T = any>(url: string): Promise<T> {
  const res = await fetch(url, {
    method: 'GET',
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res.json();
}

// Fonction pour effectuer une requête HTTP POST
export async function apiPost<T = any>(url: string, data: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res.json();
}

// Fonction pour effectuer une requête HTTP PUT
export async function apiPut<T = any>(url: string, data: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'PUT',
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res.json();
}

// Fonction pour effectuer une requête HTTP DELETE
export async function apiDelete<T = any>(url: string): Promise<T> {
  const res = await fetch(url, {
    method: 'DELETE',
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res.json();
}

// Fonction générique pour compatibilité rétroactive
export async function apiRequest<T = any>(
  urlOrMethod: string,
  urlOrData?: string | unknown,
  data?: unknown
): Promise<T> {
  // Si le premier argument est une méthode HTTP et le second une URL
  if (urlOrMethod === 'GET' && typeof urlOrData === 'string') {
    return apiGet<T>(urlOrData as string);
  } 
  else if (urlOrMethod === 'POST' && typeof urlOrData === 'string') {
    return apiPost<T>(urlOrData as string, data || {});
  }
  else if (urlOrMethod === 'PUT' && typeof urlOrData === 'string') {
    return apiPut<T>(urlOrData as string, data || {});
  }
  else if (urlOrMethod === 'DELETE' && typeof urlOrData === 'string') {
    return apiDelete<T>(urlOrData as string);
  }
  // Si le premier argument est une URL (requête GET)
  else if (typeof urlOrMethod === 'string' && !urlOrData) {
    return apiGet<T>(urlOrMethod);
  }
  // Si le premier argument est une URL et le second sont des données (requête POST)
  else if (typeof urlOrMethod === 'string' && urlOrData) {
    return apiPost<T>(urlOrMethod, urlOrData);
  }
  
  throw new Error('Invalid arguments to apiRequest');
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});

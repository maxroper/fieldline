import { useEffect } from "react";
import { useDemo } from "./demo-state";
import { apiBase, isDemo, transport } from "./transport";

/**
 * The URL a file (photo, nameplate, document) can be shown or opened from. Against a server it is the
 * `/api/files/:id` route. In the static demo the file lives in the page, so it is fetched through the
 * in-page app once and served as an object URL.
 */
const loading = new Set<string>();

async function loadDemoFile(id: string): Promise<void> {
  if (loading.has(id)) return;
  loading.add(id);
  try {
    const res = await transport(`/files/${id}`);
    if (!res.ok) return;
    const url = URL.createObjectURL(await res.blob());
    useDemo.setState((s) => ({ fileUrls: { ...s.fileUrls, [id]: url } }));
  } finally {
    loading.delete(id);
  }
}

export function useFileUrl(id: string | null | undefined): string | undefined {
  const demoUrl = useDemo((s) => (id ? s.fileUrls[id] : undefined));
  useEffect(() => {
    if (isDemo && id && !demoUrl) void loadDemoFile(id);
  }, [id, demoUrl]);
  if (!id) return undefined;
  if (!isDemo) return `${apiBase}/api/files/${id}`;
  return demoUrl;
}

import type { ReactNode } from "react";
import { useFileUrl } from "../../app/files";

/** A photo tile from the files table. Opens the full image in a new tab. */
export function FilePhoto({ id, caption, className = "" }: { id: string; caption?: string | null; className?: string }) {
  const url = useFileUrl(id);
  return (
    <a className={`photo ${className}`} href={url} target="_blank" rel="noreferrer" style={url ? { backgroundImage: `url(${url})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}>
      {caption ? <span className="cap">{caption}</span> : null}
    </a>
  );
}

/** A link to a stored file (document, nameplate photo, vendor invoice). */
export function FileLink({ id, className, children }: { id: string; className?: string; children: ReactNode }) {
  const url = useFileUrl(id);
  return (
    <a className={className} href={url} target="_blank" rel="noreferrer">
      {children}
    </a>
  );
}

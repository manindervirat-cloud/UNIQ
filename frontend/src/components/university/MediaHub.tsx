import { Camera, Home, GraduationCap, Play, Tv, Landmark, ExternalLink } from "lucide-react";
import type { University } from "@/types/api";

/**
 * External media links — a quiet link list, not a wall of buttons.
 * Everything opens in a new tab; the student's session is untouched.
 */
export function MediaHub({ university: u }: { university: University }) {
  const q = encodeURIComponent(u.name);
  const domain = (() => {
    try {
      return new URL(u.officialUrl).host;
    } catch {
      return u.officialUrl;
    }
  })();

  const links = [
    { label: "View More Photos (Google Images)", href: `https://www.google.com/search?tbm=isch&q=${q}+campus`, icon: <Camera className="h-4 w-4" aria-hidden /> },
    { label: "Watch Campus Videos (YouTube)", href: `https://www.youtube.com/results?search_query=${q}+campus+tour`, icon: <Play className="h-4 w-4" aria-hidden /> },
    { label: "Official Site Gallery", href: `https://www.google.com/search?q=site:${domain}+campus+photos+OR+gallery+OR+virtual+tour`, icon: <Landmark className="h-4 w-4" aria-hidden /> },
    { label: "Official YouTube Channel", href: `https://www.youtube.com/results?search_query=${q}&sp=EgIQAg%253D%253D`, icon: <Tv className="h-4 w-4" aria-hidden /> },
    { label: "Accommodation & Housing", href: `https://www.google.com/search?tbm=isch&q=${q}+student+accommodation+residence`, icon: <Home className="h-4 w-4" aria-hidden /> },
    { label: "Student Life & Facilities", href: `https://www.youtube.com/results?search_query=${q}+student+life+day+in+the+life`, icon: <GraduationCap className="h-4 w-4" aria-hidden /> },
  ];

  return (
    <div>
      <p className="mb-2.5 font-serif text-base font-semibold">See it for yourself</p>
      <ul className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
        {links.map((l) => (
          <li key={l.label}>
            <a
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm font-semibold text-blue-deep transition-colors hover:bg-blue-wash"
            >
              <span className="text-ink-faint group-hover:text-blue-deep">{l.icon}</span>
              {l.label}
              <ExternalLink className="ml-auto h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-60" aria-hidden />
            </a>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-ink-faint">
        External sites open separately — your shortlist here stays exactly as you left it.
      </p>
    </div>
  );
}

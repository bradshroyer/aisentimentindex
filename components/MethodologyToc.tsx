"use client";

import { useEffect, useState } from "react";

export type TocSection = { n: string; id: string; label: string };

export function MethodologyToc({ sections }: { sections: TocSection[] }) {
  const [active, setActive] = useState(sections[0]?.id);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      // Active section: the last one whose top has crossed the upper quarter
      // of the viewport; before any have, the first. At the bottom of the
      // page, the last — on tall viewports its top may never reach the line.
      const atBottom =
        window.scrollY + window.innerHeight >=
        document.documentElement.scrollHeight - 2;
      let current = sections[0]?.id;
      if (atBottom) {
        current = sections[sections.length - 1]?.id;
      } else {
        const line = window.innerHeight * 0.25;
        for (const s of sections) {
          const el = document.getElementById(s.id);
          if (el && el.getBoundingClientRect().top <= line) current = s.id;
        }
      }
      setActive(current);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [sections]);

  const jump = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    history.replaceState(null, "", `#${id}`);
  };

  return (
    <nav aria-label="On this page" className="sticky top-10">
      <ul className="space-y-3">
        {sections.map((s) => {
          const isActive = s.id === active;
          return (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                onClick={(e) => jump(e, s.id)}
                aria-current={isActive ? "true" : undefined}
                className={`flex items-baseline gap-2 whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.18em] transition-colors ${
                  isActive
                    ? "text-accent"
                    : "text-text-tertiary hover:text-text-primary"
                }`}
              >
                <span className="select-none" aria-hidden="true">
                  {s.n}
                </span>
                {s.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

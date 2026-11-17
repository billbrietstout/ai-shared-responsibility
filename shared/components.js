/**
 * AISharedResponsibility.com — shared web components
 * <site-nav current="framework"> and <site-footer>
 *
 * No shadow DOM. All styles live in shared/styles.css.
 * No build step. Loads /shared/analytics.js for GoatCounter pageviews.
 * Apache-2.0
 */

// Header labels and hrefs follow the navigation table Bill confirmed on
// November 16, 2026 (docs/plans/2026-11-16-ai-security-accountability-phase1-plan.md,
// section 13.4). Labels changed; every href is an existing URL.
const NAV_LINKS = [
  { id: "framework",      label: "AI Security Framework",   href: "/framework/" },
  { id: "threats",        label: "Threats",                 href: "/framework/security-lifecycle/" },
  { id: "controls",       label: "Security Controls",       href: "/controls/" },
  { id: "accountability", label: "Security Accountability", href: "/tools/relationship-map/" },
  { id: "architecture",   label: "Architecture",            href: "/tools/layer-matrix/" },
  { id: "industries",     label: "Industries",              href: "/industries/" },
  { id: "regulations",    label: "Regulations",             href: "/regulations/" },
  { id: "about",          label: "About",                   href: "/about/" },
];

// Links that left the header stay reachable here. Hrefs are unchanged.
const FOOTER_LINKS = [
  { label: "Personas",      href: "/personas/" },
  { label: "Assess",        href: "/assess/" },
  { label: "Compare",       href: "/compare/" },
  { label: "Data & agents", href: "/developers/" },
  { label: "Regulations",   href: "/regulations/" },
  { label: "Presentation",  href: "/presentation/unprompted-oct2026/" },
  { label: "About",         href: "/about/" },
  { label: "Changelog",     href: "/changelog/" },
  { label: "llms.txt",      href: "/llms.txt" },
  { label: "Source",        href: "https://github.com/billbrietstout/ai-shared-responsibility", external: true },
];

// Pick the one header link for this page: the longest href that prefixes the
// current path (so /framework/security-lifecycle/ marks Threats, not the
// framework overview), else the link whose id matches current="...".
function activeNavId(current) {
  const path = (typeof location !== "undefined" && location.pathname) || "";
  let best = null;
  for (const link of NAV_LINKS) {
    if (path.startsWith(link.href) && (!best || link.href.length > best.href.length)) {
      best = link;
    }
  }
  if (best) return best.id;
  const byId = NAV_LINKS.find((link) => link.id === current);
  return byId ? byId.id : "";
}

/* --------------------------------------------------------------------------
   <site-nav current="page-id">
   -------------------------------------------------------------------------- */

class SiteNav extends HTMLElement {
  connectedCallback() {
    const current = this.getAttribute("current") || "";
    const activeId = activeNavId(current);

    const links = NAV_LINKS.map((link) => {
      const isActive = link.id === activeId;
      return `<li>
        <a
          class="nav__link${isActive ? " nav__link--active" : ""}"
          href="${link.href}"
          ${isActive ? 'aria-current="page"' : ""}
        >${link.label}</a>
      </li>`;
    }).join("");

    this.innerHTML = `
      <nav class="nav" aria-label="Site navigation">
        <div class="nav__inner">
          <a class="nav__wordmark" href="/">
            <span class="nav__wordmark-dot" aria-hidden="true"></span>
            AI Shared Responsibility
          </a>
          <button
            class="nav__toggle"
            aria-expanded="false"
            aria-controls="nav-links"
            aria-label="Toggle navigation"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <rect y="3"  width="20" height="2" rx="1"/>
              <rect y="9"  width="20" height="2" rx="1"/>
              <rect y="15" width="20" height="2" rx="1"/>
            </svg>
          </button>
          <ul class="nav__links" id="nav-links" role="list">${links}</ul>
          <div class="nav__cta">
            <a class="btn btn--ghost" href="/tools/">
              Tools &amp; Explorers
            </a>
          </div>
        </div>
      </nav>
    `;

    // Mobile toggle
    const toggle = this.querySelector(".nav__toggle");
    const linksEl = this.querySelector(".nav__links");

    toggle?.addEventListener("click", () => {
      const expanded = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(!expanded));
      linksEl?.classList.toggle("nav__links--open", !expanded);
    });
  }
}

/* --------------------------------------------------------------------------
   <site-footer>
   -------------------------------------------------------------------------- */

class SiteFooter extends HTMLElement {
  connectedCallback() {
    const year = new Date().getFullYear();

    const links = FOOTER_LINKS.map((link) => {
      const external = link.external
        ? ' target="_blank" rel="noopener"'
        : "";
      return `<a href="${link.href}"${external}>${link.label}</a>`;
    }).join("");

    this.innerHTML = `
      <footer class="footer">
        <div class="footer__inner">
          <span>
            &copy; ${year} <a href="https://www.linkedin.com/in/billstout/">Bill Stout</a>. Site built with Claude Fable 5.
            Content licensed
            <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>;
            code
            <a href="/about/">Apache-2.0</a>.
          </span>
          <nav class="footer__links" aria-label="Footer navigation">
            ${links}
          </nav>
        </div>
      </footer>
    `;
  }
}

/* --------------------------------------------------------------------------
   Register
   -------------------------------------------------------------------------- */

customElements.define("site-nav", SiteNav);
customElements.define("site-footer", SiteFooter);

/* --------------------------------------------------------------------------
   Analytics (GoatCounter) — pages without this file load analytics.js directly
   -------------------------------------------------------------------------- */

(function loadAnalytics() {
  if (document.querySelector('script[data-srf-analytics]')) return;
  const s = document.createElement("script");
  s.src = "/shared/analytics.js";
  s.dataset.srfAnalytics = "1";
  document.head.appendChild(s);
})();

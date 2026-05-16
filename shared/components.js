/**
 * AISharedResponsibility.com — shared web components
 * <site-nav current="framework"> and <site-footer>
 *
 * No shadow DOM. All styles live in shared/styles.css.
 * No external dependencies. No build step.
 * Apache-2.0
 */

const NAV_LINKS = [
  { id: "framework",        label: "Framework",       href: "/framework/" },
  { id: "personas",         label: "Personas",        href: "/personas/" },
  { id: "operating-models", label: "Operating models",href: "/operating-models/" },
  { id: "tools",            label: "Tools",           href: "/tools/" },
  { id: "regulations",      label: "Regulations",     href: "/regulations/" },
  { id: "about",            label: "About",           href: "/about/" },
];

const FOOTER_LINKS = [
  { label: "Framework",        href: "/framework/" },
  { label: "Personas",         href: "/personas/" },
  { label: "Operating models", href: "/operating-models/" },
  { label: "Tools",            href: "/tools/" },
  { label: "Regulations",      href: "/regulations/" },
  { label: "About",            href: "/about/" },
  { label: "Source",           href: "https://github.com/billbrietstout/ai-shared-responsibility", external: true },
];

/* --------------------------------------------------------------------------
   <site-nav current="page-id">
   -------------------------------------------------------------------------- */

class SiteNav extends HTMLElement {
  connectedCallback() {
    const current = this.getAttribute("current") || "";

    const links = NAV_LINKS.map((link) => {
      const isActive = link.id === current;
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
              Tools
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
            &copy; ${year} The CoSAI Wizards Authors.
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

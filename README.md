# AISharedResponsibility.com

An open reference site for the [CoSAI AI Shared Responsibility Framework](https://www.coalitionforsecureai.org/) — interactive tools, layer definitions, persona guides, regulation mappings, and operating model matrices, all running as a static site with no build step and no server.

Live at **[aisharedresponsibility.com](https://aisharedresponsibility.com)**

---

## What's here

| Page | Purpose |
|------|---------|
| `/framework/` | Interactive 5-layer model with per-layer accountability detail |
| `/personas/` | The 8 CoSAI personas and their layer-by-layer responsibilities |
| `/operating-models/` | Layer × operating model responsibility matrix (IaaS, AI-PaaS, Agent-PaaS, AI-SaaS) |
| `/regulations/` | Living reference covering EU AI Act, NIST AI RMF, ISO 42001, and others, with staleness indicators |
| `/tools/` | Interactive governance tools (regulation discovery, controls assessment, policy pyramid, SRF stress test) |
| `/about/` | Project background and attribution |

---

## Running locally

No build step required. Serve the root directory with any static file server:

```bash
# Python
python3 -m http.server 8080

# Node
npx serve .

# Caddy
caddy file-server --listen :8080
```

Then open `http://localhost:8080`.

All asset paths are root-relative (`/shared/styles.css`, `/data/layers.json`) so the site works correctly from any static server pointed at the project root.

---

## Contributing

### Updating regulation references

Edit `data/regulations.json`. Update the `last_verified` date for any entry you confirm is current — this clears the staleness badge on the Regulations page. Entries older than 180 days display a visible **Verify** indicator.

### Updating framework content

Layer definitions live in `data/layers.json`. Persona definitions live in `data/personas.json`. The operating model matrix lives in `data/matrix.json`. Schemas for all three are documented in `ARCHITECTURE.md`.

### Adding a page

1. Create a directory and `index.html` (copy `about/index.html` as a starting point).
2. Add one entry to the `NAV_LINKS` array in `shared/components.js`.
3. Add the nav entry to the footer link list in `components.js`.

No other files change. See `ARCHITECTURE.md` for the full walkthrough.

### Design system

All tokens are in `shared/styles.css`. Token names are intentionally aligned with the companion `cosai-wizards` repository so both projects share a coherent visual identity.

---

## Architecture

See [`ARCHITECTURE.md`](ARCHITECTURE.md) for a full description of the directory layout, shared component system, data schemas, and hosting options.

---

## Security

See [`security-audit.md`](security-audit.md) for the most recent security review. To report a vulnerability, open an issue or email the maintainer directly.

---

## License

Licensed under the [Apache License, Version 2.0](LICENSE).

The CoSAI AI Shared Responsibility Framework content referenced and displayed by this site is a publication of the [Coalition for Secure AI (CoSAI)](https://www.coalitionforsecureai.org/). Framework text, layer definitions, and persona descriptions are reproduced here for educational and reference purposes consistent with CoSAI's open publication goals.

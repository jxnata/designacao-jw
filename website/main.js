const REPO = "jxnata/designacao-jw";
const API = `https://api.github.com/repos/${REPO}/releases/latest`;
const RELEASES_PAGE = `https://github.com/${REPO}/releases`;

const PLATFORM_RULES = {
  mac: {
    match: (name) => /\.dmg$/i.test(name),
    label: "DMG universal",
  },
  win: {
    match: (name) => /setup\.exe$/i.test(name) || /\.exe$/i.test(name),
    prefer: (name) => /setup\.exe$/i.test(name),
    label: "Instalador 64 bits",
  },
  linux: {
    match: (name) => /\.AppImage$/i.test(name) || /\.deb$/i.test(name),
    prefer: (name) => /\.AppImage$/i.test(name),
    label: "AppImage",
  },
};

function pickAsset(assets, rule) {
  const candidates = assets.filter((a) => rule.match(a.name));
  if (!candidates.length) return null;
  if (rule.prefer) {
    const preferred = candidates.find((a) => rule.prefer(a.name));
    if (preferred) return preferred;
  }
  return candidates[0];
}

function setCard(card, { href, status, ready, missing }) {
  const statusEl = card.querySelector("[data-status]");
  card.setAttribute("aria-disabled", ready ? "false" : "true");
  card.classList.toggle("is-ready", Boolean(ready));
  card.classList.toggle("is-missing", Boolean(missing));
  if (ready && href) {
    card.href = href;
    card.removeAttribute("tabindex");
  } else {
    card.href = "#";
    card.setAttribute("tabindex", "-1");
  }
  if (statusEl) statusEl.textContent = status;
}

function setMeta(text) {
  const el = document.getElementById("release-meta");
  if (el) el.textContent = text;
}

function setLead(text) {
  const el = document.getElementById("download-lead");
  if (el) el.textContent = text;
}

async function loadLatestRelease() {
  const cards = [...document.querySelectorAll(".download-card[data-platform]")];

  try {
    const res = await fetch(API, {
      headers: { Accept: "application/vnd.github+json" },
    });

    if (res.status === 404) {
      setMeta("Nenhum release público ainda.");
      setLead("Quando o primeiro release for publicado, os botões abaixo apontam para os instaladores.");
      for (const card of cards) {
        setCard(card, {
          status: "Em breve",
          missing: true,
        });
      }
      return;
    }

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const release = await res.json();
    const tag = release.tag_name || "";
    const assets = Array.isArray(release.assets) ? release.assets : [];
    const versionLabel = tag.replace(/^v/i, "");

    setMeta(versionLabel ? `Versão atual: ${versionLabel}` : "Release mais recente no GitHub");
    setLead(
      versionLabel
        ? `Instaladores da versão ${versionLabel}, publicados no GitHub Releases.`
        : "Instaladores do último release publicado no GitHub.",
    );

    for (const card of cards) {
      const platform = card.dataset.platform;
      const rule = PLATFORM_RULES[platform];
      if (!rule) continue;

      const asset = pickAsset(assets, rule);
      if (!asset?.browser_download_url) {
        setCard(card, {
          status: "Indisponível neste release",
          missing: true,
        });
        continue;
      }

      const fileEl = card.querySelector("[data-file]");
      if (fileEl) {
        fileEl.textContent = asset.name;
      }

      setCard(card, {
        href: asset.browser_download_url,
        status: versionLabel ? `Baixar v${versionLabel}` : "Baixar",
        ready: true,
      });
    }
  } catch (err) {
    console.error(err);
    setMeta("Não foi possível carregar o release agora.");
    setLead("Abra a página de releases no GitHub para baixar os instaladores.");
    for (const card of cards) {
      setCard(card, {
        href: RELEASES_PAGE,
        status: "Ver releases no GitHub",
        ready: true,
      });
      card.setAttribute("aria-disabled", "false");
      card.classList.add("is-ready");
      card.target = "_blank";
      card.rel = "noopener noreferrer";
    }
  }
}

loadLatestRelease();

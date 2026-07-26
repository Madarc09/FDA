(() => {
  const { players, skaterScoring, goalieScoring } = window.FDA_DATA;
  let currentPage = "home";
  let activeFilter = "ALL";
  let ascending = false;
  let watched = new Set(["michkov"]);
  let labPlayer = players.find(p => p.id === "crosby");

  const money = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
  const byId = id => document.getElementById(id);
  const qsAll = selector => [...document.querySelectorAll(selector)];

  function goTo(page) {
    currentPage = page;
    qsAll(".page").forEach(el => el.classList.toggle("active", el.id === `page-${page}`));
    qsAll(".nav-item").forEach(el => el.classList.toggle("active", el.dataset.page === page));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function scoreText(value) {
    const abs = Math.abs(value);
    const digits = Number.isInteger(abs) ? 0 : (abs < 1 ? 2 : 1);
    return value.toFixed(digits);
  }

  function renderStrip() {
    byId("verifiedStrip").innerHTML = players.slice(0, 4).map((p, index) => `
      <button class="strip-card panel" data-open-player="${p.id}">
        <span class="rank">0${index + 1}</span>
        <span class="small-avatar team-${p.team.toLowerCase()}">${p.initials}</span>
        <span class="strip-copy"><strong>${p.name}</strong><small>${p.team} · ${p.position} · ${p.gp} GP</small></span>
        <span class="strip-score"><strong>${p.fpg.toFixed(1)}</strong><small>FP/G</small></span>
      </button>
    `).join("");
  }

  function renderPlayers() {
    const query = byId("playerSearch").value.trim().toLowerCase();
    let list = players.filter(p => activeFilter === "ALL" || p.type === activeFilter);
    list = list.filter(p => `${p.name} ${p.team} ${p.position}`.toLowerCase().includes(query));
    list.sort((a, b) => ascending ? a.fpg - b.fpg : b.fpg - a.fpg);
    byId("playersList").innerHTML = list.length ? list.map((p, index) => `
      <article class="player-row panel">
        <button class="player-main" data-open-player="${p.id}">
          <span class="list-rank">${String(index + 1).padStart(2, "0")}</span>
          <span class="medium-avatar team-${p.team.toLowerCase()}">${p.initials}</span>
          <span class="player-row-copy"><strong>${p.name}</strong><small>${p.team} · ${p.position} · ${p.gp} GP</small><em>${p.signal}</em></span>
          <span class="player-row-score"><strong>${p.fpg.toFixed(1)}</strong><small>${p.fpts.toFixed(p.fpts % 1 ? 1 : 0)} FPTS</small></span>
        </button>
        <button class="row-watch ${watched.has(p.id) ? "active" : ""}" data-watch="${p.id}" aria-label="Watch ${p.name}">${watched.has(p.id) ? "★" : "☆"}</button>
      </article>
    `).join("") : `<div class="empty-state panel"><strong>No matching players</strong><p>Try another name, team or position filter.</p></div>`;
  }

  function renderLab() {
    const p = labPlayer;
    byId("labAvatar").textContent = p.initials;
    byId("labAvatar").className = `large-avatar team-${p.team.toLowerCase()}`;
    byId("labTeam").textContent = `${p.team} · ${p.position}`;
    byId("labName").textContent = p.name;
    byId("labSeason").textContent = `${p.gp} GP · 2025–26`;
    byId("labFpts").textContent = p.fpts.toFixed(p.fpts % 1 ? 1 : 0);
    byId("labFpg").textContent = p.fpg.toFixed(1);
    byId("labFpgExact").textContent = `${p.fpg.toFixed(3)} exact`;
    byId("labSignal").textContent = p.signal;
    byId("projectedFpg").textContent = p.projectedFpg.toFixed(1);
    byId("labWatch").classList.toggle("active", watched.has(p.id));
    byId("labWatch").textContent = watched.has(p.id) ? "★" : "☆";

    const audit = p.audit || [];
    byId("auditBadge").textContent = `${p.fpts.toFixed(p.fpts % 1 ? 1 : 0)} total`;
    byId("auditTotal").textContent = p.fpts.toFixed(2);
    byId("auditList").innerHTML = audit.length ? audit.map(([name, total, rate]) => {
      const points = total * rate;
      return `<div class="audit-row"><span><strong>${name}</strong><small>${total} × ${scoreText(rate)}</small></span><b>${money.format(points)}</b></div>`;
    }).join("") : `<div class="empty-audit"><strong>Season total is verified.</strong><p>The category-level audit will fill automatically once the full game importer is connected.</p></div>`;
  }

  function renderScoring(target, rows) {
    byId(target).innerHTML = rows.map(([name, code, value]) => `
      <div class="scoring-row"><span><strong>${name}</strong><small>${code}</small></span><b class="${value < 0 ? "negative" : ""}">${value > 0 ? "+" : ""}${scoreText(value)}</b></div>
    `).join("");
  }

  function renderSlots() {
    qsAll(".slot-dots").forEach(group => {
      const count = Number(group.dataset.count);
      const filled = Number(group.dataset.filled);
      group.innerHTML = Array.from({ length: count }, (_, i) => `<span class="${i < filled ? "filled" : ""}">${i < filled ? "✓" : "+"}</span>`).join("");
    });
  }

  function openPlayer(id) {
    const found = players.find(p => p.id === id);
    if (!found) return;
    labPlayer = found;
    renderLab();
    goTo("lab");
  }

  document.addEventListener("click", event => {
    const pageButton = event.target.closest("[data-page]");
    if (pageButton) goTo(pageButton.dataset.page);

    const playerButton = event.target.closest("[data-open-player]");
    if (playerButton) openPlayer(playerButton.dataset.openPlayer);

    const watchButton = event.target.closest("[data-watch]");
    if (watchButton) {
      const id = watchButton.dataset.watch;
      watched.has(id) ? watched.delete(id) : watched.add(id);
      renderPlayers();
      renderLab();
    }
  });

  qsAll(".filter").forEach(button => button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    qsAll(".filter").forEach(b => b.classList.toggle("active", b === button));
    renderPlayers();
  }));

  byId("playerSearch").addEventListener("input", renderPlayers);
  byId("clearSearch").addEventListener("click", () => { byId("playerSearch").value = ""; renderPlayers(); });
  byId("sortPlayers").addEventListener("click", () => {
    ascending = !ascending;
    byId("sortPlayers").textContent = ascending ? "Low → High" : "High → Low";
    renderPlayers();
  });
  byId("labWatch").addEventListener("click", () => {
    watched.has(labPlayer.id) ? watched.delete(labPlayer.id) : watched.add(labPlayer.id);
    renderLab();
    renderPlayers();
  });
  byId("resetRoster").addEventListener("click", () => {
    byId("resetRoster").textContent = "Reset done";
    setTimeout(() => byId("resetRoster").textContent = "Reset", 1100);
  });

  const infoDialog = byId("infoDialog");
  byId("openInfo").addEventListener("click", () => infoDialog.showModal());
  byId("closeInfo").addEventListener("click", () => infoDialog.close());
  infoDialog.addEventListener("click", e => { if (e.target === infoDialog) infoDialog.close(); });

  renderStrip();
  renderPlayers();
  renderLab();
  renderScoring("skaterScoring", skaterScoring);
  renderScoring("goalieScoring", goalieScoring);
  renderSlots();
})();

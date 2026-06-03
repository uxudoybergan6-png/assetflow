(function () {
  var TOKEN_KEY = "creativetools_ae_token";
  var token = localStorage.getItem(TOKEN_KEY) || "";
  var selectedAsset = null;
  var subActive = false;

  var authView = document.getElementById("auth-view");
  var mainView = document.getElementById("main-view");
  var subBadge = document.getElementById("sub-badge");
  var assetGrid = document.getElementById("asset-grid");
  var footer = document.getElementById("footer");
  var errorEl = document.getElementById("error");

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.classList.remove("hidden");
  }

  function clearError() {
    errorEl.classList.add("hidden");
  }

  function setSubBadge(status, active) {
    subBadge.textContent = status || "—";
    subBadge.className = "badge " + (active ? "ok" : "warn");
  }

  function renderAssets(items) {
    assetGrid.innerHTML = "";
    items.forEach(function (a) {
      var card = document.createElement("div");
      card.className = "card";
      card.innerHTML =
        '<div class="thumb">' +
        (a.thumbnailUrl
          ? '<img src="' + a.thumbnailUrl + '" />'
          : "<span>" + a.type.slice(0, 3) + "</span>") +
        "</div>" +
        '<p class="title">' +
        a.title +
        "</p>" +
        '<p class="meta">' +
        a.category +
        "</p>";
      card.onclick = function () {
        selectedAsset = a;
        document.getElementById("selected-title").textContent = a.title;
        footer.classList.remove("hidden");
        document.querySelectorAll(".card").forEach(function (c) {
          c.classList.remove("selected");
        });
        card.classList.add("selected");
      };
      assetGrid.appendChild(card);
    });
  }

  async function refresh() {
    if (!token) return;
    clearError();
    try {
      var sub = await checkSubscription(token);
      subActive = sub.active;
      setSubBadge(sub.status, sub.active);

      var search = document.getElementById("search").value;
      var category = document.getElementById("category").value;
      var list = await listAssets(token, {
        search: search || undefined,
        category: category || undefined,
      });
      renderAssets(list.items);
    } catch (e) {
      showError(e.message || "Load failed");
    }
  }

  function showMain() {
    authView.classList.add("hidden");
    mainView.classList.remove("hidden");
    refresh();
  }

  document.getElementById("connect-btn").onclick = function () {
    token = document.getElementById("token-input").value.trim();
    if (!token) return;
    localStorage.setItem(TOKEN_KEY, token);
    showMain();
  };

  document.getElementById("refresh-btn").onclick = refresh;

  document.getElementById("download-btn").onclick = async function () {
    if (!selectedAsset) return;
    if (!subActive) {
      showError("Active subscription required");
      return;
    }
    try {
      var result = await downloadAsset(token, selectedAsset.id);
      if (typeof CSInterface !== "undefined") {
        var cs = new CSInterface();
        cs.openURLInDefaultBrowser(result.downloadUrl);
      } else {
        window.open(result.downloadUrl, "_blank");
      }
    } catch (e) {
      showError(e.message || "Download failed");
    }
  };

  if (token) showMain();
})();

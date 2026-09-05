/* =========================================================
   KAISOUL HUB NEWS
   app.js
   Frontend application logic
   ========================================================= */

"use strict";

/* =========================================================
   GLOBAL STATE
   ========================================================= */

const KHN = {
  storage: {
    theme: "khn_theme",
    fontSize: "khn_font_size",
    saved: "khn_saved_articles",
    history: "khn_reading_history",
    followed: "khn_followed_topics"
  },

  state: {
    theme: "system",
    fontSize: "medium",
    sidebarOpen: false,
    currentModal: null,
    searchOpen: false
  }
};


/* =========================================================
   SAFE DOM HELPERS
   ========================================================= */

const $ = (selector, parent = document) => {
  try {
    return parent.querySelector(selector);
  } catch {
    return null;
  }
};

const $$ = (selector, parent = document) => {
  try {
    return [...parent.querySelectorAll(selector)];
  } catch {
    return [];
  }
};

function on(selector, event, handler) {
  const element = $(selector);

  if (element) {
    element.addEventListener(event, handler);
  }
}

function show(element) {
  if (!element) return;

  element.hidden = false;
  element.removeAttribute("hidden");
}

function hide(element) {
  if (!element) return;

  element.hidden = true;
  element.setAttribute("hidden", "");
}


/* =========================================================
   STORAGE
   ========================================================= */

function storageGet(key, fallback = null) {
  try {
    const value = localStorage.getItem(key);

    if (value === null) {
      return fallback;
    }

    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  } catch {
    return fallback;
  }
}

function storageSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function storageRemove(key) {
  try {
    localStorage.removeItem(key);
  } catch {}
}


/* =========================================================
   TOAST
   ========================================================= */

function createToastContainer() {
  let container = $("#khn-toast-container");

  if (container) {
    return container;
  }

  container = document.createElement("div");
  container.id = "khn-toast-container";
  container.setAttribute("aria-live", "polite");
  container.style.position = "fixed";
  container.style.left = "50%";
  container.style.bottom = "90px";
  container.style.transform = "translateX(-50%)";
  container.style.zIndex = "99999";
  container.style.display = "flex";
  container.style.flexDirection = "column";
  container.style.alignItems = "center";
  container.style.gap = "8px";
  container.style.pointerEvents = "none";

  document.body.appendChild(container);

  return container;
}

function toast(message, type = "info") {
  if (!message) return;

  const container = createToastContainer();

  const item = document.createElement("div");

  item.className = `khn-toast khn-toast-${type}`;
  item.textContent = message;

  item.style.maxWidth = "90vw";
  item.style.padding = "11px 16px";
  item.style.borderRadius = "12px";
  item.style.background = "var(--surface, #111827)";
  item.style.color = "var(--text, #fff)";
  item.style.border = "1px solid var(--border, rgba(255,255,255,.12))";
  item.style.boxShadow = "0 10px 30px rgba(0,0,0,.18)";
  item.style.fontSize = "14px";
  item.style.opacity = "0";
  item.style.transform = "translateY(10px)";
  item.style.transition = "opacity .2s ease, transform .2s ease";
  item.style.pointerEvents = "auto";

  container.appendChild(item);

  requestAnimationFrame(() => {
    item.style.opacity = "1";
    item.style.transform = "translateY(0)";
  });

  setTimeout(() => {
    item.style.opacity = "0";
    item.style.transform = "translateY(10px)";

    setTimeout(() => {
      item.remove();
    }, 250);
  }, 2800);
}


/* =========================================================
   THEME
   ========================================================= */

function loadTheme() {
  const saved = storageGet(KHN.storage.theme, "system");

  if (
    saved !== "light" &&
    saved !== "dark" &&
    saved !== "system"
  ) {
    KHN.state.theme = "system";
  } else {
    KHN.state.theme = saved;
  }

  applyTheme(KHN.state.theme);
}

function applyTheme(theme) {
  KHN.state.theme = theme;

  const root = document.documentElement;

  root.dataset.theme = theme;

  if (theme === "dark") {
    root.classList.add("dark");
    root.style.colorScheme = "dark";
  } else if (theme === "light") {
    root.classList.remove("dark");
    root.style.colorScheme = "light";
  } else {
    root.classList.remove("dark");
    root.style.colorScheme = "light dark";
  }

  storageSet(KHN.storage.theme, theme);

  $$(".theme-option, [data-theme-option]").forEach(button => {
    const value =
      button.dataset.themeOption ||
      button.dataset.theme ||
      "";

    button.classList.toggle(
      "active",
      value === theme
    );

    button.setAttribute(
      "aria-pressed",
      value === theme ? "true" : "false"
    );
  });
}

function initTheme() {
  loadTheme();

  $$("[data-theme]").forEach(button => {
    button.addEventListener("click", () => {
      const theme = button.dataset.theme;

      if (
        theme === "light" ||
        theme === "dark" ||
        theme === "system"
      ) {
        applyTheme(theme);
        toast(`Đã chuyển giao diện: ${theme}`);
      }
    });
  });

  $$("[data-theme-option]").forEach(button => {
    button.addEventListener("click", () => {
      const theme = button.dataset.themeOption;

      if (
        theme === "light" ||
        theme === "dark" ||
        theme === "system"
      ) {
        applyTheme(theme);
        toast("Đã cập nhật giao diện");
      }
    });
  });
}


/* =========================================================
   FONT SIZE
   ========================================================= */

function loadFontSize() {
  const saved = storageGet(
    KHN.storage.fontSize,
    "medium"
  );

  if (
    saved !== "small" &&
    saved !== "medium" &&
    saved !== "large"
  ) {
    KHN.state.fontSize = "medium";
  } else {
    KHN.state.fontSize = saved;
  }

  applyFontSize(KHN.state.fontSize);
}

function applyFontSize(size) {
  KHN.state.fontSize = size;

  const root = document.documentElement;

  root.dataset.fontSize = size;

  root.classList.remove(
    "font-small",
    "font-medium",
    "font-large"
  );

  root.classList.add(`font-${size}`);

  storageSet(KHN.storage.fontSize, size);

  $$("[data-font-size]").forEach(button => {
    const value = button.dataset.fontSize;

    button.classList.toggle(
      "active",
      value === size
    );

    button.setAttribute(
      "aria-pressed",
      value === size ? "true" : "false"
    );
  });
}

function initFontSize() {
  loadFontSize();

  $$("[data-font-size]").forEach(button => {
    button.addEventListener("click", () => {
      const size = button.dataset.fontSize;

      if (
        size === "small" ||
        size === "medium" ||
        size === "large"
      ) {
        applyFontSize(size);
      }
    });
  });
}


/* =========================================================
   SIDEBAR
   ========================================================= */

function openSidebar() {
  const sidebar = $(
    "#sidebar, .sidebar, [data-sidebar]"
  );

  const overlay = $(
    "#sidebar-overlay, .sidebar-overlay, [data-sidebar-overlay]"
  );

  KHN.state.sidebarOpen = true;

  if (sidebar) {
    sidebar.classList.add("open", "active");
    sidebar.setAttribute("aria-hidden", "false");
  }

  if (overlay) {
    overlay.classList.add("show", "active");
    show(overlay);
  }

  document.body.classList.add("sidebar-open");
}

function closeSidebar() {
  const sidebar = $(
    "#sidebar, .sidebar, [data-sidebar]"
  );

  const overlay = $(
    "#sidebar-overlay, .sidebar-overlay, [data-sidebar-overlay]"
  );

  KHN.state.sidebarOpen = false;

  if (sidebar) {
    sidebar.classList.remove("open", "active");
    sidebar.setAttribute("aria-hidden", "true");
  }

  if (overlay) {
    overlay.classList.remove("show", "active");
    hide(overlay);
  }

  document.body.classList.remove("sidebar-open");
}

function toggleSidebar() {
  if (KHN.state.sidebarOpen) {
    closeSidebar();
  } else {
    openSidebar();
  }
}

function initSidebar() {
  $$(
    "#menu-btn, #menuButton, .menu-btn, [data-menu]"
  ).forEach(button => {
    button.addEventListener("click", toggleSidebar);
  });

  $$(
    "#sidebar-close, .sidebar-close, [data-sidebar-close]"
  ).forEach(button => {
    button.addEventListener("click", closeSidebar);
  });

  const overlay = $(
    "#sidebar-overlay, .sidebar-overlay, [data-sidebar-overlay]"
  );

  if (overlay) {
    overlay.addEventListener("click", closeSidebar);
  }

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && KHN.state.sidebarOpen) {
      closeSidebar();
    }
  });
}


/* =========================================================
   SEARCH
   ========================================================= */

function initSearch() {
  const searchInput = $(
    "#searchInput, #search-input, [data-search-input]"
  );

  const searchButton = $(
    "#searchButton, #search-btn, [data-search-button]"
  );

  const searchForm = $(
    "#searchForm, #search-form, form[data-search]"
  );

  if (searchForm) {
    searchForm.addEventListener("submit", event => {
      event.preventDefault();
      performSearch();
    });
  }

  if (searchButton) {
    searchButton.addEventListener("click", performSearch);
  }

  if (searchInput) {
    searchInput.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        event.preventDefault();
        performSearch();
      }
    });

    searchInput.addEventListener("input", () => {
      KHN.state.searchOpen =
        searchInput.value.trim().length > 0;
    });
  }
}

function performSearch() {
  const input = $(
    "#searchInput, #search-input, [data-search-input]"
  );

  if (!input) return;

  const keyword = input.value.trim();

  if (!keyword) {
    toast("Nhập từ khóa cần tìm");
    input.focus();
    return;
  }

  const url =
    `search.html?q=${encodeURIComponent(keyword)}`;

  /*
   * Nếu search.html chưa được tạo,
   * chỉ thông báo thay vì chuyển sang trang trắng.
   */
  if (
    document.querySelector(
      'a[href="search.html"]'
    )
  ) {
    window.location.href = url;
    return;
  }

  toast(`Đang tìm kiếm: ${keyword}`);

  /*
   * MVP:
   * lọc trực tiếp các bài viết đang có trên trang.
   */
  filterCurrentArticles(keyword);
}

function filterCurrentArticles(keyword) {
  const normalized = keyword.toLowerCase();

  const cards = $$(
    ".news-card, .article-card, [data-article]"
  );

  if (!cards.length) {
    return;
  }

  let found = 0;

  cards.forEach(card => {
    const text =
      card.textContent.toLowerCase();

    const matched =
      text.includes(normalized);

    card.style.display =
      matched ? "" : "none";

    if (matched) {
      found++;
    }
  });

  toast(
    found
      ? `Tìm thấy ${found} bài viết`
      : "Không tìm thấy bài viết phù hợp"
  );
}


/* =========================================================
   MODALS
   ========================================================= */

function closeAllModals() {
  $$(
    ".modal, .modal-overlay, [data-modal]"
  ).forEach(modal => {
    modal.classList.remove(
      "open",
      "active",
      "show"
    );
  });

  document.body.classList.remove("modal-open");

  KHN.state.currentModal = null;
}

function openModal(target) {
  let modal = null;

  if (typeof target === "string") {
    modal =
      $(target) ||
      $(`[data-modal="${target}"]`);
  } else {
    modal = target;
  }

  if (!modal) return;

  closeAllModals();

  modal.classList.add(
    "open",
    "active",
    "show"
  );

  show(modal);

  document.body.classList.add("modal-open");

  KHN.state.currentModal =
    modal.id || modal.dataset.modal || null;

  const focusable = $(
    "button, input, textarea, select, a[href]",
    modal
  );

  if (focusable) {
    setTimeout(() => {
      try {
        focusable.focus();
      } catch {}
    }, 50);
  }
}

function initModals() {
  $$(
    "[data-open-modal]"
  ).forEach(button => {
    button.addEventListener("click", () => {
      openModal(
        button.dataset.openModal
      );
    });
  });

  $$(
    ".modal-close, [data-close-modal]"
  ).forEach(button => {
    button.addEventListener("click", () => {
      closeAllModals();
    });
  });

  $$(".modal").forEach(modal => {
    modal.addEventListener("click", event => {
      if (
        event.target === modal ||
        event.target.classList.contains("modal-overlay")
      ) {
        closeAllModals();
      }
    });
  });

  document.addEventListener("keydown", event => {
    if (
      event.key === "Escape" &&
      KHN.state.currentModal
    ) {
      closeAllModals();
    }
  });
}


/* =========================================================
   NOTIFICATION MODAL
   ========================================================= */

function openNotificationModal() {
  const modal =
    $("#notificationModal") ||
    $("#notificationsModal") ||
    $("[data-modal='notifications']");

  if (modal) {
    openModal(modal);
    return;
  }

  toast("Bạn chưa có thông báo mới");
}

function initNotifications() {
  $$(
    "#notificationButton, #notification-btn, .notification-btn, [data-notifications]"
  ).forEach(button => {
    button.addEventListener(
      "click",
      openNotificationModal
    );
  });
}


/* =========================================================
   PROFILE
   ========================================================= */

function openProfileModal() {
  const modal =
    $("#profileModal") ||
    $("[data-modal='profile']");

  if (modal) {
    openModal(modal);
    return;
  }

  window.location.href = "login.html";
}

function initProfile() {
  $$(
    "#profileButton, #profile-btn, .profile-btn, [data-profile]"
  ).forEach(button => {
    button.addEventListener(
      "click",
      openProfileModal
    );
  });
}


/* =========================================================
   SAVE ARTICLES
   ========================================================= */

function getSavedArticles() {
  const saved = storageGet(
    KHN.storage.saved,
    []
  );

  return Array.isArray(saved)
    ? saved
    : [];
}

function saveArticle(articleId) {
  if (!articleId) return;

  const saved = getSavedArticles();

  if (!saved.includes(articleId)) {
    saved.push(articleId);
    storageSet(
      KHN.storage.saved,
      saved
    );

    toast("Đã lưu bài viết");
  } else {
    const updated =
      saved.filter(id => id !== articleId);

    storageSet(
      KHN.storage.saved,
      updated
    );

    toast("Đã bỏ lưu bài viết");
  }

  updateSaveButtons();
}

function updateSaveButtons() {
  const saved = getSavedArticles();

  $$(
    "[data-save-article]"
  ).forEach(button => {
    const id =
      button.dataset.saveArticle;

    const active =
      saved.includes(id);

    button.classList.toggle(
      "active",
      active
    );

    button.setAttribute(
      "aria-pressed",
      active ? "true" : "false"
    );

    const label =
      active
        ? "Bỏ lưu bài viết"
        : "Lưu bài viết";

    button.setAttribute(
      "aria-label",
      label
    );

    const text =
      $(".save-text", button);

    if (text) {
      text.textContent =
        active ? "Đã lưu" : "Lưu";
    }
  });
}

function initSaveArticles() {
  $$(
    "[data-save-article]"
  ).forEach(button => {
    button.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();

      saveArticle(
        button.dataset.saveArticle
      );
    });
  });

  updateSaveButtons();
}


/* =========================================================
   READING HISTORY
   ========================================================= */

function addReadingHistory(articleId) {
  if (!articleId) return;

  let history = storageGet(
    KHN.storage.history,
    []
  );

  if (!Array.isArray(history)) {
    history = [];
  }

  history =
    history.filter(id => id !== articleId);

  history.unshift(articleId);

  history =
    history.slice(0, 100);

  storageSet(
    KHN.storage.history,
    history
  );
}

function initReadingHistory() {
  $$(
    "[data-article-id]"
  ).forEach(element => {
    element.addEventListener("click", () => {
      addReadingHistory(
        element.dataset.articleId
      );
    });
  });
}


/* =========================================================
   FOLLOW TOPICS
   ========================================================= */

function getFollowedTopics() {
  const topics = storageGet(
    KHN.storage.followed,
    []
  );

  return Array.isArray(topics)
    ? topics
    : [];
}

function toggleFollowTopic(topic) {
  if (!topic) return;

  let topics =
    getFollowedTopics();

  if (topics.includes(topic)) {
    topics =
      topics.filter(item => item !== topic);

    toast(`Đã bỏ theo dõi ${topic}`);
  } else {
    topics.push(topic);

    toast(`Đã theo dõi ${topic}`);
  }

  storageSet(
    KHN.storage.followed,
    topics
  );

  updateFollowButtons();
}

function updateFollowButtons() {
  const topics =
    getFollowedTopics();

  $$(
    "[data-follow-topic]"
  ).forEach(button => {
    const topic =
      button.dataset.followTopic;

    const active =
      topics.includes(topic);

    button.classList.toggle(
      "active",
      active
    );

    button.setAttribute(
      "aria-pressed",
      active ? "true" : "false"
    );

    const text =
      $(".follow-text", button);

    if (text) {
      text.textContent =
        active
          ? "Đang theo dõi"
          : "Theo dõi";
    }
  });
}

function initFollowTopics() {
  $$(
    "[data-follow-topic]"
  ).forEach(button => {
    button.addEventListener("click", event => {
      event.preventDefault();

      toggleFollowTopic(
        button.dataset.followTopic
      );
    });
  });

  updateFollowButtons();
}


/* =========================================================
   SHARE
   ========================================================= */

async function shareArticle(data = {}) {
  const title =
    data.title ||
    document.title ||
    "KAISOUL HUB NEWS";

  const url =
    data.url ||
    window.location.href;

  if (
    navigator.share &&
    typeof navigator.share === "function"
  ) {
    try {
      await navigator.share({
        title,
        url
      });

      return;
    } catch (error) {
      if (error?.name === "AbortError") {
        return;
      }
    }
  }

  try {
    await navigator.clipboard.writeText(url);

    toast("Đã sao chép liên kết");
  } catch {
    toast("Không thể sao chép liên kết");
  }
}

function initShare() {
  $$(
    "[data-share]"
  ).forEach(button => {
    button.addEventListener("click", event => {
      event.preventDefault();

      const title =
        button.dataset.shareTitle ||
        document.title;

      const url =
        button.dataset.shareUrl ||
        window.location.href;

      shareArticle({
        title,
        url
      });
    });
  });
}


/* =========================================================
   BOTTOM NAVIGATION
   ========================================================= */

function initBottomNavigation() {
  const buttons = $$(
    ".bottom-nav a, .bottom-nav button, [data-bottom-nav]"
  );

  buttons.forEach(button => {
    button.addEventListener("click", () => {
      buttons.forEach(item => {
        item.classList.remove("active");
      });

      button.classList.add("active");
    });
  });
}


/* ==============================

"use strict";

/*
 * KAISOUL HUB NEWS
 * Admin Frontend Controller
 *
 * Không lưu mật khẩu.
 * Không chứa API key.
 * Quyền thực tế phải được kiểm tra lại ở backend.
 */

(() => {
  const state = {
    me: null,
    currentSection: "dashboard"
  };

  const $ = (selector, root = document) =>
    root.querySelector(selector);

  const $$ = (selector, root = document) =>
    [...root.querySelectorAll(selector)];

  /* =========================================================
     ELEMENTS
     ========================================================= */

  const sidebar = $("#adminSidebar");
  const overlay = $("#adminOverlay");
  const menuBtn = $("#adminMenuBtn");
  const toast = $("#adminToast");
  const topTitle = $("#adminTopTitle");
  const userName = $("#adminUserName");
  const userRole = $("#adminUserRole");
  const logoutBtn = $("#adminLogoutBtn");
  const viewSiteBtn = $("#viewSiteBtn");

  /* =========================================================
     SECTION TITLES
     ========================================================= */

  const sectionTitles = {
    dashboard: "Dashboard",
    articles: "Articles",
    breaking: "Breaking News",
    live: "Live News",
    categories: "Categories",
    media: "Media",
    sources: "Sources",
    users: "Users",
    moderation: "Moderation",
    notifications: "Notifications",
    analytics: "Analytics",
    homepage: "Homepage",
    revisions: "Revisions",
    audit: "Audit Log",
    settings: "Settings"
  };

  /* =========================================================
     TOAST
     ========================================================= */

  let toastTimer = null;

  function showToast(message) {
    if (!toast) return;

    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
      toast.classList.remove("show");
    }, 2800);
  }

  /* =========================================================
     SIDEBAR
     ========================================================= */

  function openSidebar() {
    sidebar?.classList.add("open");
    overlay?.classList.add("show");
  }

  function closeSidebar() {
    sidebar?.classList.remove("open");
    overlay?.classList.remove("show");
  }

  menuBtn?.addEventListener("click", () => {
    if (sidebar?.classList.contains("open")) {
      closeSidebar();
    } else {
      openSidebar();
    }
  });

  overlay?.addEventListener("click", closeSidebar);

  /* =========================================================
     NAVIGATION
     ========================================================= */

  function showSection(sectionName) {
    const section = document.querySelector(
      `#section-${sectionName}`
    );

    if (!section) {
      showToast("Không tìm thấy khu vực quản trị.");
      return;
    }

    state.currentSection = sectionName;

    $$(".admin-section").forEach((item) => {
      item.classList.remove("active");
    });

    section.classList.add("active");

    $$(".admin-nav-item").forEach((item) => {
      item.classList.remove("active");
    });

    const activeNav = $(
      `.admin-nav-item[data-section="${sectionName}"]`
    );

    activeNav?.classList.add("active");

    if (topTitle) {
      topTitle.textContent =
        sectionTitles[sectionName] || "KAISOUL HUB NEWS";
    }

    closeSidebar();

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });

    history.replaceState(
      null,
      "",
      `#${sectionName}`
    );
  }

  $$(".admin-nav-item").forEach((button) => {
    button.addEventListener("click", () => {
      const section = button.dataset.section;

      if (section) {
        showSection(section);
      }
    });
  });

  $$(".admin-quick[data-section-target]").forEach((button) => {
    button.addEventListener("click", () => {
      showSection(button.dataset.sectionTarget);
    });
  });

  /* =========================================================
     HASH NAVIGATION
     ========================================================= */

  function loadHashSection() {
    const hash = window.location.hash.replace("#", "").trim();

    if (
      hash &&
      Object.prototype.hasOwnProperty.call(
        sectionTitles,
        hash
      )
    ) {
      showSection(hash);
    } else {
      showSection("dashboard");
    }
  }

  window.addEventListener("hashchange", loadHashSection);

  /* =========================================================
     API REQUEST
     ========================================================= */

  async function apiRequest(url, options = {}) {
    const config = {
      credentials: "include",
      ...options,
      headers: {
        Accept: "application/json",
        ...(options.headers || {})
      }
    };

    if (
      config.body &&
      typeof config.body !== "string"
    ) {
      config.headers["Content-Type"] =
        "application/json";

      config.body = JSON.stringify(config.body);
    }

    const response = await fetch(url, config);

    let data = null;

    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      const error = new Error(
        data?.message ||
        data?.error ||
        `HTTP ${response.status}`
      );

      error.status = response.status;
      error.data = data;

      throw error;
    }

    return data;
  }

  /* =========================================================
     AUTHENTICATION
     ========================================================= */

  async function getCurrentUser() {
    try {
      const data = await apiRequest(
        "/api/auth/me"
      );

      if (!data?.authenticated) {
        redirectToLogin();
        return null;
      }

      return data.user || null;

    } catch (error) {
      console.error(
        "Không thể kiểm tra phiên đăng nhập:",
        error
      );

      if (
        error.status === 401 ||
        error.status === 403
      ) {
        redirectToLogin();
        return null;
      }

      /*
       * Nếu server chưa chạy hoặc API lỗi,
       * không giả mạo quyền Admin.
       */
      showAccessError(
        "Không thể xác minh phiên đăng nhập với máy chủ."
      );

      return null;
    }
  }

  function hasAdminAccess(user) {
    if (!user) return false;

    const role = String(
      user.role || ""
    ).toUpperCase();

    return [
      "ADMIN",
      "SUPER_ADMIN"
    ].includes(role);
  }

  function redirectToLogin() {
    window.location.href = "login.html";
  }

  function showAccessError(message) {
    const main = document.querySelector(".admin-main");

    if (!main) return;

    const existing =
      document.querySelector(
        "#adminAccessError"
      );

    if (existing) {
      existing.remove();
    }

    const box =
      document.createElement("div");

    box.id = "adminAccessError";

    box.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 9999;
      display: grid;
      place-items: center;
      padding: 20px;
      background: #f5f7fb;
    `;

    box.innerHTML = `
      <div style="
        width:min(420px,100%);
        background:#fff;
        border:1px solid #e5e7eb;
        border-radius:18px;
        padding:28px;
        text-align:center;
        box-shadow:0 20px 60px rgba(0,0,0,.12);
      ">
        <div style="
          width:54px;
          height:54px;
          margin:0 auto 14px;
          border-radius:15px;
          display:grid;
          place-items:center;
          background:#fee2e2;
          color:#b91c1c;
          font-weight:900;
          font-size:20px;
        ">
          !
        </div>

        <h2 style="
          margin:0 0 8px;
          font-size:19px;
          color:#111827;
        ">
          Không thể truy cập Admin
        </h2>

        <p style="
          margin:0 0 18px;
          color:#6b7280;
          font-size:13px;
          line-height:1.6;
        ">
          ${escapeHTML(message)}
        </p>

        <button
          id="accessErrorLogin"
          style="
            border:0;
            background:#2563eb;
            color:#fff;
            border-radius:10px;
            padding:11px 18px;
            font-weight:700;
            cursor:pointer;
          "
        >
          Đăng nhập
        </button>
      </div>
    `;

    document.body.appendChild(box);

    $("#accessErrorLogin")?.addEventListener(
      "click",
      redirectToLogin
    );
  }

  /* =========================================================
     USER INFO
     ========================================================= */

  function renderUser(user) {
    state.me = user;

    if (!user) return;

    const name =
      user.name ||
      user.displayName ||
      user.kaisoulId ||
      "Administrator";

    const role =
      String(
        user.role || "USER"
      ).toUpperCase();

    if (userName) {
      userName.textContent = name;
    }

    if (userRole) {
      userRole.textContent = role;
    }
  }

  /* =========================================================
     LOGOUT
     ========================================================= */

  async function logout() {
    if (!logoutBtn) return;

    logoutBtn.disabled = true;

    try {
      await apiRequest(
        "/api/auth/logout",
        {
          method: "POST"
        }
      );

      window.location.href =
        "login.html";

    } catch (error) {
      console.error(
        "Logout error:",
        error
      );

      showToast(
        "Không thể đăng xuất. Vui lòng thử lại."
      );

      logoutBtn.disabled = false;
    }
  }

  logoutBtn?.addEventListener(
    "click",
    logout
  );

  /* =========================================================
     VIEW SITE
     ========================================================= */

  viewSiteBtn?.addEventListener(
    "click",
    () => {
      window.location.href =
        "index.html";
    }
  );

  /* =========================================================
     CREATE ARTICLE
     ========================================================= */

  function openCreateArticle() {
    showSection("articles");

    showToast(
      "Khu vực tạo bài viết đã sẵn sàng."
    );

    /*
     * Editor thực tế sẽ được nối ở phiên bản
     * Articles API tiếp theo.
     */
  }

  $$('[data-action="create-article"]').forEach(
    (button) => {
      button.addEventListener(
        "click",
        openCreateArticle
      );
    }
  );

  /* =========================================================
     REFRESH
     ========================================================= */

  $$('[data-action="refresh"]').forEach(
    (button) => {
      button.addEventListener(
        "click",
        () => {
          showToast(
            "Đang làm mới dữ liệu..."
          );

          setTimeout(() => {
            window.location.reload();
          }, 350);
        }
      );
    }
  );

  /* =========================================================
     FILTERS
     ========================================================= */

  $$(".admin-filter").forEach(
    (button) => {
      button.addEventListener(
        "click",
        () => {

          const parent =
            button.closest(
              ".admin-filter-row"
            );

          parent
            ?.querySelectorAll(
              ".admin-filter"
            )
            .forEach((item) => {
              item.classList.remove(
                "active"
              );
            });

          button.classList.add(
            "active"
          );
        }
      );
    }
  );

  /* =========================================================
     ARTICLE SEARCH
     ========================================================= */

  const articleSearch =
    $("#articleSearch");

  articleSearch?.addEventListener(
    "input",
    () => {

      const query =
        articleSearch.value
          .trim()
          .toLowerCase();

      const rows =
        $$("#articlesTable tr");

      rows.forEach((row) => {

        const text =
          row.textContent
            .toLowerCase();

        row.style.display =
          !query ||
          text.includes(query)
            ? ""
            : "none";
      });
    }
  );

  /* =========================================================
     NOTIFICATION FORM
     ========================================================= */

  const notificationForm =
    $("#notificationForm");

  notificationForm?.addEventListener(
    "submit",
    (event) => {

      event.preventDefault();

      showToast(
        "Thông báo sẽ được gửi sau khi kết nối Notification API."
      );
    }
  );

  /* =========================================================
     BUTTON HANDLER
     ========================================================= */

  document.addEventListener(
    "click",
    (event) => {

      const button =
        event.target.closest(
          ".admin-btn"
        );

      if (!button) return;

      const text =
        button.textContent
          .trim()
          .toLowerCase();

      /*
       * Chỉ hiển thị phản hồi UI.
       * Các thao tác thật sẽ được API xử lý
       * ở backend trong bước tiếp theo.
       */

      if (
        text === "duyệt" ||
        text === "approve"
      ) {
        showToast(
          "Đã ghi nhận thao tác duyệt."
        );
      }

      if (
        text === "từ chối" ||
        text === "reject"
      ) {
        showToast(
          "Đã ghi nhận thao tác từ chối."
        );
      }

      if (
        text === "gỡ breaking"
      ) {
        showToast(
          "Thao tác gỡ Breaking cần API xác nhận."
        );
      }

      if (
        text === "lưu thay đổi"
      ) {
        showToast(
          "Thay đổi sẽ được lưu sau khi kết nối API."
        );
      }

      if (
        text === "upload"
      ) {
        showToast(
          "Media uploader sẽ được kết nối ở bước Media API."
        );
      }

      if (
        text === "kiểm tra"
      ) {
        showToast(
          "Source verification API chưa được kết nối."
        );
      }

      if (
        text === "backup"
      ) {
        showToast(
          "Backup chỉ được thực hiện bởi backend."
        );
      }

      if (
        text === "clear cache"
      ) {
        showToast(
          "Cache management cần backend."
        );
      }

      if (
        text === "health check"
      ) {
        healthCheck();
      }
    }
  );

  /* =========================================================
     HEALTH CHECK
     ========================================================= */

  async function healthCheck() {

    try {

      const response =
        await fetch(
          "/api/health",
          {
            credentials: "include"
          }
        );

      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status}`
        );
      }

      const data =
        await response.json();

      showToast(
        data?.status === "ok"
          ? "Server đang hoạt động."
          : "Server phản hồi bất thường."
      );

    } catch (error) {

      console.error(
        "Health check:",
        error
      );

      showToast(
        "Không thể kết nối server."
      );
    }
  }

  /* =========================================================
     ESCAPE HTML
     ========================================================= */

  function escapeHTML(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  /* =========================================================
     GLOBAL ERROR HANDLER
     ========================================================= */

  window.addEventListener(
    "error",
    (event) => {

      console.error(
        "Admin frontend error:",
        event.error || event.message
      );

      showToast(
        "Đã xảy ra lỗi giao diện Admin."
      );
    }
  );

  window.addEventListener(
    "unhandledrejection",
    (event) => {

      console.error(
        "Unhandled admin promise:",
        event.reason
      );

      showToast(
        "Đã xảy ra lỗi khi xử lý yêu cầu."
      );
    }
  );

  /* =========================================================
     INIT
     ========================================================= */

  async function init() {

    /*
     * Không cho phép frontend tự quyết định quyền.
     * Luôn hỏi backend trước.
     */

    const user =
      await getCurrentUser();

    if (!user) return;

    if (!hasAdminAccess(user)) {

      showAccessError(
        "Tài khoản hiện tại không có quyền truy cập khu vực quản trị."
      );

      return;
    }

    renderUser(user);

    loadHashSection();

    console.log(
      "KAISOUL HUB NEWS Admin initialized."
    );
  }

  init();

  /* =========================================================
     PUBLIC API
     ========================================================= */

  window.KAISOUL_ADMIN = {
    state,
    showSection,
    showToast,
    healthCheck,
    logout
  };

})();

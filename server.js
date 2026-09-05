"use strict";

/*
=========================================================
 KAISOUL HUB NEWS
 server.js
 Backend API
=========================================================

 Chức năng hiện tại:
 - Express server
 - Security headers
 - Rate limit đăng nhập
 - POST /api/auth/login
 - GET /api/auth/me
 - POST /api/auth/logout
 - Health check
 - Serve frontend
 - HttpOnly session cookie

 QUAN TRỌNG:
 - Không lưu mật khẩu trong frontend.
 - Không hardcode KAISOUL ID / password.
 - Không lưu password vào localStorage.
 - Production cần kết nối API xác thực KAISOUL ID thật.
=========================================================
*/

require("dotenv").config();

const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const crypto = require("crypto");
const path = require("path");


/* =========================================================
   APP
========================================================= */

const app = express();

const PORT =
  Number(process.env.PORT) || 3000;

const HOST =
  process.env.HOST || "0.0.0.0";

const NODE_ENV =
  process.env.NODE_ENV || "development";

const IS_PRODUCTION =
  NODE_ENV === "production";


/* =========================================================
   BASIC SECURITY
========================================================= */

app.disable("x-powered-by");

app.set(
  "trust proxy",
  1
);

app.use(
  helmet({
    contentSecurityPolicy: false
  })
);

app.use(
  express.json({
    limit: "100kb"
  })
);

app.use(
  express.urlencoded({
    extended: false,
    limit: "100kb"
  })
);


/* =========================================================
   CORS
========================================================= */

const allowedOrigin =
  process.env.ALLOWED_ORIGIN || "";

app.use((req, res, next) => {
  const origin =
    req.headers.origin;

  if (
    allowedOrigin &&
    origin === allowedOrigin
  ) {
    res.setHeader(
      "Access-Control-Allow-Origin",
      origin
    );

    res.setHeader(
      "Access-Control-Allow-Credentials",
      "true"
    );
  }

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,POST,PUT,PATCH,DELETE,OPTIONS"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});


/* =========================================================
   SESSION STORAGE
=========================================================

 MVP session store.

 IMPORTANT:
 This is memory-only.
 Restarting server logs everyone out.

 Production:
 Use Redis/database/session service.
========================================================= */

const sessions =
  new Map();


/* =========================================================
   LOGIN RATE LIMIT
========================================================= */

const loginLimiter =
  rateLimit({
    windowMs:
      15 * 60 * 1000,

    limit: 10,

    standardHeaders: true,

    legacyHeaders: false,

    message: {
      success: false,
      message:
        "Quá nhiều lần đăng nhập. Vui lòng thử lại sau."
    }
  });


/* =========================================================
   COOKIE HELPERS
========================================================= */

const SESSION_COOKIE =
  "khn_session";


function cookieOptions() {
  return [
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    `Max-Age=${7 * 24 * 60 * 60}`,
    IS_PRODUCTION
      ? "Secure"
      : ""
  ]
    .filter(Boolean)
    .join("; ");
}


function clearCookieOptions() {
  return [
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    "Max-Age=0",
    IS_PRODUCTION
      ? "Secure"
      : ""
  ]
    .filter(Boolean)
    .join("; ");
}


function getSessionId(req) {
  const cookieHeader =
    req.headers.cookie;

  if (!cookieHeader) {
    return null;
  }

  const cookies =
    cookieHeader
      .split(";")
      .map(item => item.trim());

  for (const cookie of cookies) {
    const separator =
      cookie.indexOf("=");

    if (separator === -1) {
      continue;
    }

    const name =
      cookie.slice(
        0,
        separator
      );

    const value =
      cookie.slice(
        separator + 1
      );

    if (
      name === SESSION_COOKIE
    ) {
      return decodeURIComponent(
        value
      );
    }
  }

  return null;
}


/* =========================================================
   SESSION FUNCTIONS
========================================================= */

function createSession(user) {
  const sessionId =
    crypto.randomBytes(32)
      .toString("hex");

  const session = {
    id: sessionId,

    user: {
      kaisoulId:
        user.kaisoulId,

      displayName:
        user.displayName ||
        user.kaisoulId,

      role:
        user.role || "USER"
    },

    createdAt:
      Date.now(),

    expiresAt:
      Date.now() +
      7 * 24 * 60 * 60 * 1000
  };

  sessions.set(
    sessionId,
    session
  );

  return session;
}


function destroySession(sessionId) {
  if (!sessionId) {
    return;
  }

  sessions.delete(
    sessionId
  );
}


function getSession(req) {
  const sessionId =
    getSessionId(req);

  if (!sessionId) {
    return null;
  }

  const session =
    sessions.get(sessionId);

  if (!session) {
    return null;
  }

  if (
    Date.now() >
    session.expiresAt
  ) {
    sessions.delete(
      sessionId
    );

    return null;
  }

  return session;
}


/* =========================================================
   AUTH PROVIDER
=========================================================

 KAISOUL HUB NEWS should NOT store a second
 KAISOUL ID password database.

 The correct production flow is:

 HUB NEWS
    ↓
 KAISOUL ID authentication API
    ↓
 success / failure
    ↓
 HUB NEWS session

 Set:

 KAISOUL_ID_AUTH_URL=https://your-auth-api/...

 in .env

========================================================= */

async function authenticateWithKaisoulID(
  kaisoulId,
  password
) {
  const authUrl =
    process.env.KAISOUL_ID_AUTH_URL;

  /*
   * Không có auth URL:
   * Không cho đăng nhập giả.
   */
  if (!authUrl) {
    return {
      success: false,

      configurationError: true,

      message:
        "KAISOUL ID authentication API chưa được cấu hình."
    };
  }

  try {
    const controller =
      new AbortController();

    const timeout =
      setTimeout(
        () => controller.abort(),
        10000
      );

    const response =
      await fetch(
        authUrl,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            "Accept":
              "application/json"
          },

          body: JSON.stringify({
            kaisoulId,
            password
          }),

          signal:
            controller.signal
        }
      );

    clearTimeout(timeout);

    let data = null;

    try {
      data =
        await response.json();
    } catch {
      data = null;
    }

    /*
     * Authentication provider phải trả:
     *
     * {
     *   success: true,
     *   user: {
     *     kaisoulId: "...",
     *     displayName: "...",
     *     role: "USER"
     *   }
     * }
     */

    if (!response.ok) {
      return {
        success: false,

        message:
          data?.message ||
          "KAISOUL ID hoặc mật khẩu không chính xác."
      };
    }

    if (
      data?.success !== true
    ) {
      return {
        success: false,

        message:
          data?.message ||
          "KAISOUL ID hoặc mật khẩu không chính xác."
      };
    }

    if (
      !data?.user?.kaisoulId
    ) {
      return {
        success: false,

        message:
          "Dữ liệu xác thực KAISOUL ID không hợp lệ."
      };
    }

    return {
      success: true,

      user: {
        kaisoulId:
          data.user.kaisoulId,

        displayName:
          data.user.displayName ||
          data.user.kaisoulId,

        role:
          data.user.role ||
          "USER"
      }
    };

  } catch (error) {
    console.error(
      "KAISOUL ID authentication error:",
      error
    );

    return {
      success: false,

      serverError: true,

      message:
        "Không thể kết nối hệ thống KAISOUL ID."
    };
  }
}


/* =========================================================
   HEALTH CHECK
========================================================= */

app.get(
  "/api/health",
  (req, res) => {
    res.json({
      success: true,

      service:
        "KAISOUL HUB NEWS",

      status:
        "online",

      environment:
        NODE_ENV,

      time:
        new Date().toISOString()
    });
  }
);


/* =========================================================
   LOGIN
========================================================= */

app.post(
  "/api/auth/login",
  loginLimiter,

  async (req, res) => {
    try {
      const {
        kaisoulId,
        password
      } = req.body || {};

      /*
       * Basic validation
       */

      if (
        typeof kaisoulId !== "string" ||
        typeof password !== "string"
      ) {
        return res.status(400).json({
          success: false,

          message:
            "Thông tin đăng nhập không hợp lệ."
        });
      }

      const cleanId =
        kaisoulId.trim();

      if (!cleanId) {
        return res.status(400).json({
          success: false,

          message:
            "Vui lòng nhập KAISOUL ID."
        });
      }

      if (!password) {
        return res.status(400).json({
          success: false,

          message:
            "Vui lòng nhập mật khẩu."
        });
      }

      /*
       * Không log password.
       */

      console.log(
        `[AUTH] Login attempt: ${cleanId}`
      );

      /*
       * Authenticate against KAISOUL ID.
       */

      const authResult =
        await authenticateWithKaisoulID(
          cleanId,
          password
        );

      if (
        !authResult.success
      ) {
        /*
         * Configuration/server errors
         * get a different HTTP status.
         */

        if (
          authResult.configurationError
        ) {
          return res.status(503).json({
            success: false,

            message:
              "Hệ thống đăng nhập chưa được cấu hình."
          });
        }

        if (
          authResult.serverError
        ) {
          return res.status(502).json({
            success: false,

            message:
              authResult.message
          });
        }

        /*
         * Authentication failure.
         *
         * Do not reveal whether the ID
         * or password was the wrong field.
         */

        return res.status(401).json({
          success: false,

          message:
            "KAISOUL ID hoặc mật khẩu không chính xác."
        });
      }

      /*
       * Create HUB NEWS session.
       */

      const session =
        createSession(
          authResult.user
        );

      res.setHeader(
        "Set-Cookie",
        `${SESSION_COOKIE}=${encodeURIComponent(session.id)}; ${cookieOptions()}`
      );

      return res.json({
        success: true,

        message:
          "Đăng nhập thành công.",

        user: {
          kaisoulId:
            session.user.kaisoulId,

          displayName:
            session.user.displayName,

          role:
            session.user.role
        }
      });

    } catch (error) {
      console.error(
        "Login route error:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          "Lỗi máy chủ. Vui lòng thử lại."
      });
    }
  }
);


/* =========================================================
   CURRENT USER
========================================================= */

app.get(
  "/api/auth/me",
  (req, res) => {
    const session =
      getSession(req);

    if (!session) {
      return res.status(401).json({
        success: false,

        authenticated: false,

        message:
          "Chưa đăng nhập."
      });
    }

    return res.json({
      success: true,

      authenticated: true,

      user: {
        kaisoulId:
          session.user.kaisoulId,

        displayName:
          session.user.displayName,

        role:
          session.user.role
      }
    });
  }
);


/* =========================================================
   LOGOUT
========================================================= */

app.post(
  "/api/auth/logout",
  (req, res) => {
    const sessionId =
      getSessionId(req);

    destroySession(
      sessionId
    );

    res.setHeader(
      "Set-Cookie",
      `${SESSION_COOKIE}=; ${clearCookieOptions()}`
    );

    return res.json({
      success: true,

      message:
        "Đã đăng xuất."
    });
  }
);


/* =========================================================
   AUTH MIDDLEWARE
========================================================= */

function requireAuth(
  req,
  res,
  next
) {
  const session =
    getSession(req);

  if (!session) {
    return res.status(401).json({
      success: false,

      message:
        "Bạn cần đăng nhập."
    });
  }

  req.user =
    session.user;

  req.session =
    session;

  next();
}


/* =========================================================
   EXAMPLE PROTECTED API
========================================================= */

app.get(
  "/api/account",
  requireAuth,

  (req, res) => {
    res.json({
      success: true,

      user: req.user
    });
  }
);


/* =========================================================
   ADMIN MIDDLEWARE
========================================================= */

const ADMIN_ROLES = new Set([
  "ADMIN",
  "SUPER_ADMIN"
]);


function requireAdmin(
  req,
  res,
  next
) {
  if (
    !req.user ||
    !ADMIN_ROLES.has(
      req.user.role
    )
  ) {
    return res.status(403).json({
      success: false,

      message:
        "Bạn không có quyền truy cập."
    });
  }

  next();
}


/* =========================================================
   EXAMPLE ADMIN API
========================================================= */

app.get(
  "/api/admin/dashboard",
  requireAuth,
  requireAdmin,

  (req, res) => {
    res.json({
      success: true,

      message:
        "Admin API đang hoạt động.",

      user: req.user
    });
  }
);


/* =========================================================
   STATIC FRONTEND
========================================================= */

const publicPath =
  path.join(
    __dirname
  );

app.use(
  express.static(
    publicPath,
    {
      index: "index.html",

      extensions: [
        "html"
      ]
    }
  )
);


/* =========================================================
   PAGE ROUTES
========================================================= */

app.get(
  "/",
  (req, res) => {
    res.sendFile(
      path.join(
        publicPath,
        "index.html"
      )
    );
  }
);

app.get(
  "/login",
  (req, res) => {
    res.sendFile(
      path.join(
        publicPath,
        "login.html"
      )
    );
  }
);


/* =========================================================
   404 API
========================================================= */

app.use(
  "/api",
  (req, res) => {
    res.status(404).json({
      success: false,

      message:
        "API endpoint không tồn tại."
    });
  }
);


/* =========================================================
   404 PAGE
========================================================= */

app.use(
  (req, res) => {
    res.status(404).send(`
      <!DOCTYPE html>
      <html lang="vi">
      <head>
        <meta charset="UTF-8">
        <meta
          name="viewport"
          content="width=device-width,initial-scale=1"
        >
        <title>404 — KAISOUL HUB NEWS</title>
        <style>
          body{
            margin:0;
            min-height:100vh;
            display:grid;
            place-items:center;
            font-family:system-ui,sans-serif;
            background:#0b0d10;
            color:#fff;
            padding:24px;
            box-sizing:border-box;
          }

          main{
            width:min(100%,500px);
            text-align:center;
          }

          h1{
            font-size:64px;
            margin:0;
          }

          a{
            display:inline-block;
            margin-top:20px;
            padding:12px 18px;
            border-radius:10px;
            background:#fff;
            color:#111;
            text-decoration:none;
          }
        </style>
      </head>

      <body>
        <main>
          <h1>404</h1>
          <p>
            Trang bạn tìm kiếm không tồn tại.
          </p>

          <a href="/">
            Về trang chủ
          </a>
        </main>
      </body>
      </html>
    `);
  }
);


/* =========================================================
   GLOBAL ERROR HANDLER
========================================================= */

app.use(
  (
    error,
    req,
    res,
    next
  ) => {
    console.error(
      "Unhandled server error:",
      error
    );

    if (
      res.headersSent
    ) {
      return next(error);
    }

    return res.status(500).json({
      success: false,

      message:
        "Lỗi máy chủ."
    });
  }
);


/* =========================================================
   CLEANUP EXPIRED SESSIONS
========================================================= */

setInterval(
  () => {
    const now =
      Date.now();

    for (
      const [
        sessionId,
        session
      ] of sessions
    ) {
      if (
        now >
        session.expiresAt
      ) {
        sessions.delete(
          sessionId
        );
      }
    }
  },

  60 * 60 * 1000
);


/* =========================================================
   START SERVER
========================================================= */

app.listen(
  PORT,
  HOST,
  () => {
    console.log(
      "=========================================="
    );

    console.log(
      " KAISOUL HUB NEWS"
    );

    console.log(
      " Server: http://localhost:" +
      PORT
    );

    console.log(
      " Environment: " +
      NODE_ENV
    );

    console.log(
      " KAISOUL ID Auth: " +
      (
        process.env.KAISOUL_ID_AUTH_URL
          ? "CONFIGURED"
          : "NOT CONFIGURED"
      )
    );

    console.log(
      "=========================================="
    );
  }
);
